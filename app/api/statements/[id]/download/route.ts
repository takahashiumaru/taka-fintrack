import * as fs from "fs/promises";
import type { RowDataPacket } from "mysql2";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { ensureSchema, getPool } from "@/lib/server/db";
import { apiError } from "@/lib/server/http";
import { generateMonthlyStatement } from "@/lib/server/monthly-statements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StatementFileRow = RowDataPacket & {
  id: number;
  period_year: number;
  period_month: number;
  file_name: string;
  file_path: string;
};

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const user = await getAuthenticatedUser(request);
  if (!user) return apiError("Sesi tidak valid. Login ulang.", 401);
  const statementId = Number(params.id);
  if (!Number.isFinite(statementId) || statementId <= 0) return apiError("Statement tidak valid.", 400);

  await ensureSchema();
  const [rows] = await getPool().execute<StatementFileRow[]>(
    "SELECT id, period_year, period_month, file_name, file_path FROM monthly_statements WHERE id = ? AND user_id = ? LIMIT 1",
    [statementId, user.id],
  );
  const statement = rows[0];
  if (!statement) return apiError("Statement tidak ditemukan.", 404);

  let file: Buffer;
  let fileName = statement.file_name;

  try {
    file = await fs.readFile(statement.file_path);
  } catch (error: unknown) {
    if (!isMissingFileError(error)) throw error;

    await generateMonthlyStatement(user.id, Number(statement.period_year), Number(statement.period_month), false);
    const [refreshedRows] = await getPool().execute<StatementFileRow[]>(
      "SELECT id, period_year, period_month, file_name, file_path FROM monthly_statements WHERE id = ? AND user_id = ? LIMIT 1",
      [statementId, user.id],
    );
    const refreshedStatement = refreshedRows[0];
    if (!refreshedStatement) return apiError("Statement tidak ditemukan.", 404);

    file = await fs.readFile(refreshedStatement.file_path);
    fileName = refreshedStatement.file_name;
  }

  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName.replace(/"/g, "")}"`,
      "Content-Length": String(file.length),
      "Cache-Control": "private, no-store",
    },
  });
}

function isMissingFileError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

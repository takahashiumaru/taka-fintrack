import * as fs from "fs/promises";
import type { RowDataPacket } from "mysql2";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { ensureSchema, getPool } from "@/lib/server/db";
import { apiError } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StatementFileRow = RowDataPacket & { id: number; file_name: string; file_path: string };

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const user = await getAuthenticatedUser(request);
  if (!user) return apiError("Sesi tidak valid. Login ulang.", 401);
  const statementId = Number(params.id);
  if (!Number.isFinite(statementId) || statementId <= 0) return apiError("Statement tidak valid.", 400);

  await ensureSchema();
  const [rows] = await getPool().execute<StatementFileRow[]>(
    "SELECT id, file_name, file_path FROM monthly_statements WHERE id = ? AND user_id = ? LIMIT 1",
    [statementId, user.id],
  );
  const statement = rows[0];
  if (!statement) return apiError("Statement tidak ditemukan.", 404);

  const file = await fs.readFile(statement.file_path);
  return new Response(new Uint8Array(file), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=\"${statement.file_name.replace(/\"/g, "")}\"`,
      "Cache-Control": "private, no-store",
    },
  });
}

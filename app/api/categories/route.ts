import type { ResultSetHeader } from "mysql2";
import { NextResponse } from "next/server";
import { getAuthenticatedUser, normalizeString } from "@/lib/server/auth";
import {
  ensureUserCategories,
  normalizeCategoryColor,
  normalizeCategoryType,
  toApiCategory,
  type CategoryRow,
} from "@/lib/server/categories";
import { ensureSchema, getPool } from "@/lib/server/db";
import { apiError, readJson, handleApiError } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);

  if (!user) return apiError("Sesi tidak valid. Login ulang.", 401);

  await ensureSchema();
  await ensureUserCategories(user.id);

  const [rows] = await getPool().execute<CategoryRow[]>(
    `
      SELECT c.id, c.name, c.type, c.color, COUNT(t.id) AS transaction_count
      FROM categories c
      LEFT JOIN transactions t
        ON t.category_id = c.id
        AND t.user_id = c.user_id
      WHERE c.user_id = ?
      GROUP BY c.id, c.name, c.type, c.color
      ORDER BY c.created_at ASC, c.id ASC
    `,
    [user.id],
  );

  return NextResponse.json({ categories: rows.map(toApiCategory) });
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);

  if (!user) return apiError("Sesi tidak valid. Login ulang.", 401);

  const body = await readJson(request);
  const name = normalizeString(body?.name);
  const type = normalizeCategoryType(body?.type);
  const color = normalizeCategoryColor(body?.color);

  if (!name) return apiError("Nama kategori wajib diisi.");

  await ensureSchema();

  try {
    const [result] = await getPool().execute<ResultSetHeader>(
      "INSERT INTO categories (user_id, name, type, color) VALUES (?, ?, ?, ?)",
      [user.id, name, type, color],
    );
    const [rows] = await getPool().execute<CategoryRow[]>(
      "SELECT id, name, type, color, 0 AS transaction_count FROM categories WHERE id = ? AND user_id = ? LIMIT 1",
      [result.insertId, user.id],
    );

    return NextResponse.json({ category: toApiCategory(rows[0]) }, { status: 201 });
  } catch (error: unknown) {
    const mysqlError = error instanceof Error ? (error as { code?: string }) : {};

    if (mysqlError.code === "ER_DUP_ENTRY") {
      return apiError("Kategori dengan nama itu sudah ada.", 409);
    }

    return handleApiError(error);
  }
}

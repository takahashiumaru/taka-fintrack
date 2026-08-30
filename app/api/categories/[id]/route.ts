import type { ResultSetHeader } from "mysql2";
import { NextResponse } from "next/server";
import { getAuthenticatedUser, normalizeString } from "@/lib/server/auth";
import {
  normalizeCategoryColor,
  normalizeCategoryType,
  toApiCategory,
  type CategoryRow,
} from "@/lib/server/categories";
import { ensureSchema, getPool } from "@/lib/server/db";
import { apiError, handleApiError, readJson } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const user = await getAuthenticatedUser(request);
  if (!user) return apiError("Sesi tidak valid. Login ulang.", 401);

  const categoryId = Number(params.id);
  if (!Number.isFinite(categoryId) || categoryId <= 0) {
    return apiError("ID Kategori tidak valid.", 400);
  }

  try {
    await ensureSchema();

    const [rows] = await getPool().execute<CategoryRow[]>(
      `
        SELECT c.id, c.name, c.type, c.color, COUNT(t.id) AS transaction_count
        FROM categories c
        LEFT JOIN transactions t
          ON t.category_id = c.id
          AND t.user_id = c.user_id
        WHERE c.id = ? AND c.user_id = ?
        GROUP BY c.id, c.name, c.type, c.color
        LIMIT 1
      `,
      [categoryId, user.id]
    );

    const category = rows[0];
    if (!category) {
      return apiError("Kategori tidak ditemukan.", 404);
    }

    return NextResponse.json({ category: toApiCategory(category) });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getAuthenticatedUser(request);
  if (!user) return apiError("Sesi tidak valid. Login ulang.", 401);

  const categoryId = Number(params.id);
  if (!Number.isFinite(categoryId) || categoryId <= 0) {
    return apiError("ID Kategori tidak valid.", 400);
  }

  const body = await readJson(request);
  const name = normalizeString(body?.name);
  const type = normalizeCategoryType(body?.type);
  const color = normalizeCategoryColor(body?.color);

  if (!name) return apiError("Nama kategori wajib diisi.");

  try {
    await ensureSchema();

    const [result] = await getPool().execute<ResultSetHeader>(
      "UPDATE categories SET name = ?, type = ?, color = ? WHERE id = ? AND user_id = ? LIMIT 1",
      [name, type, color, categoryId, user.id]
    );

    if (result.affectedRows === 0) {
      return apiError("Kategori tidak ditemukan.", 404);
    }

    const [rows] = await getPool().execute<CategoryRow[]>(
      `
        SELECT c.id, c.name, c.type, c.color, COUNT(t.id) AS transaction_count
        FROM categories c
        LEFT JOIN transactions t
          ON t.category_id = c.id
          AND t.user_id = c.user_id
        WHERE c.id = ? AND c.user_id = ?
        GROUP BY c.id, c.name, c.type, c.color
        LIMIT 1
      `,
      [categoryId, user.id]
    );

    return NextResponse.json({ category: toApiCategory(rows[0]) });
  } catch (error: unknown) {
    const mysqlError = error instanceof Error ? (error as { code?: string }) : {};
    if (mysqlError.code === "ER_DUP_ENTRY") {
      return apiError("Kategori dengan nama itu sudah ada.", 409);
    }
    return handleApiError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getAuthenticatedUser(request);
  if (!user) return apiError("Sesi tidak valid. Login ulang.", 401);

  const categoryId = Number(params.id);
  if (!Number.isFinite(categoryId) || categoryId <= 0) {
    return apiError("ID Kategori tidak valid.", 400);
  }

  try {
    await ensureSchema();

    // Check if category is currently used by any transactions
    const [existingTx] = await getPool().execute<CategoryRow[]>(
      "SELECT 1 FROM transactions WHERE category_id = ? AND user_id = ? LIMIT 1",
      [categoryId, user.id]
    );

    if (existingTx.length > 0) {
      return apiError("Kategori tidak dapat dihapus karena masih digunakan dalam transaksi.", 409);
    }

    const [result] = await getPool().execute<ResultSetHeader>(
      "DELETE FROM categories WHERE id = ? AND user_id = ? LIMIT 1",
      [categoryId, user.id]
    );

    if (result.affectedRows === 0) {
      return apiError("Kategori tidak ditemukan.", 404);
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}

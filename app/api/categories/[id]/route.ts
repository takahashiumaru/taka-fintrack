import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { toApiCategory, type CategoryRow } from "@/lib/server/categories";
import { ensureSchema, getPool } from "@/lib/server/db";
import { apiError, handleApiError } from "@/lib/server/http";

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

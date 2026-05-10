import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { NextResponse } from "next/server";
import { getAuthenticatedUser, normalizeString } from "@/lib/server/auth";
import { ensureUserCategories, type CategoryRow } from "@/lib/server/categories";
import { ensureSchema, getPool } from "@/lib/server/db";
import { apiError, readJson } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TransactionRow = RowDataPacket & {
  id: number;
  category_id: number | null;
  merchant: string;
  category: string;
  category_color: string | null;
  amount: number;
  type: "income" | "expense";
  transaction_date: string | null;
  source: "Manual" | "Scan";
  created_at: string;
};

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);

  if (!user) return apiError("Sesi tidak valid. Login ulang.", 401);

  await ensureSchema();
  await ensureUserCategories(user.id);

  const [rows] = await getPool().execute<TransactionRow[]>(
    `
      SELECT
        t.id,
        t.category_id,
        t.merchant,
        COALESCE(c.name, t.category) AS category,
        COALESCE(c.color, '#64748B') AS category_color,
        t.amount,
        t.type,
        t.transaction_date,
        t.source,
        t.created_at
      FROM transactions t
      LEFT JOIN categories c
        ON c.id = t.category_id
        AND c.user_id = t.user_id
      WHERE t.user_id = ?
      ORDER BY COALESCE(t.transaction_date, t.created_at) DESC, t.id DESC
    `,
    [user.id],
  );

  return NextResponse.json({ transactions: rows.map(toTransaction) });
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);

  if (!user) return apiError("Sesi tidak valid. Login ulang.", 401);

  const body = await readJson(request);
  const merchant = normalizeString(body?.merchant);
  const categoryId = Number(body?.categoryId);
  const manualCategory = normalizeString(body?.category);
  const amount = Number(body?.amount);
  const type = body?.type === "income" ? "income" : body?.type === "expense" ? "expense" : "";
  const source = body?.source === "Scan" ? "Scan" : "Manual";
  const transactionDate = normalizeTransactionDate(body?.transactionDate);

  if (!merchant) return apiError("Merchant wajib diisi.");
  if (!Number.isFinite(amount) || amount <= 0) return apiError("Nominal belum valid.");
  if (!type) return apiError("Tipe transaksi belum valid.");

  await ensureSchema();
  await ensureUserCategories(user.id);

  const pool = getPool();
  let categoryName = manualCategory;
  let resolvedCategoryId: number | null = null;

  if (Number.isFinite(categoryId) && categoryId > 0) {
    const [categoryRows] = await pool.execute<CategoryRow[]>(
      "SELECT id, name, type, color FROM categories WHERE id = ? AND user_id = ? LIMIT 1",
      [categoryId, user.id],
    );
    const category = categoryRows[0];

    if (!category) return apiError("Kategori tidak ditemukan.", 404);

    if (category.type !== "both" && category.type !== type) {
      return apiError("Tipe kategori tidak cocok dengan tipe transaksi.");
    }

    resolvedCategoryId = Number(category.id);
    categoryName = category.name;
  }

  if (!categoryName) return apiError("Kategori wajib diisi.");

  const [result] = await pool.execute<ResultSetHeader>(
    `
      INSERT INTO transactions (user_id, category_id, merchant, category, amount, type, transaction_date, source)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [user.id, resolvedCategoryId, merchant, categoryName, Math.round(amount), type, transactionDate, source],
  );
  const [rows] = await pool.execute<TransactionRow[]>(
    `
      SELECT
        t.id,
        t.category_id,
        t.merchant,
        COALESCE(c.name, t.category) AS category,
        COALESCE(c.color, '#64748B') AS category_color,
        t.amount,
        t.type,
        t.transaction_date,
        t.source,
        t.created_at
      FROM transactions t
      LEFT JOIN categories c
        ON c.id = t.category_id
        AND c.user_id = t.user_id
      WHERE t.id = ? AND t.user_id = ?
      LIMIT 1
    `,
    [result.insertId, user.id],
  );

  return NextResponse.json({ transaction: toTransaction(rows[0]) }, { status: 201 });
}

function toTransaction(row: TransactionRow) {
  return {
    id: Number(row.id),
    categoryId: row.category_id ? Number(row.category_id) : null,
    merchant: row.merchant,
    category: row.category,
    categoryColor: row.category_color ?? "#64748B",
    amount: Number(row.amount),
    type: row.type,
    transactionDate: row.transaction_date,
    source: row.source,
    createdAt: row.created_at,
  };
}

function normalizeTransactionDate(value: unknown) {
  const rawDate = normalizeString(value);

  if (!rawDate) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    return `${rawDate} ${hours}:${minutes}:${seconds}`;
  }

  const parsedDate = new Date(rawDate);

  if (Number.isNaN(parsedDate.getTime())) return null;

  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
  const date = String(parsedDate.getDate()).padStart(2, "0");
  const hours = String(parsedDate.getHours()).padStart(2, "0");
  const minutes = String(parsedDate.getMinutes()).padStart(2, "0");
  const seconds = String(parsedDate.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${date} ${hours}:${minutes}:${seconds}`;
}

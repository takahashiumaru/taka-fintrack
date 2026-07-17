import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { NextResponse } from "next/server";
import { getAuthenticatedUser, normalizeString } from "@/lib/server/auth";
import { ensureUserCategories, type CategoryRow } from "@/lib/server/categories";
import { ensureSchema, getPool } from "@/lib/server/db";
import { apiError, readJson, paginatedResponse } from "@/lib/server/http";
import { normalizeReceiptMetadata, parseJsonArray } from "@/lib/server/receipt-metadata";

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
  payment_account: string;
  receipt_total_amount: number | null;
  receipt_selected_amount: number | null;
  receipt_split_mode: "full_receipt" | "selected_items";
  receipt_items_json: string | null;
  receipt_selected_items_json: string | null;
  receipt_adjustment_amount: number | null;
  receipt_adjustment_note: string | null;
  created_at: string;
};

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);

  if (!user) return apiError("Sesi tidak valid. Login ulang.", 401);

  await ensureSchema();
  await ensureUserCategories(user.id);

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
  const limit = Math.min(50, Math.max(5, Number(searchParams.get("limit") ?? 20) || 20));
  const offset = (page - 1) * limit;
  const year = searchParams.get("year");
  const month = searchParams.get("month");

  const [totalRows] = await getPool().execute<RowDataPacket[]>(
    "SELECT COUNT(*) as total FROM transactions WHERE user_id = ?",
    [user.id]
  );
  const total = totalRows[0].total as number;

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
        t.payment_account,
        t.receipt_total_amount,
        t.receipt_selected_amount,
        t.receipt_split_mode,
        t.receipt_items_json,
        t.receipt_selected_items_json,
        t.receipt_adjustment_amount,
        t.receipt_adjustment_note,
        t.created_at
      FROM transactions t
      LEFT JOIN categories c
        ON c.id = t.category_id
        AND c.user_id = t.user_id
      WHERE t.user_id = ?
      ORDER BY COALESCE(t.transaction_date, t.created_at) DESC, t.id DESC
      LIMIT ? OFFSET ?
    `,
    [user.id, limit, offset],
  );

  // Calculate summary for all transactions (optionally filtered by year/month)
  let summaryQuery = `
    SELECT
      SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) AS total_income,
      SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS total_expense
    FROM transactions
    WHERE user_id = ?
  `;
  const summaryParams: (number | string)[] = [user.id];

  if (year && month) {
    summaryQuery += ` AND YEAR(COALESCE(transaction_date, created_at)) = ? AND MONTH(COALESCE(transaction_date, created_at)) = ?`;
    summaryParams.push(year, month);
  }

  const [summaryRows] = await getPool().execute<RowDataPacket[]>(summaryQuery, summaryParams);

  const summary = summaryRows[0] || { total_income: 0, total_expense: 0 };

  return paginatedResponse(
    rows.map(toTransaction),
    total,
    page,
    limit
  );
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
  const paymentAccount = normalizePaymentAccount(body?.paymentAccount);
  const transactionDate = normalizeTransactionDate(body?.transactionDate);

  if (!merchant) return apiError("Merchant wajib diisi.");
  if (merchant.length > 160) return apiError("Merchant maksimal 160 karakter.");
  // Check if amount is valid
  if (!Number.isFinite(amount) || amount <= 0) return apiError("Nominal belum valid.");
  
  // Guard against missing type
  if (type !== "income" && type !== "expense") return apiError("Tipe transaksi belum valid.");

  const receiptResult = normalizeReceiptMetadata(body, amount);
  if (receiptResult.error || !receiptResult.metadata) return apiError(receiptResult.error || "Metadata struk belum valid.");
  const receiptMetadata = receiptResult.metadata;

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
      INSERT INTO transactions (user_id, category_id, merchant, category, amount, type, transaction_date, source, payment_account, receipt_total_amount, receipt_selected_amount, receipt_split_mode, receipt_items_json, receipt_selected_items_json, receipt_adjustment_amount, receipt_adjustment_note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [user.id, resolvedCategoryId, merchant, categoryName, Math.round(amount), type, transactionDate, source, paymentAccount, receiptMetadata.receiptTotalAmount, receiptMetadata.receiptSelectedAmount, receiptMetadata.receiptSplitMode, receiptMetadata.receiptItemsJson, receiptMetadata.receiptSelectedItemsJson, receiptMetadata.receiptAdjustmentAmount, receiptMetadata.receiptAdjustmentNote],
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
        t.payment_account,
        t.receipt_total_amount,
        t.receipt_selected_amount,
        t.receipt_split_mode,
        t.receipt_items_json,
        t.receipt_selected_items_json,
        t.receipt_adjustment_amount,
        t.receipt_adjustment_note,
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
    paymentAccount: row.payment_account || "Cash",
    receiptSplitMode: row.receipt_split_mode || "full_receipt",
    receiptTotalAmount: row.receipt_total_amount === null ? null : Number(row.receipt_total_amount),
    receiptSelectedAmount: row.receipt_selected_amount === null ? null : Number(row.receipt_selected_amount),
    receiptItems: parseJsonArray(row.receipt_items_json),
    receiptSelectedItems: parseJsonArray(row.receipt_selected_items_json),
    receiptAdjustmentAmount: row.receipt_adjustment_amount === null ? null : Number(row.receipt_adjustment_amount),
    receiptAdjustmentNote: row.receipt_adjustment_note,
    createdAt: row.created_at,
  };
}

function normalizePaymentAccount(value: unknown) {
  const account = normalizeString(value) || "Cash";
  return account.slice(0, 80);
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

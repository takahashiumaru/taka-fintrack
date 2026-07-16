import { NextResponse } from "next/server";
import { getAuthenticatedUser, normalizeString } from "@/lib/server/auth";
import { ensureUserCategories, type CategoryRow } from "@/lib/server/categories";
import { ensureSchema, getPool } from "@/lib/server/db";
import { apiError, readJson } from "@/lib/server/http";
import { normalizeReceiptMetadata, parseJsonArray } from "@/lib/server/receipt-metadata";
import type { ResultSetHeader, RowDataPacket } from "mysql2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const user = await getAuthenticatedUser(request);
  if (!user) return apiError("Sesi tidak valid. Login ulang.", 401);

  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) return apiError("ID transaksi tidak valid.", 400);

  await ensureSchema();

  const [rows] = await getPool().execute<TransactionRow[]>(
    `SELECT t.id, t.category_id, t.merchant, COALESCE(c.name, t.category) AS category,
            COALESCE(c.color, '#64748B') AS category_color, t.amount, t.type,
            t.transaction_date, t.source, t.payment_account, t.receipt_total_amount,
            t.receipt_selected_amount, t.receipt_split_mode, t.receipt_items_json,
            t.receipt_selected_items_json, t.receipt_adjustment_amount, t.receipt_adjustment_note, t.created_at
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id AND c.user_id = t.user_id
     WHERE t.id = ? AND t.user_id = ? LIMIT 1`,
    [id, user.id],
  );

  if (rows.length === 0) return apiError("Transaksi tidak ditemukan.", 404);

  return NextResponse.json({ transaction: toTransaction(rows[0]) });
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getAuthenticatedUser(request);
  if (!user) return apiError("Sesi tidak valid. Login ulang.", 401);

  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) return apiError("ID transaksi tidak valid.", 400);

  await ensureSchema();

  const [result] = await getPool().execute<ResultSetHeader>(
    "DELETE FROM transactions WHERE id = ? AND user_id = ? LIMIT 1",
    [id, user.id],
  );

  if (result.affectedRows === 0) {
    return apiError("Transaksi tidak ditemukan.", 404);
  }

  return NextResponse.json({ success: true });
}


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

export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  const user = await getAuthenticatedUser(request);
  if (!user) return apiError("Sesi tidak valid. Login ulang.", 401);

  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) return apiError("ID transaksi tidak valid.", 400);

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
  if (!Number.isFinite(amount) || amount <= 0) return apiError("Nominal belum valid.");
  if (!type) return apiError("Tipe transaksi belum valid.");

  const hasReceiptMetadata = "receiptSplitMode" in (body ?? {}) || "receiptItems" in (body ?? {}) || "receiptSelectedItems" in (body ?? {});
  const receiptResult = hasReceiptMetadata ? normalizeReceiptMetadata(body, amount) : null;
  if (receiptResult?.error || (hasReceiptMetadata && !receiptResult?.metadata)) return apiError(receiptResult?.error || "Metadata struk belum valid.");

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
    if (category.type !== "both" && category.type !== type) return apiError("Tipe kategori tidak cocok dengan tipe transaksi.");
    resolvedCategoryId = Number(category.id);
    categoryName = category.name;
  }

  if (!categoryName) return apiError("Kategori wajib diisi.");

  const [result] = await pool.execute<ResultSetHeader>(
    `UPDATE transactions
     SET category_id = ?, merchant = ?, category = ?, amount = ?, type = ?, transaction_date = ?, source = ?, payment_account = ?,
         receipt_total_amount = IF(? = 1, ?, receipt_total_amount),
         receipt_selected_amount = IF(? = 1, ?, receipt_selected_amount),
         receipt_split_mode = IF(? = 1, ?, receipt_split_mode),
         receipt_items_json = IF(? = 1, ?, receipt_items_json),
         receipt_selected_items_json = IF(? = 1, ?, receipt_selected_items_json),
         receipt_adjustment_amount = IF(? = 1, ?, receipt_adjustment_amount),
         receipt_adjustment_note = IF(? = 1, ?, receipt_adjustment_note)
     WHERE id = ? AND user_id = ?
     LIMIT 1`,
    [resolvedCategoryId, merchant, categoryName, Math.round(amount), type, transactionDate, source, paymentAccount,
      hasReceiptMetadata ? 1 : 0, receiptResult?.metadata?.receiptTotalAmount ?? null,
      hasReceiptMetadata ? 1 : 0, receiptResult?.metadata?.receiptSelectedAmount ?? null,
      hasReceiptMetadata ? 1 : 0, receiptResult?.metadata?.receiptSplitMode ?? "full_receipt",
      hasReceiptMetadata ? 1 : 0, receiptResult?.metadata?.receiptItemsJson ?? null,
      hasReceiptMetadata ? 1 : 0, receiptResult?.metadata?.receiptSelectedItemsJson ?? null,
      hasReceiptMetadata ? 1 : 0, receiptResult?.metadata?.receiptAdjustmentAmount ?? null,
      hasReceiptMetadata ? 1 : 0, receiptResult?.metadata?.receiptAdjustmentNote ?? null,
      id, user.id],
  );

  if (result.affectedRows === 0) return apiError("Transaksi tidak ditemukan.", 404);

  const [rows] = await pool.execute<TransactionRow[]>(
    `SELECT t.id, t.category_id, t.merchant, COALESCE(c.name, t.category) AS category,
            COALESCE(c.color, '#64748B') AS category_color, t.amount, t.type,
            t.transaction_date, t.source, t.payment_account, t.receipt_total_amount,
            t.receipt_selected_amount, t.receipt_split_mode, t.receipt_items_json,
            t.receipt_selected_items_json, t.receipt_adjustment_amount, t.receipt_adjustment_note, t.created_at
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id AND c.user_id = t.user_id
     WHERE t.id = ? AND t.user_id = ? LIMIT 1`,
    [id, user.id],
  );

  return NextResponse.json({ transaction: toTransaction(rows[0]) });
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

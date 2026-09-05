import { NextResponse } from "next/server";
import { getAuthenticatedUser, normalizeString } from "@/lib/server/auth";
import { ensureUserCategories, type CategoryRow } from "@/lib/server/categories";
import { ensureSchema, getPool } from "@/lib/server/db";
import { apiError, readJson, handleApiError } from "@/lib/server/http";
import { normalizeReceiptMetadata } from "@/lib/server/receipt-metadata";
import { normalizePaymentAccount, normalizeTransactionDate, toTransaction, type TransactionRow } from "@/lib/server/transactions";
import type { ResultSetHeader, RowDataPacket } from "mysql2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const user = await getAuthenticatedUser(request);
  if (!user) return apiError("Sesi tidak valid. Login ulang.", 401);

  const id = Number(params.id);
  if (!Number.isFinite(id) || id <= 0) return apiError("ID transaksi tidak valid.", 400);

  try {
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
  } catch (error: unknown) {
    return handleApiError(error);
  }
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

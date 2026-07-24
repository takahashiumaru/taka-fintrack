import type { RowDataPacket } from "mysql2";
import { normalizeString } from "@/lib/server/auth";
import { parseJsonArray } from "@/lib/server/receipt-metadata";

export { parseJsonArray };

export type TransactionRow = RowDataPacket & {
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

export function normalizePaymentAccount(value: unknown) {
  const account = normalizeString(value) || "Cash";
  return account.slice(0, 80);
}

export function normalizeTransactionDate(value: unknown) {
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

export function toTransaction(row: TransactionRow) {
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

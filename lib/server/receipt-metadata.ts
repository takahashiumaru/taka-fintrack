import { normalizeString } from "@/lib/server/auth";

export type ReceiptSplitMode = "full_receipt" | "selected_items";

type ReceiptItemPayload = {
  id?: string;
  name: string;
  qty: number;
  price: number;
  lineTotal?: number;
};

type SelectedReceiptItemPayload = {
  key: string;
  name: string;
  originalQty: number;
  selectedQty: number;
  unitPrice: number;
  selectedAmount: number;
};

export type ReceiptMetadata = {
  receiptSplitMode: ReceiptSplitMode;
  receiptTotalAmount: number | null;
  receiptSelectedAmount: number | null;
  receiptItemsJson: string | null;
  receiptSelectedItemsJson: string | null;
  receiptAdjustmentAmount: number | null;
  receiptAdjustmentNote: string | null;
};

const maxReceiptItems = 80;
const maxSelectedReceiptItems = 40;
const maxJsonLength = 20_000;

export function parseJsonArray(value: unknown) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function normalizeReceiptMetadata(body: unknown, fallbackAmount: number): { metadata?: ReceiptMetadata; error?: string } {
  const input = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const receiptSplitMode: ReceiptSplitMode = input.receiptSplitMode === "selected_items" ? "selected_items" : "full_receipt";
  const receiptTotalAmount = normalizeMoney(input.receiptTotalAmount);
  const receiptSelectedAmount = normalizeMoney(input.receiptSelectedAmount);
  const receiptAdjustmentAmount = normalizeMoney(input.receiptAdjustmentAmount);
  const receiptAdjustmentNote = normalizeString(input.receiptAdjustmentNote).slice(0, 190) || null;
  const receiptItems = normalizeReceiptItems(input.receiptItems, maxReceiptItems);
  const receiptSelectedItems = normalizeSelectedReceiptItems(input.receiptSelectedItems, maxSelectedReceiptItems);

  const effectiveReceiptTotal = receiptTotalAmount ?? (receiptSplitMode === "selected_items" ? Math.round(fallbackAmount) : null);
  const effectiveSelectedAmount = receiptSelectedAmount ?? (receiptSplitMode === "selected_items" ? Math.round(fallbackAmount) : null);

  if (receiptSplitMode === "selected_items") {
    if (receiptSelectedItems.length === 0) return { error: "Pilih minimal satu item struk sebelum menyimpan." };
    if (!effectiveSelectedAmount || effectiveSelectedAmount <= 0) return { error: "Nominal item terpilih belum valid." };
    if (effectiveReceiptTotal && effectiveSelectedAmount > effectiveReceiptTotal) {
      return { error: "Nominal item terpilih tidak boleh melebihi total struk." };
    }
  }

  const receiptItemsJson = stringifyLimited(receiptItems);
  if (receiptItemsJson === false) return { error: "Metadata item struk terlalu besar." };
  const receiptSelectedItemsJson = stringifyLimited(receiptSelectedItems);
  if (receiptSelectedItemsJson === false) return { error: "Metadata item terpilih terlalu besar." };

  return {
    metadata: {
      receiptSplitMode,
      receiptTotalAmount: effectiveReceiptTotal,
      receiptSelectedAmount: effectiveSelectedAmount,
      receiptItemsJson,
      receiptSelectedItemsJson,
      receiptAdjustmentAmount,
      receiptAdjustmentNote,
    },
  };
}

function normalizeMoney(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return null;
  return Math.max(0, Math.round(numberValue));
}

function normalizeReceiptItems(value: unknown, maxItems: number): ReceiptItemPayload[] {
  return parseJsonArray(value).slice(0, maxItems).map((item, index) => {
    const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const qty = Math.max(0, Number(row.qty ?? row.quantity ?? 1) || 1);
    const price = Math.max(0, Math.round(Number(row.price ?? row.unitPrice ?? row.unit_price ?? 0) || 0));
    const lineTotal = Math.max(0, Math.round(Number(row.lineTotal ?? row.totalPrice ?? row.total_price ?? qty * price) || qty * price));
    return {
      id: normalizeString(row.id ?? `item-${index}`).slice(0, 80),
      name: normalizeString(row.name).slice(0, 140) || `Item ${index + 1}`,
      qty,
      price,
      lineTotal,
    };
  }).filter((item) => item.name && (item.price > 0 || (item.lineTotal ?? 0) > 0));
}

function normalizeSelectedReceiptItems(value: unknown, maxItems: number): SelectedReceiptItemPayload[] {
  return parseJsonArray(value).slice(0, maxItems).map((item, index) => {
    const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const originalQty = Math.max(0, Number(row.originalQty ?? 1) || 1);
    const selectedQty = Math.max(0, Number(row.selectedQty ?? 1) || 1);
    const unitPrice = Math.max(0, Math.round(Number(row.unitPrice ?? 0) || 0));
    const selectedAmount = Math.max(0, Math.round(Number(row.selectedAmount ?? selectedQty * unitPrice) || selectedQty * unitPrice));
    return {
      key: normalizeString(row.key ?? `selected-${index}`).slice(0, 120),
      name: normalizeString(row.name).slice(0, 140) || `Item ${index + 1}`,
      originalQty,
      selectedQty,
      unitPrice,
      selectedAmount,
    };
  }).filter((item) => item.name && item.selectedQty > 0 && item.selectedAmount > 0);
}

function stringifyLimited(value: unknown[]) {
  if (value.length === 0) return null;
  const json = JSON.stringify(value);
  return json.length > maxJsonLength ? false : json;
}

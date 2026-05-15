# Scan Struk Item Selection Split Bill Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task. Do not auto-commit for Umar/Taka projects; build/test first, then ask before commit.

**Goal:** After scanning one shared receipt, let Umar select which receipt items are his, then save only those selected items as his transaction. This follows the GoPay split-bill style: choose your items from the bill, not merely divide the grand total.

**Correction from previous plan:** This is **not** primarily about detecting GoPay payment references or equal split by total. The core feature is **item-level ownership selection after scan**. Example: receipt has 10 products, Umar bought only 2, so Taka FinTrack saves only those 2 items/amounts.

**Architecture:** Keep AI/OCR extraction focused on itemizing the receipt accurately. Add a scan review step that lists every detected item with checkbox/quantity controls. Compute “Porsi Saya” from selected items plus optional proportional service/tax/discount allocation. Save one personal transaction using the selected-item total and store selected item metadata for audit.

**Tech Stack:** Next.js App Router, React/TypeScript, MySQL via existing `ensureSchema()` pattern, existing `/api/scan-ai`, existing transaction APIs.

---

## Product behavior

### Main flow

1. Umar scans a receipt.
2. AI/OCR returns merchant, date, total, and item list.
3. App shows all detected items.
4. Umar selects the items he bought.
5. App calculates Umar's share from selected items.
6. Umar can adjust quantity or amount if scan itemization is imperfect.
7. Saving creates a transaction with only Umar's selected total.

### Example

Receipt total contains 10 products:

- Nasi Goreng — Rp 25.000
- Es Teh — Rp 5.000
- Kopi — Rp 18.000
- Pizza — Rp 80.000
- ...

Umar selects:

- Nasi Goreng
- Es Teh

Saved transaction amount: Rp 30.000, plus optional proportional tax/service if enabled.

---

## UX requirements

### Scan result screen

Add a section titled **Pilih Item Saya** below receipt preview/total.

Each item row should show:

- Checkbox.
- Item name.
- Quantity detected.
- Unit price / total price.
- Optional quantity selector if receipt line has qty > 1.
- Optional edit button for item name/price when OCR is wrong.

### Summary card

Show:

- Total struk: full receipt total.
- Item dipilih: count selected.
- Subtotal item saya.
- Alokasi diskon/pajak/service: optional.
- **Nominal yang disimpan**.

### Controls

Provide quick actions:

- Pilih semua.
- Kosongkan.
- Bagi rata item terpilih if qty > 1.
- Simpan item saya.
- Simpan full struk, for non-shared receipts.

### Mobile rules

- Item list must be compact and scrollable.
- Save button must remain reachable above mobile bottom nav.
- Do not use a huge modal for the item picker; keep it in the scan page flow.

---

## Data model

### Option A for v1: store selected item metadata in transaction row

Add nullable columns to `transactions`:

```sql
receipt_total_amount DECIMAL(14,2) NULL,
receipt_selected_amount DECIMAL(14,2) NULL,
receipt_split_mode ENUM('full_receipt','selected_items') NOT NULL DEFAULT 'full_receipt',
receipt_items_json JSON NULL,
receipt_selected_items_json JSON NULL,
receipt_adjustment_amount DECIMAL(14,2) NULL,
receipt_adjustment_note VARCHAR(190) NULL
```

Why this is enough for v1:

- One personal transaction is created from one receipt.
- We only need to remember which scanned items formed the saved amount.
- Avoid overbuilding friend/contact/debt tracking.

### Future v2 option

If Umar later wants item-level history/search/edit, create child table:

```sql
transaction_receipt_items (
  id,
  transaction_id,
  name,
  quantity,
  unit_price,
  total_price,
  selected_quantity,
  selected_amount
)
```

Do not build v2 unless asked.

---

## Frontend types

Extend existing receipt types in `components/taka-fintrack-app.tsx`:

```ts
type ReceiptItem = {
  id?: string;
  name: string;
  qty: number;
  price: number; // unit price in current app model
  lineTotal?: number;
};

type SelectedReceiptItem = {
  key: string;
  name: string;
  originalQty: number;
  selectedQty: number;
  unitPrice: number;
  selectedAmount: number;
};

type ReceiptSplitMode = 'full_receipt' | 'selected_items';
```

State inside `ScanView`:

```ts
const [receiptSplitMode, setReceiptSplitMode] = useState<ReceiptSplitMode>('full_receipt');
const [selectedReceiptItems, setSelectedReceiptItems] = useState<Record<string, SelectedReceiptItem>>({});
const [receiptAdjustmentMode, setReceiptAdjustmentMode] = useState<'none' | 'proportional'>('proportional');
```

---

## Calculation rules

### Base selected amount

```ts
selectedSubtotal = sum(selectedQty * unitPrice)
```

### Full receipt mode

Use current behavior:

```ts
amountToSave = scannedReceipt.total
```

### Selected items mode

Use selected subtotal, then optionally allocate receipt-level adjustments.

Receipt-level adjustment:

```ts
adjustment = scannedReceipt.total - sum(all item line totals)
```

This may include tax, service charge, rounding, or discount.

If proportional allocation enabled:

```ts
selectedAdjustment = adjustment * (selectedSubtotal / allItemsSubtotal)
amountToSave = selectedSubtotal + selectedAdjustment
```

Clamp:

- minimum Rp 1
- maximum full receipt total
- round to integer rupiah

If item OCR is poor or totals mismatch heavily, show warning and allow manual edit.

---

## Task 1: Update plan terminology and remove GoPay-reference-first assumption

**Objective:** Ensure docs and implementation language use item selection, not equal-split total.

**Files:**
- Keep this plan as source of truth: `docs/plans/2026-05-15-scan-struk-item-selection-split-bill.md`
- Optional: mark older plan as superseded.

**Acceptance criteria:**

- Future implementer understands “referensi GoPay” means item selection UX pattern, not GoPay API/reference integration.

---

## Task 2: Add receipt item metadata columns

**Objective:** Persist selected receipt items and original receipt total.

**Files:**
- Modify: `lib/server/db.ts`

**Steps:**

1. Add columns to `CREATE TABLE IF NOT EXISTS transactions`.
2. Add `addColumnIfMissing(...)` calls for existing DB.
3. Keep default mode `full_receipt` for old rows.

**Verification:**

- `npm run build`
- DB `SHOW COLUMNS` confirms new `receipt_*` fields.

---

## Task 3: Extend transaction API payload

**Objective:** API can save receipt selected-item metadata.

**Files:**
- Modify: `app/api/transactions/route.ts`
- Modify: `app/api/transactions/[id]/route.ts`

**Steps:**

1. Extend `TransactionRow` with receipt metadata fields.
2. Add fields to SELECT.
3. Normalize request body:

```ts
receiptSplitMode: 'full_receipt' | 'selected_items'
receiptTotalAmount: number | null
receiptSelectedAmount: number | null
receiptItems: ReceiptItem[]
receiptSelectedItems: SelectedReceiptItem[]
receiptAdjustmentAmount: number | null
receiptAdjustmentNote: string | null
```

4. Validate JSON length and item count. Suggested max:
   - full items: 80
   - selected items: 40
   - JSON string length: 20k chars
5. Insert/update fields.
6. Return fields in API response.

**Acceptance criteria:**

- Existing transaction creation still works without receipt fields.
- Scan save can persist selected items.
- API rejects invalid selected amount > full receipt total.

---

## Task 4: Improve scan AI item extraction reliability

**Objective:** Item selection is only useful if item list is decent.

**Files:**
- Modify: `app/api/scan-ai/route.ts`
- Modify: `components/taka-fintrack-app.tsx` if mapper needs line totals.

**Steps:**

1. In AI prompt, emphasize item-level extraction:
   - Every purchased line item.
   - Quantity.
   - Unit price.
   - Line total.
   - Avoid summary/payment/admin lines as items.
2. Ensure normalized item includes `total_price` when available.
3. Frontend maps:

```ts
price = unit_price || total_price / quantity
lineTotal = total_price || quantity * unit_price
```

4. Keep OCR fallback but show warning when item count is zero.

**Acceptance criteria:**

- Normal receipt returns usable item rows.
- Summary lines like TOTAL/SUBTOTAL are not selectable items.

---

## Task 5: Build item selection UI in `ScanView`

**Objective:** Umar can choose item(s) before saving.

**Files:**
- Modify: `components/taka-fintrack-app.tsx`

**Steps:**

1. After scan result, initialize selected items:
   - For normal mode, none selected until user chooses.
   - Provide “Simpan full struk” for quick old behavior.
2. Render `Pilih Item Saya` card when `scannedReceipt.items.length > 0`.
3. Each item row:
   - checkbox
   - name
   - qty/price
   - selected quantity control for qty > 1
4. Add summary:
   - selected subtotal
   - adjustment allocation
   - final amount
5. Add quick actions.

**Acceptance criteria:**

- With 10 detected items, Umar can select only 2.
- Final amount updates instantly.
- UI remains usable on mobile.

---

## Task 6: Save selected-item transaction

**Objective:** `saveScannedReceipt()` saves selected total instead of always full receipt total.

**Files:**
- Modify: `components/taka-fintrack-app.tsx`

**Steps:**

1. Add helper:

```ts
function getReceiptAmountToSave(receipt, mode, selectedItems, adjustmentMode) { ... }
```

2. If mode is `selected_items` and no item selected, block save with message.
3. Send `amount: amountToSave` to `onCreateTransaction`.
4. Send receipt metadata fields.
5. Success message should say:
   - “Tersimpan: 2 item saya dari total struk Rp xxx.”

**Acceptance criteria:**

- Full receipt mode unchanged.
- Selected item mode saves only selected amount.
- No accidental save of full group bill when items are selected.

---

## Task 7: Display selected item metadata after save

**Objective:** User can later understand why transaction total differs from receipt total.

**Files:**
- Modify: `components/taka-fintrack-app.tsx`

**Steps:**

1. Add badge on transaction row:
   - `Item Split`
2. In detail/edit view/card, show:
   - Full receipt total
   - Saved selected total
   - Selected items list
3. Reports/e-statements should keep using transaction `amount`, not full receipt total.

**Acceptance criteria:**

- Spending analytics reflect Umar's own selected amount.
- Detail view preserves audit trail.

---

## Task 8: Verification

**Manual test cases:**

1. Receipt with 10 items, select 2, save. Transaction amount equals 2 selected items.
2. Receipt with qty 2 on one item, select qty 1. Transaction amount equals half of that line if unit price is known.
3. Receipt with tax/service mismatch. Proportional adjustment works and is visible.
4. No item extracted. App offers full-save/manual review, not broken picker.
5. Existing manual transaction create/edit still works.
6. Build and production checks:

```bash
npm run build
systemctl --user restart taka-fintrack
curl -fsS http://127.0.0.1:3001/api/health
curl -fsS https://takahashiumaru.my.id/api/health
```

---

## Out of scope for v1

- GoPay API integration.
- Automatic friend/contact tracking.
- Debt reminders.
- Equal split by participant count as the primary feature.
- Multi-user reconciliation.

V1 is strictly: **scan receipt → choose my items → save only my selected item total**.

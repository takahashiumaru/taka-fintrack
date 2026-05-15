# Scan Struk Split Bill GoPay Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task. Do not auto-commit for Umar/Taka projects; build/test first, then ask before commit.

**Goal:** Make receipt scanning support shared-payment / split-bill references, especially GoPay split-bill receipts, so only Umar's real share is saved as his expense instead of the full group bill.

**Architecture:** Add explicit split-bill metadata to scanned receipt extraction and transaction saving. The AI scan route should detect split-bill references from receipt/payment evidence, normalize the user's share vs total bill, and return a reviewed draft. The scan UI should show a clear “Pembayaran bersama” review card where Umar can choose whether to save full amount or only his share. The transaction API should persist the chosen amount plus optional split-bill reference metadata for audit/reporting.

**Tech Stack:** Next.js App Router, TypeScript/React, MySQL via mysql2, existing `ensureSchema()` migration pattern, existing AI scan endpoint `/api/scan-ai`, existing transaction APIs.

---

## Product behavior

### Primary use case

Umar scans a receipt from hanging out with friends. The receipt/payment proof includes GoPay split-bill/reference information. Current behavior saves the whole bill as Umar's expense. New behavior should detect this and default to saving only Umar's share when confidence is good.

### UX rule

Never silently change the amount without review. If split-bill is detected, show:

- Total tagihan: full group amount.
- Porsi saya: amount to save as Umar's transaction.
- Dibayar oleh / metode: e.g. GoPay.
- Referensi split bill: GoPay reference/order text if available.
- Confidence and warning if unsure.
- Toggle/choice:
  - Save **Porsi Saya** (recommended default when detected confidently).
  - Save **Total Tagihan**.
  - Manual edit amount.

### Data rule

The transaction `amount` remains the actual saved personal expense. Extra split metadata is stored separately so reports can still explain why the receipt total differs from the saved amount.

---

## Proposed data model

Add nullable columns to `transactions`:

```sql
split_bill_enabled TINYINT(1) NOT NULL DEFAULT 0,
split_bill_role ENUM('payer','participant','unknown') NULL,
split_bill_total_amount DECIMAL(14,2) NULL,
split_bill_my_share_amount DECIMAL(14,2) NULL,
split_bill_participant_count INT NULL,
split_bill_reference VARCHAR(190) NULL,
split_bill_provider VARCHAR(80) NULL,
split_bill_note TEXT NULL
```

Why columns, not a new table yet:

- Current need is one split metadata record per saved transaction.
- Simpler to wire into existing list/detail/report flows.
- Future multi-person tracking can later move to a child table if Umar wants debt settlement tracking.

---

## API response shape

Extend `/api/scan-ai` response with:

```ts
type SplitBillInfo = {
  is_split_bill: boolean;
  provider: string | null; // e.g. "GoPay"
  reference: string | null;
  role: "payer" | "participant" | "unknown" | null;
  total_amount: number | null;
  my_share_amount: number | null;
  participant_count: number | null;
  confidence: number; // 0..1
  evidence: string | null; // short phrase from receipt/AI, not full OCR dump
  save_recommendation: "my_share" | "full_amount" | "manual_review";
};
```

Embed into existing `ScanResult`:

```ts
split_bill: SplitBillInfo;
```

Frontend `ScannedReceipt` should mirror this with camelCase fields.

---

## AI extraction requirements

Update `app/api/scan-ai/route.ts` prompt to detect Indonesian split-bill / shared payment terms, especially GoPay:

- “split bill”
- “patungan”
- “bayar bareng”
- “dibagi”
- “share bill”
- “GoPay Split Bill”
- “permintaan split”
- “porsi kamu / porsi saya”
- “dibayar oleh teman”
- “peserta / participant”
- transfer/ref/order IDs around GoPay

Rules:

1. If receipt only shows full restaurant/store bill with no split evidence, `is_split_bill=false`.
2. If GoPay split-bill proof shows Umar's requested share, set `my_share_amount` to that share and `save_recommendation="my_share"`.
3. If only full total and participant count are visible but no exact personal share, estimate only if the receipt explicitly says equal split; otherwise `save_recommendation="manual_review"`.
4. Never invent participants/friends names.
5. If confidence below 0.7, UI must require manual review.
6. If `my_share_amount` is invalid, greater than total, or <= 0, normalize to null and force manual review.

---

## Task 1: Add split-bill DB columns

**Objective:** Persist split-bill metadata on transactions.

**Files:**
- Modify: `lib/server/db.ts`

**Steps:**

1. Add nullable columns to `CREATE TABLE IF NOT EXISTS transactions` after `payment_account`.
2. Add `addColumnIfMissing(...)` calls for existing production DBs.
3. Add indexes only if needed. For now, YAGNI: no new index unless reports filter split bills.

**Verification:**

Run:

```bash
npm run build
```

Then verify DB columns without printing credentials:

```bash
node -e "/* source env and SHOW COLUMNS FROM transactions LIKE 'split_bill_%' */"
```

Expected: all split-bill columns exist.

---

## Task 2: Extend transaction API types and persistence

**Objective:** Allow manual/scan-created transactions to save split metadata.

**Files:**
- Modify: `app/api/transactions/route.ts`
- Modify: `app/api/transactions/[id]/route.ts`

**Steps:**

1. Extend `TransactionRow` with split columns.
2. Add split columns to SELECT queries.
3. Add input normalization helpers:

```ts
function normalizeSplitBillInput(body: unknown, amount: number) {
  // returns constrained split metadata
}
```

4. Validate:
   - `split_bill_enabled` only true if metadata says true.
   - `my_share_amount` must be > 0 and <= `total_amount` when both exist.
   - Do not allow API caller to save amount that conflicts with chosen split mode unless explicitly edited by user.
5. Add split columns to INSERT and UPDATE.
6. Return split metadata in `toTransaction()`.

**Acceptance criteria:**

- Existing manual transactions still work with no split fields.
- Scan transactions can include split metadata.
- Editing a transaction preserves or updates split metadata safely.

---

## Task 3: Extend `/api/scan-ai` schema and normalization

**Objective:** AI scan returns trustworthy split-bill metadata.

**Files:**
- Modify: `app/api/scan-ai/route.ts`

**Steps:**

1. Add `SplitBillInfo` type.
2. Add `split_bill` field to `ScanResult`.
3. Add helpers:

```ts
function normalizeSplitBillInfo(input: unknown, grandTotal: number | null): SplitBillInfo
```

4. Update prompt JSON examples to include `split_bill` for both transaction and non-transaction output.
5. Add GoPay-specific extraction instructions.
6. Clamp confidence to 0..1.
7. If invalid share/total, force `save_recommendation="manual_review"`.

**Acceptance criteria:**

- Non-split receipts return `is_split_bill=false`.
- GoPay split-bill evidence returns provider/reference/share when visible.
- Bad/missing split data cannot overwrite `grand_total` silently.

---

## Task 4: Extend frontend receipt model and mapper

**Objective:** Frontend can hold split-bill AI result.

**Files:**
- Modify: `components/taka-fintrack-app.tsx`

**Steps:**

1. Add `SplitBillInfo` / `ScannedSplitBill` TypeScript types near existing receipt types.
2. Extend `ScannedReceipt` with optional `splitBill`.
3. Map `aiData.split_bill` from API response into `parsedReceipt.splitBill`.
4. Ensure local OCR fallback sets `splitBill` to a safe disabled/default state.

**Acceptance criteria:**

- Build passes.
- Existing scan result preview works for non-split receipts.

---

## Task 5: Add scan UI review card for split bill

**Objective:** User sees and controls whether to save full total or personal share.

**Files:**
- Modify: `components/taka-fintrack-app.tsx` inside `ScanView`

**State to add:**

```ts
const [splitSaveMode, setSplitSaveMode] = useState<'my_share' | 'full_amount' | 'manual'>('full_amount');
const [manualSplitAmount, setManualSplitAmount] = useState('');
```

**Behavior:**

1. When scan result has `splitBill.isSplitBill=true` and recommendation is `my_share`, default `splitSaveMode` to `my_share`.
2. Render card below totals:
   - “Terdeteksi Split Bill GoPay”
   - Total tagihan
   - Porsi saya
   - Referensi
   - Confidence/warning
3. Provide segmented controls:
   - Porsi Saya
   - Total Tagihan
   - Edit Manual
4. Show “Nominal yang akan disimpan” clearly.
5. If manual mode, show amount input.

**Acceptance criteria:**

- User must understand why saved amount differs from receipt total.
- If AI confidence low, default to manual review, not auto-share.
- UI remains mobile-friendly and not clipped by bottom nav.

---

## Task 6: Save chosen split amount and metadata

**Objective:** Saving a scanned receipt uses the selected amount and persists split context.

**Files:**
- Modify: `components/taka-fintrack-app.tsx`

**Steps:**

1. Compute:

```ts
const amountToSave = getSplitAwareReceiptAmount(scannedReceipt, splitSaveMode, manualSplitAmount);
```

2. In `saveScannedReceipt()`, send `amount: amountToSave` instead of always `scannedReceipt.total`.
3. Include split metadata payload:

```ts
splitBill: {
  enabled: scannedReceipt.splitBill?.isSplitBill ?? false,
  provider,
  reference,
  role,
  totalAmount: scannedReceipt.total,
  myShareAmount: amountToSave,
  participantCount,
  note,
}
```

4. Update success message to say whether full total or split share was saved.

**Acceptance criteria:**

- Full receipt save remains unchanged when no split bill.
- Split receipt saves only selected share by default when confident.
- User can override to full amount or manual amount.

---

## Task 7: Show split metadata in transaction list/detail/reporting

**Objective:** Make saved split-bill transactions auditable.

**Files:**
- Modify: `components/taka-fintrack-app.tsx`
- Optional later: report/e-statement PDF if Umar wants split labels in exports.

**Steps:**

1. Add a small badge on transaction rows: `Split Bill • GoPay`.
2. In transaction detail modal/card, show:
   - Total receipt amount
   - Saved personal share
   - Reference/provider
3. Keep e-statement/report totals based on saved personal amount only.

**Acceptance criteria:**

- Reports don't inflate Umar's spending with friends' portions.
- User can inspect why the amount differs from scanned receipt total.

---

## Task 8: Tests and manual verification

**Objective:** Prove feature works and does not regress normal receipt scanning.

**Files:**
- Add or update tests if project has a test runner; otherwise use manual API probes plus build.

**Verification checklist:**

1. `npm run build` passes.
2. Existing non-split receipt scan still saves full amount.
3. Mock `/api/scan-ai` response with:
   - `grand_total=300000`
   - `split_bill.my_share_amount=100000`
   - `provider="GoPay"`
   - `reference="..."`
   UI defaults to Porsi Saya and saves `100000`.
4. Low-confidence split response defaults to manual review.
5. API rejects invalid split share greater than total.
6. Transaction list displays split-bill badge.
7. Production restart and health check:

```bash
npm run build
systemctl --user restart taka-fintrack
curl -fsS http://127.0.0.1:3001/api/health
curl -fsS https://takahashiumaru.my.id/api/health
```

---

## Implementation order

1. Backend schema/API first.
2. AI scan schema/prompt second.
3. Frontend model/UI third.
4. Save behavior fourth.
5. Display/report polish fifth.
6. Build/restart/verify last.

---

## Out of scope for v1

- Tracking each friend as a contact.
- Debt settlement reminders.
- Automatic GoPay API integration.
- Multi-user reconciliation inside Taka FinTrack.
- Splitting item-by-item across friends.

These can be v2 after basic split-bill receipt saving works reliably.

# Mobile Weekly History Implementation Plan

> **For Hermes:** Implement directly in small steps; do not commit unless Umar asks.

**Goal:** Add a mobile-friendly weekly history card on Taka FinTrack Home showing Monday–Sunday totals and the week total.

**Architecture:** Reuse existing client analytics in `components/taka-fintrack-app.tsx`. Change weekly calculation from “last 7 days” to the current calendar week (Senin sampai Minggu), keep raw rupiah totals for mobile summaries, and display a compact phone-first card under summary cards. Desktop chart can continue using the same weekly data.

**Tech Stack:** Next.js 14, React, TypeScript, Tailwind CSS/Recharts.

---

## Task 1: Make weekly analytics calendar-based

**Objective:** Ensure weekly data always covers Senin–Minggu for the current week, not rolling last 7 days.

**Files:**
- Modify: `components/taka-fintrack-app.tsx`

**Steps:**
1. Add helper `getStartOfWeekMonday(date)` near date helpers.
2. In `getFinanceAnalytics`, generate 7 days from Monday to Sunday.
3. Keep `income` and `expense` in thousands for chart compatibility.
4. Add raw fields per day: `incomeAmount`, `expenseAmount`, `netAmount`, `dateLabel`.
5. Return `weeklyTotals` containing total income, expense, and net for the week.

**Verification:** `npm run build` must pass.

## Task 2: Add mobile weekly history card

**Objective:** Show weekly history in phone mode with clear Monday–Sunday rows and total.

**Files:**
- Modify: `components/taka-fintrack-app.tsx`

**Steps:**
1. Create `MobileWeeklyHistory` component.
2. Render it in `DashboardView` after `SummaryGrid`, only visible on mobile/tablet (`lg:hidden`).
3. Card header: “History 1 Minggu” and subtitle “Senin–Minggu”.
4. Show total week income, expense, and net in compact chips.
5. Render 7 rows: day label, date label, income, expense, net.
6. Use blue/cyan/navy glass style and dark-mode-safe classes.

**Verification:** Mobile layout must remain compact and not overlap bottom nav.

## Task 3: Production verification

**Objective:** Confirm new UI ships safely.

**Files:**
- No new files except this plan.

**Steps:**
1. Run `npm run build`.
2. Restart `taka-fintrack` systemd user service.
3. Probe `/api/health`, root HTML, and referenced Next.js assets.
4. Report changed files and note uncommitted status.

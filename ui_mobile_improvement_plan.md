# Taka FinTrack Mobile-Friendly UI Improvement Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Improve Taka FinTrack UI to be more mobile-friendly, adhering to the premium native-app feel (navy/blue/cyan, solid surfaces, no purple), optimizing performance and usability on small screens.

**Architecture:** Incremental UI refinements using existing React/Next.js codebase. Introduce a design token system, refactor components for consistency, optimize asset loading, and adjust layout for touch-first interactions. No major architectural changes—focus on CSS, component props, and asset handling.

**Tech Stack:** Next.js (React), Tailwind CSS (if used) or custom CSS, Next/Image, ESLint, Prettier, Jest/React Testing Library.

---

## Task 1: Audit Current Mobile UI and Baseline Metrics

**Objective:** Document existing mobile UI issues, performance metrics, and create a baseline for improvement.

**Files:**
- Create: `docs/mobile-ui-audit-baseline.md`
- Modify: None

**Step 1: Run Lighthouse on mobile emulator**
```
npx lighthouse https://localhost:3001 --preset=mobile --output=json --output-path=./reports/lighthouse-mobile-base.json
```
**Step 2: Capture screenshots of key pages (login, dashboard, transaction list, add transaction) at mobile width (390px)**
```
# Use a script or manual; store in ./docs/screenshots/base/
```
**Step 3: Write audit findings**
```
# Summarize issues: touch targets, overflow, font sizes, CLS, FCP, etc.
```
**Step 4: Commit**
```bash
git add docs/mobile-ui-audit-baseline.md reports/ screenshots/
git commit -m "docs: add mobile UI audit baseline"
```

---

## Task 2: Define Design Token System (Colors, Spacing, Radius, Typography)

**Objective:** Create CSS/Tailwind design tokens to ensure consistent navy/blue/cyan palette, spacing, and typography across mobile UI.

**Files:**
- Create: `src/styles/tokens.css` (or `tailwind.config.js` if using Tailwind)
- Modify: `src/styles/globals.css` (import tokens)

**Step 1: Define color tokens**
```css
:root {
  --color-navy: #0a1f44;
  --color-blue: #2563eb;
  --color-cyan: #06b6d4;
  --color-bg: #f8fafc;
  --color-card: #ffffff;
  --color-text: #0f172a;
  --color-muted: #64748b;
  --color-border: #e2e8f0;
}
```
**Step 2: Define spacing scale (4px base)**
```css
:root {
  --space-0: 0px;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
}
```
**Step 3: Define radius tokens**
```css
:root {
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-pill: 999px;
}
```
**Step 4: Define typography base (rem)**
```css
:root {
  --font-sans: 'Inter', system-ui, sans-serif;
  --text-base: 0.875rem; /* 14px */
  --text-lg: 1rem; /* 16px */
  --text-xl: 1.125rem; /* 18px */
  --text-2xl: 1.5rem; /* 24px */
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-bold: 600;
}
```
**Step 5: Update globals.css to use tokens**
```bash
# Replace hardcoded colors with var(--color-*)
```
**Step 6: Commit**
```bash
git add src/styles/
git commit -m "style: add design token system for mobile UI"
```

---

## Task 3: Refactor Top Navigation / Header for Mobile

**Objective:** Make header touch-friendly, prioritize actions, and avoid cramped layout on small screens.

**Files:**
- Modify: `src/components/Header.tsx`
- Create: `src/components/MobileHeader.tsx` (if splitting)
- Modify: `src/styles/Header.module.css` or equivalent

**Step 1: Change layout to use space-between with hamburger on left, title center, actions (theme, avatar) on right**
**Step 2: Ensure minimum touch target 44px for icon buttons**
**Step 3: Hide search bar on mobile; replace with search icon that opens modal/sheet**
**Step 4: Use `--space-3` padding vertically, `--space-4` horizontally**
**Step 5: Apply `--radius-md` to header background**
**Step 6: Commit**
```bash
git add src/components/Header.tsx src/styles/Header.module.css
git commit -m "ui: refactor header for mobile touch friendliness"
```

---

## Task 4: Optimize Image Loading with Next/Image and Lazy Load

**Objective:** Reduce initial payload and improve LCP by serving appropriately sized images and lazy-loading below-the-fold.

**Files:**
- Modify: `src/components/TransactionCard.tsx`, `src/components/DashboardStats.tsx`, etc.
- Ensure `next.config.js` has image domains configured.

**Step 1: Replace `<img src="..."` with `<NextImage src={...} width={...} height={...} alt={...} priority={false} />`**
**Step 2: Set `priority` only for hero/logo above the fold**
**Step 3: Use `blurPlaceholder` or `loading="lazy"`**
**Step 4: Define breakpoints for mobile (width 320-480) using NextImage's `sizes` prop**
**Step 5: Commit**
```bash
git add src/components/TransactionCard.tsx src/components/DashboardStats.tsx next.config.js
git commit -m "perf: optimize images with Next/Image for mobile"
```

---

## Task 5: Improve Form Inputs and Touch Targets

**Objective:** Ensure all form fields (login, transaction entry) have adequate size, clear labels, and proper autocomplete.

**Files:**
- Modify: `src/components/LoginForm.tsx`, `src/components/AddTransactionForm.tsx`, etc.

**Step 1: Set `input` min-height to 44px**
**Step 2: Use `--space-3` vertical padding, `--space-4` horizontal**
**Step 3: Ensure labels are visible (not placeholder-only) or use floating label pattern**
**Step 4: Add `autoComplete="username"` for NIP/email, `autoComplete="current-password"` for password**
**Step 5: Show password toggle with sufficient touch area**
**Step 6: Commit**
```bash
git add src/components/LoginForm.tsx src/components/AddTransactionForm.tsx
git commit -m "ui: improve form input touch targets and accessibility"
```

---

## Task 6: Adjust Card and List Layout for Mobile

**Objective:** Make cards full-width, reduce horizontal overflow, and improve vertical rhythm.

**Files:**
- Modify: `src/components/StationCard.tsx`, `src/components/KpiCard.tsx`, `src/components/TransactionList.tsx`

**Step 1: Remove fixed widths; use `width: 100%` with `max-width: xs` (optional)**
**Step 2: Apply `--space-4` margin bottom between cards**
**Step 3: Ensure inner padding uses `--space-3` (or `--space-2` for dense cards)**
**Step 4: For horizontal lists (e.g., recent transactions), enable horizontal scroll with scrollbar hints**
**Step 5: Commit**
```bash
git add src/components/StationCard.tsx src/components/KpiCard.tsx src/components/TransactionList.tsx
git commit -m "ui: adjust card layout for mobile full-width and spacing"
```

---

## Task 7: Reduce CLS (Cumulative Layout Shift) by Specifying Dimensions

**Objective:** Prevent layout shifts during image/font loading.

**Files:**
- Modify: Same as image components + any dynamic containers.

**Step 1: Add `width` and `height` to all images (NextImage already does)**
**Step 2: Ensure placeholder elements have same dimensions as loaded content**
**Step 3: Use `font-display: swap;` in `@font-face` if custom fonts**
**Step 4: Commit**
```bash
git add src/components/**.tsx
git commit -m "perf: reduce CLS by specifying dimensions"
```

---

## Task 8: Implement Lazy-Loading for Non-Critical Sections (e.g., Charts, Detailed Reports)

**Objective:** Defer loading of heavy charts until user scrolls near them.

**Files:**
- Modify: `src/components/DashboardCharts.tsx`
- Create: `src/components/LazySection.tsx` (using IntersectionObserver or `next/dynamic`)

**Step 1: Wrap chart components in lazy loader**
**Step 2: Show placeholder skeleton while loading**
**Step 3: Commit**
```bash
git add src/components/DashboardCharts.tsx src/components/LazySection.tsx
git commit -m "perf: lazy-load charts and heavy sections"
```

---

## Task 9: Validate Mobile Usability with Lighthouse and Real Device Testing

**Objective:** Confirm improvements meet mobile-friendly criteria.

**Files:**
- Create: `docs/mobile-ui-audit-post.md`

**Step 1: Run Lighthouse mobile again**
```
npx lighthouse https://localhost:3001 --preset=mobile --output=json --output-path=./reports/lighthouse-mobile-post.json
```
**Step 2: Compare scores (aim for >90 performance, >90 accessibility, <0.1 CLS)**
**Step 3: Capture post-improvement screenshots**
**Step 4: Write summary**
**Step 5: Commit**
```bash
git add docs/mobile-ui-audit-post.md reports/
git commit -m "docs: add post-improvement mobile audit"
```

---

## Task 10: Document Changes and Update SOUL.md (if applicable)

**Objective:** Ensure team knows mobile-specific guidelines.

**Files:**
- Modify: `SOUL.md` (append mobile UI section)
- Create: `docs/MOBILE-UI-GUIDELINES.md`

**Step 1: Add checklist:**
- Use design tokens
- Touch target ≥44px
- No horizontal overflow
- Optimize images
- Lazy load below fold
- Maintain navy/blue/cyan palette, no purple
**Step 2: Commit**
```bash
git add SOUL.md docs/MOBILE-UI-GUIDELINES.md
git commit -m "docs: add mobile UI guidelines"
```

---
**End of Plan**

Once the plan is saved, you can execute it via `subagent-driven-development` (Hermes will dispatch a subagent per task with spec review then code review).
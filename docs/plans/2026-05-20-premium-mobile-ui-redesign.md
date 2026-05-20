# Taka FinTrack Premium Mobile UI Redesign Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task. Do not commit unless Umar explicitly asks.

**Goal:** Upgrade Taka FinTrack into an elegant, professional, beautiful premium finance app with comfortable light/dark mode, uncluttered layouts, and a native-mobile feel instead of a generic web-app dashboard.

**Architecture:** Keep the existing Next.js 14 + React + Tailwind v3 stack and improve in focused passes. First create design tokens and reusable primitives, then refactor the large app shell and each view so mobile is the primary experience and desktop becomes a tasteful expansion. Preserve all existing auth, transaction, scan, chat, reports, friends, and notification behavior.

**Tech Stack:** Next.js 14, React 18, Tailwind CSS v3, TypeScript, Recharts, lucide-react, Capacitor.

**Current UI facts:**
- Main app is concentrated in `components/taka-fintrack-app.tsx` (~6k lines).
- Global tokens and dark-mode overrides live in `app/globals.css`.
- Font is currently Inter in `app/layout.tsx` and `tailwind.config.ts`.
- Tailwind is v3.4.17, so avoid Tailwind v4 syntax.
- User preference: navy/blue/cyan glass, no white dark cards, no purple, native-mobile feel, no overscroll blanks, pinned bottom nav, content close to bottom nav.

---

## Non-negotiable design direction

**Tone:** premium fintech mobile app — refined, calm, confident, slightly glossy, never loud.

**Visual rules:**
- Use a navy / blue / cyan palette only. Avoid purple and random rainbow gradients.
- Dark mode must use deep navy surfaces, not white cards patched by broad CSS overrides.
- Light mode should feel airy and premium, not flat white boxes everywhere.
- Use one accent family: cyan-blue. Success/warning/danger colors are semantic only.
- Reduce card clutter. Use spacing, section headers, dividers, and grouped surfaces instead of boxing every item.
- Mobile layout is the source of truth. Desktop should enhance, not dictate.
- Avoid “web dashboard squeezed into phone” patterns: no dense desktop-style grids on mobile, no tiny controls, no stacked noisy cards.
- Keep scan view immersive and full-screen. Keep chat stable and app-like.

**Mobile rules:**
- Safe-area aware top/bottom spacing using `env(safe-area-inset-*)`.
- Bottom nav remains pinned and never overlaps content.
- Main content bottom padding should be consistent: enough for nav, not a giant blank gap.
- Touch targets minimum 44px.
- Avoid horizontal overflow and hidden clipped controls.
- Use `100dvh`/`100svh` carefully; do not use raw `100vh` for mobile app frames.
- No rubber-band blank gaps.

---

## Acceptance criteria

### Overall
- App looks intentionally premium in both light and dark mode.
- Dashboard, transactions, scan, chat, profile, reports, friends, and notifications all remain functional.
- No page feels “numpuk-numpuk”; hierarchy is clear and breathing.
- Mobile feels like an installed app, not a responsive website.
- Desktop remains clean and professional.

### Dark mode
- No white/gray light cards leaking into dark mode.
- Text contrast is comfortable, not neon.
- Borders and shadows are subtle cyan/navy tinted.
- Charts, inputs, dropdowns, and modals are readable.

### Light mode
- White surfaces are used sparingly and intentionally.
- Background has soft depth without overdone gradients.
- Text hierarchy is clear.

### Verification
- `npm run build` passes.
- Manual mobile check at 390x844 and 430x932 passes.
- Manual desktop check at 1440x900 passes.
- No horizontal scroll on mobile.
- All main flows still work: login, add/edit/delete transaction, scan flow UI, chat send, profile edit, reports view, friends/notifications view.

---

## Task 1: Create a design inventory before changing UI

**Objective:** Capture the current UI structure and problem areas so implementation stays targeted.

**Files:**
- Read: `components/taka-fintrack-app.tsx`
- Read: `app/globals.css`
- Read: `tailwind.config.ts`
- Create: `docs/ui/taka-fintrack-ui-audit.md`

**Steps:**
1. List all major components and their line ranges:
   - `TakaFinTrackApp`
   - `Sidebar`
   - `TopBar`
   - `DashboardView`
   - `TransactionsView`
   - `ScanView`
   - `ChatView`
   - `NotificationsView`
   - `ProfileView`
   - `ProfileFriendsView`
   - `ProfileReportsView` / `ReportsView`
   - `MobileNav`
   - shared form/select/date/time components
2. Identify repeated visual patterns:
   - hardcoded white/light backgrounds
   - many independent card styles
   - dark-mode safety-net selectors in CSS
   - inconsistent radii and shadows
   - crowded mobile sections
3. Write priority list: shell, tokens, dashboard, transactions, scan, chat, profile/reports, final polish.

**Verification:**
- `docs/ui/taka-fintrack-ui-audit.md` exists and mentions exact components/files.

---

## Task 2: Replace generic font with premium finance-app typography

**Objective:** Move away from Inter and create more polished text hierarchy.

**Files:**
- Modify: `app/layout.tsx`
- Modify: `tailwind.config.ts`
- Modify: `app/globals.css`

**Implementation direction:**
- Replace `Inter` with a premium sans such as `Geist` if available from `next/font/google`.
- Add a mono font for numbers, e.g. `Geist_Mono`, because finance values need stable tabular figures.
- Update Tailwind font variables:
  - `font-sans`: `var(--font-geist-sans)`
  - `font-mono`: `var(--font-geist-mono)`
- Add global numeric polish:
  - `font-variant-numeric: tabular-nums;` for amounts, stats, chart labels, and nav badges.
- Keep Indonesian copy concise and confident.

**Verification:**
- `npm run build` passes.
- Text remains readable on mobile and desktop.

---

## Task 3: Build a clean token system for premium light/dark mode

**Objective:** Stop relying on broad dark-mode patch selectors and make surfaces intentional.

**Files:**
- Modify: `app/globals.css`
- Modify: `tailwind.config.ts`

**Implementation direction:**
1. Define semantic CSS variables:
   - `--app-bg`
   - `--app-bg-ambient`
   - `--surface-base`
   - `--surface-raised`
   - `--surface-glass`
   - `--surface-subtle`
   - `--text-main`
   - `--text-muted`
   - `--text-soft`
   - `--border-subtle`
   - `--border-strong`
   - `--accent`
   - `--accent-strong`
   - `--accent-soft`
   - `--shadow-soft`
   - `--shadow-raised`
2. Keep palette consistent:
   - Light: soft ice-blue background, white/blue-tinted surfaces.
   - Dark: deep navy background, blue-black raised surfaces, cyan-tinted borders.
3. Add reusable classes:
   - `.app-surface`
   - `.app-surface-raised`
   - `.app-glass`
   - `.app-muted-panel`
   - `.app-button-primary`
   - `.app-button-ghost`
   - `.app-field`
   - `.app-section-title`
4. Gradually remove broad selectors like dark-mode `[class*="bg-white"]` only after components are migrated.

**Verification:**
- Dark mode has no white cards.
- Light mode keeps premium soft surfaces.
- Existing components still render during partial migration.

---

## Task 4: Refactor app shell for native-mobile rhythm

**Objective:** Make the frame feel like a mobile app first, with stable safe areas and clean content spacing.

**Files:**
- Modify: `components/taka-fintrack-app.tsx` around `TakaFinTrackApp`
- Modify: `app/globals.css`

**Implementation direction:**
- Create consistent shell classes:
  - `.native-app-shell`
  - `.native-content-frame`
  - `.native-scroll-area`
- Main shell should be fixed/fullscreen only on mobile where needed, and normal/responsive on desktop.
- Content scroller should own vertical scroll, not nested random containers.
- For non-scan views:
  - top safe padding: compact but breathable
  - content bottom padding: bottom nav height + safe area + 12–16px
- For scan view:
  - immersive full screen
  - no topbar/sidebar/mobile nav
- Prevent horizontal overflow globally and per-content.

**Verification:**
- On 390px mobile, no horizontal scroll.
- Bottom nav does not cover content.
- No giant empty blank below content.
- Pull-to-refresh still works.

---

## Task 5: Redesign top bar as compact native app header

**Objective:** Replace desktop-dashboard feeling header with a refined mobile app header.

**Files:**
- Modify: `components/taka-fintrack-app.tsx` `TopBar`
- Modify: `app/globals.css`

**Implementation direction:**
- Mobile header:
  - compact height
  - left: app mark + current page title
  - right: theme, notification, avatar icons
  - no noisy date badge on small screen unless meaningful
- Desktop header:
  - wider spacing and optional month pill
  - primary action “Tambah” remains visible
- Use `.app-glass` or `.app-surface-raised` instead of hardcoded classes.
- Active states: subtle press scale, no harsh glow.

**Verification:**
- Header does not crowd page title.
- Header remains readable in both themes.
- Notification badge is visible but not loud.

---

## Task 6: Redesign bottom navigation as premium mobile tab bar

**Objective:** Make the main navigation feel like native iOS/Android finance app navigation.

**Files:**
- Modify: `components/taka-fintrack-app.tsx` `MobileNav`
- Modify: `app/globals.css`

**Implementation direction:**
- Keep five nav items, but reduce visual noise.
- Center scan action remains elevated, but should look integrated, not floating randomly.
- Use active indicator capsule or underline, not big blocks everywhere.
- Labels should fit without clipping.
- Add safe-area bottom positioning.
- Use high contrast in dark mode without white leakage.

**Verification:**
- Nav is pinned and stable across all non-scan pages.
- Active state is obvious.
- Center scan touch target is at least 56px.
- Labels do not truncate awkwardly on common phone widths.

---

## Task 7: Redesign sidebar for desktop without competing with mobile

**Objective:** Make desktop premium while keeping mobile app-first layout.

**Files:**
- Modify: `components/taka-fintrack-app.tsx` `Sidebar`

**Implementation direction:**
- Use `app-glass` / `app-surface-raised`.
- Simplify the user summary card.
- Reduce “card inside card inside card” nesting.
- Active nav uses subtle accent rail + text color, not giant saturated block.
- Security footer can be smaller and calmer.

**Verification:**
- Desktop at 1440x900 looks professional.
- Sidebar is not visually heavier than content.

---

## Task 8: Redesign dashboard into premium mobile finance home

**Objective:** Make dashboard feel like the home screen of a finance app.

**Files:**
- Modify: `components/taka-fintrack-app.tsx` `DashboardView`
- Modify shared dashboard subcomponents in same file as needed

**Implementation direction:**
- Mobile order:
  1. Financial health / balance hero
  2. income vs expense compact summary
  3. quick actions horizontal row
  4. recent transactions
  5. category insights / chart
- Desktop order can use a tasteful 2-column layout.
- Replace many same-looking cards with:
  - one hero panel
  - grouped metrics using dividers
  - compact transaction list
  - single chart panel
- Use tabular numbers and consistent amount styles.
- Empty state when no transactions: beautiful “start tracking” panel, not blank.

**Verification:**
- Dashboard is not crowded on 390px width.
- User can identify net status within 3 seconds.
- Empty/loading/error states look designed.

---

## Task 9: Redesign transactions as a native ledger

**Objective:** Make transaction management readable and fast on mobile.

**Files:**
- Modify: `components/taka-fintrack-app.tsx` `TransactionsView`
- Modify transaction list/form components in same file

**Implementation direction:**
- Mobile layout:
  - sticky/compact summary top or filter row
  - transaction list grouped by date/month where feasible
  - each transaction row: icon, title/category, date/account, amount, status/action
- Avoid huge stacked form blocks above the list. Prefer:
  - compact add panel
  - expandable sheet-like section
  - or clear tabs between “Tambah” and “Riwayat” if current structure is too crowded
- Keep custom select/date/time controls and ensure dark mode is clean.
- Use destructive actions calmly: confirmation and red only where needed.

**Verification:**
- Add/edit/delete transaction still works.
- Form does not dominate the screen when user wants history.
- Rows are scannable and not too tall.

---

## Task 10: Preserve and polish scan as immersive capture flow

**Objective:** Keep scan feeling native and focused, not like a webpage form.

**Files:**
- Modify: `components/taka-fintrack-app.tsx` `ScanView`
- Modify scan-related CSS in `app/globals.css`

**Implementation direction:**
- Fullscreen scan shell remains separate from normal shell.
- Top area: clear back/close action and concise status.
- Camera/upload actions look like app controls.
- Receipt result should be shown as a step-by-step review:
  1. merchant/date/total
  2. detected items
  3. category/payment/split
  4. save action
- Avoid stacking all review fields at once.
- Dark mode must not show light form cards.

**Verification:**
- Scan view still mounts hidden when not active as currently intended.
- Switching into/out of scan does not break camera state.
- Mobile viewport has no nav overlap.

---

## Task 11: Redesign AI chat as native assistant panel

**Objective:** Make chat feel like an in-app finance assistant, not a web chat box.

**Files:**
- Modify: `components/taka-fintrack-app.tsx` `ChatView`
- Modify chat CSS in `app/globals.css`

**Implementation direction:**
- Stable chat frame using full remaining height.
- Message area scrolls independently.
- Composer pinned above bottom safe area or inside chat frame.
- Suggested questions as horizontal chips, not a tall block.
- Assistant messages use calm surface; user messages use accent but not neon.
- Loading state uses small typing/skeleton indicator.

**Verification:**
- Keyboard/composer does not hide content on mobile as much as web allows.
- Messages remain readable in both themes.
- Chat scroll does not fight the main page scroll.

---

## Task 12: Redesign profile, reports, friends, and notifications

**Objective:** Make secondary screens consistent and not overloaded.

**Files:**
- Modify: `components/taka-fintrack-app.tsx`
  - `ProfileView`
  - `ProfileFriendsView`
  - `ProfileReportsView`
  - `ReportsView`
  - `NotificationsView`
  - `ProfileSection`
  - `ProfileListButton`

**Implementation direction:**
- Profile overview:
  - compact identity header
  - settings rows with clear hierarchy
  - theme toggle integrated tastefully
- Reports:
  - monthly statement cards become premium document tiles
  - charts get dark-mode aware colors
  - avoid too many chart panels stacked without explanation
- Friends:
  - friend requests and friend list separated with calm headings
  - actions are easy to tap
- Notifications:
  - chronological list with clear status/action buttons
  - empty state is polished

**Verification:**
- Back navigation works for reports/friends.
- All buttons remain accessible and tappable.
- Dark mode reports/charts readable.

---

## Task 13: Create reusable primitives and reduce class chaos

**Objective:** Make future UI work easier and prevent regression into messy stacked styling.

**Files:**
- Preferred create: `components/ui/app-primitives.tsx`
- Modify: `components/taka-fintrack-app.tsx`

**Implementation direction:**
Create small reusable components if refactor cost is reasonable:
- `AppSurface`
- `AppButton`
- `AppIconButton`
- `AppSectionHeader`
- `MetricText`
- `EmptyState`
- `StatusPill`

Rules:
- Do not over-abstract business logic.
- Use primitives for repeated surface/button/empty-state patterns only.
- Keep props simple.

**Verification:**
- Repeated hardcoded class chunks are reduced.
- App still builds.

---

## Task 14: Add loading, empty, and error states polish

**Objective:** Make every state feel complete.

**Files:**
- Modify: `components/taka-fintrack-app.tsx`
- Modify: `app/loading.tsx`
- Modify: `app/error.tsx`
- Modify: `app/global-error.tsx`

**Implementation direction:**
- Replace generic spinners with skeletons matching the layout.
- Empty transaction/dashboard/report/friend/notification states should include:
  - simple icon/illustration using existing icon set
  - concise title
  - one helpful action
- Error states should be direct and calm, no “Oops”.
- Use consistent `.app-surface` and `.app-button-*` classes.

**Verification:**
- Force empty data mentally / via local test state if possible.
- `npm run build` passes.

---

## Task 15: Accessibility and tactile polish pass

**Objective:** Ensure premium feel does not break usability.

**Files:**
- Modify: `components/taka-fintrack-app.tsx`
- Modify: `app/globals.css`

**Implementation direction:**
- Ensure buttons have labels where icon-only.
- Add/verify focus rings for buttons, fields, custom selects.
- Maintain sufficient contrast in both themes.
- Add `aria-current` to active nav where appropriate.
- Motion should be subtle and transform/opacity only.
- Respect `prefers-reduced-motion` in CSS for decorative animations.

**Verification:**
- Keyboard tab order is sane on desktop.
- Focus ring visible in light and dark mode.
- No animation causes layout shift.

---

## Task 16: Mobile QA matrix and final visual cleanup

**Objective:** Catch real mobile issues before production restart.

**Files:**
- Modify any affected UI files based on findings.
- Create: `docs/ui/taka-fintrack-mobile-qa.md`

**Manual QA matrix:**
- 390x844 mobile portrait
- 430x932 mobile portrait
- 768x1024 tablet portrait
- 1440x900 desktop
- Light mode and dark mode for each main route:
  - Home/dashboard
  - Transaksi
  - Scan
  - AI Chat
  - Profile
  - Reports
  - Friends
  - Notifications

**Check each screen:**
- no horizontal scroll
- no clipped buttons
- no nav overlap
- no giant blank bottom gap
- text readable
- tap targets comfortable
- dark mode surfaces correct

**Verification commands:**
- Run `npm run build`.
- If production update is requested later: build first, restart Taka FinTrack service, verify local and public endpoints.

---

## Implementation sequence recommendation

1. Audit + tokens first.
2. Shell/topbar/bottom nav second.
3. Dashboard and transactions third.
4. Scan/chat fourth.
5. Profile/reports/friends/notifications fifth.
6. Loading/empty/error/accessibility final.
7. Build and mobile QA before any restart.

## Out of scope for this plan

- Backend changes.
- Database schema changes.
- New payment/bank integrations.
- Replacing lucide-react with another icon library.
- Major route architecture migration.
- Commit/push/deploy unless Umar asks.

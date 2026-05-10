# Taka FinTrack Dark/Light Theme Redesign Plan

> **For Hermes:** Use this plan before touching UI again. Do not implement broad visual changes until the color system and contrast rules are locked.

**Goal:** Redesign Taka FinTrack theme system so dark mode and light mode both look polished, all icons/text remain visible, and the UI follows the proven blue/cyan/green dark SaaS style from the TakaSchool reference.

**Architecture:** Build a strict design-token layer first, then migrate UI components screen-by-screen. Avoid random Tailwind color overrides. Every card, text, icon, button, chart, and nav state must use semantic tokens that have tested light/dark values.

**Tech Stack:** Next.js 14, React, TypeScript, Tailwind CSS, CSS variables in `app/globals.css`, main UI in `components/taka-fintrack-app.tsx`.

---

## Reference Direction

Use the uploaded TakaSchool screenshot as visual benchmark:

- Dark mode base: deep navy/black gradient, not pure black.
- Accent: electric blue + cyan, with green only for WhatsApp/success/positive states.
- Text: strong white headings, readable slate/cyan-gray secondary text.
- Cards: dark elevated surfaces with subtle blue borders/glow.
- Buttons: primary blue gradient, secondary dark blue-gray.
- Icons: always high contrast; no pale gray icons on pale surfaces.
- Light mode: clean white/soft-blue surfaces with same blue/green semantic meaning.

---

## Color System

### Dark mode tokens

```css
:root[data-theme="dark"] {
  --bg: #050B18;
  --bg-2: #081426;
  --surface: #0D1B2F;
  --surface-2: #10233C;
  --surface-soft: rgba(15, 35, 60, 0.72);
  --border: rgba(96, 165, 250, 0.22);
  --text: #F8FAFC;
  --text-muted: #CBD5E1;
  --text-soft: #94A3B8;
  --primary: #2563EB;
  --primary-bright: #38BDF8;
  --primary-soft: rgba(37, 99, 235, 0.18);
  --success: #22C55E;
  --success-soft: rgba(34, 197, 94, 0.15);
  --warning: #F59E0B;
  --danger: #FB7185;
  --danger-soft: rgba(251, 113, 133, 0.16);
}
```

### Light mode tokens

```css
:root {
  --bg: #F6FAFF;
  --bg-2: #EEF6FF;
  --surface: #FFFFFF;
  --surface-2: #F8FBFF;
  --surface-soft: rgba(255, 255, 255, 0.82);
  --border: rgba(37, 99, 235, 0.14);
  --text: #0F172A;
  --text-muted: #475569;
  --text-soft: #64748B;
  --primary: #2563EB;
  --primary-bright: #0284C7;
  --primary-soft: #DBEAFE;
  --success: #16A34A;
  --success-soft: #DCFCE7;
  --warning: #D97706;
  --danger: #E11D48;
  --danger-soft: #FFE4E6;
}
```

### Semantic usage rules

- Blue/cyan = primary action, selected nav, links, finance focus.
- Green = income, success, positive health, WhatsApp/saved state.
- Red/pink = expense, negative balance, destructive actions.
- Yellow/orange = warning, pending, attention.
- Gray/slate = secondary labels only, never main icon on dark background.

---

## Contrast Rules

Minimum target:

- Body text: WCAG 4.5:1 or better.
- Large headings: WCAG 3:1 or better, but prefer 4.5:1.
- Icons: at least 3:1 against their background.
- Disabled/inactive nav icons: still readable; use `--text-muted`, not `--text-soft` on dark.
- Text on gradients must sit on a solid/semi-transparent chip/card.

Forbidden:

- Black text directly on bright gradients in dark mode.
- Light gray icons inside light cards in dark mode.
- Fixed bottom nav floating in the middle of the screen.
- Global CSS overrides that blindly convert every `.bg-white` into dark surfaces.
- Huge safe-area padding without visual test.

---

## Implementation Plan

### Task 1: Freeze repo baseline and create a visual checkpoint

**Objective:** Make sure current main UI is clean before redesign.

**Files:**
- Read only: `components/taka-fintrack-app.tsx`
- Read only: `app/globals.css`
- Read only: `tailwind.config.ts`

**Steps:**
1. Confirm `git status --short` is clean except this plan doc.
2. Run `npm run build`.
3. Keep preview at `http://43.133.155.252:3000`.
4. Ask for one baseline screenshot in dark and light mode if needed.

**Verification:**
- Build passes.
- No unintended UI files modified yet.

### Task 2: Add semantic theme tokens only

**Objective:** Add a safe design-token layer without changing layouts.

**Files:**
- Modify: `app/globals.css`

**Steps:**
1. Add the light and dark CSS variables above.
2. Add body background using tokens only.
3. Add utility classes:
   - `.theme-surface`
   - `.theme-surface-soft`
   - `.theme-border`
   - `.theme-text`
   - `.theme-muted`
   - `.theme-primary-button`
   - `.theme-secondary-button`
4. Do not override all Tailwind classes globally.

**Verification:**
- `npm run build` passes.
- Existing UI should look mostly unchanged except body background if connected.

### Task 3: Implement theme state cleanly

**Objective:** Add light/dark mode toggle with persistent localStorage, without causing hydration bugs.

**Files:**
- Modify: `components/taka-fintrack-app.tsx`

**Steps:**
1. Add `type ThemeMode = "light" | "dark"`.
2. Add `themeStorageKey = "taka-fintrack.theme"`.
3. Add `getInitialTheme()` that checks localStorage and `prefers-color-scheme`.
4. Add state inside `TakaFinTrackApp`.
5. Set `document.documentElement.dataset.theme = theme` in `useEffect`.
6. Add toggle button in `TopBar` only.

**Verification:**
- Toggle changes theme.
- Refresh keeps selected theme.
- No layout shift or console error.

### Task 4: Migrate app shell and top bar

**Objective:** Make app shell, top bar, and profile controls use safe theme tokens.

**Files:**
- Modify: `components/taka-fintrack-app.tsx`
- Modify: `app/globals.css` if needed

**Steps:**
1. Replace top-level hard-coded backgrounds with `theme-*` classes.
2. TopBar should follow reference:
   - dark: navy card, blue border, white title
   - light: white card, soft blue border, dark title
3. Ensure icon buttons have visible icon color:
   - dark icon: `#E0F2FE`
   - light icon: `#1E3A8A`
4. Keep mobile top spacing conservative: no giant padding.

**Verification:**
- Header visible on mobile browser.
- Theme toggle, bell, avatar all visible.

### Task 5: Migrate dashboard cards carefully

**Objective:** Make dashboard cards readable in both themes before touching other screens.

**Files:**
- Modify: `components/taka-fintrack-app.tsx`

**Steps:**
1. Hero balance card:
   - dark: `#071426` / `#0D1B2F`, blue glow border
   - light: white/soft blue card
2. Income card uses success green.
3. Expense card uses danger pink/red.
4. Action buttons:
   - Transaksi = blue gradient button
   - Scan Struk = dark/outlined secondary with visible icon
5. Do not place bottom nav over hero content.

**Verification:**
- Dashboard dark screenshot: all labels/icon visible.
- Dashboard light screenshot: no washed-out white-on-white or gray-on-gray.

### Task 6: Fix mobile bottom nav with stable layout

**Objective:** Bottom nav should stay at bottom and never cover important content.

**Files:**
- Modify: `components/taka-fintrack-app.tsx`
- Modify: `app/globals.css`

**Steps:**
1. Keep nav fixed at `bottom: calc(env(safe-area-inset-bottom) + 12px)`.
2. Add main padding bottom around `112px`, not excessive.
3. Active nav = blue gradient with white icon/text.
4. Inactive nav dark = `#CBD5E1` text/icon.
5. Inactive nav light = `#475569` text/icon.
6. Use icon stroke width 2.4–2.6.

**Verification:**
- On iPhone screenshot, nav is not in the middle.
- Last card can scroll above nav.
- Icons readable.

### Task 7: Migrate secondary screens one by one

**Objective:** Avoid breaking whole UI at once.

**Files:**
- Modify: `TransactionsView`, `ScanView`, `ChatView`, `ReportsView`, `AuthScreen` sections inside `components/taka-fintrack-app.tsx`.

**Order:**
1. Transactions.
2. Scan.
3. AI Chat.
4. Reports.
5. Auth.

**Rules:**
- Migrate one screen.
- Build.
- Preview.
- Ask for screenshot if visual risk is high.
- Then continue.

**Verification per screen:**
- Dark mode readable.
- Light mode readable.
- Icons visible.
- Buttons clearly tappable.
- No content hidden by nav/browser toolbar.

### Task 8: Add theme audit checklist before approval

**Objective:** Prevent repeating invisible text/icon bugs.

**Files:**
- Create: `docs/THEME_QA_CHECKLIST.md`

**Checklist:**
- Home dark/light screenshot reviewed.
- Transactions dark/light screenshot reviewed.
- Scan dark/light screenshot reviewed.
- AI Chat dark/light screenshot reviewed.
- Reports dark/light screenshot reviewed.
- Auth dark/light screenshot reviewed.
- Bottom nav does not overlap primary content.
- Icons visible in active/inactive/disabled states.
- Text on gradients has solid backing.
- `npm run build` passes.
- No commit until Umar approves.

---

## Execution Guardrails

- Do not rewrite the whole UI in one shot.
- Do not use broad CSS hacks like `[data-theme="dark"] .bg-white { ... }` across the whole app.
- Do not add huge safe-area padding based on one screenshot.
- Do not commit unless Umar explicitly says commit.
- After each meaningful UI pass, provide preview only.

---

## Acceptance Criteria

- Dark mode looks like the TakaSchool reference: deep navy, blue/cyan accents, readable white text, subtle borders.
- Light mode stays clean and professional.
- No invisible icons or low-contrast labels.
- Mobile bottom nav stays at bottom and does not cover key content.
- Build passes.
- Changes remain local until approved.

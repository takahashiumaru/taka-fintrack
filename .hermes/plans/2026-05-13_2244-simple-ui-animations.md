# Plan: Tambahkan animasi simple Taka FinTrack

## Goal
Membuat Taka FinTrack terasa lebih hidup dan tidak kaku, tanpa membuat UI terlalu ramai atau berat di mobile. Animasi harus subtle, cepat, smooth, dan tetap cocok untuk light/dark mode.

## Current context
- App utama ada di `components/taka-fintrack-app.tsx`.
- Styling global ada di `app/globals.css`.
- Taka FinTrack sudah punya desain mobile finance dengan kartu, bottom nav, modal detail transaksi, custom select/date picker, splash, AI chat, dan scan struk.
- User mengutamakan mobile UX yang polished, tidak glitch, dan tetap enak di dark/light mode.

## Prinsip animasi
- Durasi pendek: 150–450ms.
- Easing lembut: `cubic-bezier(.2,.8,.2,1)` atau Tailwind transition default yang smooth.
- Tidak membuat layout shift besar.
- Tidak mengganggu input/form.
- Hormati `prefers-reduced-motion: reduce`.
- Animasi hanya memperjelas hierarki, bukan dekorasi berlebihan.

## Proposed approach
Tambahkan utility animation di `app/globals.css`, lalu pasang class ke komponen penting di `components/taka-fintrack-app.tsx`.

## Step-by-step plan

### 1. Tambah global animation utilities
File: `app/globals.css`

Tambah keyframes dan utility class:
- `taka-fade-up`: fade + naik halus untuk card/section.
- `taka-scale-in`: scale 0.96 → 1 untuk modal/popover.
- `taka-soft-pop`: pop kecil untuk tombol action aktif.
- `taka-shine`: shimmer halus untuk gradient balance/card utama.
- `taka-progress-sweep`: progress/loading bar lebih smooth.
- `taka-nav-pop`: active bottom nav/camera button terasa hidup.

Tambahkan block:
- `@media (prefers-reduced-motion: reduce)` untuk mematikan animation dan transition berat.

### 2. Animasi page/section card
File: `components/taka-fintrack-app.tsx`

Target:
- Dashboard summary cards.
- Recent transactions card.
- Expense by Category card.
- Taka AI insight card.
- Transaction form/card.

Implementasi:
- Tambahkan class `taka-fade-up` dengan delay kecil berbasis urutan card.
- Bisa pakai inline style CSS variable: `style={{ "--motion-delay": "80ms" } as React.CSSProperties }` jika dibutuhkan.

### 3. Animasi transaction row
File: `components/taka-fintrack-app.tsx`

Target:
- `TransactionRow`

Implementasi:
- Hover/tap: `active:scale-[0.985]`, transition shadow/border.
- Entry: fade-up ringan untuk daftar transaksi.
- Action button edit/delete: scale saat tap, warna tetap sesuai tema.

Catatan:
- Jangan membuat row bergeser jauh agar tidak mengganggu click detail.
- Pastikan event modal yang sudah dipindah ke portal tetap aman.

### 4. Animasi modal detail transaksi
File: `components/taka-fintrack-app.tsx`

Target:
- Transaction detail modal.
- Confirm delete modal.

Implementasi:
- Backdrop: fade-in.
- Modal: `taka-scale-in` + sedikit translateY.
- Close tidak perlu exit animation kompleks karena state unmount langsung; cukup opening smooth.

Catatan:
- Jangan mengembalikan modal ke dalam row; tetap portal.
- Z-index tetap:
  - detail: `z-[1600]`
  - confirm delete: `z-[1700]`

### 5. Animasi custom select/date picker
File: `components/taka-fintrack-app.tsx`

Target:
- `CustomSelect`
- `CustomDateField`

Implementasi:
- Dropdown: fade/scale-in dari atas kecil.
- Option hover tetap smooth.
- Date cell selected/today: scale kecil saat active/hover.

### 6. Animasi bottom navigation
File: `components/taka-fintrack-app.tsx`

Target:
- `MobileNav`
- Camera center button

Implementasi:
- Active nav item: scale/pop ringan.
- Camera button: subtle hover/active pop, jangan pulse terus-menerus agar tidak norak.
- Bisa tambahkan glow kecil pada active camera/nav.

### 7. Animasi splash/loading
File: `components/taka-fintrack-app.tsx` dan `app/globals.css`

Target:
- Splash screen logo/progress.

Implementasi:
- Logo scale-in halus.
- Progress bar pakai sweep yang lebih clean.
- Tetap simple sesuai request sebelumnya.

### 8. Animasi AI Chat
File: `components/taka-fintrack-app.tsx`

Target:
- Chat bubbles.
- Typing indicator.

Implementasi:
- Bubble baru fade-up.
- Typing dots ringan.
- Jangan streaming chunk menyebabkan layout terlalu agresif; cukup container bubble yang animate saat pertama muncul.

## Files likely to change
- `app/globals.css`
  - tambah keyframes, utility classes, reduced-motion guard.
- `components/taka-fintrack-app.tsx`
  - tambah class animation ke card, modal, dropdown, nav, chat, splash.

## Validation checklist
- `npm run build` harus sukses.
- Restart service: `systemctl --user restart taka-fintrack`.
- Health check: `curl -sS http://127.0.0.1:3001/api/health`.
- Manual QA mobile:
  - buka dashboard light mode
  - buka dashboard dark mode
  - klik transaksi → modal detail muncul smooth di tengah
  - klik Edit/Hapus/Batal
  - buka custom select
  - buka date picker
  - pindah bottom nav
  - coba AI Chat
  - coba Scan Struk
- Pastikan tidak ada flicker/glitch baru.
- Pastikan `prefers-reduced-motion` mematikan animasi besar.

## Risks / tradeoffs
- Terlalu banyak animation class bisa bikin UI terasa ramai; harus pilih area penting saja.
- Animasi pada list panjang bisa berdampak performa di HP lama; gunakan animasi sederhana dan hindari animasi terus-menerus.
- Exit animation sulit tanpa state tambahan; untuk sekarang cukup opening animation agar implementasi aman.
- Jangan mengubah struktur modal portal yang baru diperbaiki.

## Suggested implementation order
1. Tambah CSS utilities + reduced-motion.
2. Terapkan ke modal detail + confirm delete dulu.
3. Terapkan ke cards/dashboard/list row.
4. Terapkan ke select/date picker.
5. Terapkan ke bottom nav + splash + chat.
6. Build, restart, QA mobile.

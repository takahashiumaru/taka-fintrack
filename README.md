# Taka FinTrack

Taka FinTrack adalah frontend mobile-first MVP untuk pengelolaan keuangan pribadi.

## Tech Stack
- Next.js 14 (App Router)
- TypeScript
- Capacitor (for mobile deployment)
- MySQL (via mysql2)
- Tailwind CSS

## Commands
- `npm run dev`: Start development server
- `npm run build`: Build project
- `npm run lint`: Lint project
- `npm run typecheck`: Run TypeScript check
- `npm run mobile:sync`: Sync project with Capacitor
- `npm run android:build:release`: Build Android release APK
- `npm run ios:open`: Open iOS project

## API Endpoints

Berikut adalah daftar endpoint API:

### Auth
- `POST /api/auth/register`: Daftar akun baru.
- `POST /api/auth/login`: Login.
- `POST /api/auth/logout`: Logout.
- `GET /api/auth/me`: Cek status user login & ambil token.
- `POST /api/auth/forgot-password`: Lupa password.
- `POST /api/auth/reset-password`: Reset password.
- `POST /api/auth/demo`: Akses demo (hanya pengembangan).

### Transaksi & Kategori
- `GET /api/transactions`: Ambil daftar transaksi (paginated).
- `GET /api/transactions/[id]`: Ambil detail transaksi.
- `POST /api/transactions`: Tambah transaksi.
- `PUT /api/transactions/[id]`: Update transaksi.
- `DELETE /api/transactions/[id]`: Hapus transaksi.
- `GET /api/categories`: Ambil daftar kategori.
- `POST /api/categories`: Tambah kategori.
- `GET /api/categories/[id]`: Ambil detail kategori.
- `PUT /api/categories/[id]`: Update kategori.
- `DELETE /api/categories/[id]`: Hapus kategori.

### Laporan & AI
- `GET /api/statements`: Daftar laporan bulanan.
- `GET /api/statements/[id]`: Ambil detail laporan bulanan.
- `POST /api/statements/generate`: Generate laporan bulanan.
- `GET /api/statements/[id]/download`: Unduh laporan (PDF).
- `POST /api/chat`: AI chat interface.
- `POST /api/scan-ai`: AI scan receipt interface.

### Sosial & Split Bill
- `GET /api/friends`: Daftar pertemanan.
- `POST /api/friends/request`: Kirim permintaan pertemanan.
- `PATCH /api/friends/[id]`: Update status pertemanan.
- `DELETE /api/friends/[id]`: Hapus pertemanan.
- `GET /api/split-requests`: Daftar split bill.
- `POST /api/split-requests`: Buat split bill.
- `PATCH /api/split-requests/[id]`: Update split bill.

### Profil & Notifikasi
- `POST /api/users/password`: Ubah password.
- `PATCH /api/users/profile`: Update profil.
- `GET /api/notifications`: Daftar notifikasi.
- `POST /api/notifications`: Tandai notifikasi dibaca.
- `PATCH /api/notifications/[id]`: Update notifikasi individual.
- `GET /api/health`: Status API & versi.
- `GET /api/routes`: Daftar semua route API.


## How to Build
1. Install dependencies: `npm install`
2. Run build: `npm run build`
3. For mobile deployment:
   - Run `npm run mobile:assets` to generate icons/splash.
   - Run `npm run mobile:sync` to update native project sources.
   - Run `npm run android:open` or `npm run ios:open` to finalize in Android Studio/Xcode.


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

Berikut adalah beberapa endpoint API utama:
- `GET /api/health`: Cek status API, latensi DB, dan versi aplikasi.
- `GET /api/transactions`: Ambil daftar transaksi (paginated).
- `GET /api/transactions/[id]`: Ambil detail transaksi.
- `POST /api/transactions`: Tambah transaksi baru.
- `GET /api/categories`: Ambil daftar kategori pengguna.
- `GET /api/categories/[id]`: Ambil detail kategori.
- `POST /api/categories`: Tambah kategori baru.
- `GET /api/routes`: Daftar semua route API yang terdaftar.
- `GET /api/statements`: Daftar laporan bulanan.
- `POST /api/statements/generate`: Generate laporan bulanan.
- `GET /api/statements/[id]/download`: Unduh file laporan bulanan (PDF).
- `POST /api/users/password`: Ubah password pengguna yang sedang login.
- `PATCH /api/users/profile`: Update profil pengguna.
- `GET /api/friends`: Ambil daftar pertemanan.
- `POST /api/friends/request`: Kirim permintaan pertemanan.
- `GET /api/split-requests`: Ambil daftar tagihan split bill.
- `POST /api/split-requests`: Buat permintaan split bill baru.
- `GET /api/notifications`: Ambil daftar notifikasi.


## How to Build
1. Install dependencies: `npm install`
2. Run build: `npm run build`
3. For mobile, run `npm run mobile:sync` then open respective native IDE.

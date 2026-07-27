# Taka FinTrack

Frontend MVP untuk Taka FinTrack, aplikasi pelacak keuangan dengan fitur scan struk AI.

## Tech Stack
- Next.js 14
- TypeScript
- MySQL (via PlanetScale/RDS)
- Capacitor (for mobile app)
- Tesseract.js (for receipt scanning)

## Setup
1. `npm install`
2. `cp .env.example .env`
3. `npm run dev`

## API Endpoints
- `GET /api/health`: Cek status aplikasi, database, dan versi.
- `GET /api/routes`: Daftar semua route yang tersedia.
- `GET /api/transactions`: Ambil daftar transaksi (paginated).
- `POST /api/transactions`: Buat transaksi baru.
- `GET /api/transactions/:id`: Ambil detail transaksi.
- `PUT /api/transactions/:id`: Update transaksi.
- `DELETE /api/transactions/:id`: Hapus transaksi.
- `GET /api/categories`: Ambil daftar kategori.
- `POST /api/categories`: Buat kategori baru.
- `GET /api/categories/:id`: Ambil detail kategori.
- `GET /api/friends`: Ambil daftar teman dan permintaan pertemanan.
- `POST /api/friends/request`: Kirim permintaan pertemanan.
- `PATCH /api/friends/:id`: Aksi pertemanan (accept/decline).
- `DELETE /api/friends/:id`: Hapus pertemanan.
- `GET /api/split-requests`: Ambil semua permintaan split (masuk dan keluar).
- `POST /api/split-requests`: Buat permintaan split baru.
- `PATCH /api/split-requests/:id`: Aksi split request (accept/reject).
- `POST /api/scan-ai`: Scan struk menggunakan AI.
- `POST /api/chat`: AI chat assistant.
- `GET /api/notifications`: Ambil daftar notifikasi.
- `POST /api/notifications`: Buat notifikasi baru.
- `PATCH /api/notifications/:id`: Update status notifikasi (read/unread).
- `POST /api/auth/register`: Daftar akun baru.
- `POST /api/auth/login`: Login.
- `POST /api/auth/logout`: Logout.
- `GET /api/auth/me`: Ambil data user yang sedang login.
- `POST /api/auth/forgot-password`: Lupa password.
- `POST /api/auth/reset-password`: Reset password.
- `POST /api/auth/demo`: Login sebagai akun demo.
- `POST /api/users/password`: Update password.
- `POST /api/users/profile`: Update profil.
- `POST /api/statements/generate`: Generate laporan keuangan.
- `GET /api/statements/:id/download`: Download laporan keuangan.

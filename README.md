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
- `GET /api/transactions/:id`: Ambil detail transaksi.

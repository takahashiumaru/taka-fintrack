# 💰 Taka FinTrack

Taka FinTrack adalah aplikasi personal finance modern berbasis web + mobile wrapper. Fokusnya: catat transaksi harian, scan struk dengan AI, lihat cashflow bulanan, dan tanya insight ke Taka AI dalam UI yang terasa seperti aplikasi finance premium.

![Taka FinTrack desktop dashboard](docs/assets/taka-fintrack-dashboard-desktop.jpg)

![Taka FinTrack mobile home](docs/assets/taka-fintrack-mobile-home.jpg)

## ✨ Fitur Utama

- **Dashboard Finance Real-time**
  - Ringkasan balance, income, expense, budget usage, dan finance health.
  - Angka utama memakai counting animation agar terasa hidup.
  - Card dan panel memakai micro-animation yang ringan di mobile.

- **Transaksi Harian**
  - Tambah, edit, hapus, dan lihat detail transaksi.
  - Detail transaksi memakai modal mobile-friendly yang center di HP.
  - Pagination transaksi agar data tetap ringan.

- **AI Receipt Scanner**
  - Upload foto struk dari kamera atau galeri.
  - AI membantu membaca merchant, nominal, kategori, tanggal, dan catatan.
  - Fallback aman kalau AI gagal membaca struk.

- **Taka AI Assistant**
  - Chat finance assistant untuk insight pengeluaran dan cashflow.
  - Auth fallback via Bearer token agar tetap jalan di browser/mobile yang cookie-nya ketat.

- **Mobile-first UX**
  - Bottom navigation dengan tombol scan utama.
  - Pull-to-refresh di mobile: tarik dari atas untuk refresh data transaksi/kategori.
  - Dark/light mode.
  - PWA icon, splash, dan cache image/static asset.

- **Authentication & Security**
  - Login/register.
  - HTTP-only session cookie + fallback token.
  - Forgot/reset password via email.
  - Rate limiting untuk endpoint sensitif.

- **APK & iOS Wrapper Ready**
  - Sudah disiapkan dengan Capacitor.
  - Android APK bisa dibuild dari Android Studio atau terminal.
  - iOS bisa di-run langsung ke iPhone via Xcode tanpa App Store.
  - App mobile membuka production URL: `https://takahashiumaru.my.id`.

## 🛠️ Tech Stack

- **Framework**: Next.js 14 App Router
- **UI**: React 18, TailwindCSS, custom design tokens
- **Charts**: Recharts
- **Icons**: Lucide React
- **Database**: MySQL via `mysql2`
- **AI/OCR**: OpenAI-compatible/9Router API integration
- **Email**: Nodemailer SMTP
- **Mobile Wrapper**: Capacitor Android + iOS

## 🚀 Web Development Setup

### Prasyarat

- Node.js 18+
- MySQL
- npm

### Clone dan install

```bash
git clone https://github.com/takahashiumaru/taka-fintrack.git
cd taka-fintrack
npm install
```

### Environment

Buat `.env.local`:

```env
DATABASE_URL="mysql://user:password@localhost:3306/taka_fintrack"
AUTH_SECRET="your-random-secret-key"

# Optional AI provider
OPENAI_API_KEY="..."
OPENAI_BASE_URL="..."
OPENAI_MODEL="..."

# Optional SMTP password reset
SMTP_HOST="smtp.example.com"
SMTP_PORT="587"
SMTP_USER="user@example.com"
SMTP_PASS="password"
SMTP_FROM="Taka FinTrack <noreply@example.com>"
```

### Run development server

```bash
npm run dev
```

Buka:

```text
http://localhost:3001
```

### Build production

```bash
npm run build
npm run start
```

## 📱 Mobile APK/iOS Build

Repo ini sudah diprepare agar setelah clone bisa langsung sync/build mobile wrapper.

Production URL yang dibuka app native:

```text
https://takahashiumaru.my.id
```

Quick commands:

```bash
npm install
npm run mobile:sync
```

Android:

```bash
npm run android:open
npm run android:build:debug
```

Output debug APK:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

iOS:

```bash
npm run ios:open
```

Lalu di Xcode pilih Apple ID/team, colok iPhone, klik **Run**. Tidak perlu App Store untuk install ke iPhone pribadi.

Panduan lengkap ada di [`MOBILE_BUILD.md`](./MOBILE_BUILD.md).

## 🎨 Design Notes

Taka FinTrack memakai gaya visual:

- navy/blue/cyan glass finance dashboard
- rounded card besar, soft shadow, gradient action button
- mobile bottom nav seperti native app
- subtle motion, bukan animasi berlebihan
- custom app-styled controls untuk mobile Safari
- cache image/static asset agar lebih ringan di HP

## 📂 Struktur Penting

```text
app/                         Next.js routes, API, layout
components/taka-fintrack-app.tsx
lib/server/                  auth, db, ai helpers
public/images/               logo/app assets
public/icons/                PWA icons generated from logo
android/                     Capacitor Android project
ios/                         Capacitor iOS project
resources/                   mobile icon/splash source
MOBILE_BUILD.md              tutorial build APK/iOS
```

## ✅ Useful Scripts

```bash
npm run dev                    # local web dev
npm run build                  # production build check
npm run start                  # start Next.js production
npm run mobile:sync            # Capacitor sync Android/iOS
npm run mobile:assets          # regenerate icon/splash then sync
npm run android:open           # open Android Studio
npm run android:build:debug    # build debug APK
npm run android:build:release  # build unsigned release APK
npm run ios:open               # open Xcode project
npm run ios:sync               # sync iOS only
```

---

Developed by [Umar Maruf Mutaqin](https://github.com/takahashiumaru)


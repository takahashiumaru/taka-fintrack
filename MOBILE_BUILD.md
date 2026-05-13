# Taka FinTrack Mobile Build Guide

Panduan ini menyiapkan repo agar setelah `git clone`, kamu bisa langsung build Taka FinTrack menjadi aplikasi Android APK atau iOS app wrapper tanpa App Store.

Mobile app ini memakai **Capacitor** dan membuka web production:

- Production URL: `https://takahashiumaru.my.id`
- App ID: `id.takahashiumaru.takafintrack`
- App name: `Taka FinTrack`
- Logo/icon source: `public/images/taka-logo-v3.png`

> Catatan: karena memakai production URL, mobile app tetap membutuhkan internet dan memakai backend/web asli di domain production. Tidak perlu menjalankan Next.js lokal hanya untuk membuka app di HP.

---

## 1. Clone repo

```bash
git clone https://github.com/takahashiumaru/taka-fintrack.git
cd taka-fintrack
npm install
```

---

## 2. Sync mobile project

Jalankan ini setelah clone atau setiap kali config/web asset berubah:

```bash
npm run mobile:sync
```

Kalau logo diganti, generate ulang icon/splash:

```bash
npm run mobile:assets
```

Ini akan membuat/memperbarui icon Android, icon iOS, dan splash screen dari:

```text
public/images/taka-logo-v3.png
```

---

## 3. Build Android APK

### Syarat di laptop/PC

- Java JDK 17+
- Android Studio
- Android SDK sudah terpasang
- USB debugging aktif di HP Android kalau mau install langsung

### Buka project Android

```bash
npm run android:open
```

Lalu di Android Studio:

1. Tunggu Gradle sync selesai.
2. Pilih device/emulator.
3. Klik **Run** untuk install langsung ke HP.

### Generate debug APK via terminal

```bash
npm run android:build:debug
```

Output APK:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Install ke HP Android:

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

### Generate release APK

```bash
npm run android:build:release
```

Output release APK:

```text
android/app/build/outputs/apk/release/app-release-unsigned.apk
```

> Untuk dibagikan ke orang lain, release APK perlu signing key. Untuk testing pribadi, debug APK biasanya cukup.

---

## 4. Build iOS langsung ke iPhone tanpa App Store

### Syarat wajib

- Harus di macOS
- Xcode terinstall
- iPhone tersambung kabel USB
- Apple ID login di Xcode

> Bisa pakai Apple ID gratis, tapi app biasanya perlu di-reinstall/sign ulang setelah beberapa hari. Untuk durasi lebih panjang pakai Apple Developer Program.

### Buka project iOS

```bash
npm run ios:open
```

Di Xcode:

1. Buka target **App**.
2. Masuk tab **Signing & Capabilities**.
3. Centang **Automatically manage signing**.
4. Pilih **Team** Apple ID kamu.
5. Pastikan Bundle Identifier:

```text
id.takahashiumaru.takafintrack
```

6. Sambungkan iPhone via USB.
7. Pilih iPhone sebagai target device.
8. Klik tombol **Run ▶**.
9. Kalau muncul warning trust/developer:
   - iPhone → Settings → General → VPN & Device Management
   - Trust developer Apple ID kamu.

Setelah itu app Taka FinTrack akan muncul di Home Screen iPhone dengan logo Taka FinTrack.

---

## 5. Update web/app setelah ada perubahan

Karena mobile app menunjuk ke production URL, perubahan UI/backend di production otomatis terlihat di app setelah domain production ter-update.

Kalau yang berubah adalah native config/icon/splash:

```bash
npm run mobile:assets
npm run mobile:sync
```

Lalu build/run ulang dari Android Studio atau Xcode.

---

## 6. Script yang tersedia

```bash
npm run mobile:sync          # Sync Capacitor Android/iOS
npm run mobile:assets        # Generate icon/splash lalu sync
npm run android:open         # Buka Android Studio
npm run android:build:debug  # Build APK debug
npm run android:build:release # Build APK release unsigned
npm run ios:open             # Buka Xcode project
npm run ios:sync             # Sync iOS saja
```

---

## 7. Troubleshooting

### iOS tidak bisa camera/scan
Pastikan app dibuka dari device asli dan domain `https://takahashiumaru.my.id` aktif. Camera membutuhkan secure context.

### iPhone gagal install
Cek:
- iPhone sudah trust Mac.
- Bundle Identifier unik.
- Signing Team sudah dipilih.
- Developer mode aktif jika iOS meminta.

### Android build gagal karena SDK/JDK
Buka Android Studio sekali, install SDK yang diminta, lalu ulang:

```bash
npm run android:build:debug
```

### Icon belum berubah
Jalankan ulang:

```bash
npm run mobile:assets
```

Lalu uninstall app lama dari HP dan install ulang.

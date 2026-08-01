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
- `GET /api/health`: Check API status, database latency, and app version.

## How to Build
1. Install dependencies: `npm install`
2. Run build: `npm run build`
3. For mobile, run `npm run mobile:sync` then open respective native IDE.

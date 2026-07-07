# Taka FinTrack Development Guide

This document provides a quick overview of the project structure and setup instructions for developers.

## Tech Stack
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Mobile:** Capacitor
- **Styling:** Tailwind CSS
- **Database:** MySQL (via mysql2)

## Project Structure
- `/app`: Next.js routes and API endpoints.
- `/components`: Reusable React components (e.g., `taka-fintrack-app.tsx`).
- `/lib`: Server-side utilities (auth, db, mail) and client helpers.
- `/public`: Static assets (icons, manifest).

## Setup Instructions
1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Environment Variables:**
   Copy `.env.example` (if available) to `.env.local` and fill in the required values (e.g., `DATABASE_URL`, `JWT_SECRET`).
3. **Development Server:**
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:3001`.

## Scripts
- `npm run dev`: Start development server.
- `npm run build`: Create a production build.
- `npm run lint`: Run ESLint.
- `npm run mobile:sync`: Sync Capacitor changes.

## Contributing
- Follow conventional commits (feat, fix, refactor, docs, chore).
- Ensure `npm run build` passes before pushing.

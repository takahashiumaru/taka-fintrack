# Taka FinTrack

Taka FinTrack is a modern, responsive frontend for a personal finance tracking application. Built with Next.js, TypeScript, and Capacitor, it provides a seamless user experience on both web and mobile platforms.

## Features

- **Transaction Management:** Add, edit, and view your daily expenses and income.
- **AI-Powered Scanning:** Scan receipts to automatically input transaction data.
- **Friend & Split Bills:** Connect with friends and easily split shared expenses.
- **Financial Statements:** Generate monthly PDF statements for your records.
- **Cross-Platform:** Runs on web, Android, and iOS from a single codebase.

## Tech Stack

- **Framework:** [Next.js](https://nextjs.org/)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/)
- **Mobile:** [Capacitor](https://capacitorjs.com/)
- **UI Components:** Custom components with `lucide-react` for icons.

## Getting Started

### Prerequisites

- Node.js (v20 or later)
- npm or yarn

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/takahashiumaru/taka-fintrack.git
    cd taka-fintrack
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

### Running the Development Server

To run the app in development mode for web:

```bash
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) to view it in your browser.

### Building for Production

To create a production-ready build:

```bash
npm run build
```

### API Endpoints

### Authentication
- `POST /api/auth/login`: Login with credentials.
- `POST /api/auth/register`: Register a new user.
- `GET /api/auth/me`: Get current user profile.

### Transactions
- `GET /api/transactions`: List transactions with pagination (`page`, `limit`). Returns `{ transactions, pagination: { page, limit, total, totalPages }, summary }`.
- `POST /api/transactions`: Create a new transaction.

### Categories
- `GET /api/categories`: List all categories with transaction counts.
- `GET /api/categories/[id]`: Get details for a specific category.
- `POST /api/categories`: Create a new category.

### Social
- `GET /api/friends`: List friends.
- `POST /api/split-requests`: Create a split request.

### Utilities
- `GET /api/version`: Get the current application version.
- `GET /api/health`: Health check with DB latency and version.

## Mobile Development (Capacitor)

To run on a mobile device or emulator:

1.  **Sync the web build:**
    ```bash
    npm run mobile:sync
    ```

2.  **Open in native IDE:**
    ```bash
    # For Android
    npm run android:open

    # For iOS
    npm run ios:open
    ```

From there, you can run the app on your connected device or emulator.

# 💰 Taka FinTrack

![Taka FinTrack Preview](taka-fintrack.png)

Taka FinTrack is a premium, AI-powered personal finance management application. Designed for clarity and insight, it helps you track every penny with a stunning user interface and intelligent features.

## ✨ Key Features

- **🚀 Smart Dashboard**: Real-time overview of your financial status with beautiful charts (Recharts).
- **📅 Month & Date Navigation**: Navigate through your financial history with a custom month picker and date-range filtering.
- **📝 Seamless Transactions**: Log income and expenses with precise categorization and real-time balance updates.
- **📸 AI Receipt Scanner**: Extract transaction details automatically from photos of your receipts (powered by Tesseract.js).
- **🤖 Taka AI Assistant**: A dedicated AI chat interface to get insights on your spending habits and financial health.
- **🛡️ Secure & Private**: Built with JWT-based session management and personalized data access.
- **📱 Responsive Excellence**: A "premium-feel" UI that adapts perfectly to desktop and mobile devices.

## 🛠️ Technology Stack

- **Framework**: [Next.js 14](https://nextjs.org/)
- **Styling**: TailwindCSS with Custom Design Tokens
- **Database**: MySQL (via `mysql2`)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Charts**: [Recharts](https://recharts.org/)
- **AI/OCR**: [Tesseract.js](https://tesseract.projectnaptha.com/)

## 🏁 Getting Started

### Prerequisites

- Node.js (v18+)
- MySQL instance

### Installation & Setup

1. **Clone the Repo**
   ```bash
   git clone https://github.com/takahashiumaru/taka-fintrack.git
   cd taka-fintrack
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment**
   Create a `.env.local` file (or rename `.env.example`):
   ```env
   DATABASE_URL="mysql://user:password@localhost:3306/taka_fintrack"
   AUTH_SECRET="your-random-secret-key"
   ```

4. **Run Development Server**
   ```bash
   npm run dev
   ```

5. **Visit the App**
   Navigate to [http://localhost:3001](http://localhost:3001)

## 🎨 Design Philosophy

Taka FinTrack prioritizes a **Modern & Alive** interface. We use:
- **Gradients & Glassmorphism**: For a premium, state-of-the-art look.
- **Micro-animations**: Using Tailwind transition and bounce effects for interactive elements.
- **Dynamic Feedback**: Real-time health scoring and daily limit tracking.

---

Developed by [Umar Maruf Mutaqin](https://github.com/takahashiumaru)

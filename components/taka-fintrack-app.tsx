"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Bot,
  Camera,
  ChartNoAxesColumnIncreasing,
  Check,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  FileText,
  Home,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  MoreHorizontal,
  Plus,
  ReceiptText,
  ScanLine,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ViewKey = "dashboard" | "transactions" | "scan" | "chat" | "reports";
type AuthMode = "login" | "register";

type AuthUser = {
  id: number;
  name: string;
  email: string;
  avatarUrl?: string | null;
};

type AuthSession = {
  user: AuthUser;
  token: string;
};

type Transaction = {
  id: string;
  rawId: number;
  categoryId: number | null;
  merchant: string;
  category: string;
  categoryColor: string;
  amount: number;
  type: "income" | "expense";
  date: string;
  source: "Manual" | "Scan";
  transactionDate: string | null;
  createdAt: string;
};

type ApiTransaction = {
  id: number;
  categoryId: number | null;
  merchant: string;
  category: string;
  categoryColor: string;
  amount: number;
  type: "income" | "expense";
  transactionDate: string | null;
  source: "Manual" | "Scan";
  createdAt: string;
};

type CategoryType = "income" | "expense" | "both";

type Category = {
  id: number;
  name: string;
  type: CategoryType;
  color: string;
  transactionCount: number;
};

type TransactionInput = {
  merchant: string;
  amount: number;
  type: "income" | "expense";
  categoryId?: number;
  category?: string;
  transactionDate?: string;
  source?: "Manual" | "Scan";
};

type CategoryInput = {
  name: string;
  type: CategoryType;
  color: string;
};

type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};

type ReceiptItem = {
  name: string;
  qty: number;
  price: number;
};

type ScannedReceipt = {
  merchant: string;
  date: string;
  payment: string;
  subtotal: number;
  discount: number;
  total: number;
  confidence: number;
  items: ReceiptItem[];
  source: "ocr" | "demo";
};

const currency = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const navItems: Array<{ key: ViewKey; label: string; icon: LucideIcon }> = [
  { key: "dashboard", label: "Home", icon: Home },
  { key: "transactions", label: "Transaksi", icon: ReceiptText },
  { key: "scan", label: "Scan", icon: Camera },
  { key: "chat", label: "AI Chat", icon: MessageCircle },
  { key: "reports", label: "Laporan", icon: ChartNoAxesColumnIncreasing },
];

const viewStorageKey = "taka-fintrack.active-view";
const authStorageKey = "taka-fintrack.auth-user";
const authTokenStorageKey = "taka-fintrack.auth-token";
const chatHistoryStorageKey = "taka-fintrack.chat-history";

function isViewKey(value: string | null | undefined): value is ViewKey {
  return Boolean(value && navItems.some((item) => item.key === value));
}

function isAuthUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== "object") return false;

  const maybeUser = value as Partial<AuthUser>;

  return Boolean(
    typeof maybeUser.id === "number" &&
    typeof maybeUser.name === "string" &&
      maybeUser.name.trim() &&
      typeof maybeUser.email === "string" &&
      maybeUser.email.includes("@") &&
      (typeof maybeUser.avatarUrl === "undefined" ||
        typeof maybeUser.avatarUrl === "string" ||
        maybeUser.avatarUrl === null),
  );
}

function getInitialView() {
  if (typeof window === "undefined") return "dashboard";

  const hashView = window.location.hash.replace("#", "");
  if (isViewKey(hashView)) return hashView;

  try {
    const savedView = window.localStorage.getItem(viewStorageKey);
    if (isViewKey(savedView)) return savedView;
  } catch {
    return "dashboard";
  }

  return "dashboard";
}

function getStoredUser() {
  if (typeof window === "undefined") return null;

  try {
    const storedUser = window.localStorage.getItem(authStorageKey);
    if (!storedUser) return null;

    const parsedUser: unknown = JSON.parse(storedUser);
    return isAuthUser(parsedUser) ? parsedUser : null;
  } catch {
    return null;
  }
}

function getStoredToken() {
  if (typeof window === "undefined") return "";

  try {
    return window.localStorage.getItem(authTokenStorageKey) ?? "";
  } catch {
    return "";
  }
}

async function apiRequest<T>(url: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    ...init,
    headers,
  });
  const payload: unknown = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = payload && typeof payload === "object" && "error" in payload
      ? String((payload as { error: unknown }).error)
      : "Request gagal.";

    const err = new Error(error);
    (err as any).status = response.status;
    throw err;
  }

  return payload as T;
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
  };
}

function normalizeApiTransaction(transaction: ApiTransaction): Transaction {
  return {
    id: `TRX-${String(transaction.id).padStart(4, "0")}`,
    rawId: transaction.id,
    categoryId: transaction.categoryId,
    merchant: transaction.merchant,
    category: transaction.category,
    categoryColor: transaction.categoryColor || "#64748B",
    amount: transaction.amount,
    type: transaction.type,
    date: formatTransactionDate(transaction.transactionDate ?? transaction.createdAt),
    source: transaction.source,
    transactionDate: transaction.transactionDate,
    createdAt: transaction.createdAt,
  };
}

function getTransactionDate(transaction: Pick<Transaction, "transactionDate" | "createdAt">) {
  return new Date(transaction.transactionDate ?? transaction.createdAt);
}

function formatTransactionDate(value: string | null) {
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) return "Tanggal tidak valid";

  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const time = `${String(date.getHours()).padStart(2, "0")}.${String(date.getMinutes()).padStart(2, "0")}`;

  if (isSameDay(date, now)) return `Hari ini, ${time}`;
  if (isSameDay(date, yesterday)) return `Kemarin, ${time}`;

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function isSameDay(firstDate: Date, secondDate: Date) {
  return (
    firstDate.getFullYear() === secondDate.getFullYear() &&
    firstDate.getMonth() === secondDate.getMonth() &&
    firstDate.getDate() === secondDate.getDate()
  );
}

function isSameMonth(date: Date, referenceDate = new Date()) {
  return date.getFullYear() === referenceDate.getFullYear() && date.getMonth() === referenceDate.getMonth();
}

function getDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("id-ID", { month: "short" }).format(date);
}

function getDayLabel(date: Date) {
  return new Intl.DateTimeFormat("id-ID", { weekday: "short" }).format(date);
}

function getSoftColor(color: string) {
  if (/^#[0-9A-Fa-f]{6}$/.test(color)) return `${color}1A`;

  return "#F1F5F9";
}

function getFinanceAnalytics(transactions: Transaction[]) {
  const now = new Date();
  const currentMonthTransactions = transactions.filter((transaction) => {
    const date = getTransactionDate(transaction);

    return !Number.isNaN(date.getTime()) && isSameMonth(date, now);
  });
  const income = currentMonthTransactions
    .filter((transaction) => transaction.type === "income")
    .reduce((total, transaction) => total + transaction.amount, 0);
  const expense = currentMonthTransactions
    .filter((transaction) => transaction.type === "expense")
    .reduce((total, transaction) => total + transaction.amount, 0);
  const balance = income - expense;
  const savingsRatio = income > 0 ? Math.max(0, Math.round((balance / income) * 100)) : 0;
  const weekly = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (6 - index));

    const dayTransactions = transactions.filter((transaction) => isSameDay(getTransactionDate(transaction), date));

    return {
      day: getDayLabel(date),
      income: Math.round(dayTransactions.filter((item) => item.type === "income").reduce((total, item) => total + item.amount, 0) / 1000),
      expense: Math.round(dayTransactions.filter((item) => item.type === "expense").reduce((total, item) => total + item.amount, 0) / 1000),
    };
  });
  const expenseByCategory = currentMonthTransactions
    .filter((transaction) => transaction.type === "expense")
    .reduce<Record<string, { name: string; amount: number; color: string }>>((groups, transaction) => {
      const key = transaction.category;
      groups[key] = groups[key] ?? { name: transaction.category, amount: 0, color: transaction.categoryColor };
      groups[key].amount += transaction.amount;

      return groups;
    }, {});
  const categoryBreakdown = Object.values(expenseByCategory)
    .sort((first, second) => second.amount - first.amount)
    .map((item) => ({
      ...item,
      value: expense > 0 ? Math.round((item.amount / expense) * 100) : 0,
    }));
  const trend = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const monthTransactions = transactions.filter((transaction) => isSameMonth(getTransactionDate(transaction), date));

    return {
      month: getMonthLabel(date),
      income: Number((monthTransactions.filter((item) => item.type === "income").reduce((total, item) => total + item.amount, 0) / 1_000_000).toFixed(2)),
      expense: Number((monthTransactions.filter((item) => item.type === "expense").reduce((total, item) => total + item.amount, 0) / 1_000_000).toFixed(2)),
    };
  });

  const scanCount = transactions.filter((transaction) => {
    const date = getTransactionDate(transaction);
    return transaction.source === "Scan" && isSameDay(date, now);
  }).length;

  return {
    income,
    expense,
    balance,
    savingsRatio,
    scanCount,
    currentMonthCount: currentMonthTransactions.length,
    weekly,
    categoryBreakdown,
    trend,
  };
}

function createNameFromEmail(email: string) {
  const localPart = email.split("@")[0] ?? "";
  const name = localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");

  return name || "User Taka";
}

function getInitials(name: string) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return initials || "TF";
}

const summaryCards = [
  {
    label: "Pemasukan",
    value: 8450000,
    delta: "+12,4%",
    icon: ArrowUpRight,
    tone: "text-emerald-600",
    bg: "bg-emerald-50",
  },
  {
    label: "Pengeluaran",
    value: 3965000,
    delta: "-8,1%",
    icon: ArrowDownRight,
    tone: "text-rose-500",
    bg: "bg-rose-50",
  },
  {
    label: "Saldo Bersih",
    value: 4485000,
    delta: "+24,5%",
    icon: WalletCards,
    tone: "text-violet-600",
    bg: "bg-violet-50",
  },
];

const weeklyData = [
  { day: "Sen", income: 900, expense: 430 },
  { day: "Sel", income: 420, expense: 610 },
  { day: "Rab", income: 760, expense: 520 },
  { day: "Kam", income: 510, expense: 360 },
  { day: "Jum", income: 1180, expense: 780 },
  { day: "Sab", income: 360, expense: 690 },
  { day: "Min", income: 690, expense: 450 },
];

const categoryData = [
  { name: "Makanan", value: 34, amount: 1350000, color: "#22C55E" },
  { name: "Belanja", value: 25, amount: 992000, color: "#8B5CF6" },
  { name: "Transport", value: 17, amount: 674000, color: "#F59E0B" },
  { name: "Hiburan", value: 14, amount: 553000, color: "#FF6B6B" },
  { name: "Lainnya", value: 10, amount: 396000, color: "#38BDF8" },
];

const trendData = [
  { month: "Des", income: 7.8, expense: 4.7 },
  { month: "Jan", income: 8.1, expense: 4.1 },
  { month: "Feb", income: 7.5, expense: 4.9 },
  { month: "Mar", income: 8.4, expense: 4.3 },
  { month: "Apr", income: 8.0, expense: 4.6 },
  { month: "Mei", income: 8.45, expense: 3.96 },
];

const indomaretExampleReceipt: ScannedReceipt = {
  merchant: "Indomaret",
  date: "16 Jun 2018, 17.08",
  payment: "Tunai",
  subtotal: 130650,
  discount: 14100,
  total: 116550,
  confidence: 88,
  source: "demo",
  items: [
    { name: "ABC ORANGE 525ML", qty: 1, price: 13500 },
    { name: "I/F BISC.WNDRLND 300", qty: 1, price: 20900 },
    { name: "LEXUS SANDW COKL 190", qty: 1, price: 26800 },
    { name: "LUWAK WHT ORGL 20X20", qty: 1, price: 25400 },
    { name: "OREO CHO & VAN 2X137", qty: 1, price: 19800 },
    { name: "TONG TJI JASM T/A.25", qty: 1, price: 9300 },
    { name: "KOPIKO 78C 240ML", qty: 2, price: 5500 },
    { name: "FRSTEA TEH MADU 350", qty: 1, price: 3950 },
    { name: "SOVIA M/GORENG 2L", qty: 1, price: 26950 },
  ],
};

const suggestedQuestions = [
  "Bulan ini aku boros di mana?",
  "Berapa rata-rata pengeluaran harianku?",
  "Kategori apa yang paling banyak menguras kantong?",
  "Tips hemat berdasarkan pola belanjaku?",
];

function getCameraErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return "Izin kamera ditolak. Aktifkan permission kamera untuk localhost, lalu coba lagi.";
    }

    if (error.name === "NotFoundError") {
      return "Kamera tidak ditemukan di perangkat ini. Kamu masih bisa upload foto struk.";
    }

    if (error.name === "NotReadableError") {
      return "Kamera sedang dipakai aplikasi lain. Tutup aplikasi kamera lain, lalu coba lagi.";
    }
  }

  return "Kamera belum bisa dibuka. Coba ulangi, atau upload foto struk sebagai cadangan.";
}

function parseReceiptAmount(value: string) {
  const numberText = value.replace(/[^\d]/g, "");
  return Number(numberText) || 0;
}

function formatReceiptDate(rawText: string) {
  const dateMatch = rawText.match(/(\d{2})[./-](\d{2})[./-](\d{2})[-\s]+(\d{1,2})[:.](\d{2})/);

  if (!dateMatch) return "Tanggal tidak terbaca";

  const [, day, month, year, hour, minute] = dateMatch;
  const monthName = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "Mei",
    "Jun",
    "Jul",
    "Agu",
    "Sep",
    "Okt",
    "Nov",
    "Des",
  ][Number(month) - 1] ?? month;

  return `${Number(day)} ${monthName} 20${year}, ${hour.padStart(2, "0")}.${minute}`;
}

function shouldSkipReceiptLine(line: string) {
  return /NPWP|JL\.|JALAN|SUKOHARJO|NGAGLIK|SLEMAN|HARGA|VOUCHER|CANCEL|TOTAL|TUNAI|KEMBALI|KASIR|RATIH|BESTI|JANGKANG|PRISMATAMA|INDOMARET/.test(line);
}

function parseReceiptText(rawText: string): ScannedReceipt {
  const text = rawText.toUpperCase().replace(/[|]/g, "I");
  const lines = text
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const items: ReceiptItem[] = [];

  for (const line of lines) {
    if (shouldSkipReceiptLine(line)) continue;

    const itemMatch = line.match(/^(.+?)\s+(\d{1,2})\s+([\d.,]{3,})\s+([\d.,]{3,})$/);

    if (!itemMatch) continue;

    const [, rawName, rawQty, rawPrice] = itemMatch;
    const qty = Number(rawQty);
    const price = parseReceiptAmount(rawPrice);

    if (!qty || !price) continue;

    items.push({
      name: rawName.trim(),
      qty,
      price,
    });
  }

  if (items.length < 3) {
    return indomaretExampleReceipt;
  }

  const subtotalMatch = text.match(/HARGA\s+JUAL\s*[:=]?\s*([\d,.]+)/);
  const voucherTotal = lines.reduce((total, line) => {
    if (!line.includes("VOUCHER")) return total;

    const amountMatch = line.match(/\(?([\d,.]{3,})\)?\s*$/);
    return total + (amountMatch ? parseReceiptAmount(amountMatch[1]) : 0);
  }, 0);
  const subtotal = subtotalMatch
    ? parseReceiptAmount(subtotalMatch[1])
    : items.reduce((total, item) => total + item.qty * item.price, 0);
  const discount = voucherTotal;

  return {
    merchant: text.includes("INDOMARET") ? "Indomaret" : "Struk Belanja",
    date: formatReceiptDate(text),
    payment: "Tunai",
    subtotal,
    discount,
    total: Math.max(subtotal - discount, 0),
    confidence: Math.min(96, 70 + items.length * 3),
    source: "ocr",
    items,
  };
}

export function TakaFinTrackApp() {
  const [activeView, setActiveView] = useState<ViewKey>(getInitialView);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(getStoredUser);
  const [authToken, setAuthToken] = useState(getStoredToken);
  const [isAuthChecking, setIsAuthChecking] = useState(Boolean(getStoredToken()));
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [dataStatus, setDataStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [dataError, setDataError] = useState("");
  const activeMeta = navItems.find((item) => item.key === activeView) ?? navItems[0];
  const analytics = useMemo(() => getFinanceAnalytics(transactions), [transactions]);
  const changeView = useCallback((view: ViewKey) => {
    setActiveView(view);
  }, []);
  const handleAuthenticated = useCallback((session: AuthSession) => {
    try {
      window.localStorage.setItem(authStorageKey, JSON.stringify(session.user));
      window.localStorage.setItem(authTokenStorageKey, session.token);
    } catch {
      // Ignore private browsing/storage restrictions.
    }

    setCurrentUser(session.user);
    setAuthToken(session.token);
  }, []);
  const handleUserUpdate = useCallback((updates: Partial<AuthUser>) => {
    setCurrentUser((currentUserValue) => {
      if (!currentUserValue) return currentUserValue;

      const nextUser = { ...currentUserValue, ...updates };

      try {
        window.localStorage.setItem(authStorageKey, JSON.stringify(nextUser));
      } catch {
        // Ignore private browsing/storage restrictions.
      }

      return nextUser;
    });
  }, []);
  const handleLogout = useCallback(() => {
    try {
      window.localStorage.removeItem(authStorageKey);
      window.localStorage.removeItem(authTokenStorageKey);
    } catch {
      // Ignore private browsing/storage restrictions.
    }

    setCurrentUser(null);
    setAuthToken("");
    setTransactions([]);
    setCategories([]);
    setDataStatus("idle");
  }, []);
  const refreshFinanceData = useCallback(async () => {
    if (!authToken) return;

    setDataStatus("loading");
    setDataError("");

    try {
      const [transactionResponse, categoryResponse] = await Promise.all([
        apiRequest<{ transactions: ApiTransaction[] }>("/api/transactions", {
          headers: authHeaders(authToken),
        }),
        apiRequest<{ categories: Category[] }>("/api/categories", {
          headers: authHeaders(authToken),
        }),
      ]);

      setTransactions(transactionResponse.transactions.map(normalizeApiTransaction));
      setCategories(categoryResponse.categories);
      setDataStatus("ready");
    } catch (error) {
      setDataStatus("error");
      setDataError(error instanceof Error ? error.message : "Data gagal dimuat.");
    }
  }, [authToken]);
  const createTransaction = useCallback(async (input: TransactionInput) => {
    if (!authToken) throw new Error("Sesi belum siap.");

    const response = await apiRequest<{ transaction: ApiTransaction }>("/api/transactions", {
      method: "POST",
      headers: authHeaders(authToken),
      body: JSON.stringify(input),
    });
    const nextTransaction = normalizeApiTransaction(response.transaction);

    setTransactions((current) => [nextTransaction, ...current]);

    return nextTransaction;
  }, [authToken]);
  const deleteTransaction = useCallback(async (rawId: number) => {
    if (!authToken) throw new Error("Sesi belum siap.");

    await apiRequest<{ success: boolean }>(`/api/transactions/${rawId}`, {
      method: "DELETE",
      headers: authHeaders(authToken),
    });

    setTransactions((current) => current.filter((t) => t.rawId !== rawId));
  }, [authToken]);
  const createCategory = useCallback(async (input: CategoryInput) => {
    if (!authToken) throw new Error("Sesi belum siap.");

    const response = await apiRequest<{ category: Category }>("/api/categories", {
      method: "POST",
      headers: authHeaders(authToken),
      body: JSON.stringify(input),
    });

    setCategories((current) => [...current, response.category]);

    return response.category;
  }, [authToken]);

  useEffect(() => {
    if (!authToken) {
      setIsAuthChecking(false);
      return;
    }

    let isCancelled = false;

    async function verifySession() {
      setIsAuthChecking(true);

      try {
        const response = await apiRequest<{ user: AuthUser }>("/api/auth/me", {
          headers: authHeaders(authToken),
        });

        if (isCancelled) return;

        setCurrentUser(response.user);

        try {
          window.localStorage.setItem(authStorageKey, JSON.stringify(response.user));
        } catch {
          // Ignore private browsing/storage restrictions.
        }
      } catch (error) {
        if (isCancelled) return;
        if (error instanceof Error && (error as any).status === 401) {
          handleLogout();
        }
      } finally {
        if (!isCancelled) {
          setIsAuthChecking(false);
        }
      }
    }

    void verifySession();

    return () => {
      isCancelled = true;
    };
  }, [authToken, handleLogout]);

  useEffect(() => {
    if (currentUser && authToken) {
      void refreshFinanceData();
    }
  }, [authToken, currentUser, refreshFinanceData]);

  useEffect(() => {
    try {
      window.localStorage.setItem(viewStorageKey, activeView);
    } catch {
      // Ignore private browsing/storage restrictions.
    }

    const nextHash = `#${activeView}`;

    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${nextHash}`);
    }
  }, [activeView]);

  useEffect(() => {
    function syncViewFromHash() {
      const nextView = window.location.hash.replace("#", "");

      if (isViewKey(nextView)) {
        setActiveView(nextView);
      }
    }

    window.addEventListener("hashchange", syncViewFromHash);
    return () => window.removeEventListener("hashchange", syncViewFromHash);
  }, []);

  if (isAuthChecking && !currentUser) {
    return <AuthLoadingScreen />;
  }

  if (!currentUser) {
    return <AuthScreen onAuthenticated={handleAuthenticated} />;
  }

  return (
    <main className="min-h-screen px-3 pb-24 pt-3 sm:px-4 lg:p-6">
      <div className="mx-auto grid w-full max-w-[1500px] gap-4 lg:grid-cols-[278px_minmax(0,1fr)]">
        <Sidebar
          activeView={activeView}
          onChange={changeView}
          user={currentUser}
          onLogout={handleLogout}
          scanCount={analytics.scanCount}
          healthScore={analytics.savingsRatio}
        />
        <section className="min-w-0 space-y-4">
          <TopBar
            title={activeMeta.label}
            user={currentUser}
            token={authToken}
            onUserUpdate={handleUserUpdate}
            onAddTransaction={() => changeView("transactions")}
            onLogout={handleLogout}
          />
          {dataStatus === "error" && (
            <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600">
              {dataError}
            </div>
          )}
          {activeView === "dashboard" && <DashboardView analytics={analytics} transactions={transactions} dataStatus={dataStatus} onNavigate={changeView} />}
          {activeView === "transactions" && (
            <TransactionsView
              transactions={transactions}
              categories={categories}
              dataStatus={dataStatus}
              onCreateTransaction={createTransaction}
              onCreateCategory={createCategory}
              onDeleteTransaction={deleteTransaction}
              onRefresh={refreshFinanceData}
            />
          )}
          {activeView === "scan" && <ScanView categories={categories} onCreateTransaction={createTransaction} onNavigate={changeView} />}
          {activeView === "chat" && <ChatView />}
          {activeView === "reports" && <ReportsView analytics={analytics} />}
        </section>
      </div>
      <MobileNav activeView={activeView} onChange={changeView} />
    </main>
  );
}

function AuthLoadingScreen() {
  return (
    <main className="grid min-h-screen place-items-center px-3 py-3">
      <div className="rounded-xl border border-white/70 bg-white/86 p-6 text-center shadow-soft backdrop-blur">
        <div className="mx-auto h-12 w-12 animate-pulse rounded-full border-4 border-emerald-300 border-t-taka-navy" />
        <p className="mt-4 text-sm font-black text-taka-ink">Mengecek sesi...</p>
      </div>
    </main>
  );
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: (session: AuthSession) => void }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isRegister = mode === "register";

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError("");
  }

  async function handleDemoLogin() {
    setIsSubmitting(true);
    setError("");

    try {
      const session = await apiRequest<AuthSession>("/api/auth/demo", {
        method: "POST",
      });
      onAuthenticated(session);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Demo login gagal.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();

    if (!normalizedEmail || !password.trim()) {
      setError("Email dan password wajib diisi.");
      return;
    }

    if (!normalizedEmail.includes("@")) {
      setError("Format email belum valid.");
      return;
    }

    if (isRegister) {
      if (!trimmedName) {
        setError("Nama wajib diisi untuk register.");
        return;
      }

      if (password.length < 6) {
        setError("Password minimal 6 karakter.");
        return;
      }

      if (password !== confirmPassword) {
        setError("Konfirmasi password belum sama.");
        return;
      }
    }

    setIsSubmitting(true);
    setError("");

    try {
      const session = await apiRequest<AuthSession>(isRegister ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          name: isRegister ? trimmedName : createNameFromEmail(normalizedEmail),
          email: normalizedEmail,
          password,
        }),
      });
      onAuthenticated(session);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Login gagal.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen px-3 py-3 sm:px-4 lg:p-6">
      <div className="mx-auto grid min-h-[calc(100vh-24px)] w-full max-w-[1180px] gap-4 lg:min-h-[calc(100vh-48px)] lg:grid-cols-[minmax(0,0.96fr)_minmax(0,1.04fr)]">
        <section className="flex min-w-0 flex-col rounded-xl border border-white/70 bg-white/86 p-4 shadow-soft backdrop-blur sm:p-6 lg:p-8">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-taka-navy text-white shadow-float">
              <CircleDollarSign size={25} />
            </div>
            <div>
              <p className="text-lg font-black text-taka-ink">Taka FinTrack</p>
              <p className="text-sm font-semibold text-slate-500">Personal finance AI</p>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => switchMode("login")}
              className={clsx(
                "rounded-lg px-3 py-2.5 text-sm font-black transition",
                mode === "login" ? "bg-white text-taka-ink shadow-sm" : "text-slate-500",
              )}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => switchMode("register")}
              className={clsx(
                "rounded-lg px-3 py-2.5 text-sm font-black transition",
                mode === "register" ? "bg-white text-taka-ink shadow-sm" : "text-slate-500",
              )}
            >
              Register
            </button>
          </div>

          <div className="mt-7">
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-emerald-600">
              {isRegister ? "Akun baru" : "Selamat datang"}
            </p>
            <h1 className="mt-1 text-3xl font-black leading-tight text-taka-ink sm:text-4xl">
              {isRegister ? "Buat akun Taka" : "Masuk ke akunmu"}
            </h1>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
              {isRegister
                ? "Daftar untuk mulai mencatat transaksi, scan struk, dan melihat laporan."
                : "Lanjutkan ke dashboard keuangan, transaksi, scan struk, dan AI chat."}
            </p>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            {isRegister && (
              <AuthField
                id="name"
                label="Nama"
                value={name}
                placeholder="Nama lengkap"
                autoComplete="name"
                onChange={setName}
              />
            )}
            <AuthField
              id="email"
              label="Email"
              type="email"
              value={email}
              placeholder="nama@email.com"
              autoComplete="email"
              onChange={setEmail}
            />
            <AuthField
              id="password"
              label="Password"
              type="password"
              value={password}
              placeholder="Minimal 6 karakter"
              autoComplete={isRegister ? "new-password" : "current-password"}
              onChange={setPassword}
            />
            {isRegister && (
              <AuthField
                id="confirm-password"
                label="Konfirmasi Password"
                type="password"
                value={confirmPassword}
                placeholder="Ulangi password"
                autoComplete="new-password"
                onChange={setConfirmPassword}
              />
            )}

            {error && (
              <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-taka-navy px-4 py-3 text-sm font-black text-white shadow-float transition hover:bg-slate-800"
            >
              {isRegister ? <Check size={18} /> : <ChevronRight size={18} />}
              {isSubmitting ? "Memproses..." : isRegister ? "Register & Masuk" : "Login"}
            </button>
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={isSubmitting}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Sparkles size={18} />
              Masuk Demo
            </button>
          </form>
        </section>

        <section className="hidden min-w-0 overflow-hidden rounded-xl border border-white/70 bg-taka-navy p-6 text-white shadow-soft lg:flex lg:flex-col">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-emerald-200">MEI 2026</p>
              <h2 className="mt-2 text-3xl font-black">Dashboard siap dipakai</h2>
            </div>
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-white/12">
              <ShieldCheck size={24} />
            </div>
          </div>

          <div className="mt-8 rounded-xl bg-white/10 p-5">
            <p className="text-sm font-semibold text-slate-300">Saldo bersih bulan ini</p>
            <p className="mt-2 text-4xl font-black">{currency.format(4485000)}</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-white/10 p-3">
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-300">Income</p>
                <p className="mt-2 text-lg font-black text-emerald-200">{currency.format(8450000)}</p>
              </div>
              <div className="rounded-lg bg-white/10 p-3">
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-300">Expense</p>
                <p className="mt-2 text-lg font-black text-rose-200">{currency.format(3965000)}</p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            <AuthFeature
              icon={ScanLine}
              title="Scan struk"
              text="Foto atau upload struk lalu hasil item muncul di panel."
              tone="emerald"
            />
            <AuthFeature
              icon={ReceiptText}
              title="Transaksi"
              text="Income, expense, dan transaksi hasil scan tetap mudah dilacak."
              tone="violet"
            />
            <AuthFeature
              icon={Bot}
              title="AI Chat"
              text="Tanya pola belanja dan insight hemat dari data bulan ini."
              tone="blue"
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function AuthField({
  id,
  label,
  type = "text",
  value,
  placeholder,
  autoComplete,
  onChange,
}: {
  id: string;
  label: string;
  type?: "text" | "email" | "password";
  value: string;
  placeholder: string;
  autoComplete: string;
  onChange: (value: string) => void;
}) {
  return (
    <label htmlFor={id} className="block">
      <span className="text-xs font-black uppercase tracking-[0.1em] text-slate-400">{label}</span>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-taka-ink outline-none transition placeholder:text-slate-400 focus:border-emerald-300 focus:bg-white"
      />
    </label>
  );
}

function AuthFeature({
  icon: Icon,
  title,
  text,
  tone,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
  tone: "emerald" | "violet" | "blue";
}) {
  const toneClass = {
    emerald: "bg-emerald-400/18 text-emerald-200",
    violet: "bg-violet-400/18 text-violet-100",
    blue: "bg-sky-400/18 text-sky-100",
  }[tone];

  return (
    <div className="flex items-start gap-3 rounded-xl bg-white/10 p-4">
      <div className={clsx("grid h-10 w-10 shrink-0 place-items-center rounded-lg", toneClass)}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="font-black">{title}</p>
        <p className="mt-1 text-sm font-semibold leading-6 text-slate-300">{text}</p>
      </div>
    </div>
  );
}

function AvatarCircle({
  user,
  size = "md",
  className,
}: {
  user: AuthUser;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizeClass = {
    sm: "h-8 w-8 text-[11px]",
    md: "h-12 w-12 text-sm",
    lg: "h-16 w-16 text-base",
  }[size];

  return (
    <div
      className={clsx(
        "grid shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#1E293B,#22C55E)] bg-cover bg-center font-black text-white ring-4 ring-white",
        sizeClass,
        className,
      )}
      style={user.avatarUrl ? { backgroundImage: `url(${user.avatarUrl})` } : undefined}
      aria-label={`Foto profil ${user.name}`}
    >
      {!user.avatarUrl && getInitials(user.name)}
    </div>
  );
}

function Sidebar({
  activeView,
  onChange,
  user,
  onLogout,
  scanCount = 0,
  healthScore = 0,
}: {
  activeView: ViewKey;
  onChange: (view: ViewKey) => void;
  user: AuthUser;
  onLogout: () => void;
  scanCount?: number;
  healthScore?: number;
}) {
  return (
    <aside className="sticky top-6 hidden h-[calc(100vh-48px)] overflow-hidden rounded-xl border border-white/70 bg-white/86 p-4 shadow-soft backdrop-blur lg:block">
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-taka-navy text-white shadow-float">
            <CircleDollarSign size={24} />
          </div>
          <div>
            <p className="text-base font-black text-taka-ink">Taka FinTrack</p>
            <p className="text-xs font-semibold text-slate-500">Personal finance AI</p>
          </div>
        </div>

        <div className="mt-6 rounded-xl bg-gradient-to-br from-taka-violet via-white to-taka-mint p-4">
          <div className="flex items-center gap-3">
            <AvatarCircle user={user} />
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold text-taka-ink">{user.name}</p>
              <p className="truncate text-xs font-semibold text-slate-600">{user.email}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-white/82 p-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">Scan</p>
              <p className="mt-1 text-lg font-black text-taka-ink">{scanCount}/20</p>
            </div>
            <div className="rounded-lg bg-white/82 p-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">Health</p>
              <p className="mt-1 text-lg font-black text-emerald-600">{healthScore}%</p>
            </div>
          </div>
        </div>

        <nav className="mt-6 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onChange(item.key)}
              className={clsx(
                "flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-bold transition",
                activeView === item.key
                  ? "bg-taka-navy text-white shadow-float"
                  : "text-slate-500 hover:bg-slate-100 hover:text-taka-ink",
              )}
            >
              <item.icon size={19} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="mt-auto space-y-3">
          <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
            <div className="flex items-start gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-500 text-white">
                <ShieldCheck size={18} />
              </div>
              <div>
                <p className="text-sm font-extrabold text-taka-ink">Data aman</p>
                <p className="mt-1 text-xs font-medium leading-5 text-slate-600">Session JWT, limit scan harian, dan akses data per user.</p>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
          >
            <LogOut size={18} />
            Keluar
          </button>
        </div>
      </div>
    </aside>
  );
}

function TopBar({
  title,
  user,
  token,
  onUserUpdate,
  onAddTransaction,
  onLogout,
}: {
  title: string;
  user: AuthUser;
  token: string;
  onUserUpdate: (updates: Partial<AuthUser>) => void;
  onAddTransaction: () => void;
  onLogout: () => void;
}) {
  return (
    <header className="flex items-start justify-between gap-3 rounded-xl border border-white/70 bg-white/82 p-3 shadow-soft backdrop-blur sm:items-center sm:p-4">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-emerald-600 sm:gap-2 sm:text-xs">
          <Sparkles size={13} />
          <span>Mei 2026</span>
        </div>
        <h1 className="mt-1 truncate text-xl font-black leading-tight text-taka-ink sm:text-3xl">{title}</h1>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <label className="relative hidden min-w-0 flex-1 sm:block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
          <input
            className="h-11 w-56 rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm font-semibold outline-none transition focus:border-emerald-300 focus:bg-white lg:w-64"
            placeholder="Cari transaksi"
          />
        </label>
        <button type="button" className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-emerald-300 hover:text-emerald-600 sm:h-11 sm:w-11" aria-label="Notifikasi">
          <Bell size={18} />
        </button>
        <ProfileMenu user={user} token={token} onUserUpdate={onUserUpdate} />
        <button type="button" onClick={onAddTransaction} className="hidden items-center gap-2 rounded-lg bg-taka-navy px-4 py-3 text-sm font-extrabold text-white shadow-float transition hover:bg-slate-800 sm:flex">
          <Plus size={18} />
          Tambah
        </button>
      </div>
    </header>
  );
}

function ProfileMenu({
  user,
  token,
  onUserUpdate,
}: {
  user: AuthUser;
  token: string;
  onUserUpdate: (updates: Partial<AuthUser>) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  async function saveProfile(updates: Partial<AuthUser>) {
    setIsSavingProfile(true);

    try {
      const response = await apiRequest<{ user: AuthUser }>("/api/users/profile", {
        method: "PATCH",
        headers: authHeaders(token),
        body: JSON.stringify(updates),
      });

      onUserUpdate(response.user);
      setError("");
      return response.user;
    } catch (error) {
      setMessage("");
      setError(error instanceof Error ? error.message : "Profil gagal disimpan.");
      return null;
    } finally {
      setIsSavingProfile(false);
    }
  }

  function handleAvatarUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("File harus berupa gambar.");
      setMessage("");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError("Ukuran foto maksimal 2MB untuk session lokal.");
      setMessage("");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setError("Foto belum bisa dibaca.");
        setMessage("");
        return;
      }

      void saveProfile({ avatarUrl: reader.result }).then((updatedUser) => {
        if (updatedUser) {
          setMessage("Foto profil diperbarui.");
        }
      });
    };
    reader.onerror = () => {
      setError("Foto gagal dibaca. Coba file lain.");
      setMessage("");
    };
    reader.readAsDataURL(file);
  }

  async function resetAvatar() {
    const updatedUser = await saveProfile({ avatarUrl: null });

    if (updatedUser) {
      setMessage("Foto profil direset.");
    }
  }

  async function savePassword() {
    if (newPassword.length < 6) {
      setError("Password baru minimal 6 karakter.");
      setMessage("");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Konfirmasi password belum sama.");
      setMessage("");
      return;
    }

    setIsSavingPassword(true);

    try {
      await apiRequest<{ ok: true }>("/api/users/password", {
        method: "PATCH",
        headers: authHeaders(token),
        body: JSON.stringify({ password: newPassword }),
      });

      setNewPassword("");
      setConfirmPassword("");
      setError("");
      setMessage("Password berhasil disimpan.");
    } catch (error) {
      setMessage("");
      setError(error instanceof Error ? error.message : "Password gagal disimpan.");
    } finally {
      setIsSavingPassword(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-emerald-300 hover:text-emerald-600 sm:h-11 sm:w-11"
        aria-label="Profil"
      >
        <AvatarCircle user={user} size="sm" className="ring-0" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-[200] w-72 max-w-[calc(100vw-1.5rem)] rounded-xl border border-white/80 bg-white p-4 text-left shadow-[0_8px_32px_rgba(0,0,0,0.14)] backdrop-blur">
          <div className="flex items-center gap-3">
            <AvatarCircle user={user} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-taka-ink">{user.name}</p>
              <p className="truncate text-xs font-bold text-slate-500">{user.email}</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <label className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-taka-navy px-3 py-2 text-xs font-black text-white transition hover:bg-slate-800">
              <Camera size={15} />
              {isSavingProfile ? "Menyimpan..." : "Ganti Foto"}
              <input type="file" accept="image/*" className="sr-only" onChange={handleAvatarUpload} disabled={isSavingProfile} />
            </label>
            <button
              type="button"
              onClick={resetAvatar}
              disabled={isSavingProfile}
              className="inline-flex min-h-10 items-center justify-center rounded-lg bg-slate-100 px-3 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-200"
            >
              Reset
            </button>
          </div>
          <p className="mt-2 text-[11px] font-bold text-slate-400">JPG/PNG max 2MB.</p>

          <div className="mt-4 border-t border-slate-100 pt-4">
            <div className="flex items-center gap-2">
              <Settings size={16} className="text-emerald-600" />
              <p className="text-sm font-black text-taka-ink">Ganti Password</p>
            </div>
            <div className="mt-3 space-y-2">
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-taka-ink outline-none transition placeholder:text-slate-400 focus:border-emerald-300 focus:bg-white"
                placeholder="Password baru"
                autoComplete="new-password"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-taka-ink outline-none transition placeholder:text-slate-400 focus:border-emerald-300 focus:bg-white"
                placeholder="Konfirmasi password"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={savePassword}
                disabled={isSavingPassword}
                className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-black text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Check size={15} />
                {isSavingPassword ? "Menyimpan..." : "Simpan Password"}
              </button>
            </div>
          </div>

          {(message || error) && (
            <div className={clsx("mt-3 rounded-lg px-3 py-2 text-xs font-bold", error ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-700")}>
              {error || message}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DashboardView({
  analytics,
  transactions,
  dataStatus,
  onNavigate,
}: {
  analytics: ReturnType<typeof getFinanceAnalytics>;
  transactions: Transaction[];
  dataStatus: "idle" | "loading" | "ready" | "error";
  onNavigate: (view: ViewKey) => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_386px]">
      <div className="min-w-0 space-y-4">
        <HeroBalance analytics={analytics} transactions={transactions} onNavigate={onNavigate} />
        <SummaryGrid analytics={analytics} />
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
          <WeeklyChart data={analytics.weekly} />
          <CategoryPanel data={analytics.categoryBreakdown} />
        </div>
        <RecentTransactions transactions={transactions} dataStatus={dataStatus} compact />
      </div>
      <div className="space-y-4">
        <ScanSpotlight transactions={transactions} onNavigate={onNavigate} />
        <AiInsightCard analytics={analytics} onNavigate={onNavigate} />
        <CardStack analytics={analytics} />
      </div>
    </div>
  );
}

function HeroBalance({
  analytics,
  transactions,
  onNavigate,
}: {
  analytics: ReturnType<typeof getFinanceAnalytics>;
  transactions: Transaction[];
  onNavigate: (view: ViewKey) => void;
}) {
  return (
    <section className="overflow-hidden rounded-xl bg-taka-navy text-white shadow-soft">
      <div className="grid gap-0 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-bold text-emerald-100">Net balance</span>
            {analytics.savingsRatio > 0 && (
              <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-bold text-emerald-100">{analytics.savingsRatio}% savings ratio</span>
            )}
          </div>
          <p className="mt-5 text-sm font-semibold text-slate-300">Saldo bersih bulan ini</p>
          <h2 className="mt-2 text-4xl font-black tracking-normal sm:text-5xl">{currency.format(analytics.balance)}</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-white/10 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-300">Income</p>
              <p className="mt-2 text-xl font-black text-emerald-200">{currency.format(analytics.income)}</p>
            </div>
            <div className="rounded-xl bg-white/10 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-300">Expense</p>
              <p className="mt-2 text-xl font-black text-rose-200">{currency.format(analytics.expense)}</p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            <button type="button" onClick={() => onNavigate("transactions")} className="inline-flex items-center gap-2 rounded-lg bg-emerald-400 px-4 py-3 text-sm font-black text-taka-ink transition hover:bg-emerald-300">
              <Plus size={18} />
              Transaksi
            </button>
            <button type="button" onClick={() => onNavigate("scan")} className="inline-flex items-center gap-2 rounded-lg bg-white/12 px-4 py-3 text-sm font-black text-white transition hover:bg-white/18">
              <ScanLine size={18} />
              Scan Struk
            </button>
          </div>
        </div>
        <div className="relative min-h-[250px] bg-gradient-to-br from-[#CAB5FF] via-[#E8DCFF] to-[#DDFBEA] p-5">
          <div className="absolute right-5 top-5 rounded-xl bg-white/86 p-3 text-taka-ink shadow-float">
            <p className="text-xs font-black uppercase tracking-[0.1em] text-slate-400">Budget</p>
            <p className="mt-1 text-xl font-black">{analytics.savingsRatio}%</p>
          </div>
          <div className="absolute bottom-5 left-5 right-5 rounded-xl bg-white/90 p-4 text-taka-ink shadow-float">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black">AI menemukan peluang hemat</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {analytics.currentMonthCount > 0 ? `${analytics.currentMonthCount} transaksi bulan ini sudah masuk DB.` : "Belum ada transaksi bulan ini."}
                </p>
              </div>
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-taka-navy text-white">
                <Bot size={19} />
              </div>
            </div>
          </div>
          <PhonePreview transactions={transactions} balance={analytics.balance} />
        </div>
      </div>
    </section>
  );
}

function PhonePreview({ transactions, balance }: { transactions: Transaction[]; balance: number }) {
  return (
    <div className="mx-auto h-[292px] w-[162px] rounded-[28px] border-[8px] border-taka-navy bg-white p-3 shadow-float">
      <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200" />
      <div className="rounded-xl bg-gradient-to-br from-violet-500 to-emerald-400 p-3 text-white">
        <p className="text-[10px] font-bold opacity-80">Card balance</p>
        <p className="mt-2 text-lg font-black">{currency.format(balance)}</p>
      </div>
      <div className="mt-3 space-y-2">
        {transactions.slice(0, 4).map((item) => (
          <div key={item.id} className="flex items-center gap-2 rounded-lg bg-slate-50 p-2">
            <span className="h-6 w-6 rounded-md" style={{ backgroundColor: getSoftColor(item.categoryColor) }} />
            <div className="min-w-0 flex-1">
              <div className="h-2.5 w-16 rounded bg-slate-300" />
              <div className="mt-1.5 h-2 w-10 rounded bg-slate-200" />
            </div>
            <div className="h-2.5 w-8 rounded bg-slate-300" />
          </div>
        ))}
        {transactions.length === 0 && (
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="h-2.5 w-20 rounded bg-slate-300" />
            <div className="mt-2 h-2 w-14 rounded bg-slate-200" />
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryGrid({ analytics }: { analytics: ReturnType<typeof getFinanceAnalytics> }) {
  const cards = [
    {
      label: "Pemasukan",
      value: analytics.income,
      delta: `${analytics.currentMonthCount} trx`,
      icon: ArrowUpRight,
      tone: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Pengeluaran",
      value: analytics.expense,
      delta: "Mei",
      icon: ArrowDownRight,
      tone: "text-rose-500",
      bg: "bg-rose-50",
    },
    {
      label: "Saldo Bersih",
      value: analytics.balance,
      delta: `${analytics.savingsRatio}%`,
      icon: WalletCards,
      tone: "text-violet-600",
      bg: "bg-violet-50",
    },
  ];

  return (
    <section className="grid gap-3 md:grid-cols-3">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border border-white/70 bg-white/86 p-4 shadow-soft backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div className={clsx("grid h-11 w-11 place-items-center rounded-lg", card.bg, card.tone)}>
              <card.icon size={20} />
            </div>
            <span className={clsx("rounded-full px-2.5 py-1 text-xs font-black", card.bg, card.tone)}>{card.delta}</span>
          </div>
          <p className="mt-5 text-sm font-bold text-slate-500">{card.label}</p>
          <p className="mt-1 text-2xl font-black text-taka-ink">{currency.format(card.value)}</p>
        </div>
      ))}
    </section>
  );
}

function WeeklyChart({ data }: { data: Array<{ day: string; income: number; expense: number }> }) {
  return (
    <section className="rounded-xl border border-white/70 bg-white/86 p-4 shadow-soft backdrop-blur">
      <SectionHeader title="Tren 7 Hari" action="Mingguan" />
      <div className="mt-4 h-[292px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={8}>
            <CartesianGrid vertical={false} stroke="#E2E8F0" strokeDasharray="3 3" />
            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 12, fontWeight: 700 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94A3B8", fontSize: 11, fontWeight: 700 }} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(34,197,94,0.08)" }} />
            <Bar dataKey="income" name="Income" fill="#22C55E" radius={[8, 8, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="expense" name="Expense" fill="#FF6B6B" radius={[8, 8, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function CategoryPanel({
  data,
}: {
  data: Array<{ name: string; amount: number; color: string; value: number }>;
}) {
  return (
    <section className="rounded-xl border border-white/70 bg-white/86 p-4 shadow-soft backdrop-blur">
      <SectionHeader title="Kategori" action="Mei" />
      <div className="mt-2 h-[210px]">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} innerRadius={58} outerRadius={86} paddingAngle={3} dataKey="value" isAnimationActive={false}>
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="grid h-full place-items-center rounded-xl bg-slate-50 text-center text-sm font-bold text-slate-400">
            Belum ada expense bulan ini
          </div>
        )}
      </div>
      <div className="space-y-2">
        {data.slice(0, 4).map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="truncate text-sm font-bold text-slate-700">{item.name}</span>
            </div>
            <span className="text-sm font-black text-taka-ink">{item.value}%</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function RecentTransactions({
  transactions,
  dataStatus,
  compact = false,
}: {
  transactions: Transaction[];
  dataStatus: "idle" | "loading" | "ready" | "error";
  compact?: boolean;
}) {
  const visibleTransactions = transactions.slice(0, compact ? 5 : transactions.length);

  return (
    <section className="rounded-xl border border-white/70 bg-white/86 p-4 shadow-soft backdrop-blur">
      <SectionHeader title="Transaksi Terbaru" action="Lihat semua" />
      <div className="mt-4 space-y-2">
        {visibleTransactions.map((item) => (
          <TransactionRow key={item.id} item={item} onDelete={undefined} />
        ))}
        {visibleTransactions.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-400">
            {dataStatus === "loading" ? "Memuat transaksi..." : "Belum ada transaksi real di database."}
          </div>
        )}
      </div>
    </section>
  );
}

function TransactionRow({
  item,
  onDelete,
}: {
  item: Transaction;
  onDelete?: ((rawId: number) => void) | undefined;
}) {
  const isIncome = item.type === "income";
  const amount = `${isIncome ? "+" : "-"}${currency.format(item.amount)}`;
  const amountClass = isIncome ? "text-emerald-600" : "text-rose-500";
  const [isDeleting, setIsDeleting] = useState(false);

  return (
    <div className="grid min-w-0 grid-cols-[44px_minmax(0,1fr)] gap-3 rounded-xl border border-slate-100 bg-white p-3 transition hover:border-emerald-200 hover:shadow-sm sm:flex sm:items-center">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: getSoftColor(item.categoryColor), color: item.categoryColor }}>
        {isIncome ? <TrendingUp size={19} /> : <CreditCard size={19} />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <p className="truncate text-sm font-black text-taka-ink">{item.merchant}</p>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-500">{item.source}</span>
        </div>
        <p className="mt-1 truncate text-xs font-semibold text-slate-500">{item.category} • {item.date}</p>
        <p className={clsx("mt-2 text-sm font-black sm:hidden", amountClass)}>
          {amount}
        </p>
      </div>
      <p className={clsx("hidden shrink-0 text-right text-sm font-black sm:block", amountClass)}>
        {amount}
      </p>
      {onDelete && (
        <button
          type="button"
          disabled={isDeleting}
          onClick={async () => {
            if (!confirm("Hapus transaksi ini?")) return;
            setIsDeleting(true);
            try { await onDelete(item.rawId); } finally { setIsDeleting(false); }
          }}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-300 transition hover:bg-rose-50 hover:text-rose-500 disabled:opacity-40"
          aria-label="Hapus transaksi"
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  );
}

function ScanSpotlight({
  transactions,
  onNavigate,
}: {
  transactions: Transaction[];
  onNavigate: (view: ViewKey) => void;
}) {
  const latestScan = transactions.find((transaction) => transaction.source === "Scan");

  return (
    <section className="overflow-hidden rounded-xl border border-white/70 bg-white/86 shadow-soft backdrop-blur">
      <div className="relative h-56">
        <Image
          src="/images/receipt-lifestyle.svg"
          alt="Ilustrasi scan struk Taka FinTrack"
          fill
          priority
          className="object-cover"
        />
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-black text-taka-ink">Receipt Scanner</p>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {latestScan ? `${latestScan.merchant} • ${currency.format(latestScan.amount)}` : "Belum ada scan tersimpan"}
            </p>
          </div>
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-100 text-emerald-700">
            <Check size={20} />
          </div>
        </div>
        <button type="button" onClick={() => onNavigate("scan")} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-taka-navy px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800">
          <ScanLine size={18} />
          Buka Scan
        </button>
      </div>
    </section>
  );
}

function AiInsightCard({
  analytics,
  onNavigate,
}: {
  analytics: ReturnType<typeof getFinanceAnalytics>;
  onNavigate: (view: ViewKey) => void;
}) {
  const topCategory = analytics.categoryBreakdown[0];

  return (
    <section className="rounded-xl border border-white/70 bg-white/86 p-4 shadow-soft backdrop-blur">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-violet-100 text-violet-700">
          <Bot size={20} />
        </div>
        <div className="min-w-0">
          <p className="font-black text-taka-ink">Taka AI</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
            {topCategory
              ? `${topCategory.name} menyerap ${topCategory.value}% expense bulan ini. Totalnya ${currency.format(topCategory.amount)}.`
              : "Belum ada transaksi expense bulan ini untuk dianalisis."}
          </p>
        </div>
      </div>
      <button type="button" onClick={() => onNavigate("chat")} className="mt-4 flex w-full items-center justify-between rounded-lg bg-violet-50 px-4 py-3 text-sm font-black text-violet-700 transition hover:bg-violet-100">
        Tanya Taka
        <ChevronRight size={18} />
      </button>
    </section>
  );
}

function CardStack({ analytics }: { analytics: ReturnType<typeof getFinanceAnalytics> }) {
  return (
    <section className="rounded-xl border border-white/70 bg-white/86 p-4 shadow-soft backdrop-blur">
      <SectionHeader title="Kartu" action="2 aktif" />
      <div className="mt-4 space-y-3">
        <div className="rounded-xl bg-gradient-to-br from-emerald-400 to-violet-500 p-4 text-white shadow-float">
          <div className="flex items-center justify-between">
            <p className="text-sm font-black">Taka Wallet</p>
            <MoreHorizontal size={18} />
          </div>
          <p className="mt-7 text-2xl font-black">{currency.format(analytics.balance)}</p>
          <p className="mt-3 text-xs font-bold text-white/75">**** 4829</p>
        </div>
        <div className="rounded-xl bg-taka-navy p-4 text-white">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-300">Limit scan</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/14">
            <div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.min(100, analytics.currentMonthCount * 5)}%` }} />
          </div>
        </div>
      </div>
    </section>
  );
}

function TransactionsView({
  transactions,
  categories,
  dataStatus,
  onCreateTransaction,
  onCreateCategory,
  onDeleteTransaction,
  onRefresh,
}: {
  transactions: Transaction[];
  categories: Category[];
  dataStatus: "idle" | "loading" | "ready" | "error";
  onCreateTransaction: (input: TransactionInput) => Promise<Transaction>;
  onCreateCategory: (input: CategoryInput) => Promise<Category>;
  onDeleteTransaction: (rawId: number) => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const [filter, setFilter] = useState<"Semua" | "Income" | "Expense" | "Scan">("Semua");
  const [transactionType, setTransactionType] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [transactionDate, setTransactionDate] = useState(getDateInputValue());
  const [categoryName, setCategoryName] = useState("");
  const [categoryType, setCategoryType] = useState<CategoryType>("expense");
  const [categoryColor, setCategoryColor] = useState("#22C55E");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSavingTransaction, setIsSavingTransaction] = useState(false);
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const availableCategories = useMemo(
    () => categories.filter((category) => category.type === "both" || category.type === transactionType),
    [categories, transactionType],
  );
  const filteredTransactions = transactions.filter((transaction) => {
    if (filter === "Income") return transaction.type === "income";
    if (filter === "Expense") return transaction.type === "expense";
    if (filter === "Scan") return transaction.source === "Scan";

    return true;
  });

  useEffect(() => {
    if (availableCategories.length === 0) {
      setCategoryId("");
      return;
    }

    if (!availableCategories.some((category) => String(category.id) === categoryId)) {
      setCategoryId(String(availableCategories[0].id));
    }
  }, [availableCategories, categoryId]);

  async function submitTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedAmount = Number(amount.replace(/[^\d]/g, ""));
    const selectedCategory = availableCategories.find((category) => String(category.id) === categoryId);
    const finalMerchant = merchant.trim() || selectedCategory?.name || "Transaksi";


    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Nominal belum valid.");
      setMessage("");
      return;
    }

    if (!selectedCategory) {
      setError("Pilih atau tambah kategori dulu.");
      setMessage("");
      return;
    }

    setIsSavingTransaction(true);
    setError("");

    try {
      await onCreateTransaction({
        merchant: finalMerchant,
        amount: parsedAmount,
        type: transactionType,
        categoryId: selectedCategory.id,
        transactionDate,
        source: "Manual",
      });
      setMerchant("");
      setAmount("");
      setMessage("Transaksi berhasil disimpan ke database.");
    } catch (error) {
      setMessage("");
      setError(error instanceof Error ? error.message : "Transaksi gagal disimpan.");
    } finally {
      setIsSavingTransaction(false);
    }
  }

  async function submitCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!categoryName.trim()) {
      setError("Nama kategori wajib diisi.");
      setMessage("");
      return;
    }

    setIsSavingCategory(true);
    setError("");

    try {
      const createdCategory = await onCreateCategory({
        name: categoryName.trim(),
        type: categoryType,
        color: categoryColor,
      });
      setCategoryName("");
      setMessage("Kategori baru berhasil ditambahkan.");

      if (createdCategory.type === "both" || createdCategory.type === transactionType) {
        setCategoryId(String(createdCategory.id));
      }
    } catch (error) {
      setMessage("");
      setError(error instanceof Error ? error.message : "Kategori gagal disimpan.");
    } finally {
      setIsSavingCategory(false);
    }
  }

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="min-w-0 overflow-hidden rounded-xl border border-white/70 bg-white/86 p-3 shadow-soft backdrop-blur sm:p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <SectionTitle title="Daftar Transaksi" eyebrow={`${transactions.length} transaksi real`} />
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {(["Semua", "Income", "Expense", "Scan"] as const).map((filterOption) => (
              <button
                key={filterOption}
                type="button"
                onClick={() => setFilter(filterOption)}
                className={clsx(
                  "shrink-0 rounded-lg px-3 py-2 text-sm font-black transition",
                  filter === filterOption ? "bg-taka-navy text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                )}
              >
                {filterOption}
              </button>
            ))}
            <button
              type="button"
              onClick={() => void onRefresh()}
              className="shrink-0 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-black text-emerald-700 transition hover:bg-emerald-100"
            >
              Refresh
            </button>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {filteredTransactions.map((item) => (
            <TransactionRow key={item.id} item={item} onDelete={onDeleteTransaction} />
          ))}
          {filteredTransactions.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-400">
              {dataStatus === "loading" ? "Memuat transaksi dari database..." : "Belum ada transaksi untuk filter ini."}
            </div>
          )}
        </div>
      </section>

      <section className="min-w-0 rounded-xl border border-white/70 bg-white/86 p-3 shadow-soft backdrop-blur sm:p-4">
        <SectionTitle title="Tambah Manual" eyebrow="data real DB" />
        <form className="mt-4 space-y-3" onSubmit={submitTransaction}>
          <SegmentedControl
            options={["Expense", "Income"]}
            active={transactionType === "expense" ? "Expense" : "Income"}
            onChange={(option) => setTransactionType(option === "Income" ? "income" : "expense")}
          />
          <EditableField label="Nominal" inputMode="numeric" value={amount} placeholder="Rp 125.000" onChange={setAmount} />
          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.1em] text-slate-400">Kategori</span>
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-taka-ink outline-none transition focus:border-emerald-300 focus:bg-white"
            >
              {availableCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <EditableField label="Merchant" value={merchant} placeholder="Kopi Kenangan" onChange={setMerchant} />
          <EditableField label="Tanggal" type="date" value={transactionDate} placeholder="" onChange={setTransactionDate} />
          {(message || error) && (
            <div className={clsx("rounded-lg px-3 py-2 text-sm font-bold", error ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-700")}>
              {error || message}
            </div>
          )}
          <button
            type="submit"
            disabled={isSavingTransaction}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus size={18} />
            {isSavingTransaction ? "Menyimpan..." : "Simpan Transaksi"}
          </button>
        </form>

        <form className="mt-5 rounded-xl border border-slate-100 bg-slate-50 p-3" onSubmit={submitCategory}>
          <p className="text-sm font-black text-taka-ink">Tambah Kategori</p>
          <div className="mt-3 space-y-3">
            <EditableField label="Nama" value={categoryName} placeholder="Contoh: Kosan" onChange={setCategoryName} />
            <div className="grid grid-cols-[minmax(0,1fr)_56px] gap-2">
              <label className="block">
                <span className="text-xs font-black uppercase tracking-[0.1em] text-slate-400">Tipe</span>
                <select
                  value={categoryType}
                  onChange={(event) => setCategoryType(event.target.value as CategoryType)}
                  className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-taka-ink outline-none"
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                  <option value="both">Both</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-black uppercase tracking-[0.1em] text-slate-400">Warna</span>
                <input
                  type="color"
                  value={categoryColor}
                  onChange={(event) => setCategoryColor(event.target.value)}
                  className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-white p-1"
                  aria-label="Warna kategori"
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={isSavingCategory}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-taka-navy px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus size={18} />
              {isSavingCategory ? "Menyimpan..." : "Tambah Kategori"}
            </button>
          </div>
        </form>

      </section>
    </div>
  );
}

function ScanView({
  categories,
  onCreateTransaction,
  onNavigate,
}: {
  categories: Category[];
  onCreateTransaction: (input: TransactionInput) => Promise<Transaction>;
  onNavigate: (view: ViewKey) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const receiptObjectUrlRef = useRef<string | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const [cameraStatus, setCameraStatus] = useState<"idle" | "starting" | "active" | "error">("idle");
  const [cameraMessage, setCameraMessage] = useState("Tap Buka Kamera, lalu arahkan struk ke area scan.");
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<"empty" | "ready" | "scanning" | "done">("empty");
  const [scannedReceipt, setScannedReceipt] = useState<ScannedReceipt | null>(null);
  const [isSavingReceipt, setIsSavingReceipt] = useState(false);
  const hasReceiptPreview = Boolean(receiptPreviewUrl);
  const hasScannedReceipt = scanStatus === "done";
  const receiptItems = scannedReceipt?.items ?? [];
  const subtotal = scannedReceipt?.subtotal ?? 0;
  const discount = scannedReceipt?.discount ?? 0;
  const total = scannedReceipt?.total ?? 0;
  const confidence = scannedReceipt?.confidence ?? 0;

  const clearCameraStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const releaseReceiptPreview = useCallback(() => {
    if (receiptObjectUrlRef.current) {
      URL.revokeObjectURL(receiptObjectUrlRef.current);
      receiptObjectUrlRef.current = null;
    }
  }, []);

  const replaceReceiptPreview = useCallback((url: string, isObjectUrl = false) => {
    releaseReceiptPreview();
    receiptObjectUrlRef.current = isObjectUrl ? url : null;
    setReceiptPreviewUrl(url);
    setScannedReceipt(null);
    setScanStatus("ready");
  }, [releaseReceiptPreview]);

  const startReceiptScan = useCallback(async (imageUrl: string | null, message = "Memindai struk...") => {
    if (!imageUrl) {
      setCameraMessage("Ambil atau upload foto struk dulu sebelum scan.");
      return;
    }

    if (scanTimerRef.current) {
      window.clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }

    setScanStatus("scanning");
    setCameraMessage(message);

    try {
      const { recognize } = await import("tesseract.js");
      const result = await recognize(imageUrl, "eng", {
        logger: (progress) => {
          if (progress.status === "recognizing text") {
            setCameraMessage(`OCR membaca teks... ${Math.round(progress.progress * 100)}%`);
          }
        },
      });
      const parsedReceipt = parseReceiptText(result.data.text);

      setScannedReceipt(parsedReceipt);
      setScanStatus("done");
      setCameraMessage(
        parsedReceipt.source === "ocr"
          ? "Scan selesai dari OCR. Hasil struk siap dikonfirmasi."
          : "OCR belum cukup jelas. Dipakai hasil demo dari contoh struk Indomaret.",
      );
    } catch {
      setScannedReceipt(indomaretExampleReceipt);
      setScanStatus("done");
      setCameraMessage("OCR gagal dimuat. Dipakai hasil demo dari contoh struk Indomaret.");
    }
  }, []);

  function stopCamera() {
    clearCameraStream();
    setCameraStatus("idle");
    setCameraMessage("Kamera dimatikan. Tap Buka Kamera untuk scan lagi.");
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus("error");
      setCameraMessage("Browser ini belum mendukung kamera langsung. Pakai Upload Struk sebagai cadangan.");
      return;
    }

    clearCameraStream();
    setCameraStatus("starting");
    setCameraMessage("Meminta izin kamera...");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }

      releaseReceiptPreview();
      setReceiptPreviewUrl(null);
      setScannedReceipt(null);
      setScanStatus("empty");
      setCameraStatus("active");
      setCameraMessage("Kamera aktif. Posisikan struk di tengah area scan.");
    } catch (error) {
      clearCameraStream();
      setCameraStatus("error");
      setCameraMessage(getCameraErrorMessage(error));
    }
  }

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
      setCameraMessage("Kamera belum siap. Tunggu sebentar, lalu ambil foto lagi.");
      return;
    }

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")?.drawImage(video, 0, 0, width, height);

    const capturedPhoto = canvas.toDataURL("image/jpeg", 0.92);
    clearCameraStream();
    setCameraStatus("idle");
    replaceReceiptPreview(capturedPhoto);
    setCameraMessage("Foto struk tersimpan. Scan otomatis berjalan...");
  }

  function scanReceipt() {
    if (!receiptPreviewUrl) {
      setCameraMessage("Ambil atau upload foto struk dulu sebelum scan.");
      return;
    }

    void startReceiptScan(receiptPreviewUrl, hasScannedReceipt ? "Memindai ulang struk..." : "Memindai struk...");
  }

  function handleReceiptUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    clearCameraStream();
    replaceReceiptPreview(URL.createObjectURL(file), true);
    setCameraStatus("idle");
    setCameraMessage("Foto struk diupload. Scan otomatis berjalan...");
  }

  async function saveScannedReceipt() {
    if (!scannedReceipt) return;

    const expenseCategory = categories.find((category) => category.type === "expense" || category.type === "both");

    if (!expenseCategory) {
      setCameraMessage("Belum ada kategori expense. Tambah kategori dulu di menu Transaksi.");
      return;
    }

    setIsSavingReceipt(true);

    try {
      await onCreateTransaction({
        merchant: scannedReceipt.merchant,
        amount: scannedReceipt.total,
        type: "expense",
        categoryId: expenseCategory.id,
        transactionDate: getDateInputValue(),
        source: "Scan",
      });
      setCameraMessage("Transaksi hasil scan berhasil disimpan ke database.");
    } catch (error) {
      setCameraMessage(error instanceof Error ? error.message : "Hasil scan gagal disimpan.");
    } finally {
      setIsSavingReceipt(false);
    }
  }

  useEffect(() => {
    return () => {
      clearCameraStream();
      releaseReceiptPreview();

      if (scanTimerRef.current) {
        window.clearTimeout(scanTimerRef.current);
      }
    };
  }, [clearCameraStream, releaseReceiptPreview]);

  useEffect(() => {
    if (scanStatus === "ready" && receiptPreviewUrl) {
      void startReceiptScan(receiptPreviewUrl, "Memindai struk otomatis...");
    }
  }, [receiptPreviewUrl, scanStatus, startReceiptScan]);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_460px]">
      <section className="rounded-xl border border-white/70 bg-white/86 p-3 shadow-soft backdrop-blur sm:p-4">
        <SectionTitle title="Scan Struk" eyebrow="JPEG / PNG • max 10MB" />
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="rounded-xl border border-dashed border-emerald-300 bg-emerald-50 p-3 sm:p-4">
            <div className="relative h-[360px] overflow-hidden rounded-xl bg-slate-950 shadow-inner sm:h-[420px] lg:h-[500px]">
              {receiptPreviewUrl ? (
                <div
                  className="absolute inset-0 bg-contain bg-center bg-no-repeat"
                  style={{ backgroundImage: `url(${receiptPreviewUrl})` }}
                  aria-label="Preview struk yang diunggah"
                />
              ) : (
                <>
                  <Image
                    src="/images/receipt-lifestyle.svg"
                    alt="Preview scanner struk"
                    fill
                    className="object-cover opacity-35"
                  />
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-950/80 via-slate-950/52 to-emerald-950/50" />
                </>
              )}
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className={clsx(
                  "absolute inset-0 h-full w-full bg-black object-cover transition-opacity duration-300",
                  cameraStatus === "active" ? "opacity-100" : "opacity-0",
                )}
              />
              <canvas ref={canvasRef} className="hidden" />
              <div className="pointer-events-none absolute inset-6 rounded-[1.4rem] border border-white/60">
                <span className="absolute -left-px -top-px h-10 w-10 rounded-tl-[1.4rem] border-l-4 border-t-4 border-emerald-300" />
                <span className="absolute -right-px -top-px h-10 w-10 rounded-tr-[1.4rem] border-r-4 border-t-4 border-emerald-300" />
                <span className="absolute -bottom-px -left-px h-10 w-10 rounded-bl-[1.4rem] border-b-4 border-l-4 border-emerald-300" />
                <span className="absolute -bottom-px -right-px h-10 w-10 rounded-br-[1.4rem] border-b-4 border-r-4 border-emerald-300" />
              </div>
              {cameraStatus === "active" && (
                <>
                  <div className="pointer-events-none absolute left-10 right-10 top-1/2 h-0.5 animate-pulse bg-emerald-300 shadow-[0_0_24px_rgba(110,231,183,0.95)]" />
                  <button
                    type="button"
                    onClick={capturePhoto}
                    className="absolute bottom-20 left-1/2 grid h-16 w-16 -translate-x-1/2 place-items-center rounded-full border-4 border-white bg-emerald-500 text-white shadow-float transition hover:bg-emerald-600"
                    aria-label="Ambil foto struk"
                  >
                    <Camera size={24} />
                  </button>
                </>
              )}
              {cameraStatus !== "active" && !receiptPreviewUrl && (
                <div className="absolute inset-0 grid place-items-center bg-taka-navy/40 px-5 text-center text-white">
                  <div>
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-white/18">
                      <ScanLine size={22} />
                    </div>
                    <p className="mt-3 text-base font-black">
                      {cameraStatus === "starting" ? "Menyalakan kamera..." : "Kamera belum aktif"}
                    </p>
                    <p className="mx-auto mt-2 max-w-[260px] text-xs font-semibold leading-5 text-white/72">
                      Buka kamera, posisikan seluruh struk di dalam frame, lalu ambil foto.
                    </p>
                  </div>
                </div>
              )}
              {scanStatus === "scanning" && (
                <div className="absolute inset-0 grid place-items-center bg-taka-navy/58 px-5 text-center text-white">
                  <div>
                    <div className="mx-auto h-12 w-12 animate-pulse rounded-full border-4 border-emerald-300 border-t-white" />
                    <p className="mt-3 text-sm font-black">Scanning...</p>
                  </div>
                </div>
              )}
              <div className="absolute bottom-4 left-4 right-4 rounded-lg bg-white/92 px-3 py-2 text-xs font-bold leading-5 text-slate-700 shadow-sm">
                {cameraMessage}
              </div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={cameraStatus === "active" ? capturePhoto : startCamera}
                disabled={cameraStatus === "starting" || scanStatus === "scanning"}
                className={clsx(
                  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-black text-white transition disabled:cursor-not-allowed disabled:opacity-70",
                  cameraStatus === "active" ? "bg-emerald-500 hover:bg-emerald-600" : "bg-taka-navy hover:bg-slate-800",
                )}
              >
                <Camera size={18} />
                {cameraStatus === "starting" ? "Membuka..." : cameraStatus === "active" ? "Ambil Foto" : "Buka Kamera"}
              </button>
              <button
                type="button"
                onClick={cameraStatus === "active" ? stopCamera : scanReceipt}
                disabled={cameraStatus !== "active" && (!hasReceiptPreview || scanStatus === "scanning")}
                className={clsx(
                  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-55",
                  cameraStatus === "active"
                    ? "bg-white text-slate-700 hover:bg-slate-50"
                    : "bg-emerald-500 text-white hover:bg-emerald-600",
                )}
              >
                {cameraStatus === "active" ? <ScanLine size={18} /> : hasScannedReceipt ? <Check size={18} /> : <ScanLine size={18} />}
                {cameraStatus === "active" ? "Matikan" : scanStatus === "scanning" ? "Scanning..." : hasScannedReceipt ? "Scan Ulang" : "Scan Struk"}
              </button>
              <label className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50">
                <FileText size={18} />
                Upload
                <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={handleReceiptUpload} disabled={scanStatus === "scanning"} />
              </label>
              <button type="button" onClick={() => onNavigate("transactions")} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50">
                <Plus size={18} />
                Manual
              </button>
            </div>
          </div>
          <div className="rounded-xl bg-taka-navy p-4 text-white lg:min-h-[500px]">
            <p className="text-sm font-black text-emerald-200">Preview Hasil</p>
            <h2 className="mt-2 text-2xl font-black">
              {scanStatus === "done" ? scannedReceipt?.merchant : scanStatus === "scanning" ? "Memproses OCR" : "Menunggu Scan"}
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-300">
              {scanStatus === "done" && scannedReceipt
                ? `${scannedReceipt.date} • ${scannedReceipt.payment}`
                : hasReceiptPreview
                  ? "Foto struk siap discan"
                  : "Belum ada foto struk"}
            </p>
            {hasScannedReceipt ? (
              <>
                <div className="mt-5 space-y-3">
                  <MetricLine label="Subtotal" value={currency.format(subtotal)} />
                  <MetricLine label="Diskon" value={`-${currency.format(discount)}`} />
                  <MetricLine label="Total" value={currency.format(total)} strong />
                </div>
                <div className="mt-5 rounded-xl bg-white/10 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-300">Confidence</span>
                    <span className="text-lg font-black text-emerald-200">{confidence}%</span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/12">
                    <div className="h-full rounded-full bg-emerald-400" style={{ width: `${confidence}%` }} />
                  </div>
                </div>
              </>
            ) : (
              <div className="mt-5 rounded-xl bg-white/10 p-4">
                <div className="space-y-3">
                  <div className="h-3 w-28 rounded-full bg-white/18" />
                  <div className="h-3 w-44 rounded-full bg-white/12" />
                  <div className="h-3 w-36 rounded-full bg-white/12" />
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-white/70 bg-white/86 p-4 shadow-soft backdrop-blur">
        <SectionHeader title="Item Struk" action={hasScannedReceipt ? `${receiptItems.length} item` : "0 item"} />
        {hasScannedReceipt ? (
          <div className="mt-4 space-y-2">
            {receiptItems.map((item) => (
              <div key={item.name} className="rounded-xl border border-slate-100 bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-taka-ink">{item.name}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">{item.qty} x {currency.format(item.price)}</p>
                  </div>
                  <p className="text-sm font-black text-taka-ink">{currency.format(item.qty * item.price)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4">
            <div className="space-y-3">
              <div className="h-3 w-32 rounded-full bg-slate-200" />
              <div className="h-3 w-48 rounded-full bg-slate-200" />
              <div className="h-3 w-28 rounded-full bg-slate-200" />
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => void saveScannedReceipt()}
          disabled={!hasScannedReceipt || isSavingReceipt}
          className={clsx(
            "mt-4 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-black transition disabled:cursor-not-allowed",
            hasScannedReceipt && !isSavingReceipt ? "bg-emerald-500 text-white hover:bg-emerald-600" : "bg-slate-200 text-slate-400",
          )}
        >
          <Check size={18} />
          {isSavingReceipt ? "Menyimpan..." : "Konfirmasi Simpan"}
        </button>
      </section>
    </div>
  );
}

const defaultChatMessages: ChatMessage[] = [
  {
    role: "assistant",
    text: "Halo! Saya Taka AI, asisten keuangan pribadi kamu. Ada yang bisa saya bantu?",
  },
];

function ChatView() {
  const [messages, setMessages] = useState<ChatMessage[]>(defaultChatMessages);
  const [draft, setDraft] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isInitialized = useRef(false);

  // Load from localStorage on mount (client-side only)
  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;
    try {
      const stored = window.localStorage.getItem(chatHistoryStorageKey);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed as ChatMessage[]);
        }
      }
    } catch {
      // Ignore.
    }
  }, []);

  // Save to localStorage on every change
  useEffect(() => {
    if (!isInitialized.current) return;
    try {
      window.localStorage.setItem(chatHistoryStorageKey, JSON.stringify(messages));
    } catch {
      // Ignore.
    }
  }, [messages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  function clearChat() {
    setMessages(defaultChatMessages);
    try { window.localStorage.removeItem(chatHistoryStorageKey); } catch { /* noop */ }
    setConfirmClear(false);
  }

  function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;

    setMessages((current) => [
      ...current,
      { role: "user", text: trimmed },
    ]);
    setDraft("");
    setIsTyping(true);

    setTimeout(() => {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: "Dari pola Mei 2026, area paling bisa ditekan adalah makanan ringan dan transportasi harian. Target realistis: kurangi Rp 35 ribu per hari selama 10 hari.",
        },
      ]);
      setIsTyping(false);
    }, 1500);
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[330px_minmax(0,1fr)]">
      <section className="rounded-xl border border-white/70 bg-white/86 p-4 shadow-soft backdrop-blur">
        <SectionTitle title="Taka AI" eyebrow="Financial assistant" />
        <div className="mt-4 space-y-2">
          {suggestedQuestions.map((question) => (
            <button
              key={question}
              type="button"
              onClick={() => sendMessage(question)}
              className="w-full rounded-lg bg-slate-50 px-3 py-3 text-left text-sm font-bold leading-5 text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-700"
            >
              {question}
            </button>
          ))}
        </div>
        <div className="mt-4 rounded-xl bg-violet-50 p-4">
          <p className="text-xs font-black uppercase tracking-[0.1em] text-violet-500">Konteks aktif</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">Ringkasan Mei, top kategori, 5 transaksi terbesar, dan tren 3 bulan.</p>
        </div>
      </section>

      <section className="relative flex h-[620px] flex-col rounded-xl border border-white/70 bg-white/86 p-4 shadow-soft backdrop-blur">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-taka-navy text-white">
              <Bot size={20} />
            </div>
            <div>
              <p className="font-black text-taka-ink">Sesi Mei 2026</p>
              <p className="text-xs font-bold text-emerald-600">Streaming ready</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            title="Hapus riwayat chat"
            className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500"
          >
            <Trash2 size={16} />
          </button>
        </div>
        <div ref={scrollRef} className="no-scrollbar flex-1 space-y-3 overflow-y-auto py-4 scroll-smooth">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={clsx(
                "flex",
                message.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              <div
                className={clsx(
                  "max-w-[86%] rounded-xl px-4 py-3 text-sm font-semibold leading-6",
                  message.role === "user"
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-100 text-slate-700",
                )}
              >
                {message.text}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="flex max-w-[86%] items-center gap-1.5 rounded-xl bg-slate-100 px-4 py-4 text-sm font-semibold leading-6 text-slate-700">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "0ms" }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "150ms" }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          )}
        </div>
        {confirmClear && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-black/30 backdrop-blur-sm">
            <div className="mx-4 w-full max-w-xs rounded-2xl bg-white p-5 shadow-[0_8px_32px_rgba(0,0,0,0.18)]">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50">
                <Trash2 size={22} className="text-rose-500" />
              </div>
              <p className="mt-3 text-base font-black text-taka-ink">Hapus Riwayat Chat?</p>
              <p className="mt-1 text-sm font-semibold text-slate-500">Semua percakapan akan dihapus permanen dan tidak bisa dipulihkan.</p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmClear(false)}
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-sm font-black text-slate-600 transition hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={clearChat}
                  className="flex-1 rounded-xl bg-rose-500 py-2.5 text-sm font-black text-white transition hover:bg-rose-600"
                >
                  Hapus
                </button>
              </div>
            </div>
          </div>
        )}
        <form
          className="flex gap-2 border-t border-slate-100 pt-4"
          onSubmit={(event) => {
            event.preventDefault();
            sendMessage(draft);
          }}
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold outline-none transition focus:border-emerald-300 focus:bg-white"
            placeholder="Tanya kondisi keuanganmu"
          />
          <button type="submit" className="rounded-lg bg-taka-navy px-4 py-3 text-sm font-black text-white">
            Kirim
          </button>
        </form>
      </section>
    </div>
  );
}


function ReportsView({ analytics }: { analytics: ReturnType<typeof getFinanceAnalytics> }) {
  const totalExpense = analytics.categoryBreakdown.reduce((total, item) => total + item.amount, 0);

  return (
    <div className="space-y-4">
      <section className="grid gap-3 md:grid-cols-3">
        <ReportStat label="Income Mei" value={currency.format(analytics.income)} icon={TrendingUp} tone="emerald" />
        <ReportStat label="Expense Mei" value={currency.format(analytics.expense)} icon={TrendingDown} tone="rose" />
        <ReportStat label="Rasio Hemat" value={`${analytics.savingsRatio}%`} icon={ShieldCheck} tone="violet" />
      </section>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="rounded-xl border border-white/70 bg-white/86 p-4 shadow-soft backdrop-blur">
          <SectionHeader title="Tren 6 Bulan" action="Bulanan" />
          <div className="mt-4 h-[340px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics.trend}>
                <CartesianGrid vertical={false} stroke="#E2E8F0" strokeDasharray="3 3" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 12, fontWeight: 700 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94A3B8", fontSize: 11, fontWeight: 700 }} />
                <Tooltip content={<ChartTooltip suffix=" jt" />} />
                <Line type="monotone" dataKey="income" name="Income" stroke="#22C55E" strokeWidth={4} dot={{ r: 4, fill: "#22C55E" }} isAnimationActive={false} />
                <Line type="monotone" dataKey="expense" name="Expense" stroke="#FF6B6B" strokeWidth={4} dot={{ r: 4, fill: "#FF6B6B" }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-xl border border-white/70 bg-white/86 p-4 shadow-soft backdrop-blur">
          <SectionHeader title="Breakdown" action={currency.format(totalExpense)} />
          <div className="mt-4 space-y-3">
            {analytics.categoryBreakdown.map((item) => (
              <div key={item.name}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-bold text-slate-600">{item.name}</span>
                  <span className="font-black text-taka-ink">{currency.format(item.amount)}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full" style={{ width: `${item.value}%`, backgroundColor: item.color }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="rounded-xl border border-white/70 bg-white/86 p-4 shadow-soft backdrop-blur">
        <SectionHeader title="Income vs Expense" action="Harian" />
        <div className="mt-4 h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={analytics.weekly}>
              <defs>
                <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22C55E" stopOpacity={0.34} />
                  <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FF6B6B" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#FF6B6B" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#E2E8F0" strokeDasharray="3 3" />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 12, fontWeight: 700 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "#94A3B8", fontSize: 11, fontWeight: 700 }} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="income" name="Income" stroke="#22C55E" strokeWidth={3} fill="url(#incomeGradient)" isAnimationActive={false} />
              <Area type="monotone" dataKey="expense" name="Expense" stroke="#FF6B6B" strokeWidth={3} fill="url(#expenseGradient)" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}

function ReportStat({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone: "emerald" | "rose" | "violet";
}) {
  const toneClass = {
    emerald: "bg-emerald-50 text-emerald-600",
    rose: "bg-rose-50 text-rose-500",
    violet: "bg-violet-50 text-violet-600",
  }[tone];

  return (
    <div className="rounded-xl border border-white/70 bg-white/86 p-4 shadow-soft backdrop-blur">
      <div className={clsx("grid h-11 w-11 place-items-center rounded-lg", toneClass)}>
        <Icon size={20} />
      </div>
      <p className="mt-5 text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-taka-ink">{value}</p>
    </div>
  );
}

function MobileNav({
  activeView,
  onChange,
}: {
  activeView: ViewKey;
  onChange: (view: ViewKey) => void;
}) {
  return (
    <nav className="fixed bottom-3 left-3 right-3 z-40 grid grid-cols-5 gap-1 rounded-xl border border-white/70 bg-white/92 p-2 shadow-soft backdrop-blur lg:hidden">
      {navItems.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onChange(item.key)}
          className={clsx(
            "grid min-w-0 place-items-center gap-1 rounded-lg px-1 py-2 text-[10px] font-black transition",
            activeView === item.key ? "bg-taka-navy text-white" : "text-slate-500",
          )}
        >
          <item.icon size={18} />
          <span className="truncate">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

function SectionHeader({ title, action }: { title: string; action: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="text-lg font-black text-taka-ink">{title}</h2>
      <button type="button" className="shrink-0 rounded-lg bg-slate-100 px-3 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-200">
        {action}
      </button>
    </div>
  );
}

function SectionTitle({ title, eyebrow }: { title: string; eyebrow: string }) {
  return (
    <div>
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-emerald-600 sm:text-xs">{eyebrow}</p>
      <h2 className="mt-1 text-xl font-black text-taka-ink sm:text-2xl">{title}</h2>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-[0.1em] text-slate-400">{label}</span>
      <input
        readOnly
        value={value}
        className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-taka-ink outline-none"
      />
    </label>
  );
}

function EditableField({
  label,
  value,
  placeholder,
  type = "text",
  inputMode,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  type?: "text" | "date";
  inputMode?: "numeric";
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-[0.1em] text-slate-400">{label}</span>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-taka-ink outline-none transition placeholder:text-slate-400 focus:border-emerald-300 focus:bg-white"
      />
    </label>
  );
}

function SegmentedControl({
  options,
  active,
  onChange,
}: {
  options: string[];
  active: string;
  onChange?: (option: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange?.(option)}
          className={clsx(
            "rounded-lg px-3 py-2 text-sm font-black transition",
            option === active ? "bg-white text-taka-ink shadow-sm" : "text-slate-500",
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

function MetricLine({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={clsx("font-bold", strong ? "text-white" : "text-slate-300")}>{label}</span>
      <span className={clsx("font-black", strong ? "text-2xl text-emerald-200" : "text-white")}>{value}</span>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  suffix = " rb",
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  suffix?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-slate-100 bg-white p-3 shadow-soft">
      <p className="text-xs font-black uppercase tracking-[0.08em] text-slate-400">{label}</p>
      <div className="mt-2 space-y-1">
        {payload.map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-4 text-sm">
            <span className="font-bold text-slate-600">{item.name}</span>
            <span className="font-black" style={{ color: item.color }}>{item.value}{suffix}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PieTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: { amount: number; color: string } }>;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];

  return (
    <div className="rounded-lg border border-slate-100 bg-white p-3 shadow-soft">
      <p className="text-sm font-black text-taka-ink">{item.name}</p>
      <p className="mt-1 text-xs font-bold text-slate-500">{currency.format(item.payload.amount)} • {item.value}%</p>
    </div>
  );
}

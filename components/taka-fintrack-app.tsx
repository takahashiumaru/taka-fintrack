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
  CalendarDays,
  Camera,
  ChartNoAxesColumnIncreasing,
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Eye,
  EyeOff,
  FileDown,
  FileText,
  Home,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  MoreHorizontal,
  Paperclip,
  Pencil,
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
  X,
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
type AuthMode = "login" | "register" | "forgot";

type AuthUser = {
  id: number;
  name: string;
  email: string;
  avatarUrl?: string | null;
};

type AuthSession = {
  user: AuthUser;
  token?: string;
  authenticated?: boolean;
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
  paymentAccount: string;
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
  paymentAccount: string;
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
  paymentAccount?: string;
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
  source: "ocr" | "demo" | "ai";
  categorySuggestion?: string | null;
  paymentAccount?: string | null;
};

type CategorySuggestion = {
  category: Category | null;
  reason: string;
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
const authTokenStorageKey = "taka-fintrack.auth-token-fallback";
const chatHistoryStorageKey = "taka-fintrack.chat-history";
const forgotPasswordCooldownStorageKey = "taka-fintrack.forgot-password-cooldown-until";
const forgotPasswordCooldownSeconds = 60;
const paymentAccountOptions = [
  "Cash",
  "QRIS",
  "BCA",
  "BNI",
  "BRI",
  "Mandiri",
  "BSI",
  "CIMB Niaga",
  "PermataBank",
  "Danamon",
  "Bank Jago",
  "Krom Bank",
  "Jenius",
  "SeaBank",
  "blu by BCA Digital",
  "Bank Neo Commerce",
  "Allo Bank",
  "Bank Saqu",
  "LINE Bank",
  "Superbank",
  "GoPay",
  "OVO",
  "DANA",
  "ShopeePay",
  "LinkAja",
  "AstraPay",
  "Sakuku",
  "i.saku",
  "Kartu Kredit",
  "Kartu Debit",
  "Transfer Bank",
  "Lainnya",
];

function normalizePaymentAccount(value: string | null | undefined) {
  const normalized = (value || "").trim().toLowerCase();

  if (!normalized) return "Cash";
  if (/bca digital|blu/.test(normalized)) return "blu by BCA Digital";
  if (/bca/.test(normalized)) return "BCA";
  if (/bni/.test(normalized)) return "BNI";
  if (/bri/.test(normalized)) return "BRI";
  if (/mandiri|livin/.test(normalized)) return "Mandiri";
  if (/bsi|syariah indonesia/.test(normalized)) return "BSI";
  if (/cimb|octo/.test(normalized)) return "CIMB Niaga";
  if (/permata/.test(normalized)) return "PermataBank";
  if (/danamon/.test(normalized)) return "Danamon";
  if (/jago/.test(normalized)) return "Bank Jago";
  if (/krom/.test(normalized)) return "Krom Bank";
  if (/jenius|btpn/.test(normalized)) return "Jenius";
  if (/sea ?bank|seabank/.test(normalized)) return "SeaBank";
  if (/neo|bank neo|bnc/.test(normalized)) return "Bank Neo Commerce";
  if (/allo/.test(normalized)) return "Allo Bank";
  if (/saqu/.test(normalized)) return "Bank Saqu";
  if (/line bank|linebank/.test(normalized)) return "LINE Bank";
  if (/superbank/.test(normalized)) return "Superbank";
  if (/shopee|spay/.test(normalized)) return "ShopeePay";
  if (/gopay|gojek/.test(normalized)) return "GoPay";
  if (/ovo/.test(normalized)) return "OVO";
  if (/dana/.test(normalized)) return "DANA";
  if (/linkaja|link aja/.test(normalized)) return "LinkAja";
  if (/astrapay|astra pay/.test(normalized)) return "AstraPay";
  if (/sakuku/.test(normalized)) return "Sakuku";
  if (/i\.saku|isaku/.test(normalized)) return "i.saku";
  if (/qris|qr/.test(normalized)) return "QRIS";
  if (/kredit|credit|cc|visa|mastercard|master card/.test(normalized)) return "Kartu Kredit";
  if (/debit/.test(normalized)) return "Kartu Debit";
  if (/transfer|bank/.test(normalized)) return "Transfer Bank";
  if (/cash|tunai|uang tunai/.test(normalized)) return "Cash";

  return value?.trim() || "Lainnya";
}

function getForgotPasswordCooldownRemaining() {
  if (typeof window === "undefined") return 0;

  const rawCooldownUntil = window.localStorage.getItem(forgotPasswordCooldownStorageKey);
  const cooldownUntil = Number(rawCooldownUntil);

  if (!Number.isFinite(cooldownUntil) || cooldownUntil <= Date.now()) {
    window.localStorage.removeItem(forgotPasswordCooldownStorageKey);
    return 0;
  }

  return Math.ceil((cooldownUntil - Date.now()) / 1000);
}

function formatCooldown(seconds: number) {
  return `${Math.max(0, seconds)} detik`;
}

function startForgotPasswordCooldown() {
  if (typeof window === "undefined") return forgotPasswordCooldownSeconds;

  const cooldownUntil = Date.now() + forgotPasswordCooldownSeconds * 1000;
  window.localStorage.setItem(forgotPasswordCooldownStorageKey, String(cooldownUntil));

  return forgotPasswordCooldownSeconds;
}

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

async function apiRequest<T>(url: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);

  if (!headers.has("Authorization") && typeof window !== "undefined") {
    try {
      const token = window.localStorage.getItem(authTokenStorageKey);
      if (token) headers.set("Authorization", `Bearer ${token}`);
    } catch {
      // Ignore private browsing/storage restrictions.
    }
  }

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, {
    credentials: "include",
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
    paymentAccount: transaction.paymentAccount || "Cash",
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

function getFullMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(date);
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
  // Remove everything that is not a digit, comma, or period
  // Indonesian receipt format: 10.500 or 10,500 or 10500
  const cleaned = value.replace(/[^\d.,]/g, "");
  // If there's a period or comma followed by exactly 3 digits at the end, it's a thousands separator
  const normalized = cleaned.replace(/[.,](?=\d{3}(?:[.,]|$))/g, "");
  // Remove remaining commas/periods (decimal separators we don't need for IDR)
  return Number(normalized.replace(/[.,]/g, "")) || 0;
}

function formatReceiptDate(rawText: string) {
  // Try many date formats: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, DD/MM/YY, etc.
  const patterns = [
    /(\d{1,2})[./-](\d{1,2})[./-](\d{4})[\s,.-]+(\d{1,2})[:.h](\d{2})/,     // DD/MM/YYYY HH:MM
    /(\d{1,2})[./-](\d{1,2})[./-](\d{2})[\s,.-]+(\d{1,2})[:.h](\d{2})/,       // DD/MM/YY HH:MM
    /(\d{1,2})[./-](\d{1,2})[./-](\d{4})/,                                     // DD/MM/YYYY
    /(\d{1,2})[./-](\d{1,2})[./-](\d{2})/,                                     // DD/MM/YY
  ];

  for (const pattern of patterns) {
    const match = rawText.match(pattern);
    if (!match) continue;

    const [, day, month, yearRaw, hour, minute] = match;
    const year = yearRaw.length === 2 ? `20${yearRaw}` : yearRaw;
    const monthName = [
      "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
      "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
    ][Number(month) - 1] ?? month;
    const timeStr = hour && minute ? `, ${hour.padStart(2, "0")}.${minute}` : "";

    return `${Number(day)} ${monthName} ${year}${timeStr}`;
  }

  return "Tanggal tidak terbaca";
}

/** Lines that should NOT be treated as items */
function isReceiptMetaLine(line: string) {
  return /^(NPWP|JL\b|JALAN|ALAMAT|TEL|TELP|FAX|NO\s*:|\*{3,}|-{3,}|={3,}|KASIR|STRUK|RECEIPT|TERIMA\s*KASIH|THANK|SELAMAT|WELCOME|MEMBER|CUSTOMER|PELANGGAN|NOTA|INVOICE|TOKO|STORE)/i.test(line);
}

/** Lines that are total/summary lines, not items */
function isSummaryLine(line: string) {
  return /^\s*(SUB\s*TOTAL|TOTAL|GRAND\s*TOTAL|BAYAR|TUNAI|CASH|DEBIT|CREDIT|KREDIT|KEMBALIAN|KEMBALI|CHANGE|DIS[CK]|DISC|PPN|TAX|PAJAK|VOUCHER|PROMO|HARGA\s*JUAL|SAVING|HEMAT|PEMBAYARAN|PAYMENT|ROUNDING)\b/i.test(line);
}

function extractMerchantName(lines: string[]): string {
  // Common Indonesian store chains
  const knownMerchants: Record<string, string> = {
    INDOMARET: "Indomaret",
    ALFAMART: "Alfamart",
    ALFAMIDI: "Alfamidi",
    "CIRCLE K": "Circle K",
    LAWSON: "Lawson",
    SUPERINDO: "Superindo",
    HYPERMART: "Hypermart",
    TRANSMART: "Transmart",
    CARREFOUR: "Carrefour",
    GIANT: "Giant",
    LOTTE: "Lotte Mart",
    MATAHARI: "Matahari",
    STARBUCKS: "Starbucks",
    MCDONALD: "McDonald's",
    "KFC": "KFC",
    "PIZZA HUT": "Pizza Hut",
    HOKBEN: "HokBen",
    YOSHINOYA: "Yoshinoya",
    JCOFFEE: "J.CO",
    "J.CO": "J.CO",
    CHATIME: "Chatime",
    MIXUE: "Mixue",
    DAGADU: "Dagadu",
    KOPKEN: "Kopi Kenangan",
    KENANGAN: "Kopi Kenangan",
    "KOPI KENANGAN": "Kopi Kenangan",
    JANJI: "Janji Jiwa",
    "FORE COFFEE": "Fore Coffee",
    FORE: "Fore Coffee",
    TOMORO: "Tomoro Coffee",
    GRAMEDIA: "Gramedia",
    ACE: "ACE Hardware",
    MINISO: "Miniso",
    UNIQLO: "Uniqlo",
    WATSONS: "Watsons",
    GUARDIAN: "Guardian",
  };

  const fullText = lines.join(" ").toUpperCase();
  for (const [keyword, name] of Object.entries(knownMerchants)) {
    if (fullText.includes(keyword)) return name;
  }

  // Try the first 3 non-empty lines that look like store names
  for (const line of lines.slice(0, 5)) {
    const cleaned = line.trim();
    if (
      cleaned.length >= 3 &&
      cleaned.length <= 40 &&
      !isReceiptMetaLine(cleaned) &&
      !isSummaryLine(cleaned) &&
      !/^\d/.test(cleaned) &&
      !/Rp\s*[\d.,]/i.test(cleaned)
    ) {
      return cleaned.split(/\s+/).map((w) =>
        w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
      ).join(" ");
    }
  }

  return "Struk Belanja";
}

function extractPaymentMethod(text: string): string {
  const upper = text.toUpperCase();
  if (/DEBIT|DEBET/i.test(upper)) return "Debit";
  if (/CREDIT|KREDIT|CC\b/i.test(upper)) return "Kredit";
  if (/QRIS|QR/i.test(upper)) return "QRIS";
  if (/GOPAY/i.test(upper)) return "GoPay";
  if (/OVO\b/i.test(upper)) return "OVO";
  if (/DANA\b/i.test(upper)) return "DANA";
  if (/SHOPEEPAY|SPAY/i.test(upper)) return "ShopeePay";
  if (/E-?MONEY|EMONEY|FLAZZ|BRIZZI|MANDIRI\s*E/i.test(upper)) return "E-Money";
  if (/TUNAI|CASH|BAYAR\s*TUNAI/i.test(upper)) return "Tunai";
  return "Tunai";
}

function suggestReceiptCategory(receipt: ScannedReceipt | null, categories: Category[], type: "income" | "expense"): CategorySuggestion {
  const availableCategories = categories.filter((category) => category.type === type || category.type === "both");
  if (!receipt || availableCategories.length === 0) {
    return { category: null, reason: "Belum ada kategori yang cocok." };
  }

  const text = [receipt.merchant, receipt.payment, receipt.categorySuggestion ?? "", ...receipt.items.map((item) => item.name)]
    .join(" ")
    .toLowerCase();
  const findByName = (...needles: string[]) => availableCategories.find((category) => {
    const name = category.name.toLowerCase();
    return needles.some((needle) => name.includes(needle));
  }) ?? null;

  if (receipt.categorySuggestion) {
    const aiSuggestion = receipt.categorySuggestion.toLowerCase();
    const aiCategory = availableCategories.find((category) => {
      const name = category.name.toLowerCase();
      return name === aiSuggestion || name.includes(aiSuggestion) || aiSuggestion.includes(name);
    });
    if (aiCategory) return { category: aiCategory, reason: "Kategori ditentukan oleh AI dari isi struk." };
  }

  const rules: Array<{ keywords: string[]; names: string[]; reason: string }> = [
    {
      keywords: ["pln", "listrik", "pdam", "pulsa", "token listrik", "internet", "wifi", "telkom", "indihome", "virtual account", "tagihan", "utility", "utilities", "bill"],
      names: ["tagihan", "utilitas", "utility"],
      reason: "Terdeteksi pola pembayaran/tagihan dari teks struk.",
    },
    {
      keywords: ["accessories", "accesories", "aksesoris", "fashion", "baju", "sepatu", "tas", "kosmetik", "store", "shop", "mart", "mall"],
      names: ["belanja", "fashion"],
      reason: "Terdeteksi merchant/item belanja non-makanan.",
    },
    {
      keywords: ["restaurant", "resto", "cafe", "coffee", "kopi", "bakso", "ayam", "makan", "minum", "food", "indomaret", "alfamart"],
      names: ["makanan", "minuman"],
      reason: "Terdeteksi merchant/item makanan atau minuman.",
    },
    {
      keywords: ["grab", "gojek", "gocar", "goride", "taxi", "tol", "parkir", "pertamina", "shell", "transport"],
      names: ["transport"],
      reason: "Terdeteksi biaya transportasi.",
    },
    {
      keywords: ["rs", "klinik", "apotek", "pharmacy", "obat", "health"],
      names: ["kesehatan"],
      reason: "Terdeteksi biaya kesehatan.",
    },
  ];

  for (const rule of rules) {
    if (rule.keywords.some((keyword) => text.includes(keyword))) {
      const category = findByName(...rule.names);
      if (category) return { category, reason: rule.reason };
    }
  }

  const fallback = findByName("makanan", "minuman") ?? availableCategories[0] ?? null;
  return {
    category: fallback,
    reason: fallback ? "AI/kata kunci belum yakin dalam 30 detik; default dipilih Makanan & Minuman sesuai aturan fallback." : "Belum ada kategori yang cocok.",
  };
}

function parseReceiptText(rawText: string): ScannedReceipt {
  const text = rawText.replace(/[|]/g, "I").replace(/\r/g, "");
  const lines = text
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const items: ReceiptItem[] = [];

  // Strategy: Try multiple regex patterns to extract items
  const itemPatterns = [
    // Pattern 1: NAME  QTY  PRICE  TOTAL  (most common for supermarkets)
    /^(.+?)\s+(\d{1,3})\s+([\d.,]{3,})\s+([\d.,]{3,})\s*$/i,
    // Pattern 2: NAME  QTYxPRICE  (e.g. "Nasi Goreng 2x15.000")
    /^(.+?)\s+(\d{1,3})\s*[xX×]\s*([\d.,]{3,})\s*$/i,
    // Pattern 3: NAME  Rp PRICE (single item, qty=1)
    /^(.{3,}?)\s+(?:Rp\.?\s*)?(\d[\d.,]{2,})\s*$/i,
    // Pattern 4: NAME  QTY  @PRICE  TOTAL
    /^(.+?)\s+(\d{1,3})\s*@\s*([\d.,]{3,})\s+([\d.,]{3,})\s*$/i,
    // Pattern 5: QTY NAME PRICE (qty first)
    /^(\d{1,3})\s+(.{3,}?)\s+([\d.,]{3,})\s*$/i,
  ];

  for (const line of lines) {
    const upper = line.toUpperCase();
    if (isReceiptMetaLine(upper) || isSummaryLine(upper)) continue;

    let matched = false;

    // Try Pattern 1: NAME QTY PRICE TOTAL
    const m1 = line.match(itemPatterns[0]);
    if (m1 && !matched) {
      const [, rawName, rawQty, rawPrice] = m1;
      const qty = Number(rawQty);
      const price = parseReceiptAmount(rawPrice);
      if (qty > 0 && qty <= 100 && price > 0 && rawName.length >= 2) {
        items.push({ name: rawName.trim(), qty, price });
        matched = true;
      }
    }

    // Try Pattern 2: NAME QTYxPRICE
    if (!matched) {
      const m2 = line.match(itemPatterns[1]);
      if (m2) {
        const [, rawName, rawQty, rawPrice] = m2;
        const qty = Number(rawQty);
        const price = parseReceiptAmount(rawPrice);
        if (qty > 0 && qty <= 100 && price > 0 && rawName.length >= 2) {
          items.push({ name: rawName.trim(), qty, price });
          matched = true;
        }
      }
    }

    // Try Pattern 4: NAME QTY @PRICE TOTAL
    if (!matched) {
      const m4 = line.match(itemPatterns[3]);
      if (m4) {
        const [, rawName, rawQty, rawPrice] = m4;
        const qty = Number(rawQty);
        const price = parseReceiptAmount(rawPrice);
        if (qty > 0 && qty <= 100 && price > 0 && rawName.length >= 2) {
          items.push({ name: rawName.trim(), qty, price });
          matched = true;
        }
      }
    }

    // Try Pattern 5: QTY NAME PRICE
    if (!matched) {
      const m5 = line.match(itemPatterns[4]);
      if (m5) {
        const [, rawQty, rawName, rawPrice] = m5;
        const qty = Number(rawQty);
        const price = parseReceiptAmount(rawPrice);
        if (qty > 0 && qty <= 100 && price > 0 && rawName.length >= 2) {
          items.push({ name: rawName.trim(), qty, price });
          matched = true;
        }
      }
    }

    // Try Pattern 3: NAME Rp PRICE (qty=1, for simpler receipts like coffee shops)
    if (!matched) {
      // Require either 'Rp' or that the number is <= 8 digits to avoid matching phone numbers like 02744464894
      const m3 = line.match(/^(.{3,}?)\s+(?:Rp\.?\s*(\d[\d.,]{2,})|(\d[\d.,]{2,6}))\s*$/i);
      if (m3) {
        const [, rawName, rawPriceRp, rawPriceShort] = m3;
        const rawPrice = rawPriceRp || rawPriceShort;
        const price = parseReceiptAmount(rawPrice);
        // Avoid matching summary lines that have "total", "subtotal", etc.
        // Also avoid matching address lines (e.g. contains JL, KM, RT, RW)
        if (price > 0 && rawName.length >= 2 && !isSummaryLine(rawName) && !/^(JL|KM|RT|RW|NO)\b/i.test(rawName)) {
          items.push({ name: rawName.trim(), qty: 1, price });
          matched = true;
        }
      }
    }
  }

  // Extract totals from text
  const fullText = lines.join("\n").toUpperCase();
  const totalPatterns = [
    /(?:GRAND\s*)?TOTAL\s*[:=]?\s*(?:Rp\.?\s*)?([\d.,]+)/i,
    /BAYAR\s*[:=]?\s*(?:Rp\.?\s*)?([\d.,]+)/i,
  ];
  const subtotalPatterns = [
    /SUB\s*TOTAL\s*[:=]?\s*(?:Rp\.?\s*)?([\d.,]+)/i,
    /HARGA\s*JUAL\s*[:=]?\s*(?:Rp\.?\s*)?([\d.,]+)/i,
  ];
  const discountPatterns = [
    /DIS[CK](?:OUNT)?\s*[:=]?\s*\(?(?:Rp\.?\s*)?([\d.,]+)\)?/i,
    /VOUCHER\s*[:=]?\s*\(?(?:Rp\.?\s*)?([\d.,]+)\)?/i,
    /PROMO\s*[:=]?\s*\(?(?:Rp\.?\s*)?([\d.,]+)\)?/i,
    /HEMAT\s*[:=]?\s*\(?(?:Rp\.?\s*)?([\d.,]+)\)?/i,
    /SAVING\s*[:=]?\s*\(?(?:Rp\.?\s*)?([\d.,]+)\)?/i,
  ];

  let parsedTotal = 0;
  for (const pattern of totalPatterns) {
    const match = fullText.match(pattern);
    if (match) { parsedTotal = parseReceiptAmount(match[1]); break; }
  }

  let parsedSubtotal = 0;
  for (const pattern of subtotalPatterns) {
    const match = fullText.match(pattern);
    if (match) { parsedSubtotal = parseReceiptAmount(match[1]); break; }
  }

  let parsedDiscount = 0;
  for (const pattern of discountPatterns) {
    const match = fullText.match(pattern);
    if (match) { parsedDiscount += parseReceiptAmount(match[1]); }
  }

  // Calculate derived values
  const itemsTotal = items.reduce((sum, item) => sum + item.qty * item.price, 0);
  const subtotal = parsedSubtotal || itemsTotal || parsedTotal;
  const discount = parsedDiscount;
  const total = parsedTotal || Math.max(subtotal - discount, 0);

  // If no items could be parsed, still return what we can from totals
  if (items.length === 0 && total === 0) {
    return indomaretExampleReceipt;
  }

  const merchant = extractMerchantName(lines);
  const date = formatReceiptDate(fullText);
  const payment = extractPaymentMethod(fullText);

  // Confidence based on how much data we extracted
  let confidence = 40;
  if (items.length > 0) confidence += Math.min(30, items.length * 5);
  if (parsedTotal > 0) confidence += 10;
  if (date !== "Tanggal tidak terbaca") confidence += 10;
  if (merchant !== "Struk Belanja") confidence += 10;
  confidence = Math.min(98, confidence);

  return {
    merchant,
    date,
    payment,
    subtotal,
    discount,
    total,
    confidence,
    source: "ocr",
    items,
  };
}


export function TakaFinTrackApp() {
  const [activeView, setActiveView] = useState<ViewKey>(getInitialView);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(getStoredUser);
  const [sessionReady, setSessionReady] = useState(Boolean(getStoredUser()));
  const [isAuthChecking, setIsAuthChecking] = useState(Boolean(getStoredUser()));
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
      if (session.token) window.localStorage.setItem(authTokenStorageKey, session.token);
    } catch {
      // Ignore private browsing/storage restrictions.
    }

    setCurrentUser(session.user);
    setSessionReady(true);
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
    setSessionReady(false);
    void fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => undefined);
    setTransactions([]);
    setCategories([]);
    setDataStatus("idle");
  }, []);
  const refreshFinanceData = useCallback(async () => {
    if (!sessionReady) return;

    setDataStatus("loading");
    setDataError("");

    try {
      const [transactionResponse, categoryResponse] = await Promise.all([
        apiRequest<{ transactions: ApiTransaction[] }>("/api/transactions", {
        }),
        apiRequest<{ categories: Category[] }>("/api/categories", {
        }),
      ]);

      setTransactions(transactionResponse.transactions.map(normalizeApiTransaction));
      setCategories(categoryResponse.categories);
      setDataStatus("ready");
    } catch (error) {
      setDataStatus("error");
      setDataError(error instanceof Error ? error.message : "Data gagal dimuat.");
    }
  }, [sessionReady]);
  const createTransaction = useCallback(async (input: TransactionInput) => {
    if (!sessionReady) throw new Error("Sesi belum siap.");

    const response = await apiRequest<{ transaction: ApiTransaction }>("/api/transactions", {
      method: "POST",
      body: JSON.stringify(input),
    });
    const nextTransaction = normalizeApiTransaction(response.transaction);

    setTransactions((current) => [nextTransaction, ...current]);

    return nextTransaction;
  }, [sessionReady]);
  const updateTransaction = useCallback(async (rawId: number, input: TransactionInput) => {
    if (!sessionReady) throw new Error("Sesi belum siap.");

    const response = await apiRequest<{ transaction: ApiTransaction }>(`/api/transactions/${rawId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
    const updatedTransaction = normalizeApiTransaction(response.transaction);

    setTransactions((current) => current.map((transaction) => transaction.rawId === rawId ? updatedTransaction : transaction));

    return updatedTransaction;
  }, [sessionReady]);
  const deleteTransaction = useCallback(async (rawId: number) => {
    if (!sessionReady) throw new Error("Sesi belum siap.");

    await apiRequest<{ success: boolean }>(`/api/transactions/${rawId}`, {
      method: "DELETE",
    });

    setTransactions((current) => current.filter((t) => t.rawId !== rawId));
  }, [sessionReady]);
  const createCategory = useCallback(async (input: CategoryInput) => {
    if (!sessionReady) throw new Error("Sesi belum siap.");

    const response = await apiRequest<{ category: Category }>("/api/categories", {
      method: "POST",
      body: JSON.stringify(input),
    });

    setCategories((current) => [...current, response.category]);

    return response.category;
  }, [sessionReady]);

  useEffect(() => {
    if (!sessionReady) {
      setIsAuthChecking(false);
      return;
    }

    let isCancelled = false;

    async function verifySession() {
      setIsAuthChecking(true);

      try {
        const response = await apiRequest<{ user: AuthUser; token?: string }>("/api/auth/me");

        if (isCancelled) return;

        setCurrentUser(response.user);

        try {
          window.localStorage.setItem(authStorageKey, JSON.stringify(response.user));
          if (response.token) window.localStorage.setItem(authTokenStorageKey, response.token);
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
  }, [sessionReady, handleLogout]);

  useEffect(() => {
    if (currentUser && sessionReady) {
      void refreshFinanceData();
    }
  }, [sessionReady, currentUser, refreshFinanceData]);

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
    <main className="min-h-screen w-full max-w-full overflow-x-hidden px-3 pb-24 pt-3 sm:px-4 lg:p-6">
      <div className="mx-auto grid w-full max-w-[1500px] items-start gap-4 lg:grid-cols-[278px_minmax(0,1fr)]">
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
            sessionReady={sessionReady}
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
              onUpdateTransaction={updateTransaction}
              onCreateCategory={createCategory}
              onDeleteTransaction={deleteTransaction}
              onRefresh={refreshFinanceData}
            />
          )}
          <div className={activeView === "scan" ? "block" : "hidden"} aria-hidden={activeView !== "scan"}>
            <ScanView categories={categories} sessionReady={sessionReady} onCreateTransaction={createTransaction} onNavigate={changeView} />
          </div>
          {activeView === "chat" && <ChatView transactions={transactions} sessionReady={sessionReady} />}
          {activeView === "reports" && <ReportsView analytics={analytics} transactions={transactions} />}
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
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [forgotCooldown, setForgotCooldown] = useState(0);
  const isRegister = mode === "register";
  const isForgot = mode === "forgot";
  const isForgotOnCooldown = isForgot && forgotCooldown > 0;

  useEffect(() => {
    const refreshCooldown = () => setForgotCooldown(getForgotPasswordCooldownRemaining());

    refreshCooldown();
    const intervalId = window.setInterval(refreshCooldown, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError("");
    setSuccessMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();

    if (!normalizedEmail) {
      setError("Email wajib diisi.");
      return;
    }

    if (!isForgot && !password.trim()) {
      setError("Password wajib diisi.");
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

    if (isForgot && forgotCooldown > 0) {
      setError(`Tunggu ${formatCooldown(forgotCooldown)} sebelum meminta link reset lagi.`);
      return;
    }

    setIsSubmitting(true);
    setError("");
    setSuccessMessage("");

    try {
      if (isForgot) {
        await apiRequest<{ success: boolean }>("/api/auth/forgot-password", {
          method: "POST",
          body: JSON.stringify({ email: normalizedEmail }),
        });
        setForgotCooldown(startForgotPasswordCooldown());
        setSuccessMessage("Link reset password sudah dikirim jika email terdaftar. Cek inbox/spam ya. Kamu bisa meminta link baru lagi setelah 1 menit.");
        return;
      }

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
            <AppLogo size={48} />
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
              {isForgot ? "Reset akses" : isRegister ? "Akun baru" : "Selamat datang"}
            </p>
            <h1 className="mt-1 text-3xl font-black leading-tight text-taka-ink sm:text-4xl">
              {isForgot ? "Lupa password?" : isRegister ? "Buat akun Taka" : "Masuk ke akunmu"}
            </h1>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
              {isForgot
                ? "Masukkan email akunmu. Kami akan mengirim instruksi reset password dengan tampilan email profesional."
                : isRegister
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
            {!isForgot && (
              <AuthField
                id="password"
                label="Password"
                type="password"
                value={password}
                placeholder="Minimal 6 karakter"
                autoComplete={isRegister ? "new-password" : "current-password"}
                onChange={setPassword}
              />
            )}
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

            {successMessage && (
              <div className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-sm font-bold text-sky-700">
                {successMessage}
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || isForgotOnCooldown}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-taka-navy px-4 py-3 text-sm font-black text-white shadow-float transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRegister ? <Check size={18} /> : <ChevronRight size={18} />}
              {isSubmitting
                ? "Memproses..."
                : isForgotOnCooldown
                  ? `Kirim lagi dalam ${formatCooldown(forgotCooldown)}`
                  : isForgot
                    ? "Kirim Email Reset"
                    : isRegister
                      ? "Register & Masuk"
                      : "Login"}
            </button>
            {isForgotOnCooldown && (
              <p className="text-center text-xs font-bold text-slate-500">
                Demi keamanan, tunggu {formatCooldown(forgotCooldown)} sebelum meminta link reset lagi.
              </p>
            )}
            {!isRegister && (
              <button
                type="button"
                onClick={() => switchMode(isForgot ? "login" : "forgot")}
                className="w-full rounded-lg px-3 py-2 text-sm font-black text-emerald-700 transition hover:bg-emerald-50"
              >
                {isForgot ? "Kembali ke Login" : "Lupa Password?"}
              </button>
            )}
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
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword ? (showPassword ? "text" : "password") : type;

  return (
    <div className="relative">
      <label htmlFor={id} className="block">
        <span className="text-xs font-black uppercase tracking-[0.1em] text-slate-400">{label}</span>
        <div className="relative mt-2">
          <input
            id={id}
            type={inputType}
            value={value}
            placeholder={placeholder}
            autoComplete={autoComplete}
            onChange={(event) => onChange(event.target.value)}
            className="h-12 w-full rounded-lg border border-slate-200 bg-slate-50 pl-3 pr-10 text-sm font-bold text-taka-ink outline-none transition placeholder:text-slate-400 focus:border-emerald-300 focus:bg-white"
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          )}
        </div>
      </label>
    </div>
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

function AppLogo({ size = 44 }: { size?: number }) {
  return (
    <Image
      src="/images/taka-logo-v2.png"
      alt="Taka FinTrack"
      width={size}
      height={size}
      priority
      unoptimized
      className="shrink-0 object-contain drop-shadow-[0_10px_22px_rgba(15,23,42,0.14)]"
      style={{ width: size, height: size }}
    />
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
    <aside className="hidden h-[calc(100vh-48px)] self-start overflow-hidden rounded-xl border border-white/70 bg-white/86 p-3 shadow-soft backdrop-blur lg:block">
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 px-2 py-1">
          <AppLogo size={44} />
          <div>
            <p className="text-base font-black text-taka-ink">Taka FinTrack</p>
            <p className="text-xs font-semibold text-slate-500">Personal finance AI</p>
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-gradient-to-br from-taka-violet via-white to-taka-mint p-4">
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

        <nav className="mt-4 space-y-2">
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
  onUserUpdate,
  onAddTransaction,
  onLogout,
}: {
  title: string;
  user: AuthUser;
  sessionReady: boolean;
  onUserUpdate: (updates: Partial<AuthUser>) => void;
  onAddTransaction: () => void;
  onLogout: () => void;
}) {
  return (
    <header className="relative z-[1200] flex items-start justify-between gap-3 rounded-xl border border-white/70 bg-white/82 p-3 shadow-soft backdrop-blur sm:items-center sm:p-4">
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
        <ProfileMenu user={user} onUserUpdate={onUserUpdate} onLogout={onLogout} />
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
  onUserUpdate,
  onLogout,
}: {
  user: AuthUser;
  onUserUpdate: (updates: Partial<AuthUser>) => void;
  onLogout: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function saveProfile(updates: Partial<AuthUser>) {
    setIsSavingProfile(true);

    try {
      const response = await apiRequest<{ user: AuthUser }>("/api/users/profile", {
        method: "PATCH",
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
        <>
          <button
            type="button"
            aria-label="Tutup menu profil"
            className="fixed inset-0 z-[900] cursor-default bg-transparent"
            onClick={() => setIsOpen(false)}
          />
          <div className="fixed right-3 top-24 z-[1300] max-h-[calc(100vh-8rem)] w-72 max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-xl border border-white/80 bg-white p-4 text-left shadow-[0_18px_60px_rgba(15,23,42,0.25)] backdrop-blur">
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
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-3 pr-10 text-xs font-bold text-taka-ink outline-none transition placeholder:text-slate-400 focus:border-emerald-300 focus:bg-white"
                  placeholder="Password baru"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-3 pr-10 text-xs font-bold text-taka-ink outline-none transition placeholder:text-slate-400 focus:border-emerald-300 focus:bg-white"
                  placeholder="Konfirmasi password"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
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

          <div className="mt-4 border-t border-slate-100 pt-4 lg:hidden">
            <button
              type="button"
              onClick={onLogout}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-rose-100 bg-rose-50 px-3 py-2.5 text-xs font-black text-rose-600 transition hover:bg-rose-100"
            >
              <LogOut size={15} />
              Keluar dari Taka
            </button>
          </div>
          </div>
        </>
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
  onEdit,
  onDelete,
}: {
  item: Transaction;
  onEdit?: ((transaction: Transaction) => void) | undefined;
  onDelete?: ((rawId: number) => void) | undefined;
}) {
  const isIncome = item.type === "income";
  const amount = `${isIncome ? "+" : "-"}${currency.format(item.amount)}`;
  const amountClass = isIncome ? "text-emerald-600" : "text-rose-500";
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setShowDetail(true)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setShowDetail(true);
        }
      }}
      className="grid min-w-0 cursor-pointer grid-cols-[36px_minmax(0,1fr)_auto] gap-2 rounded-lg border border-slate-100 bg-white p-2.5 transition hover:border-emerald-200 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 sm:flex sm:items-center sm:p-3"
    >
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg sm:h-10 sm:w-10" style={{ backgroundColor: getSoftColor(item.categoryColor), color: item.categoryColor }}>
        {isIncome ? <TrendingUp size={17} /> : <CreditCard size={17} />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <p className="truncate text-[13px] font-black text-taka-ink sm:text-sm">{item.merchant}</p>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-500">{item.source}</span>
        </div>
        <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-500 sm:text-xs">{item.category} • {item.paymentAccount || "Cash"} • {item.date}</p>
        <p className={clsx("mt-1 text-[13px] font-black sm:hidden", amountClass)}>
          {amount}
        </p>
      </div>
      <p className={clsx("hidden shrink-0 text-right text-sm font-black sm:block", amountClass)}>
        {amount}
      </p>
      <div className="flex shrink-0 items-center gap-1 self-start sm:self-center">
      {onEdit && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onEdit(item);
          }}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-600"
          aria-label="Edit transaksi"
        >
          <Pencil size={15} />
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          disabled={isDeleting}
          onClick={(event) => {
            event.stopPropagation();
            setShowConfirmDelete(true);
          }}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-300 transition hover:bg-rose-50 hover:text-rose-500 disabled:opacity-40"
          aria-label="Hapus transaksi"
        >
          <Trash2 size={16} />
        </button>
      )}
      </div>

      {showDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={(event) => {
            if (event.target === event.currentTarget) setShowDetail(false);
          }}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-[0_8px_32px_rgba(0,0,0,0.18)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">Detail Transaksi</p>
                <h3 className="mt-1 text-lg font-black text-taka-ink">{item.merchant}</h3>
              </div>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setShowDetail(false);
                }}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-500 transition hover:bg-slate-200"
                aria-label="Tutup detail transaksi"
              >
                <X size={18} strokeWidth={3} />
              </button>
            </div>
            <div className={clsx("mt-4 rounded-2xl p-4", isIncome ? "bg-emerald-50" : "bg-rose-50")}>
              <p className="text-xs font-black uppercase tracking-[0.1em] text-slate-400">Nominal</p>
              <p className={clsx("mt-1 text-2xl font-black", amountClass)}>{amount}</p>
            </div>
            <div className="mt-4 grid gap-2 text-sm font-bold text-slate-600">
              <DetailLine label="Kategori" value={item.category} />
              <DetailLine label="Akun / Dompet" value={item.paymentAccount || "Cash"} />
              <DetailLine label="Tanggal" value={item.date} />
              <DetailLine label="Jenis" value={isIncome ? "Income" : "Expense"} />
              <DetailLine label="Sumber" value={item.source} />
            </div>
            <div className="mt-4 flex gap-2">
              {onEdit && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setShowDetail(false);
                    onEdit(item);
                  }}
                  className="flex-1 rounded-xl bg-taka-navy py-2.5 text-sm font-black text-white transition hover:bg-slate-800"
                >
                  Edit
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setShowDetail(false);
                    setShowConfirmDelete(true);
                  }}
                  className="flex-1 rounded-xl bg-rose-500 py-2.5 text-sm font-black text-white transition hover:bg-rose-600"
                >
                  Hapus
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showConfirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) setShowConfirmDelete(false);
          }}
        >
          <div
            className="w-full max-w-xs rounded-2xl bg-white p-5 shadow-[0_8px_32px_rgba(0,0,0,0.18)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-50">
              <Trash2 size={22} className="text-rose-500" />
            </div>
            <p className="mt-3 text-base font-black text-taka-ink">Hapus Transaksi?</p>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Apakah kamu yakin ingin menghapus transaksi <span className="font-bold">{item.merchant}</span>? Data tidak dapat dipulihkan.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setShowConfirmDelete(false);
                }}
                disabled={isDeleting}
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-sm font-black text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={async (event) => {
                  event.stopPropagation();
                  setIsDeleting(true);
                  try {
                    if (onDelete) {
                      await onDelete(item.rawId);
                    }
                  } finally {
                    setIsDeleting(false);
                    setShowConfirmDelete(false);
                  }
                }}
                disabled={isDeleting}
                className="flex-1 rounded-xl bg-rose-500 py-2.5 text-sm font-black text-white transition hover:bg-rose-600 disabled:opacity-50 flex justify-center items-center"
              >
                {isDeleting ? "Menghapus..." : "Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2">
      <span className="text-xs font-black uppercase tracking-[0.08em] text-slate-400">{label}</span>
      <span className="truncate text-right text-sm font-black text-taka-ink">{value}</span>
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
  onUpdateTransaction,
  onCreateCategory,
  onDeleteTransaction,
  onRefresh,
}: {
  transactions: Transaction[];
  categories: Category[];
  dataStatus: "idle" | "loading" | "ready" | "error";
  onCreateTransaction: (input: TransactionInput) => Promise<Transaction>;
  onUpdateTransaction: (rawId: number, input: TransactionInput) => Promise<Transaction>;
  onCreateCategory: (input: CategoryInput) => Promise<Category>;
  onDeleteTransaction: (rawId: number) => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const [filter, setFilter] = useState<"Semua" | "Income" | "Expense" | "Scan">("Semua");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [transactionType, setTransactionType] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [paymentAccount, setPaymentAccount] = useState("Cash");
  const [transactionDate, setTransactionDate] = useState(getDateInputValue());
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
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

  const monthTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      const date = getTransactionDate(transaction);
      return isSameMonth(date, selectedMonth);
    });
  }, [transactions, selectedMonth]);

  const filteredTransactions = monthTransactions.filter((transaction) => {
    if (filter === "Income") return transaction.type === "income";
    if (filter === "Expense") return transaction.type === "expense";
    if (filter === "Scan") return transaction.source === "Scan";
    return true;
  });

  const monthIncome = monthTransactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);
  const monthExpense = monthTransactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);

  function prevMonth() {
    setSelectedMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  }
  function nextMonth() {
    setSelectedMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  }
  function goToCurrentMonth() {
    const now = new Date();
    setSelectedMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  }

  useEffect(() => {
    if (availableCategories.length === 0) {
      setCategoryId("");
      return;
    }

    if (!availableCategories.some((category) => String(category.id) === categoryId)) {
      setCategoryId(String(availableCategories[0].id));
    }
  }, [availableCategories, categoryId]);

  function startEditTransaction(transaction: Transaction) {
    setEditingTransaction(transaction);
    setTransactionType(transaction.type);
    setAmount(String(transaction.amount));
    setMerchant(transaction.merchant);
    setTransactionDate(getDateInputValue(getTransactionDate(transaction)));
    setPaymentAccount(transaction.paymentAccount || "Cash");
    const matchingCategory = categories.find((category) => category.id === transaction.categoryId || category.name === transaction.category);
    setCategoryId(matchingCategory ? String(matchingCategory.id) : "");
    setMessage("Mode edit aktif. Ubah data lalu simpan.");
    setError("");
  }

  function cancelEditTransaction() {
    setEditingTransaction(null);
    setMerchant("");
    setAmount("");
    setPaymentAccount("Cash");
    setTransactionDate(getDateInputValue());
    setMessage("");
    setError("");
  }

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
      const payload = {
        merchant: finalMerchant,
        amount: parsedAmount,
        type: transactionType,
        categoryId: selectedCategory.id,
        transactionDate,
        source: editingTransaction?.source ?? "Manual",
        paymentAccount,
      } satisfies TransactionInput;

      if (editingTransaction) {
        await onUpdateTransaction(editingTransaction.rawId, payload);
      } else {
        await onCreateTransaction(payload);
      }
      setEditingTransaction(null);
      setMerchant("");
      setAmount("");
      setPaymentAccount("Cash");
      setTransactionDate(getDateInputValue());
      setMessage(editingTransaction ? "Transaksi berhasil diperbarui." : "Transaksi berhasil disimpan ke database.");
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

  const isCurrentMonth = isSameMonth(selectedMonth, new Date());

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="min-w-0 overflow-hidden rounded-xl border border-white/70 bg-white/86 p-3 shadow-soft backdrop-blur sm:p-4">
        {/* Month picker */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <button type="button" onClick={prevMonth} className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-slate-500 transition hover:bg-slate-200">
              <ChevronLeft size={18} />
            </button>
            <button type="button" onClick={goToCurrentMonth} className="flex items-center gap-2 rounded-lg bg-slate-50 px-4 py-2 text-sm font-black text-taka-ink transition hover:bg-slate-100">
              <CalendarDays size={15} className="text-emerald-600" />
              {getFullMonthLabel(selectedMonth)}
            </button>
            <button type="button" onClick={nextMonth} className="grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-slate-500 transition hover:bg-slate-200">
              <ChevronRight size={18} />
            </button>
            {!isCurrentMonth && (
              <button type="button" onClick={goToCurrentMonth} className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 transition hover:bg-emerald-100">
                Hari ini
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => void onRefresh()}
            className="shrink-0 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-black text-emerald-700 transition hover:bg-emerald-100"
          >
            Refresh
          </button>
        </div>

        {/* Monthly summary */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-emerald-50 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-emerald-600">Income</p>
            <p className="mt-1 text-sm font-black text-emerald-700">{currency.format(monthIncome)}</p>
          </div>
          <div className="rounded-lg bg-rose-50 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-rose-500">Expense</p>
            <p className="mt-1 text-sm font-black text-rose-600">{currency.format(monthExpense)}</p>
          </div>
          <div className="rounded-lg bg-violet-50 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-violet-500">Balance</p>
            <p className={clsx("mt-1 text-sm font-black", monthIncome - monthExpense >= 0 ? "text-violet-700" : "text-rose-600")}>
              {currency.format(monthIncome - monthExpense)}
            </p>
          </div>
        </div>

        {/* Type filter */}
        <div className="no-scrollbar mt-3 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
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
        </div>

        {/* Transaction count */}
        <p className="mt-3 text-xs font-bold text-slate-400">{filteredTransactions.length} transaksi</p>

        {/* Transaction list */}
        <div className="mt-2 space-y-2">
          {filteredTransactions.map((item) => (
            <TransactionRow key={item.id} item={item} onEdit={startEditTransaction} onDelete={onDeleteTransaction} />
          ))}
          {filteredTransactions.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-400">
              {dataStatus === "loading" ? "Memuat transaksi dari database..." : "Belum ada transaksi untuk periode ini."}
            </div>
          )}
        </div>
      </section>

      <section className="min-w-0 rounded-xl border border-white/70 bg-white/86 p-3 shadow-soft backdrop-blur sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <SectionTitle title={editingTransaction ? "Edit Transaksi" : "Tambah Manual"} eyebrow={editingTransaction ? "ubah data" : "data real DB"} />
          {editingTransaction && (
            <button type="button" onClick={cancelEditTransaction} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-200">
              Batal
            </button>
          )}
        </div>
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
          <label className="block">
            <span className="text-xs font-black uppercase tracking-[0.1em] text-slate-400">Akun / Dompet Pembayaran</span>
            <select
              value={paymentAccount}
              onChange={(event) => setPaymentAccount(event.target.value)}
              className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-taka-ink outline-none transition focus:border-emerald-300 focus:bg-white"
            >
              {paymentAccountOptions.map((account) => (
                <option key={account} value={account}>{account}</option>
              ))}
            </select>
          </label>
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
            {isSavingTransaction ? "Menyimpan..." : editingTransaction ? "Update Transaksi" : "Simpan Transaksi"}
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
  sessionReady,
  onCreateTransaction,
  onNavigate,
}: {
  categories: Category[];
  sessionReady: boolean;
  onCreateTransaction: (input: TransactionInput) => Promise<Transaction>;
  onNavigate: (view: ViewKey) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const receiptObjectUrlRef = useRef<string | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const [cameraStatus, setCameraStatus] = useState<"idle" | "starting" | "active" | "error">("idle");
  const [cameraMessage, setCameraMessage] = useState("Tap Buka Kamera, lalu arahkan struk ke area scan.");
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<"empty" | "ready" | "scanning" | "done">("empty");
  const [scannedReceipt, setScannedReceipt] = useState<ScannedReceipt | null>(null);
  const [isSavingReceipt, setIsSavingReceipt] = useState(false);
  const [scanType, setScanType] = useState<"expense" | "income">("expense");
  const [selectedScanCategoryId, setSelectedScanCategoryId] = useState("");
  const [scanPaymentAccount, setScanPaymentAccount] = useState("Cash");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const hasReceiptPreview = Boolean(receiptPreviewUrl);
  const hasScannedReceipt = scanStatus === "done";
  const receiptItems = scannedReceipt?.items ?? [];
  const subtotal = scannedReceipt?.subtotal ?? 0;
  const discount = scannedReceipt?.discount ?? 0;
  const total = scannedReceipt?.total ?? 0;
  const confidence = scannedReceipt?.confidence ?? 0;
  const availableScanCategories = categories.filter((category) => category.type === scanType || category.type === "both");
  const categorySuggestion = suggestReceiptCategory(scannedReceipt, categories, scanType);
  const selectedScanCategory = availableScanCategories.find((category) => String(category.id) === selectedScanCategoryId) ?? categorySuggestion.category;

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
    setSelectedScanCategoryId("");
    setScanPaymentAccount("Cash");
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

      // Preprocess image: convert to high-contrast grayscale for better OCR
      const preprocessed = await new Promise<string>((resolve) => {
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const cvs = document.createElement("canvas");
          const ctx = cvs.getContext("2d");
          if (!ctx) { resolve(imageUrl); return; }

          cvs.width = img.naturalWidth;
          cvs.height = img.naturalHeight;
          ctx.drawImage(img, 0, 0);

          // Convert to grayscale and increase contrast
          const imageData = ctx.getImageData(0, 0, cvs.width, cvs.height);
          const d = imageData.data;
          for (let i = 0; i < d.length; i += 4) {
            // Grayscale
            const gray = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
            // Increase contrast
            const contrast = ((gray - 128) * 1.5) + 128;
            const clamped = Math.max(0, Math.min(255, contrast));
            // Threshold for cleaner text (adaptive binarization)
            const binaryValue = clamped > 140 ? 255 : 0;
            d[i] = binaryValue;
            d[i + 1] = binaryValue;
            d[i + 2] = binaryValue;
          }
          ctx.putImageData(imageData, 0, 0);
          resolve(cvs.toDataURL("image/png"));
        };
        img.onerror = () => resolve(imageUrl);
        img.src = imageUrl;
      });

      setCameraMessage("OCR sedang membaca teks...");

      const result = await recognize(preprocessed, "eng", {
        logger: (progress) => {
          if (progress.status === "recognizing text") {
            setCameraMessage(`OCR membaca teks... ${Math.round(progress.progress * 100)}%`);
          }
        },
      });

      const rawText = result.data.text;

      let parsedReceipt: ScannedReceipt | null = null;
      let usedAi = false;

      setCameraMessage("Memproses teks dengan Taka AI...");
      try {
        const aiResponse = await fetch("/api/scan-ai", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ rawText, imageData: preprocessed }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          if (aiData.is_transaction) {
            const itemsData = Array.isArray(aiData.items) ? aiData.items.map((item: any) => ({
              name: item.name || "Item",
              qty: Number(item.quantity) || 1,
              price: Number(item.unit_price) || 0,
            })).filter((item: any) => item.price > 0) : [];

            let finalTotal = Number(aiData.grand_total);
            if (!Number.isFinite(finalTotal) || finalTotal <= 0) {
               finalTotal = itemsData.reduce((sum: number, item: any) => sum + (item.qty * item.price), 0);
            }

            parsedReceipt = {
              merchant: aiData.merchant || "Struk Belanja",
              date: aiData.transaction_date ? `${aiData.transaction_date} ${aiData.transaction_time || ""}`.trim() : "Tanggal tidak terbaca",
              payment: aiData.payment_method || "Tunai",
              paymentAccount: normalizePaymentAccount(aiData.payment_account || aiData.payment_method),
              subtotal: aiData.subtotal || 0,
              discount: aiData.discount || 0,
              total: finalTotal,
              confidence: aiData.confidence || 95,
              source: "ai",
              categorySuggestion: aiData.category_suggestion || null,
              items: itemsData,
            };
            usedAi = true;
          } else {
             // AI successfully responded but determined it's not a transaction
             console.log("AI deteksi bukan struk.");
          }
        } else {
          console.error("AI API Error:", await aiResponse.text());
        }
      } catch (aiError) {
        console.error("AI Processing Error:", aiError);
      }

      // Fallback to local regex if AI failed, errored, or no API key
      if (!parsedReceipt) {
        console.log("Fallback to local Regex parser...");
        parsedReceipt = parseReceiptText(rawText);
      }

      setScannedReceipt(parsedReceipt);
      setScanPaymentAccount(normalizePaymentAccount(parsedReceipt.paymentAccount || parsedReceipt.payment));
      const suggestedCategory = suggestReceiptCategory(parsedReceipt, categories, scanType).category;
      setSelectedScanCategoryId(suggestedCategory ? String(suggestedCategory.id) : "");
      setScanStatus("done");

      if (parsedReceipt.source === "ocr" || parsedReceipt.source === "ai") {
        const itemCount = parsedReceipt.items.length;
        setCameraMessage(
          `Scan selesai! ${itemCount} item terdeteksi, total ${currency.format(parsedReceipt.total)}. Confidence: ${parsedReceipt.confidence}%`
        );
      } else {
        setCameraMessage("Gagal menganalisa struk. Pastikan .env.local memiliki GEMINI_API_KEY untuk fitur AI.");
      }
    } catch (err) {
      console.error("OCR Error:", err);
      setScannedReceipt(indomaretExampleReceipt);
      const suggestedCategory = suggestReceiptCategory(indomaretExampleReceipt, categories, scanType).category;
      setSelectedScanCategoryId(suggestedCategory ? String(suggestedCategory.id) : "");
      setScanStatus("done");
      setCameraMessage("OCR gagal dimuat. Dipakai hasil demo dari contoh struk Indomaret.");
    }
  }, [categories, scanType]);

  function stopCamera() {
    clearCameraStream();
    setCameraStatus("idle");
    setCameraMessage("Kamera dimatikan. Tap Buka Kamera untuk scan lagi.");
  }

  function clearReceiptScan() {
    clearCameraStream();
    releaseReceiptPreview();
    setReceiptPreviewUrl(null);
    setScannedReceipt(null);
    setSelectedScanCategoryId("");
    setScanPaymentAccount("Cash");
    setScanStatus("empty");
    setCameraStatus("idle");
    if (scanTimerRef.current) {
      window.clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    setCameraMessage("Gambar dihapus. Ambil atau upload struk baru.");
  }

  async function startCamera() {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      cameraInputRef.current?.click();
      setCameraStatus("idle");
      setCameraMessage("Browser ini tidak mengizinkan kamera live di HTTP/in-app browser. Pakai kamera bawaan HP untuk ambil foto struk.");
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

  function handleReceiptUpload(event: ChangeEvent<HTMLInputElement>, source: "camera" | "upload" = "upload") {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    clearCameraStream();
    replaceReceiptPreview(URL.createObjectURL(file), true);
    setCameraStatus("idle");
    setCameraMessage(source === "camera" ? "Foto struk dari kamera tersimpan. Scan otomatis berjalan..." : "Foto struk diupload. Scan otomatis berjalan...");
  }

  function openUploadPicker() {
    if (scanStatus !== "scanning") uploadInputRef.current?.click();
  }

  async function saveScannedReceipt() {
    if (!scannedReceipt) return;

    const selectedCategory = selectedScanCategory;

    if (!selectedCategory) {
      setCameraMessage(`Belum ada kategori ${scanType}. Tambah kategori dulu di menu Transaksi.`);
      return;
    }

    setIsSavingReceipt(true);

    try {
      await onCreateTransaction({
        merchant: scannedReceipt.merchant,
        amount: scannedReceipt.total,
        type: scanType,
        categoryId: selectedCategory.id,
        transactionDate: getDateInputValue(),
        source: "Scan",
        paymentAccount: scanPaymentAccount,
      });
      setShowSuccessModal(true);
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
    <div className="relative grid gap-4 xl:grid-cols-[minmax(0,1fr)_460px]">
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
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(event) => handleReceiptUpload(event, "camera")}
                disabled={scanStatus === "scanning"}
              />
              <input
                ref={uploadInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => handleReceiptUpload(event, "upload")}
                disabled={scanStatus === "scanning"}
              />
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
              {receiptPreviewUrl && (
                <button
                  type="button"
                  onClick={clearReceiptScan}
                  disabled={scanStatus === "scanning"}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-rose-500 px-4 py-3 text-sm font-black text-white shadow-[0_8px_24px_rgba(225,29,72,0.3)] transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <X size={18} strokeWidth={3} />
                  Hapus Gambar
                </button>
              )}
              <button
                type="button"
                onClick={openUploadPicker}
                disabled={scanStatus === "scanning"}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-3 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-55"
              >
                <FileText size={18} />
                Upload Galeri
              </button>
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
        
        {hasScannedReceipt && (
          <div className="mt-4">
            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.1em] text-slate-400">Jenis Transaksi</span>
              <select
                value={scanType}
                onChange={(e) => {
                  const nextType = e.target.value as "expense" | "income";
                  setScanType(nextType);
                  const suggestedCategory = suggestReceiptCategory(scannedReceipt, categories, nextType).category;
                  setSelectedScanCategoryId(suggestedCategory ? String(suggestedCategory.id) : "");
                }}
                className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-taka-ink outline-none"
              >
                <option value="expense">Pengeluaran (Expense)</option>
                <option value="income">Pemasukan (Income)</option>
              </select>
            </label>
            <label className="mt-3 block">
              <span className="text-xs font-black uppercase tracking-[0.1em] text-slate-400">Kategori</span>
              <select
                value={selectedScanCategory ? String(selectedScanCategory.id) : ""}
                onChange={(e) => setSelectedScanCategoryId(e.target.value)}
                className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-taka-ink outline-none"
              >
                <option value="">Pilih kategori</option>
                {availableScanCategories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </label>
            <label className="mt-3 block">
              <span className="text-xs font-black uppercase tracking-[0.1em] text-slate-400">Akun / Dompet Pembayaran</span>
              <select
                value={scanPaymentAccount}
                onChange={(e) => setScanPaymentAccount(e.target.value)}
                className="mt-2 h-12 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-taka-ink outline-none"
              >
                {paymentAccountOptions.map((account) => (
                  <option key={account} value={account}>{account}</option>
                ))}
              </select>
            </label>
            <p className="mt-2 rounded-lg bg-sky-50 px-3 py-2 text-xs font-bold leading-5 text-sky-700">
              AI membaca pembayaran: {scannedReceipt?.payment || "tidak terbaca"}. Dompet tersimpan: {scanPaymentAccount}.
            </p>
            {selectedScanCategory && (
              <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold leading-5 text-emerald-700">
                Disarankan: {selectedScanCategory.name}. {categorySuggestion.reason}
              </p>
            )}
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

      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-xs rounded-2xl bg-white p-5 shadow-[0_8px_32px_rgba(0,0,0,0.18)] text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50">
              <Check size={22} className="text-emerald-500" />
            </div>
            <p className="mt-3 text-base font-black text-taka-ink">Berhasil Disimpan!</p>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Transaksi hasil scan berhasil ditambahkan.
            </p>
            <button
              type="button"
              onClick={() => {
                setShowSuccessModal(false);
                onNavigate("transactions");
              }}
              className="mt-4 w-full rounded-xl bg-emerald-500 py-2.5 text-sm font-black text-white transition hover:bg-emerald-600"
            >
              Lanjut ke Transaksi
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const defaultChatMessages: ChatMessage[] = [
  {
    role: "assistant",
    text: "Halo! Saya Taka AI, asisten keuangan pribadi kamu. Ada yang bisa saya bantu?",
  },
];

function ChatView({ transactions, sessionReady }: { transactions: Transaction[]; sessionReady: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>(defaultChatMessages);
  const [draft, setDraft] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [typingPreview, setTypingPreview] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isInitialized = useRef(false);
  const typingTimerRef = useRef<number | null>(null);

  // Load from localStorage on mount (client-side only)
  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;
    try {
      const stored = window.localStorage.getItem(chatHistoryStorageKey);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const safeMessages = parsed
            .filter((message): message is ChatMessage => {
              if (!message || typeof message !== "object") return false;
              const candidate = message as Partial<ChatMessage>;
              return (candidate.role === "user" || candidate.role === "assistant") && typeof candidate.text === "string";
            })
            .slice(-30);

          setMessages(safeMessages.length > 0 ? safeMessages : defaultChatMessages);
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
  }, [messages, isTyping, typingPreview]);

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) {
        window.clearInterval(typingTimerRef.current);
      }
    };
  }, []);

  function revealAssistantMessage(fullText: string) {
    if (typingTimerRef.current) {
      window.clearInterval(typingTimerRef.current);
    }

    const safeText = fullText.trim() || "Maaf, Taka AI belum mendapatkan jawaban. Coba tanya ulang ya.";
    const step = Math.max(1, Math.ceil(safeText.length / 120));
    let index = 0;
    setTypingPreview("");
    setIsTyping(true);

    typingTimerRef.current = window.setInterval(() => {
      index = Math.min(index + step, safeText.length);
      setTypingPreview(safeText.slice(0, index));

      if (index >= safeText.length) {
        if (typingTimerRef.current) {
          window.clearInterval(typingTimerRef.current);
          typingTimerRef.current = null;
        }
        setMessages((current) => [...current, { role: "assistant", text: safeText }]);
        setTypingPreview("");
        setIsTyping(false);
      }
    }, 18);
  }

  function clearChat() {
    setMessages(defaultChatMessages);
    try { window.localStorage.removeItem(chatHistoryStorageKey); } catch { /* noop */ }
    setConfirmClear(false);
  }

  async function sendMessage(text: string) {
    if (isTyping) return;
    
    const trimmed = text.trim();
    if (!trimmed) return;

    // Add user message immediately
    const userMessage = { role: "user" as const, text: trimmed };
    setMessages((current) => [...current, userMessage]);
    setDraft("");
    setIsTyping(true);

    try {
      const formattedTransactions = transactions.map(t => 
        `- ${new Date(t.transactionDate || t.createdAt).toLocaleDateString("id-ID")} | ${t.type === 'expense' ? 'Pengeluaran' : 'Pemasukan'} | ${t.category} | ${t.merchant} | Rp${t.amount}`
      ).join('\n');
      
      const currentDate = new Date().toLocaleDateString("id-ID", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      
      const systemPrompt = {
        role: "system",
        content: `Anda adalah Taka AI, asisten keuangan pribadi. Hari ini adalah ${currentDate}. Berikut adalah data transaksi riil pengguna (total ${transactions.length} transaksi):\n\n${formattedTransactions || 'Belum ada transaksi.'}\n\nGunakan data di atas untuk menjawab pertanyaan pengguna dengan akurat, singkat, dan tuntas. Format rupiah harus rapi, contoh: Rp35.000. Jangan pernah mengakhiri jawaban dengan angka yang terpotong seperti Rp45.. atau kalimat menggantung. Jika membuat rincian, gunakan baris pendek agar mudah dibaca di layar HP.`
      };

      // Create chat history for API (last 5 messages)
      const chatHistory = [systemPrompt, ...[...messages, userMessage].slice(-5).map(m => ({
        role: m.role,
        content: m.text
      }))];

      const response = await fetch('/api/chat', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: chatHistory
        })
      });

      if (!response.ok) {
        throw new Error("Failed to fetch AI response");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = "";
      let streamBuffer = "";
      
      if (reader) {
        let done = false;
        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            streamBuffer += decoder.decode(value, { stream: true });
            const lines = streamBuffer.split('\n');
            streamBuffer = lines.pop() ?? "";

            for (const line of lines) {
              const trimmedLine = line.trim();
              if (!trimmedLine.startsWith('data: ') || trimmedLine === 'data: [DONE]') continue;
              try {
                const data = JSON.parse(trimmedLine.substring(6));
                const content = data.choices?.[0]?.delta?.content;
                if (content) {
                  accumulatedText += content;
                }
              } catch (e) {
                console.error("Error parsing stream chunk", e);
              }
            }
          }
        }
      } else {
        const data = await response.json();
        accumulatedText = data.choices?.[0]?.message?.content ?? "";
      }

      setIsTyping(false);
      revealAssistantMessage(accumulatedText);
    } catch (error) {
      console.error("AI Chat Error:", error);
      setIsTyping(false);
      revealAssistantMessage("Maaf, sistem Taka AI sedang mengalami gangguan koneksi.");
    }
  }

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[330px_minmax(0,1fr)]">
      {/* Desktop sidebar — hidden on mobile */}
      <section className="hidden rounded-xl border border-white/70 bg-white/86 p-4 shadow-soft backdrop-blur xl:block">
        <SectionTitle title="Taka AI" eyebrow="Financial assistant" />
        <div className="mt-4 space-y-2">
          {suggestedQuestions.map((question) => (
            <button
              key={question}
              type="button"
              disabled={isTyping}
              onClick={() => sendMessage(question)}
              className="w-full rounded-lg bg-slate-50 px-3 py-3 text-left text-sm font-bold leading-5 text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* Chat area — fills viewport on mobile, fixed height on desktop */}
      <section className="relative flex h-[calc(100svh-190px)] min-h-[430px] min-w-0 max-w-full flex-col overflow-hidden rounded-xl border border-white/70 bg-white/86 p-4 shadow-soft backdrop-blur xl:h-[620px] xl:min-h-0">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-taka-navy text-white xl:h-11 xl:w-11">
              <Bot size={20} />
            </div>
            <div>
              <p className="text-sm font-black text-taka-ink xl:text-base">Sesi Mei 2026</p>
              <p className="text-[11px] font-bold text-emerald-600 xl:text-xs">Streaming ready</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            title="Hapus riwayat chat"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500 xl:h-10 xl:w-10"
          >
            <Trash2 size={16} />
          </button>
        </div>

        {/* Mobile inline suggested questions — horizontal scroll pills */}
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-3 xl:hidden">
          {suggestedQuestions.map((question) => (
            <button
              key={question}
              type="button"
              disabled={isTyping}
              onClick={() => sendMessage(question)}
              className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-700 transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {question}
            </button>
          ))}
        </div>

        <div ref={scrollRef} className="no-scrollbar flex-1 space-y-3 overflow-y-auto py-3 scroll-smooth xl:py-4">
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
                {(() => {
                  const parts = message.text.split(/(\*\*.*?\*\*)/g);
                  return (
                    <>
                      {parts.map((part, i) => {
                        if (part.startsWith('**') && part.endsWith('**')) {
                          return <strong key={i} className="font-black text-slate-900">{part.slice(2, -2)}</strong>;
                        }
                        return (
                          <span key={i}>
                            {part.split('\n').map((line, j, arr) => [
                              line,
                              j < arr.length - 1 ? <br key={`br-${j}`} /> : null
                            ])}
                          </span>
                        );
                      })}
                    </>
                  );
                })()}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="max-w-[86%] rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold leading-6 text-slate-700">
                {typingPreview ? (
                  <span>
                    {typingPreview.split('\n').map((line, j, arr) => [
                      line,
                      j < arr.length - 1 ? <br key={`typing-br-${j}`} /> : null,
                    ])}
                    <span className="ml-0.5 inline-block h-4 w-1 animate-pulse rounded-full bg-slate-400 align-[-2px]" />
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 py-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "0ms" }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "150ms" }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "300ms" }} />
                  </span>
                )}
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
          className="flex gap-2 border-t border-slate-100 pt-3 xl:pt-4"
          onSubmit={(event) => {
            event.preventDefault();
            sendMessage(draft);
          }}
        >
          <input
            value={draft}
            disabled={isTyping}
            onChange={(event) => setDraft(event.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold outline-none transition focus:border-emerald-300 focus:bg-white disabled:opacity-50 disabled:cursor-not-allowed xl:py-3"
            placeholder="Tanya kondisi keuanganmu"
          />
          <button 
            type="submit" 
            disabled={isTyping || !draft.trim()} 
            className="rounded-lg bg-taka-navy px-4 py-2.5 text-sm font-black text-white transition disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-800 xl:py-3"
          >
            Kirim
          </button>
        </form>
      </section>
    </div>
  );
}


function escapeCsvCell(value: string | number) {
  const text = String(value).replace(/"/g, '""');
  return `"${text}"`;
}

function ReportsView({ analytics, transactions }: { analytics: ReturnType<typeof getFinanceAnalytics>; transactions: Transaction[] }) {
  const totalExpense = analytics.categoryBreakdown.reduce((total, item) => total + item.amount, 0);

  function exportExcel() {
    const rows = [
      ["Tanggal", "Tipe", "Kategori", "Merchant", "Nominal", "Sumber"],
      ...transactions.map((transaction) => [
        transaction.transactionDate ?? transaction.createdAt,
        transaction.type === "income" ? "Pemasukan" : "Pengeluaran",
        transaction.category,
        transaction.merchant,
        transaction.amount,
        transaction.source,
      ]),
    ];
    const csvContent = rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
    const blob = new Blob([`\uFEFF${csvContent}`], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `taka-fintrack-laporan-${getDateInputValue()}.xls`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-white/70 bg-white/86 p-4 shadow-soft backdrop-blur">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.24em] text-taka-emerald">Export laporan</p>
            <h3 className="mt-1 text-xl font-black text-taka-ink">Download data transaksi</h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">Export semua transaksi ke file Excel untuk rekap atau arsip.</p>
          </div>
          <button
            type="button"
            onClick={exportExcel}
            disabled={transactions.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-taka-navy px-4 py-3 text-sm font-black text-white shadow-soft transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:hover:translate-y-0"
          >
            <FileDown size={18} />
            Export Excel
          </button>
        </div>
      </section>
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
        className={clsx(
          "mt-2 h-12 w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-taka-ink outline-none transition placeholder:text-slate-400 focus:border-emerald-300 focus:bg-white",
          type === "date" && "appearance-none overflow-hidden text-center [color-scheme:light] [&::-webkit-date-and-time-value]:m-0 [&::-webkit-date-and-time-value]:min-h-0 [&::-webkit-date-and-time-value]:text-center [&::-webkit-calendar-picker-indicator]:opacity-60",
        )}
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

// Pure helpers, constants, and types extracted from taka-fintrack-app.tsx.

export type ViewKey = "dashboard" | "transactions" | "scan" | "chat" | "profile";
export type AuthMode = "login" | "register" | "forgot";

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  avatarUrl?: string | null;
};

export type AuthSession = {
  user: AuthUser;
  token?: string;
  authenticated?: boolean;
};

export type Transaction = {
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
  receiptSplitMode?: ReceiptSplitMode;
  receiptTotalAmount?: number | null;
  receiptSelectedAmount?: number | null;
  receiptItems?: ReceiptItem[];
  receiptSelectedItems?: SelectedReceiptItem[];
  receiptAdjustmentAmount?: number | null;
  receiptAdjustmentNote?: string | null;
};

export type MonthlyStatement = {
  id: number;
  periodYear: number;
  periodMonth: number;
  fileName: string;
  totalIncome: number;
  totalExpense: number;
  netCashflow: number;
  openingBalance: number;
  closingBalance: number;
  emailedAt: string | null;
  createdAt: string;
  downloadUrl: string;
};

export type TransactionsPagination = {
  page: number;
  limit: number;
  hasMore: boolean;
  nextPage: number | null;
};

export type ApiTransaction = {
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
  receiptSplitMode?: ReceiptSplitMode;
  receiptTotalAmount?: number | null;
  receiptSelectedAmount?: number | null;
  receiptItems?: ReceiptItem[];
  receiptSelectedItems?: SelectedReceiptItem[];
  receiptAdjustmentAmount?: number | null;
  receiptAdjustmentNote?: string | null;
};

export type CategoryType = "income" | "expense" | "both";

export type Category = {
  id: number;
  name: string;
  type: CategoryType;
  color: string;
  transactionCount: number;
};

export type TransactionInput = {
  merchant: string;
  amount: number;
  type: "income" | "expense";
  categoryId?: number;
  category?: string;
  transactionDate?: string;
  source?: "Manual" | "Scan";
  paymentAccount?: string;
  receiptSplitMode?: ReceiptSplitMode;
  receiptTotalAmount?: number | null;
  receiptSelectedAmount?: number | null;
  receiptItems?: ReceiptItem[];
  receiptSelectedItems?: SelectedReceiptItem[];
  receiptAdjustmentAmount?: number | null;
  receiptAdjustmentNote?: string | null;
};

export type CategoryInput = {
  name: string;
  type: CategoryType;
  color: string;
};

export type ChatMessage = {
  role: "user" | "assistant";
  text: string;
};

export type ReceiptItem = {
  id?: string;
  name: string;
  qty: number;
  price: number;
  lineTotal?: number;
};

export type SelectedReceiptItem = {
  key: string;
  name: string;
  originalQty: number;
  selectedQty: number;
  unitPrice: number;
  selectedAmount: number;
};

export type ReceiptSplitMode = "full_receipt" | "selected_items";
export type ReceiptAdjustmentMode = "none" | "proportional";

export type ScannedReceipt = {
  merchant: string;
  date: string;
  transactionDate?: string | null;
  payment: string;
  subtotal: number;
  discount: number;
  tax?: number | null;
  service?: number | null;
  total: number;
  confidence: number;
  items: ReceiptItem[];
  source: "ocr" | "demo" | "ai";
  categorySuggestion?: string | null;
  paymentAccount?: string | null;
};

export type CategorySuggestion = {
  category: Category | null;
  reason: string;
};

export const currency = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export type ThemeMode = "light" | "dark";

export const viewStorageKey = "taka-fintrack.active-view";
export const themeStorageKey = "taka-fintrack.theme";
export const chatHistoryStorageKey = "taka-fintrack.chat-history";
export const forgotPasswordCooldownStorageKey = "taka-fintrack.forgot-password-cooldown-until";
export const forgotPasswordCooldownSeconds = 60;

export const paymentAccountOptions = [
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

export function normalizePaymentAccount(value: string | null | undefined) {
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

export function formatCooldown(seconds: number) {
  return `${Math.max(0, seconds)} detik`;
}

export function normalizeApiTransaction(transaction: ApiTransaction): Transaction {
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
    receiptSplitMode: transaction.receiptSplitMode ?? "full_receipt",
    receiptTotalAmount: transaction.receiptTotalAmount ?? null,
    receiptSelectedAmount: transaction.receiptSelectedAmount ?? null,
    receiptItems: transaction.receiptItems ?? [],
    receiptSelectedItems: transaction.receiptSelectedItems ?? [],
    receiptAdjustmentAmount: transaction.receiptAdjustmentAmount ?? null,
    receiptAdjustmentNote: transaction.receiptAdjustmentNote ?? null,
  };
}

export function getTransactionDate(transaction: Pick<Transaction, "transactionDate" | "createdAt">) {
  return new Date(transaction.transactionDate ?? transaction.createdAt);
}

export function formatTransactionDate(value: string | null) {
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

export function isSameDay(firstDate: Date, secondDate: Date) {
  return (
    firstDate.getFullYear() === secondDate.getFullYear() &&
    firstDate.getMonth() === secondDate.getMonth() &&
    firstDate.getDate() === secondDate.getDate()
  );
}

export function isSameMonth(date: Date, referenceDate = new Date()) {
  return date.getFullYear() === referenceDate.getFullYear() && date.getMonth() === referenceDate.getMonth();
}

export function getDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("id-ID", { month: "short" }).format(date);
}

export function getDayLabel(date: Date) {
  return new Intl.DateTimeFormat("id-ID", { weekday: "short" }).format(date);
}

export function getFullMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(date);
}

export function getShortDateLabel(date: Date) {
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short" }).format(date);
}

export function getStartOfWeekMonday(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  start.setDate(start.getDate() - daysSinceMonday);

  return start;
}

export function getSoftColor(color: string) {
  if (/^#[0-9A-Fa-f]{6}$/.test(color)) return `${color}1A`;

  return "#F1F5F9";
}

export function getFinanceAnalytics(transactions: Transaction[]) {
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
  const weekStart = getStartOfWeekMonday(now);
  const weekly = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);

    const dayTransactions = transactions.filter((transaction) => isSameDay(getTransactionDate(transaction), date));
    const incomeAmount = dayTransactions.filter((item) => item.type === "income").reduce((total, item) => total + item.amount, 0);
    const expenseAmount = dayTransactions.filter((item) => item.type === "expense").reduce((total, item) => total + item.amount, 0);

    return {
      day: getDayLabel(date),
      dateLabel: getShortDateLabel(date),
      income: Math.round(incomeAmount / 1000),
      expense: Math.round(expenseAmount / 1000),
      incomeAmount,
      expenseAmount,
      netAmount: incomeAmount - expenseAmount,
    };
  });
  const weeklyTotals = weekly.reduce(
    (totals, item) => ({
      income: totals.income + item.incomeAmount,
      expense: totals.expense + item.expenseAmount,
      net: totals.net + item.netAmount,
    }),
    { income: 0, expense: 0, net: 0 },
  );
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
    weeklyTotals,
    categoryBreakdown,
    trend,
  };
}

export function createNameFromEmail(email: string) {
  const localPart = email.split("@")[0] ?? "";
  const name = localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");

  return name || "User Taka";
}

export function getInitials(name: string) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return initials || "TF";
}

export function getReceiptItemKey(item: ReceiptItem, index: number) {
  return item.id || `${index}-${item.name}-${item.qty}-${item.price}`;
}

export function getReceiptLineTotal(item: ReceiptItem) {
  return Math.max(0, Math.round(item.lineTotal ?? item.qty * item.price));
}

export function getReceiptSplitSummary(
  receipt: ScannedReceipt | null,
  selectedItems: Record<string, SelectedReceiptItem>,
  adjustmentMode: ReceiptAdjustmentMode,
) {
  const allItemsSubtotal = receipt?.items.reduce((sum, item) => sum + getReceiptLineTotal(item), 0) ?? 0;
  const selectedSubtotal = Object.values(selectedItems).reduce((sum, item) => sum + item.selectedAmount, 0);
  const receiptTotal = Math.max(0, Math.round(receipt?.total ?? 0));
  const adjustment = receipt && allItemsSubtotal > 0 ? receiptTotal - allItemsSubtotal : 0;
  const selectedAdjustment = adjustmentMode === "proportional" && allItemsSubtotal > 0 && selectedSubtotal > 0
    ? Math.round(adjustment * (selectedSubtotal / allItemsSubtotal))
    : 0;
  const selectedTotal = selectedSubtotal > 0
    ? Math.min(Math.max(1, receiptTotal || selectedSubtotal), Math.max(1, Math.round(selectedSubtotal + selectedAdjustment)))
    : 0;

  return {
    allItemsSubtotal,
    selectedCount: Object.keys(selectedItems).length,
    selectedSubtotal,
    receiptTotal,
    adjustment,
    selectedAdjustment,
    selectedTotal,
  };
}

export const indomaretExampleReceipt: ScannedReceipt = {
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

export const suggestedQuestions = [
  "Bulan ini aku boros di mana?",
  "Berapa rata-rata pengeluaran harianku?",
  "Kategori apa yang paling banyak menguras kantong?",
  "Tips hemat berdasarkan pola belanjaku?",
];

export function parseReceiptAmount(value: string) {
  // Remove everything that is not a digit, comma, or period
  // Indonesian receipt format: 10.500 or 10,500 or 10500
  const cleaned = value.replace(/[^\d.,]/g, "");
  // If there's a period or comma followed by exactly 3 digits at the end, it's a thousands separator
  const normalized = cleaned.replace(/[.,](?=\d{3}(?:[.,]|$))/g, "");
  // Remove remaining commas/periods (decimal separators we don't need for IDR)
  return Number(normalized.replace(/[.,]/g, "")) || 0;
}

export function formatReceiptDate(rawText: string) {
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
export function isReceiptMetaLine(line: string) {
  return /^(NPWP|JL\b|JALAN|ALAMAT|TEL|TELP|FAX|NO\s*:|\*{3,}|-{3,}|={3,}|KASIR|STRUK|RECEIPT|TERIMA\s*KASIH|THANK|SELAMAT|WELCOME|MEMBER|CUSTOMER|PELANGGAN|NOTA|INVOICE|TOKO|STORE)/i.test(line);
}

/** Lines that are total/summary lines, not items */
export function isSummaryLine(line: string) {
  return /^\s*(SUB\s*TOTAL|TOTAL|GRAND\s*TOTAL|BAYAR|TUNAI|CASH|DEBIT|CREDIT|KREDIT|KEMBALIAN|KEMBALI|CHANGE|DIS[CK]|DISC|PPN|TAX|PAJAK|VOUCHER|PROMO|HARGA\s*JUAL|SAVING|HEMAT|PEMBAYARAN|PAYMENT|ROUNDING)\b/i.test(line);
}

export function extractMerchantName(lines: string[]): string {
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

export function extractPaymentMethod(text: string): string {
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

export function suggestReceiptCategory(receipt: ScannedReceipt | null, categories: Category[], type: "income" | "expense"): CategorySuggestion {
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

export function parseReceiptText(rawText: string): ScannedReceipt {
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

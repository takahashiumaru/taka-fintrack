"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, TouchEvent as ReactTouchEvent } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { authStorageKey, clearStoredAuthTokenFallback } from "@/lib/client/session-storage";
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
  Moon,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Plus,
  ReceiptText,
  RefreshCw,
  ScanLine,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
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
import {
  chatHistoryStorageKey,
  createNameFromEmail,
  currency,
  forgotPasswordCooldownSeconds,
  forgotPasswordCooldownStorageKey,
  formatCooldown,
  getDateInputValue,
  getFinanceAnalytics,
  getFullMonthLabel,
  getInitials,
  getReceiptItemKey,
  getReceiptLineTotal,
  getReceiptSplitSummary,
  getSoftColor,
  getTransactionDate,
  indomaretExampleReceipt,
  isSameMonth,
  normalizeApiTransaction,
  normalizePaymentAccount,
  parseReceiptText,
  paymentAccountOptions,
  suggestedQuestions,
  suggestReceiptCategory,
  themeStorageKey,
  viewStorageKey,
} from "./taka-fintrack-helpers";
import type {
  AuthMode,
  AuthSession,
  AuthUser,
  ApiTransaction,
  Category,
  CategoryInput,
  CategoryType,
  ChatMessage,
  MonthlyStatement,
  ReceiptAdjustmentMode,
  ReceiptSplitMode,
  ScannedReceipt,
  SelectedReceiptItem,
  ThemeMode,
  Transaction,
  TransactionInput,
  TransactionsPagination,
  ViewKey,
} from "./taka-fintrack-helpers";

function useAnimatedNumber(value: number, duration = 780) {
  const [displayValue, setDisplayValue] = useState(0);
  const previousValue = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") {
      setDisplayValue(value);
      previousValue.current = value;
      return;
    }

    const mediaQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (mediaQuery?.matches) {
      setDisplayValue(value);
      previousValue.current = value;
      return;
    }

    const startValue = previousValue.current;
    const difference = value - startValue;
    if (difference === 0) return;

    let frame = 0;
    let startTime: number | null = null;
    const easeOutCubic = (progress: number) => 1 - Math.pow(1 - progress, 3);

    const tick = (time: number) => {
      if (startTime === null) startTime = time;
      const progress = Math.min((time - startTime) / duration, 1);
      setDisplayValue(startValue + difference * easeOutCubic(progress));

      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
      } else {
        previousValue.current = value;
        setDisplayValue(value);
      }
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [duration, value]);

  return displayValue;
}

function AnimatedCurrency({ value, className }: { value: number; className?: string }) {
  const animatedValue = useAnimatedNumber(value);
  return <span className={className}>{currency.format(Math.round(animatedValue))}</span>;
}

function AnimatedPercent({ value, className }: { value: number; className?: string }) {
  const animatedValue = useAnimatedNumber(value, 620);
  return <span className={className}>{Math.round(animatedValue)}%</span>;
}

const navItems: Array<{ key: ViewKey; label: string; icon: LucideIcon }> = [
  { key: "dashboard", label: "Home", icon: Home },
  { key: "transactions", label: "Transaksi", icon: ReceiptText },
  { key: "scan", label: "Scan", icon: Camera },
  { key: "chat", label: "AI Chat", icon: MessageCircle },
  { key: "reports", label: "Laporan", icon: ChartNoAxesColumnIncreasing },
];

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

function getInitialTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";

  try {
    const savedTheme = window.localStorage.getItem(themeStorageKey);
    if (savedTheme === "light" || savedTheme === "dark") return savedTheme;
    if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) return "dark";
  } catch {
    return "light";
  }

  return "light";
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

const summaryCards = [
  {
    label: "Pemasukan",
    value: 8450000,
    delta: "+12,4%",
    icon: ArrowUpRight,
    tone: "text-blue-600",
    bg: "bg-blue-50",
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
    tone: "text-blue-600",
    bg: "bg-blue-50",
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



export function TakaFinTrackApp() {
  const [activeView, setActiveView] = useState<ViewKey>(getInitialView);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);
  const [sessionReady, setSessionReady] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [statements, setStatements] = useState<MonthlyStatement[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [dataStatus, setDataStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [dataError, setDataError] = useState("");
  const [transactionsPagination, setTransactionsPagination] = useState<TransactionsPagination>({ page: 1, limit: 20, hasMore: false, nextPage: null });
  const [isLoadingMoreTransactions, setIsLoadingMoreTransactions] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);
  const contentScrollerRef = useRef<HTMLDivElement>(null);
  const pullStartYRef = useRef<number | null>(null);
  const isPullingRef = useRef(false);
  const activeMeta = navItems.find((item) => item.key === activeView) ?? navItems[0];
  const analytics = useMemo(() => getFinanceAnalytics(transactions), [transactions]);
  const changeView = useCallback((view: ViewKey) => {
    setActiveView(view);
  }, []);
  const toggleTheme = useCallback(() => {
    setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"));
  }, []);
  const handleAuthenticated = useCallback((session: AuthSession) => {
    clearStoredAuthTokenFallback();

    try {
      window.localStorage.setItem(authStorageKey, JSON.stringify(session.user));
    } catch {
      // Ignore private browsing/storage restrictions.
    }

    setCurrentUser(session.user);
    setSessionReady(true);
    setShowSplash(true);
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
  const clearClientSession = useCallback(() => {
    try {
      window.localStorage.removeItem(authStorageKey);
    } catch {
      // Ignore private browsing/storage restrictions.
    }

    clearStoredAuthTokenFallback();
  }, []);

  const handleLogout = useCallback(async () => {
    setIsAuthChecking(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        keepalive: true,
      });
    } catch {
      // Even if the network fails, clear client state so the user is not kept in the app UI.
    } finally {
      clearClientSession();
      setCurrentUser(null);
      setSessionReady(false);
      setTransactions([]);
      setCategories([]);
      setDataStatus("idle");
      setIsAuthChecking(false);
    }
  }, [clearClientSession]);
  const refreshFinanceData = useCallback(async () => {
    if (!sessionReady) return;

    setDataStatus("loading");
    setDataError("");

    try {
      const [transactionResponse, categoryResponse, statementResponse] = await Promise.all([
        apiRequest<{ transactions: ApiTransaction[]; pagination?: TransactionsPagination }>("/api/transactions?page=1&limit=20"),
        apiRequest<{ categories: Category[] }>("/api/categories"),
        apiRequest<{ statements: MonthlyStatement[] }>("/api/statements"),
      ]);

      setTransactions(transactionResponse.transactions.map(normalizeApiTransaction));
      setTransactionsPagination(transactionResponse.pagination ?? { page: 1, limit: 20, hasMore: false, nextPage: null });
      setCategories(categoryResponse.categories);
      setStatements(statementResponse.statements);
      setDataStatus("ready");
    } catch (error) {
      setDataStatus("error");
      setDataError(error instanceof Error ? error.message : "Data gagal dimuat.");
    }
  }, [sessionReady]);

  const canUsePullToRefresh = sessionReady && !isAuthChecking && !showSplash && dataStatus !== "loading";
  const pullRefreshThreshold = 56;
  const pullProgress = Math.min(1, pullDistance / pullRefreshThreshold);
  const pullLabel = isPullRefreshing ? "Memuat ulang data..." : pullDistance > pullRefreshThreshold ? "Lepas untuk refresh" : "Tarik untuk refresh";

  const handlePullStart = useCallback((event: ReactTouchEvent<HTMLElement>) => {
    const chatScroller = activeView === "chat" ? document.querySelector<HTMLElement>(".chat-messages-scroll") : null;
    const isAtTop = activeView === "chat" ? (chatScroller?.scrollTop ?? 0) <= 2 : window.scrollY <= 2;
    if (!canUsePullToRefresh || event.touches.length !== 1 || !isAtTop) return;
    pullStartYRef.current = event.touches[0].clientY;
    isPullingRef.current = false;
  }, [activeView, canUsePullToRefresh]);

  const handlePullMove = useCallback((event: ReactTouchEvent<HTMLElement>) => {
    if (pullStartYRef.current === null || isPullRefreshing) return;
    const chatScroller = activeView === "chat" ? document.querySelector<HTMLElement>(".chat-messages-scroll") : null;
    const isStillAtTop = activeView === "chat" ? (chatScroller?.scrollTop ?? 0) <= 2 : window.scrollY <= 2;
    if (!isStillAtTop) {
      pullStartYRef.current = null;
      isPullingRef.current = false;
      setPullDistance(0);
      return;
    }

    const delta = event.touches[0].clientY - pullStartYRef.current;
    if (delta <= 0) {
      setPullDistance(0);
      return;
    }

    isPullingRef.current = true;
    event.preventDefault();
    setPullDistance(Math.min(128, delta * 0.45));
  }, [activeView, isPullRefreshing]);

  const handlePullEnd = useCallback(async () => {
    if (!isPullingRef.current) {
      pullStartYRef.current = null;
      return;
    }

    const shouldRefresh = pullDistance > pullRefreshThreshold && !isPullRefreshing;
    pullStartYRef.current = null;
    isPullingRef.current = false;

    if (!shouldRefresh) {
      setPullDistance(0);
      return;
    }

    setPullDistance(72);
    setIsPullRefreshing(true);
    try {
      await refreshFinanceData();
    } finally {
      setTimeout(() => {
        setIsPullRefreshing(false);
        setPullDistance(0);
      }, 260);
    }
  }, [isPullRefreshing, pullDistance, pullRefreshThreshold, refreshFinanceData]);

  const loadMoreTransactions = useCallback(async () => {
    if (!sessionReady || isLoadingMoreTransactions || !transactionsPagination.hasMore || !transactionsPagination.nextPage) return;

    setIsLoadingMoreTransactions(true);
    setDataError("");

    try {
      const response = await apiRequest<{ transactions: ApiTransaction[]; pagination?: TransactionsPagination }>(
        `/api/transactions?page=${transactionsPagination.nextPage}&limit=${transactionsPagination.limit}`,
      );
      const nextTransactions = response.transactions.map(normalizeApiTransaction);

      setTransactions((current) => {
        const seenIds = new Set(current.map((transaction) => transaction.rawId));
        return [...current, ...nextTransactions.filter((transaction) => !seenIds.has(transaction.rawId))];
      });
      setTransactionsPagination(response.pagination ?? {
        page: transactionsPagination.nextPage ?? transactionsPagination.page + 1,
        limit: transactionsPagination.limit,
        hasMore: false,
        nextPage: null,
      });
    } catch (error) {
      setDataError(error instanceof Error ? error.message : "Transaksi berikutnya gagal dimuat.");
    } finally {
      setIsLoadingMoreTransactions(false);
    }
  }, [sessionReady, isLoadingMoreTransactions, transactionsPagination]);
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
    let isCancelled = false;

    async function verifySession() {
      setIsAuthChecking(true);

      try {
        const response = await apiRequest<{ user: AuthUser; token?: string }>("/api/auth/me");

        if (isCancelled) return;

        setCurrentUser(response.user);
        setSessionReady(true);

        clearStoredAuthTokenFallback();

        try {
          window.localStorage.setItem(authStorageKey, JSON.stringify(response.user));
        } catch {
          // Ignore private browsing/storage restrictions.
        }
      } catch {
        if (isCancelled) return;

        clearClientSession();

        setCurrentUser(null);
        setSessionReady(false);
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
  }, [clearClientSession]);

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


  useEffect(() => {
    if (!currentUser || !showSplash) return;

    const timeoutId = window.setTimeout(() => setShowSplash(false), 1350);
    return () => window.clearTimeout(timeoutId);
  }, [currentUser, showSplash]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;

    try {
      window.localStorage.setItem(themeStorageKey, theme);
    } catch {
      // Ignore private browsing/storage restrictions.
    }
  }, [theme]);

  useEffect(() => {
    contentScrollerRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [activeView]);


  if (isAuthChecking && !currentUser) {
    return <AuthLoadingScreen />;
  }

  if (!currentUser) {
    return <AuthScreen onAuthenticated={handleAuthenticated} />;
  }

  return (
    <>
      {showSplash && <AppSplashScreen theme={theme} />}
      {(pullDistance > 4 || isPullRefreshing) && (
        <div className="pointer-events-none fixed left-0 right-0 top-3 z-[1550] flex justify-center lg:hidden" aria-live="polite">
          <div
            className="flex items-center gap-2 rounded-full border border-white/70 bg-white/92 px-4 py-2 text-xs font-black text-blue-700 shadow-[0_16px_36px_rgba(37,99,235,0.20)] backdrop-blur-xl dark:border-sky-400/20 dark:bg-slate-950/90 dark:text-sky-100"
            style={{ transform: `translateY(${Math.min(38, pullDistance * 0.24)}px)`, opacity: Math.max(0.35, pullProgress) }}
          >
            <RefreshCw size={15} className={clsx("transition-transform", isPullRefreshing ? "animate-spin" : pullDistance > pullRefreshThreshold ? "rotate-180" : "rotate-0")} />
            <span>{pullLabel}</span>
          </div>
        </div>
      )}
      <main
        className={clsx(
          "finance-app-shell h-[100dvh] w-full max-w-full overflow-hidden px-3 sm:px-4 lg:h-auto lg:min-h-screen lg:overflow-x-hidden lg:p-6",
          activeView === "chat" ? "pb-0" : "pb-0",
          activeView === "chat" ? "pt-[calc(8px+env(safe-area-inset-top))]" : activeView === "scan" ? "pt-[calc(6px+env(safe-area-inset-top))]" : "pt-[calc(10px+env(safe-area-inset-top))]",
        )}
        onTouchStart={handlePullStart}
        onTouchMove={handlePullMove}
        onTouchEnd={handlePullEnd}
        onTouchCancel={handlePullEnd}
      >
      <div className={clsx("mx-auto grid h-full min-h-0 w-full max-w-[1500px] items-start gap-3 lg:h-auto lg:grid-cols-[278px_minmax(0,1fr)] lg:gap-4", activeView === "chat" ? "lg:h-auto" : "") }>
        <Sidebar
          activeView={activeView}
          onChange={changeView}
          user={currentUser}
          onLogout={handleLogout}
          scanCount={analytics.scanCount}
          healthScore={analytics.savingsRatio}
        />
        <section className="flex h-full min-h-0 min-w-0 flex-col gap-3 lg:block lg:h-auto lg:space-y-4">
          <TopBar
            title={activeMeta.label}
            user={currentUser}
            sessionReady={sessionReady}
            onUserUpdate={handleUserUpdate}
            onAddTransaction={() => changeView("transactions")}
            onLogout={handleLogout}
            theme={theme}
            onToggleTheme={toggleTheme}
            compactMobile={activeView === "chat"}
          />
          {dataStatus === "error" && (
            <div className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600">
              {dataError}
            </div>
          )}
          <div
            ref={contentScrollerRef}
            className={clsx(
              "no-scrollbar min-h-0 flex-1 overscroll-contain pb-[calc(96px+env(safe-area-inset-bottom))] lg:overflow-visible lg:pb-0",
              activeView === "chat" ? "overflow-hidden" : "overflow-y-auto",
              activeView === "scan" ? "scan-view-scroll" : "",
            )}
          >
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
              pagination={transactionsPagination}
              isLoadingMore={isLoadingMoreTransactions}
              onLoadMore={loadMoreTransactions}
            />
          )}
          <div className={activeView === "scan" ? "block" : "hidden"} aria-hidden={activeView !== "scan"}>
            <ScanView categories={categories} sessionReady={sessionReady} onCreateTransaction={createTransaction} onNavigate={changeView} />
          </div>
          <div className={activeView === "chat" ? "chat-view-frame block h-full min-h-0" : "hidden"} aria-hidden={activeView !== "chat"}>
            <ChatView transactions={transactions} sessionReady={sessionReady} />
          </div>
          {activeView === "reports" && <ReportsView analytics={analytics} transactions={transactions} statements={statements} />}
          </div>
        </section>
      </div>
      <MobileNav activeView={activeView} onChange={changeView} />
      </main>
    </>
  );
}

function AppSplashScreen({ theme }: { theme: ThemeMode }) {
  const isDark = theme === "dark";

  return (
    <div
      className={clsx(
        "fixed inset-0 z-[9999] grid place-items-center overflow-hidden px-6 transition-colors",
        isDark ? "bg-[#061427] text-white" : "bg-[#F4F9FF] text-[#0F172A]",
      )}
    >
      <div className={clsx("pointer-events-none absolute inset-0", isDark ? "bg-[radial-gradient(circle_at_50%_18%,rgba(14,165,233,0.22),transparent_30%),linear-gradient(180deg,#071B33_0%,#061427_78%)]" : "bg-[radial-gradient(circle_at_50%_20%,rgba(96,165,250,0.20),transparent_34%),linear-gradient(180deg,#F8FBFF_0%,#EAF4FF_100%)]")} />
      <div className="relative flex w-full max-w-[320px] flex-col items-center text-center">
        <div className={clsx("taka-soft-pop relative grid h-24 w-24 place-items-center rounded-[30px] p-3", isDark ? "bg-white/8 ring-1 ring-white/12" : "bg-white ring-1 ring-blue-100 shadow-[0_20px_48px_rgba(37,99,235,0.13)]")}>
          <Image src="/images/taka-logo-v3.png" alt="Taka FinTrack" width={76} height={76} priority unoptimized className="h-full w-full object-contain" />

        </div>
        <p className={clsx("mt-5 text-[11px] font-black uppercase tracking-[0.28em]", isDark ? "text-sky-200" : "text-blue-600")}>Taka FinTrack</p>
        <h2 className="mt-2 text-2xl font-black tracking-tight">Memuat dashboard</h2>
        <p className={clsx("mt-2 max-w-[260px] text-sm font-semibold leading-6", isDark ? "text-slate-300" : "text-slate-500")}>Sedang menyiapkan data terbaru kamu.</p>
        <div className={clsx("mt-7 h-2 w-44 overflow-hidden rounded-full", isDark ? "bg-white/10" : "bg-blue-100")}>
          <div className="taka-progress-sweep h-full w-2/3 rounded-full bg-gradient-to-r from-sky-300 via-blue-500 to-cyan-300" />
        </div>
      </div>
    </div>
  );
}

function AuthLoadingScreen() {
  return (
    <main className="grid min-h-screen place-items-center px-3 py-3">
      <div className="rounded-xl border border-white/70 bg-white/86 p-6 text-center shadow-soft backdrop-blur">
        <div className="mx-auto h-12 w-12 animate-pulse rounded-full border-4 border-blue-300 border-t-taka-navy" />
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

      try {
        window.localStorage.removeItem(authStorageKey);
      } catch {
        // Ignore private browsing/storage restrictions.
      }
      clearStoredAuthTokenFallback();

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
    <main className="finance-app-shell fixed inset-0 h-[100dvh] overflow-hidden px-3 py-[calc(8px+env(safe-area-inset-top))] sm:px-4 lg:relative lg:inset-auto lg:h-auto lg:min-h-screen lg:overflow-x-hidden lg:p-6">
      <div className="auth-mobile-shell no-scrollbar mx-auto grid h-full min-h-0 w-full max-w-[1180px] gap-3 overflow-hidden overscroll-none pb-[calc(18px+env(safe-area-inset-bottom))] lg:min-h-[calc(100vh-48px)] lg:grid-cols-[minmax(0,0.96fr)_minmax(0,1.04fr)] lg:gap-4 lg:overflow-visible lg:pb-0">
        <section className="auth-mobile-card flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-white/70 bg-white/86 p-3 shadow-soft backdrop-blur sm:p-6 lg:overflow-visible lg:p-8">
          <div className="flex items-center gap-3">
            <AppLogo size={48} />
            <div>
              <p className="text-lg font-black text-taka-ink">Taka FinTrack</p>
              <p className="text-sm font-semibold text-slate-500">Personal finance AI</p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 sm:mt-8">
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

          <div className="mt-5 sm:mt-7">
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-blue-600">
              {isForgot ? "Reset akses" : isRegister ? "Akun baru" : "Selamat datang"}
            </p>
            <h1 className="mt-1 text-2xl font-black leading-tight text-taka-ink sm:text-4xl">
              {isForgot ? "Lupa password?" : isRegister ? "Buat akun Taka" : "Masuk ke akunmu"}
            </h1>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500 sm:mt-3">
              {isForgot
                ? "Masukkan email akunmu. Kami akan mengirim instruksi reset password dengan tampilan email profesional."
                : isRegister
                  ? "Daftar untuk mulai mencatat transaksi, scan struk, dan melihat laporan."
                  : "Lanjutkan ke dashboard keuangan, transaksi, scan struk, dan AI chat."}
            </p>
          </div>

          <form className="mt-5 space-y-3.5 sm:mt-6 sm:space-y-4" onSubmit={handleSubmit}>
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
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-taka-navy px-4 py-3 text-sm font-black text-white shadow-float transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
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
                className="w-full rounded-lg px-3 py-2 text-sm font-black text-blue-700 transition hover:bg-blue-50"
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
              tone="blue"
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
            className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 pl-3 pr-10 text-base font-bold text-taka-ink outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white sm:h-12 sm:text-sm"
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
  tone: "emerald" | "blue";
}) {
  const toneClass = {
    emerald: "bg-emerald-400/18 text-emerald-200",
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
      src="/images/taka-logo-v3.png"
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
        "avatar-circle grid shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#1E3A8A,#0EA5E9)] bg-cover bg-center font-black text-white ring-4 ring-white",
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

        <div className="mt-4 rounded-xl bg-gradient-to-br from-taka-sky via-white to-taka-mint p-4 dark:from-[#1e3a5f] dark:via-[#0f233c] dark:to-[#1a4d5c] dark:border dark:border-white/10">
          <div className="flex items-center gap-3">
            <AvatarCircle user={user} />
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold text-taka-ink dark:text-white">{user.name}</p>
              <p className="truncate text-xs font-semibold text-slate-600 dark:text-slate-300">{user.email}</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-white/82 p-3 dark:bg-white/8 dark:border dark:border-white/10">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-300">Scan</p>
              <p className="mt-1 text-lg font-black text-taka-ink dark:text-white">{scanCount}/20</p>
            </div>
            <div className="rounded-lg bg-white/82 p-3 dark:bg-white/8 dark:border dark:border-white/10">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400 dark:text-slate-300">Health</p>
              <p className="mt-1 text-lg font-black text-blue-600 dark:text-emerald-400">{healthScore}%</p>
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
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
            <div className="flex items-start gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-500 text-white">
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
  theme,
  onToggleTheme,
  compactMobile = false,
}: {
  title: string;
  user: AuthUser;
  sessionReady: boolean;
  onUserUpdate: (updates: Partial<AuthUser>) => void;
  onAddTransaction: () => void;
  onLogout: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  compactMobile?: boolean;
}) {
  return (
    <header className={clsx("topbar-glass native-topbar sticky z-[1200] flex items-center justify-between gap-2 rounded-[20px] border border-white/70 bg-white/84 p-2 backdrop-blur-xl sm:relative sm:top-auto sm:p-4", compactMobile ? "top-0" : "top-[calc(6px+env(safe-area-inset-top))]")}>
      <div className="flex min-w-0 items-center gap-2 sm:block">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-blue-50 ring-1 ring-blue-100 dark:bg-sky-500/12 dark:ring-sky-400/20 sm:hidden">
          <AppLogo size={30} />
        </div>
        <div className="min-w-0">
          <div className="hidden rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-blue-700 ring-1 ring-blue-100 dark:bg-sky-500/12 dark:text-sky-200 dark:ring-sky-400/20 sm:inline-flex sm:text-xs">
            Mei 2026
          </div>
          <p className="truncate text-[10px] font-black uppercase tracking-[0.1em] text-blue-600 dark:text-sky-300 sm:hidden">Taka FinTrack</p>
          <h1 className="truncate text-[1.05rem] font-black leading-tight text-taka-ink dark:text-white sm:mt-1 sm:text-3xl">{title}</h1>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={onToggleTheme}
          className="theme-icon-button grid h-9 w-9 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:border-sky-300 hover:text-sky-600 dark:border-white/10 dark:bg-white/8 dark:text-sky-100 sm:h-11 sm:w-11 sm:rounded-lg"
          aria-label={theme === "dark" ? "Aktifkan light mode" : "Aktifkan dark mode"}
        >
          {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        <ProfileMenu user={user} onUserUpdate={onUserUpdate} onLogout={onLogout} />
        <button type="button" onClick={onAddTransaction} className="hidden items-center gap-2 rounded-lg bg-taka-navy px-4 py-3 text-sm font-extrabold text-white shadow-float transition hover:bg-blue-700 sm:flex">
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
        className="profile-trigger grid h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-sky-300 hover:text-sky-600 sm:h-11 sm:w-11"
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
          <div className="profile-modal fixed right-3 top-24 z-[1300] max-h-[calc(100vh-8rem)] w-72 max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-xl border border-white/80 bg-white p-4 text-left shadow-[0_18px_60px_rgba(15,23,42,0.25)] backdrop-blur">
          <div className="flex items-center gap-3">
            <AvatarCircle user={user} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-taka-ink">{user.name}</p>
              <p className="truncate text-xs font-bold text-slate-500">{user.email}</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <label className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg bg-taka-navy px-3 py-2 text-xs font-black text-white transition hover:bg-blue-700">
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
              <Settings size={16} className="text-blue-600" />
              <p className="text-sm font-black text-taka-ink">Ganti Password</p>
            </div>
            <div className="mt-3 space-y-2">
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-3 pr-10 text-xs font-bold text-taka-ink outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white"
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
                  className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-3 pr-10 text-xs font-bold text-taka-ink outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white"
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
                className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-blue-500 px-3 py-2 text-xs font-black text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Check size={15} />
                {isSavingPassword ? "Menyimpan..." : "Simpan Password"}
              </button>
            </div>
          </div>

          {(message || error) && (
            <div className={clsx("mt-3 rounded-lg px-3 py-2 text-xs font-bold", error ? "bg-rose-50 text-rose-600" : "bg-blue-50 text-blue-700")}>
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
    <div className="space-y-3 sm:space-y-5">
      <HeroBalance analytics={analytics} transactions={transactions} onNavigate={onNavigate} />
      <SummaryGrid analytics={analytics} />
      <MobileWeeklyHistory analytics={analytics} />
      <div className="grid gap-5 max-lg:hidden xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <div className="space-y-5">
          <WeeklyChart data={analytics.weekly} />
          <RecentTransactions transactions={transactions} dataStatus={dataStatus} compact />
        </div>
        <div className="space-y-5">
          <CategoryPanel data={analytics.categoryBreakdown} />
          <AiInsightCard analytics={analytics} onNavigate={onNavigate} />
          <ScanSpotlight transactions={transactions} onNavigate={onNavigate} />
        </div>
      </div>
    </div>
  );
}

function HeroBalance({ analytics, transactions, onNavigate }: { analytics: ReturnType<typeof getFinanceAnalytics>; transactions: Transaction[]; onNavigate: (view: ViewKey) => void; }) {
  const latestTransactions = transactions.slice(0, 3);
  const spentPercent = analytics.income > 0 ? Math.min(100, Math.round((analytics.expense / analytics.income) * 100)) : 0;

  return (
    <section className="relative overflow-hidden rounded-[26px] bg-[#F8FAFC] p-3 shadow-[0_24px_70px_rgba(37,99,235,0.13)] ring-1 ring-[#DBEAFE] sm:rounded-[34px] sm:p-6 lg:p-7">
      <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_390px]">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-[#2563EB] shadow-sm ring-1 ring-[#DBEAFE]"><Sparkles size={14} /> Finance overview</p>
              <h2 className="mt-3 max-w-2xl text-2xl font-black leading-tight text-[#0F172A] dark:text-white dark:drop-shadow-[0_2px_14px_rgba(14,165,233,0.22)] sm:mt-4 sm:text-5xl">Saldo & transaksi hari ini.</h2>
              <p className="mt-2 hidden max-w-xl text-sm font-semibold leading-6 text-[#64687F] dark:text-slate-200 sm:mt-3 sm:block sm:text-base">Ringkasan saldo, spending, scan struk, dan insight AI tetap memakai data real dari API — tampilannya dibuat seperti app finance profesional.</p>
            </div>
            <button type="button" onClick={() => onNavigate("transactions")} className="hidden items-center gap-2 rounded-[20px] bg-gradient-to-br from-[#0EA5E9] to-[#2563EB] px-5 py-3 text-sm font-black text-white shadow-[0_16px_34px_rgba(37,99,235,0.24)] transition hover:-translate-y-0.5 sm:inline-flex"><Plus size={18} /> Tambah Transaksi</button>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="overflow-hidden rounded-[26px] bg-gradient-to-br from-[#0EA5E9] via-[#2563EB] to-[#1D4ED8] p-4 text-white shadow-[0_24px_60px_rgba(37,99,235,0.30)] sm:col-span-2 sm:rounded-[32px] sm:p-5">
              <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-white/70">Total balance bulan ini</p><p className="mt-3 text-4xl font-black tracking-tight sm:text-5xl"><AnimatedCurrency value={analytics.balance} /></p></div><div className="rounded-2xl bg-white/14 p-3"><WalletCards size={24} /></div></div>
              <div className="mt-8 grid grid-cols-2 gap-3"><MetricPill label="Income" value={analytics.income} tone="green" /><MetricPill label="Expense" value={analytics.expense} tone="red" /></div>
              <div className="mt-5"><div className="flex items-center justify-between text-xs font-bold text-white/70"><span>Budget usage</span><AnimatedPercent value={spentPercent} /></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/18"><div className="h-full rounded-full bg-[#F6A23A] transition-[width] duration-700 ease-out" style={{ width: `${spentPercent}%` }} /></div></div>
            </div>
            <div className="hidden rounded-[32px] bg-white p-5 shadow-[0_18px_45px_rgba(32,34,58,0.07)] ring-1 ring-[#DBEAFE] dark:bg-slate-900/86 dark:ring-sky-400/20 sm:block"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#EFF6FF] text-[#2563EB]"><Bot size={23} /></div><p className="mt-5 text-sm font-black text-[#0F172A] dark:text-white">AI Finance Health</p><p className="mt-2 text-4xl font-black text-[#2563EB]">{analytics.savingsRatio}%</p><p className="mt-2 text-sm font-semibold leading-6 text-[#64748B] dark:text-slate-300">Rasio hemat dari transaksi bulan ini.</p><button type="button" onClick={() => onNavigate("chat")} className="mt-4 w-full rounded-[18px] bg-[#EFF6FF] px-4 py-3 text-sm font-black text-[#2563EB] dark:bg-sky-500/16 dark:text-sky-100">Tanya AI</button></div>
          </div>
        </div>
        <div className="hidden min-h-[520px] overflow-hidden rounded-[36px] bg-gradient-to-br from-blue-50 via-sky-50 to-slate-100 p-5 text-slate-950 shadow-[0_26px_70px_rgba(37,99,235,0.14)] ring-1 ring-blue-100/80 dark:from-[#071426] dark:via-[#06101f] dark:to-[#020617] dark:text-white dark:ring-transparent dark:shadow-[0_26px_70px_rgba(2,6,23,0.54)] lg:relative lg:block">
          <div className="absolute inset-x-8 top-8 h-40 rounded-full bg-[#0EA5E9]/22 blur-3xl dark:bg-[#0EA5E9]/28" />
          <div className="relative mx-auto max-w-[285px] rounded-[34px] border-[9px] border-white/75 bg-white p-3 text-[#0F172A] shadow-2xl dark:border-[#07101f] dark:bg-[#071426] dark:text-white">
            <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-[#DBEAFE] dark:bg-slate-700" /><div className="flex items-center justify-between"><div><p className="text-xs font-bold text-[#64748B] dark:text-slate-300">Hi, Umar</p><p className="text-lg font-black dark:text-white">FinTrack</p></div><div className="grid h-10 w-10 place-items-center rounded-full bg-white text-[#2563EB] shadow-sm dark:bg-slate-900 dark:text-sky-300"><Bell size={17} /></div></div>
            <div className="mt-4 rounded-[28px] bg-gradient-to-br from-[#0EA5E9] to-[#2563EB] p-4 text-white shadow-[0_16px_34px_rgba(37,99,235,0.28)]"><p className="text-xs font-semibold text-white/70">Total balance</p><p className="mt-2 text-2xl font-black">{currency.format(analytics.balance)}</p><div className="mt-5 flex items-center justify-between text-[11px] font-bold text-white/75"><span>**** 4829</span><span>Taka Card</span></div></div>
            <div className="mt-4 grid grid-cols-2 gap-2"><MiniPhoneStat label="Income" value={analytics.income} color="#2DB87D" /><MiniPhoneStat label="Expense" value={analytics.expense} color="#FB7185" /></div>
            <div className="mt-4 rounded-[24px] bg-white p-3 shadow-sm dark:bg-slate-900/92 dark:ring-1 dark:ring-sky-400/10"><div className="flex items-center justify-between"><p className="text-sm font-black dark:text-white">Recent</p><span className="text-xs font-bold text-[#64748B] dark:text-slate-300">Today</span></div><div className="mt-3 space-y-2">
              {latestTransactions.map((item) => (<div key={item.id} className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-xl" style={{ backgroundColor: getSoftColor(item.categoryColor), color: item.categoryColor }}>{item.type === "income" ? <TrendingUp size={15} /> : <CreditCard size={15} />}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-black dark:text-white">{item.merchant}</p><p className="truncate text-[10px] font-bold text-[#64748B] dark:text-slate-300">{item.category}</p></div><p className={clsx("text-[11px] font-black", item.type === "income" ? "text-[#39C7A5]" : "text-[#FF6375]")}>{item.type === "income" ? "+" : "-"}{currency.format(item.amount).replace("Rp", "")}</p></div>))}
              {latestTransactions.length === 0 && <p className="rounded-2xl bg-[#F7F6FD] p-3 text-center text-xs font-bold text-[#64748B] dark:bg-slate-950 dark:text-slate-300">Belum ada transaksi</p>}
            </div></div>
          </div>
        </div>
      </div>
    </section>
  );
}

function MetricPill({ label, value, tone }: { label: string; value: number; tone: "green" | "red" }) { return (<div className="rounded-[22px] bg-white/12 p-4"><p className="text-xs font-bold uppercase tracking-[0.1em] text-white/60">{label}</p><p className={clsx("mt-2 text-lg font-black", tone === "green" ? "text-[#BFF4E7]" : "text-[#FFD4DA]")}><AnimatedCurrency value={value} /></p></div>); }
function MiniPhoneStat({ label, value, color }: { label: string; value: number; color: string }) { return (<div className="rounded-[20px] bg-white p-3 shadow-sm dark:bg-[#071B33] dark:shadow-none"><p className="text-[10px] font-black uppercase tracking-[0.08em] text-[#64748B] dark:text-[#D9F3FF]">{label}</p><p className="mt-1 truncate text-xs font-black" style={{ color }}>{currency.format(value)}</p></div>); }

function SummaryGrid({ analytics }: { analytics: ReturnType<typeof getFinanceAnalytics> }) {
  const cards = [
    { label: "Pemasukan", value: analytics.income, helper: `${analytics.currentMonthCount} transaksi`, icon: ArrowUpRight, iconClass: "from-emerald-300 via-teal-400 to-cyan-500", pillClass: "text-emerald-700 bg-emerald-50 ring-emerald-100 dark:text-emerald-100 dark:bg-emerald-400/12 dark:ring-emerald-300/20", valueClass: "text-emerald-700 dark:text-emerald-100", glow: "bg-emerald-400/16" },
    { label: "Pengeluaran", value: analytics.expense, helper: "Bulan ini", icon: ArrowDownRight, iconClass: "from-rose-300 via-rose-500 to-orange-400", pillClass: "text-rose-700 bg-rose-50 ring-rose-100 dark:text-rose-100 dark:bg-rose-400/12 dark:ring-rose-300/20", valueClass: "text-rose-700 dark:text-rose-100", glow: "bg-rose-400/14" },
    { label: "Saldo Bersih", value: analytics.balance, helper: `${analytics.savingsRatio}% savings`, icon: WalletCards, iconClass: "from-sky-300 via-blue-500 to-indigo-600", pillClass: "text-blue-700 bg-blue-50 ring-blue-100 dark:text-sky-100 dark:bg-sky-400/12 dark:ring-sky-300/20", valueClass: "text-blue-800 dark:text-sky-100", glow: "bg-sky-400/16" },
  ];

  return (
    <section className="grid gap-3 md:grid-cols-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="group relative min-w-[76vw] snap-start overflow-hidden rounded-[26px] border border-blue-100/80 bg-gradient-to-br from-white via-blue-50/60 to-slate-100 p-4 shadow-[0_18px_42px_rgba(37,99,235,0.10)] transition hover:-translate-y-1 hover:shadow-[0_24px_56px_rgba(37,99,235,0.15)] dark:border-transparent dark:bg-[#061427] dark:bg-none dark:shadow-[inset_0_1px_0_rgba(14,165,233,0.08),0_20px_52px_rgba(2,6,23,0.45)] md:min-w-0 md:rounded-[32px] md:p-5"
        >
          <div className="relative flex items-start justify-between gap-3">
            <div className={clsx("grid h-14 w-14 place-items-center rounded-[22px] bg-gradient-to-br text-white shadow-[0_16px_34px_rgba(14,165,233,0.20)] ring-1 ring-white/25 dark:ring-0 dark:shadow-[0_18px_38px_rgba(14,165,233,0.22)]", card.iconClass)}>
              <card.icon size={24} strokeWidth={2.7} />
            </div>
            <span className={clsx("rounded-full px-3 py-1.5 text-[11px] font-black ring-1 backdrop-blur", card.pillClass)}>{card.helper}</span>
          </div>
          <div className="relative mt-6">
            <p className="text-[13px] font-black uppercase tracking-[0.08em] text-slate-500 dark:text-slate-300">{card.label}</p>
            <p className={clsx("mt-2 text-3xl font-black tracking-tight", card.valueClass)}>{currency.format(card.value)}</p>
          </div>
        </div>
      ))}
    </section>
  );
}

function MobileWeeklyHistory({ analytics }: { analytics: ReturnType<typeof getFinanceAnalytics> }) {
  return (
    <section className="overflow-hidden rounded-[26px] border border-sky-100/80 bg-gradient-to-br from-white via-sky-50/80 to-blue-50 p-4 shadow-[0_18px_46px_rgba(37,99,235,0.12)] dark:border-transparent dark:bg-[#061427] dark:bg-none dark:shadow-[0_22px_54px_rgba(2,6,23,0.48)] lg:hidden">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-sky-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-blue-700 ring-1 ring-sky-200/70 dark:border-0 dark:bg-[#0B2A44] dark:text-[#EAF8FF] dark:ring-0">
            <CalendarDays size={13} /> Senin–Minggu
          </p>
          <h3 className="mt-3 text-xl font-black tracking-tight text-slate-950 dark:text-[#F8FCFF]">History 1 Minggu</h3>
        </div>
        <div className="rounded-2xl bg-white/80 px-3 py-2 text-right shadow-sm ring-1 ring-sky-100 dark:bg-[#071B33] dark:ring-0">
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500 dark:text-[#D9F3FF]">Total</p>
          <p className={clsx("text-sm font-black", analytics.weeklyTotals.net >= 0 ? "text-emerald-600 dark:text-[#BDF8E6]" : "text-rose-600 dark:text-[#FFD6DD]")}>{currency.format(analytics.weeklyTotals.net)}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <MiniPhoneStat label="Income Minggu" value={analytics.weeklyTotals.income} color="#2DB87D" />
        <MiniPhoneStat label="Expense Minggu" value={analytics.weeklyTotals.expense} color="#FB7185" />
      </div>

      <div className="mt-4 space-y-2">
        {analytics.weekly.map((item) => (
          <div key={`${item.day}-${item.dateLabel}`} className="rounded-[20px] bg-white/78 p-3 ring-1 ring-sky-100/70 dark:bg-[#071B33] dark:ring-0">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-black text-slate-950 dark:text-[#F8FCFF]">{item.day}</p>
                <p className="text-[11px] font-bold text-slate-500 dark:text-[#C8EFFF]">{item.dateLabel}</p>
              </div>
              <div className="text-right">
                <p className={clsx("text-sm font-black", item.netAmount >= 0 ? "text-emerald-600 dark:text-[#BDF8E6]" : "text-rose-600 dark:text-[#FFD6DD]")}>{currency.format(item.netAmount)}</p>
                <p className="mt-0.5 text-[10px] font-bold text-slate-500 dark:text-[#C8EFFF]">
                  +{currency.format(item.incomeAmount)} / -{currency.format(item.expenseAmount)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function WeeklyChart({ data }: { data: Array<{ day: string; income: number; expense: number }> }) { return (<section className="rounded-[30px] bg-white p-5 shadow-[0_16px_40px_rgba(37,99,235,0.08)] ring-1 ring-[#DBEAFE]"><SectionHeader title="Cashflow 7 Hari" action="Mingguan" /><div className="mt-5 h-[310px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={data} barGap={8}><CartesianGrid vertical={false} stroke="#DBEAFE" strokeDasharray="3 3" /><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#64748B", fontSize: 12, fontWeight: 700 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: "#B1B4C6", fontSize: 11, fontWeight: 700 }} /><Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(81,70,216,0.06)" }} /><Bar dataKey="income" name="Income" fill="#39C7A5" radius={[10, 10, 0, 0]} isAnimationActive /><Bar dataKey="expense" name="Expense" fill="#FF6375" radius={[10, 10, 0, 0]} isAnimationActive /></BarChart></ResponsiveContainer></div></section>); }

function CategoryPanel({ data }: { data: Array<{ name: string; amount: number; color: string; value: number }>; }) {
  return (
    <section className="rounded-[30px] bg-white p-5 shadow-[0_16px_40px_rgba(37,99,235,0.08)] ring-1 ring-[#DBEAFE] dark:bg-[#071426] dark:ring-transparent dark:shadow-[0_18px_52px_rgba(2,6,23,0.44)]">
      <SectionHeader title="Expense by Category" action="Bulan ini" />
      <div className="mt-3 h-[220px]">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} innerRadius={62} outerRadius={90} paddingAngle={4} dataKey="value" isAnimationActive>
                {data.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
              </Pie>
              <Tooltip content={<PieTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="grid h-full place-items-center rounded-[24px] bg-blue-50 text-center text-sm font-bold text-slate-500 dark:bg-slate-950/70 dark:text-slate-300">Belum ada expense bulan ini</div>
        )}
      </div>
      <div className="space-y-2">
        {data.slice(0, 5).map((item) => (
          <div key={item.name} className="rounded-[18px] bg-blue-50/70 px-3 py-3 ring-1 ring-blue-100/70 dark:bg-slate-950/64 dark:ring-sky-300/10">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="truncate text-sm font-black text-[#0F172A] dark:text-slate-100">{item.name}</span>
              </div>
              <span className="text-sm font-black text-[#2563EB] dark:text-sky-200">{item.value}%</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-white dark:bg-slate-800">
              <div className="h-full rounded-full" style={{ width: `${item.value}%`, backgroundColor: item.color }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RecentTransactions({ transactions, dataStatus, compact = false }: { transactions: Transaction[]; dataStatus: "idle" | "loading" | "ready" | "error"; compact?: boolean; }) { const visibleTransactions = transactions.slice(0, compact ? 6 : transactions.length); return (<section className="rounded-[30px] bg-white p-5 shadow-[0_16px_40px_rgba(37,99,235,0.08)] ring-1 ring-[#DBEAFE]"><SectionHeader title="Transaksi Terbaru" action="Lihat semua" /><div className="mt-4 space-y-2">{visibleTransactions.map((item) => <TransactionRow key={item.id} item={item} onDelete={undefined} />)}{visibleTransactions.length === 0 && (<div className="rounded-[24px] border border-dashed border-[#D7D3F5] bg-[#F7F6FD] p-5 text-center text-sm font-bold text-[#64748B]">{dataStatus === "loading" ? "Memuat transaksi..." : "Belum ada transaksi real di database."}</div>)}</div></section>); }

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
  const amountClass = isIncome ? "text-blue-600" : "text-rose-500";
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    if (!showDetail) return;

    const previousOverflow = document.body.style.overflow;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowDetail(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [showDetail]);

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
      className="transaction-row-card grid min-w-0 cursor-pointer grid-cols-[40px_minmax(0,1fr)_auto] gap-2.5 rounded-[22px] border border-white/80 bg-white/94 p-3 shadow-[0_10px_28px_rgba(37,99,235,0.07)] transition active:scale-[0.99] hover:border-sky-200 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-300 dark:border-sky-400/15 dark:bg-white/8 sm:flex sm:items-center sm:p-3"
    >
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl sm:h-10 sm:w-10" style={{ backgroundColor: getSoftColor(item.categoryColor), color: item.categoryColor }}>
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
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onEdit(item);
          }}
          className="transaction-action-edit grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-sky-100 bg-sky-50 text-sky-600 shadow-sm transition hover:bg-sky-100 hover:text-sky-700 active:scale-95"
          aria-label="Edit transaksi"
        >
          <Pencil size={15} />
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          disabled={isDeleting}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            setShowConfirmDelete(true);
          }}
          className="transaction-action-delete grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-rose-100 bg-rose-50 text-rose-500 shadow-sm transition hover:bg-rose-100 hover:text-rose-600 active:scale-95 disabled:opacity-50"
          aria-label="Hapus transaksi"
        >
          <Trash2 size={16} />
        </button>
      )}
      </div>

      {showDetail && createPortal((
        <div
          className="transaction-detail-backdrop fixed inset-0 z-[1600] flex items-center justify-center bg-slate-950/72 p-4 backdrop-blur-lg"
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.stopPropagation();
            if (event.target === event.currentTarget) setShowDetail(false);
          }}
        >
          <div
            className="transaction-detail-modal max-h-[calc(100vh-2rem)] w-full max-w-sm overflow-y-auto rounded-[1.85rem] border border-white/12 bg-white p-0 shadow-[0_24px_80px_rgba(2,6,23,0.38)] dark:bg-[#071426] dark:text-white dark:shadow-[0_28px_90px_rgba(0,0,0,0.58)]"
            role="dialog"
            aria-modal="true"
            aria-label={`Detail transaksi ${item.merchant}`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 bg-gradient-to-br from-blue-50 to-white px-5 pb-4 pt-5 dark:from-slate-900 dark:to-[#071426]">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.12em] text-sky-600 dark:text-sky-300">Detail Transaksi</p>
                <h3 className="mt-1 text-xl font-black text-taka-ink dark:text-white">{item.merchant}</h3>
              </div>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setShowDetail(false);
                }}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-slate-500 shadow-sm transition hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                aria-label="Tutup detail transaksi"
              >
                <X size={18} strokeWidth={3} />
              </button>
            </div>
            <div className="px-5 pb-5">
              <div className={clsx("rounded-2xl p-4 shadow-inner", isIncome ? "bg-blue-50 dark:bg-emerald-400/10" : "bg-rose-50 dark:bg-rose-400/10")}>
                <p className="text-xs font-black uppercase tracking-[0.1em] text-slate-400 dark:text-slate-300">Nominal</p>
                <p className={clsx("mt-1 text-3xl font-black", amountClass)}>{amount}</p>
              </div>
            <div className="mt-4 grid gap-2 text-sm font-bold text-slate-600 dark:text-slate-200">
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
                  className="flex-1 rounded-xl bg-gradient-to-r from-sky-400 via-blue-500 to-blue-700 py-3 text-sm font-black text-white shadow-[0_14px_30px_rgba(37,99,235,0.28)] transition hover:-translate-y-0.5"
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
                  className="flex-1 rounded-xl bg-rose-500/12 py-3 text-sm font-black text-rose-600 ring-1 ring-rose-200 transition hover:bg-rose-500 hover:text-white dark:bg-rose-400/10 dark:text-rose-200 dark:ring-rose-300/20 dark:hover:bg-rose-500"
                >
                  Hapus
                </button>
              )}
            </div>
            </div>
          </div>
        </div>
      ), document.body)}

      {showConfirmDelete && createPortal((
        <div
          className="fixed inset-0 z-[1700] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-md"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
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
      ), document.body)}
    </div>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 dark:bg-white/8 dark:ring-1 dark:ring-white/10">
      <span className="text-xs font-black uppercase tracking-[0.08em] text-slate-400 dark:text-slate-300">{label}</span>
      <span className="truncate text-right text-sm font-black text-taka-ink dark:text-white">{value}</span>
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
    <section className="overflow-hidden rounded-xl border border-white/70 bg-white/86 shadow-soft backdrop-blur dark:bg-white/8 dark:border-white/10">
      <div className="relative h-56">
        <Image
          src="/images/receipt-lifestyle.svg"
          alt="Ilustrasi scan struk Taka FinTrack"
          fill
          priority
          className="object-cover dark:hidden"
        />
        <Image
          src="/images/receipt-lifestyle-dark.svg"
          alt="Ilustrasi scan struk Taka FinTrack"
          fill
          priority
          className="object-cover hidden dark:block"
        />
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-lg font-black text-taka-ink dark:text-white">Receipt Scanner</p>
            <p className="mt-1 text-sm font-semibold text-slate-500 dark:text-slate-300">
              {latestScan ? `${latestScan.merchant} • ${currency.format(latestScan.amount)}` : "Belum ada scan tersimpan"}
            </p>
          </div>
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-100 text-blue-700 dark:bg-blue-500/20 dark:text-emerald-400 dark:border dark:border-emerald-400/30">
            <Check size={20} />
          </div>
        </div>
        <button type="button" onClick={() => onNavigate("scan")} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-taka-navy px-4 py-3 text-sm font-black text-white transition hover:bg-blue-700 dark:bg-blue-500/30 dark:border dark:border-blue-400/40 dark:hover:bg-blue-500/40">
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
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-blue-100 text-blue-700">
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
      <button type="button" onClick={() => onNavigate("chat")} className="mt-4 flex w-full items-center justify-between rounded-lg bg-blue-50 px-4 py-3 text-sm font-black text-blue-700 transition hover:bg-blue-100">
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
        <div className="rounded-xl bg-gradient-to-br from-emerald-400 to-sky-500 p-4 text-white shadow-float">
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
  pagination,
  isLoadingMore,
  onLoadMore,
}: {
  transactions: Transaction[];
  categories: Category[];
  dataStatus: "idle" | "loading" | "ready" | "error";
  onCreateTransaction: (input: TransactionInput) => Promise<Transaction>;
  onUpdateTransaction: (rawId: number, input: TransactionInput) => Promise<Transaction>;
  onCreateCategory: (input: CategoryInput) => Promise<Category>;
  onDeleteTransaction: (rawId: number) => Promise<void>;
  onRefresh: () => Promise<void>;
  pagination: TransactionsPagination;
  isLoadingMore: boolean;
  onLoadMore: () => Promise<void>;
}) {
  const [filter, setFilter] = useState<"Semua" | "Income" | "Expense" | "Scan">("Semua");
  const [searchQuery, setSearchQuery] = useState("");
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
  const [showMobileTransactionSheet, setShowMobileTransactionSheet] = useState(false);
  const [transactionFormStep, setTransactionFormStep] = useState(0);
  const transactionFormSteps = useMemo(
    () => [
      { label: "Tipe", helper: transactionType === "expense" ? "Pengeluaran" : "Pemasukan" },
      { label: "Nominal", helper: amount ? `Rp ${Number(amount.replace(/\D/g, "") || 0).toLocaleString("id-ID")}` : "Isi nominal" },
      { label: "Kategori", helper: "Kategori + tanggal" },
      { label: "Catatan", helper: merchant.trim() || paymentAccount },
      { label: "Simpan", helper: editingTransaction ? "Update data" : "Review akhir" },
    ],
    [amount, editingTransaction, merchant, paymentAccount, transactionType],
  );
  const lastTransactionFormStep = transactionFormSteps.length - 1;
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
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query || [
      transaction.merchant,
      transaction.category,
      transaction.paymentAccount,
      transaction.source,
    ].some((value) => value.toLowerCase().includes(query));

    if (!matchesSearch) return false;
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
    window.setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }), 30);
    setTransactionType(transaction.type);
    setAmount(String(transaction.amount));
    setMerchant(transaction.merchant);
    setTransactionDate(getDateInputValue(getTransactionDate(transaction)));
    setPaymentAccount(transaction.paymentAccount || "Cash");
    const matchingCategory = categories.find((category) => category.id === transaction.categoryId || category.name === transaction.category);
    setCategoryId(matchingCategory ? String(matchingCategory.id) : "");
    setTransactionFormStep(0);
    setMessage("Mode edit aktif. Ubah data lalu simpan.");
    setError("");
  }

  function cancelEditTransaction() {
    setEditingTransaction(null);
    setMerchant("");
    setAmount("");
    setPaymentAccount("Cash");
    setTransactionDate(getDateInputValue());
    setTransactionFormStep(0);
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
      setShowMobileTransactionSheet(false);
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
    <div className="grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1fr)_360px] xl:gap-4">
      <section className="native-transactions-panel min-w-0 overflow-hidden rounded-[24px] border border-white/70 bg-white/82 p-2 shadow-soft backdrop-blur-xl dark:border-sky-400/20 dark:bg-slate-950/82 sm:p-4">
        {/* Month picker */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <button type="button" onClick={prevMonth} className="native-icon-tap grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-500 transition active:scale-95 hover:bg-slate-200 dark:bg-white/8 dark:text-slate-200">
              <ChevronLeft size={18} />
            </button>
            <button type="button" onClick={goToCurrentMonth} className="native-month-pill flex min-w-0 items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-black text-taka-ink shadow-sm ring-1 ring-blue-100 transition active:scale-[0.98] hover:bg-slate-50 dark:bg-white/8 dark:text-white dark:ring-sky-400/20">
              <CalendarDays size={15} className="shrink-0 text-blue-600 dark:text-sky-300" />
              <span className="truncate">{getFullMonthLabel(selectedMonth)}</span>
            </button>
            <button type="button" onClick={nextMonth} className="native-icon-tap grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-500 transition active:scale-95 hover:bg-slate-200 dark:bg-white/8 dark:text-slate-200">
              <ChevronRight size={18} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => void onRefresh()}
            className="native-refresh-pill inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-blue-50 px-3 text-xs font-black text-blue-700 ring-1 ring-blue-100 transition active:scale-95 hover:bg-blue-100 dark:bg-sky-400/10 dark:text-sky-200 dark:ring-sky-400/20"
          >
            <RefreshCw size={14} />
            <span className="hidden min-[380px]:inline">Refresh</span>
          </button>
        </div>

        {/* Monthly summary */}
        <div className="native-summary-scroll no-scrollbar mt-3 -mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
          <div className="native-summary-card min-w-[128px] flex-1 snap-start rounded-[18px] bg-blue-50 px-3 py-2.5 dark:bg-sky-400/10">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-blue-600 dark:text-sky-300">Income</p>
            <p className="mt-1 whitespace-nowrap text-sm font-black text-blue-700 dark:text-sky-100">{currency.format(monthIncome)}</p>
          </div>
          <div className="native-summary-card min-w-[128px] flex-1 snap-start rounded-[18px] bg-rose-50 px-3 py-2.5 dark:bg-rose-400/10">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-rose-500 dark:text-rose-300">Expense</p>
            <p className="mt-1 whitespace-nowrap text-sm font-black text-rose-600 dark:text-rose-200">{currency.format(monthExpense)}</p>
          </div>
          <div className="native-summary-card min-w-[128px] flex-1 snap-start rounded-[18px] bg-blue-50 px-3 py-2.5 dark:bg-sky-400/10">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-blue-500 dark:text-sky-300">Balance</p>
            <p className={clsx("mt-1 whitespace-nowrap text-sm font-black", monthIncome - monthExpense >= 0 ? "text-blue-700 dark:text-sky-100" : "text-rose-600 dark:text-rose-200")}>
              {currency.format(monthIncome - monthExpense)}
            </p>
          </div>
        </div>

        <label className="relative mt-3 block">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#64748B]" size={17} />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="h-11 w-full rounded-[18px] border border-[#DBEAFE] bg-white/92 pl-11 pr-4 text-sm font-bold text-taka-ink outline-none transition placeholder:text-[#64748B] focus:border-[#2563EB] dark:border-sky-400/20 dark:bg-white/8 dark:text-white dark:placeholder:text-slate-400"
            placeholder="Cari merchant, kategori, akun..."
          />
        </label>

        {/* Type filter */}
        <div className="no-scrollbar mt-3 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {(["Semua", "Income", "Expense", "Scan"] as const).map((filterOption) => (
            <button
              key={filterOption}
              type="button"
              onClick={() => setFilter(filterOption)}
              className={clsx(
                "shrink-0 rounded-full px-3.5 py-2 text-xs font-black transition active:scale-95 sm:text-sm",
                filter === filterOption ? "bg-gradient-to-r from-sky-400 to-blue-700 text-white shadow-[0_10px_22px_rgba(37,99,235,0.24)]" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/8 dark:text-slate-200",
              )}
            >
              {filterOption}
            </button>
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-xs font-bold text-slate-400">{filteredTransactions.length} transaksi</p>
          <button type="button" onClick={() => { cancelEditTransaction(); window.setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }), 30); }} className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-sky-400 to-blue-700 px-3 py-2 text-xs font-black text-white shadow-[0_10px_22px_rgba(37,99,235,0.24)] active:scale-95 xl:hidden">
            <Plus size={14} /> Tambah
          </button>
        </div>

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
          {(pagination.hasMore || isLoadingMore) && (
            <button
              type="button"
              onClick={() => void onLoadMore()}
              disabled={isLoadingMore}
              className="mt-3 flex min-h-12 w-full items-center justify-center rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-black text-cyan-700 shadow-sm transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isLoadingMore ? "Memuat transaksi lain..." : "Muat transaksi lainnya"}
            </button>
          )}
          {!pagination.hasMore && transactions.length > 0 && (
            <p className="py-3 text-center text-xs font-bold text-slate-400">Semua transaksi sudah tampil.</p>
          )}
        </div>
      </section>

      <section className="transaction-form-sheet min-w-0 rounded-[28px] border border-white/70 bg-white/95 p-4 shadow-soft backdrop-blur dark:border-sky-400/20 dark:bg-slate-950/95">
        <div>
        <div className="flex items-start justify-between gap-3">
          <SectionTitle title={editingTransaction ? "Edit Transaksi" : "Tambah Transaksi"} eyebrow={editingTransaction ? "ubah data" : "catat income/expense"} />
          {editingTransaction && (
            <button type="button" onClick={cancelEditTransaction} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-200 dark:bg-white/10 dark:text-slate-100">
              Batal
            </button>
          )}
        </div>
        </div>
        <div>
        <form className="mt-4 space-y-3" onSubmit={submitTransaction}>
          <div>
          <SegmentedControl
            options={["Expense", "Income"]}
            active={transactionType === "expense" ? "Expense" : "Income"}
            onChange={(option) => setTransactionType(option === "Income" ? "income" : "expense")}
          />
          </div>
          <div>
          <EditableField label="Nominal" inputMode="numeric" value={amount} placeholder="Rp 125.000" onChange={setAmount} />
          </div>
          <div>
          <CustomSelect
            label="Kategori"
            value={categoryId}
            onChange={setCategoryId}
            options={availableCategories.map((category) => ({ value: String(category.id), label: category.name }))}
          />
          </div>
          <div className="space-y-3">
          <EditableField label="Merchant" value={merchant} placeholder="Kopi Kenangan" onChange={setMerchant} />
          <CustomSelect
            label="Akun / Dompet Pembayaran"
            value={paymentAccount}
            onChange={setPaymentAccount}
            options={paymentAccountOptions.map((account) => ({ value: account, label: account }))}
          />
          <CustomDateField label="Tanggal" value={transactionDate} onChange={setTransactionDate} />
          </div>
          {(message || error) && (
            <div className={clsx("rounded-lg px-3 py-2 text-sm font-bold", error ? "bg-rose-50 text-rose-600" : "bg-blue-50 text-blue-700")}>
              {error || message}
            </div>
          )}
          <button
            type="submit"
            disabled={isSavingTransaction}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-400 via-blue-500 to-blue-700 px-4 py-3.5 text-sm font-black text-white shadow-[0_16px_34px_rgba(37,99,235,0.30)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(37,99,235,0.38)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          >
            <Plus size={18} />
            {isSavingTransaction ? "Menyimpan..." : editingTransaction ? "Update Transaksi" : "Simpan Transaksi"}
          </button>
        </form>
        </div>

        <form className="category-form-card mt-5 rounded-[24px] border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-3 shadow-[0_14px_34px_rgba(37,99,235,0.08)] dark:border-sky-400/25 dark:bg-slate-950/90 dark:from-slate-900/95 dark:to-slate-950/95 dark:shadow-[0_18px_44px_rgba(14,165,233,0.10)]" onSubmit={submitCategory}>
          <p className="text-sm font-black text-taka-ink dark:text-white">Tambah Kategori</p>
          <div className="mt-3 space-y-3">
            <EditableField label="Nama" value={categoryName} placeholder="Contoh: Kosan" onChange={setCategoryName} />
            <div className="grid grid-cols-[minmax(0,1fr)_56px] gap-2">
              <CustomSelect
                label="Tipe"
                value={categoryType}
                onChange={(value) => setCategoryType(value as CategoryType)}
                options={[{ value: "expense", label: "Expense" }, { value: "income", label: "Income" }, { value: "both", label: "Both" }]}
              />
              <label className="block">
                <span className="text-xs font-black uppercase tracking-[0.1em] text-slate-400">Warna</span>
                <input
                  type="color"
                  value={categoryColor}
                  onChange={(event) => setCategoryColor(event.target.value)}
                  className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white p-1 dark:border-sky-400/20 dark:bg-slate-950/70"
                  aria-label="Warna kategori"
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={isSavingCategory}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-400 via-blue-500 to-blue-700 px-4 py-3.5 text-sm font-black text-white shadow-[0_16px_34px_rgba(37,99,235,0.30)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(37,99,235,0.38)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
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
  const [receiptSplitMode, setReceiptSplitMode] = useState<ReceiptSplitMode>("full_receipt");
  const [selectedReceiptItems, setSelectedReceiptItems] = useState<Record<string, SelectedReceiptItem>>({});
  const [receiptAdjustmentMode, setReceiptAdjustmentMode] = useState<ReceiptAdjustmentMode>("proportional");
  const [lastSavedReceiptMessage, setLastSavedReceiptMessage] = useState("Transaksi hasil scan berhasil ditambahkan.");
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
  const receiptSplitSummary = getReceiptSplitSummary(scannedReceipt, selectedReceiptItems, receiptAdjustmentMode);

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
    setReceiptSplitMode("full_receipt");
    setSelectedReceiptItems({});
    setReceiptAdjustmentMode("proportional");
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
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rawText, imageData: preprocessed }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          if (aiData.is_transaction) {
            const itemsData = Array.isArray(aiData.items) ? aiData.items.map((item: any) => ({
              name: item.name || "Item",
              qty: Number(item.quantity) || 1,
              price: Number(item.unit_price) || (Number(item.total_price) && Number(item.quantity) ? Math.round(Number(item.total_price) / Number(item.quantity)) : 0),
              lineTotal: Number(item.total_price) || undefined,
            })).filter((item: any) => item.price > 0) : [];

            let finalTotal = Number(aiData.grand_total);
            if (!Number.isFinite(finalTotal) || finalTotal <= 0) {
               finalTotal = itemsData.reduce((sum: number, item: any) => sum + (item.qty * item.price), 0);
            }

            const aiConfidenceRaw = Number(aiData.confidence);
            const aiConfidence = Number.isFinite(aiConfidenceRaw)
              ? Math.round(aiConfidenceRaw <= 1 ? aiConfidenceRaw * 100 : aiConfidenceRaw)
              : 0;

            parsedReceipt = {
              merchant: aiData.merchant || "Struk Belanja",
              date: aiData.transaction_date ? `${aiData.transaction_date} ${aiData.transaction_time || ""}`.trim() : "Tanggal tidak terbaca",
              payment: aiData.payment_method || "Tunai",
              paymentAccount: normalizePaymentAccount(aiData.payment_account || aiData.payment_method),
              subtotal: aiData.subtotal || 0,
              discount: aiData.discount || 0,
              total: finalTotal,
              confidence: Math.max(0, Math.min(100, aiConfidence)),
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
      setReceiptSplitMode("full_receipt");
      setSelectedReceiptItems({});
      setReceiptAdjustmentMode("proportional");
      setScanPaymentAccount(normalizePaymentAccount(parsedReceipt.paymentAccount || parsedReceipt.payment));
      const suggestedCategory = suggestReceiptCategory(parsedReceipt, categories, scanType).category;
      setSelectedScanCategoryId(suggestedCategory ? String(suggestedCategory.id) : "");
      setScanStatus("done");

      if (parsedReceipt.source === "ocr" || parsedReceipt.source === "ai") {
        const itemCount = parsedReceipt.items.length;
        const reviewPrefix = parsedReceipt.confidence < 70 ? "Perlu review manual — " : "";
        setCameraMessage(
          `${reviewPrefix}Scan selesai! ${itemCount} item terdeteksi, total ${currency.format(parsedReceipt.total)}. Confidence: ${parsedReceipt.confidence}%`
        );
      } else {
        setCameraMessage("Gagal menganalisa struk. Pastikan .env.local memiliki GEMINI_API_KEY untuk fitur AI.");
      }
    } catch (err) {
      console.error("OCR Error:", err);
      setScannedReceipt(null);
      setSelectedScanCategoryId("");
      setScanStatus("empty");
      setCameraMessage("OCR gagal. Coba ambil foto ulang dengan pencahayaan lebih baik, atau pastikan .env.local memiliki GEMINI_API_KEY.");
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
    setReceiptSplitMode("full_receipt");
    setSelectedReceiptItems({});
    setReceiptAdjustmentMode("proportional");
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
      setCameraMessage("Kamera live butuh HTTPS atau localhost. Pakai tombol upload untuk ambil foto struk dari galeri HP.");
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
      setReceiptSplitMode("full_receipt");
      setSelectedReceiptItems({});
      setReceiptAdjustmentMode("proportional");
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

  function toggleReceiptItem(item: ScannedReceipt["items"][number], index: number) {
    const key = getReceiptItemKey(item, index);
    setSelectedReceiptItems((current) => {
      if (current[key]) {
        const next = { ...current };
        delete next[key];
        return next;
      }
      const unitPrice = item.price || Math.round(getReceiptLineTotal(item) / Math.max(1, item.qty));
      return {
        ...current,
        [key]: {
          key,
          name: item.name,
          originalQty: item.qty,
          selectedQty: item.qty,
          unitPrice,
          selectedAmount: Math.round(item.qty * unitPrice),
        },
      };
    });
    setReceiptSplitMode("selected_items");
  }

  function updateSelectedReceiptQty(item: ScannedReceipt["items"][number], index: number, selectedQty: number) {
    const key = getReceiptItemKey(item, index);
    const safeQty = Math.max(0, Math.min(item.qty, selectedQty));
    setSelectedReceiptItems((current) => {
      if (safeQty <= 0) {
        const next = { ...current };
        delete next[key];
        return next;
      }
      const unitPrice = current[key]?.unitPrice || item.price || Math.round(getReceiptLineTotal(item) / Math.max(1, item.qty));
      return {
        ...current,
        [key]: {
          key,
          name: item.name,
          originalQty: item.qty,
          selectedQty: safeQty,
          unitPrice,
          selectedAmount: Math.round(safeQty * unitPrice),
        },
      };
    });
    setReceiptSplitMode("selected_items");
  }

  function selectAllReceiptItems() {
    if (!scannedReceipt) return;
    const next: Record<string, SelectedReceiptItem> = {};
    scannedReceipt.items.forEach((item, index) => {
      const key = getReceiptItemKey(item, index);
      const unitPrice = item.price || Math.round(getReceiptLineTotal(item) / Math.max(1, item.qty));
      next[key] = {
        key,
        name: item.name,
        originalQty: item.qty,
        selectedQty: item.qty,
        unitPrice,
        selectedAmount: Math.round(item.qty * unitPrice),
      };
    });
    setSelectedReceiptItems(next);
    setReceiptSplitMode("selected_items");
  }

  function clearSelectedReceiptItems() {
    setSelectedReceiptItems({});
    setReceiptSplitMode("selected_items");
  }

  async function saveScannedReceipt() {
    if (!scannedReceipt) return;

    const selectedCategory = selectedScanCategory;

    if (!selectedCategory) {
      setCameraMessage(`Belum ada kategori ${scanType}. Tambah kategori dulu di menu Transaksi.`);
      return;
    }

    if (receiptSplitMode === "selected_items" && receiptSplitSummary.selectedCount === 0) {
      setCameraMessage("Pilih minimal satu item kamu, atau pakai Simpan full struk.");
      return;
    }

    const amountToSave = receiptSplitMode === "selected_items" ? receiptSplitSummary.selectedTotal : scannedReceipt.total;

    setIsSavingReceipt(true);

    try {
      await onCreateTransaction({
        merchant: scannedReceipt.merchant,
        amount: amountToSave,
        type: scanType,
        categoryId: selectedCategory.id,
        transactionDate: getDateInputValue(),
        source: "Scan",
        paymentAccount: scanPaymentAccount,
        receiptSplitMode,
        receiptTotalAmount: scannedReceipt.total,
        receiptSelectedAmount: receiptSplitMode === "selected_items" ? amountToSave : null,
        receiptItems: scannedReceipt.items,
        receiptSelectedItems: Object.values(selectedReceiptItems),
        receiptAdjustmentAmount: receiptSplitMode === "selected_items" ? receiptSplitSummary.selectedAdjustment : null,
        receiptAdjustmentNote: receiptSplitMode === "selected_items" && receiptSplitSummary.selectedAdjustment !== 0 ? "Alokasi proporsional pajak/service/diskon" : null,
      });
      setLastSavedReceiptMessage(receiptSplitMode === "selected_items" ? `Tersimpan: ${receiptSplitSummary.selectedCount} item saya dari total struk ${currency.format(scannedReceipt.total)}.` : "Transaksi full struk berhasil ditambahkan.");
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
    <div className="relative grid gap-3 xl:grid-cols-[minmax(0,1fr)_460px]">
      <section className="rounded-xl border border-white/70 bg-white/86 p-2.5 shadow-soft backdrop-blur sm:p-4">
        <SectionTitle title="Scan Struk" eyebrow="JPEG / PNG • max 10MB" />
        <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="rounded-xl border border-dashed border-blue-300 bg-blue-50 p-2.5 sm:p-4">
            <div className="receipt-camera-frame relative overflow-hidden rounded-xl bg-slate-950 shadow-inner sm:h-[420px] lg:h-[500px]">
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
                <span className="absolute -left-px -top-px h-10 w-10 rounded-tl-[1.4rem] border-l-4 border-t-4 border-blue-300" />
                <span className="absolute -right-px -top-px h-10 w-10 rounded-tr-[1.4rem] border-r-4 border-t-4 border-blue-300" />
                <span className="absolute -bottom-px -left-px h-10 w-10 rounded-bl-[1.4rem] border-b-4 border-l-4 border-blue-300" />
                <span className="absolute -bottom-px -right-px h-10 w-10 rounded-br-[1.4rem] border-b-4 border-r-4 border-blue-300" />
              </div>
              {cameraStatus === "active" && (
                <>
                  <div className="pointer-events-none absolute left-10 right-10 top-1/2 h-0.5 animate-pulse bg-emerald-300 shadow-[0_0_24px_rgba(110,231,183,0.95)]" />
                  <button
                    type="button"
                    onClick={capturePhoto}
                    className="absolute bottom-20 left-1/2 grid h-16 w-16 -translate-x-1/2 place-items-center rounded-full border-4 border-white bg-blue-500 text-white shadow-float transition hover:bg-blue-600"
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
                    <div className="mx-auto h-12 w-12 animate-pulse rounded-full border-4 border-blue-300 border-t-white" />
                    <p className="mt-3 text-sm font-black">Scanning...</p>
                  </div>
                </div>
              )}
              <div className="absolute bottom-2 left-2 right-2 rounded-lg bg-white/92 px-2.5 py-1.5 text-[11px] font-bold leading-4 text-slate-700 shadow-sm sm:bottom-4 sm:left-4 sm:right-4 sm:px-3 sm:py-2 sm:text-xs sm:leading-5">
                {cameraMessage}
              </div>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
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
                  cameraStatus === "active" ? "bg-blue-500 hover:bg-blue-600" : "bg-taka-navy hover:bg-blue-700",
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
                  "scan-retry-button inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-55",
                  cameraStatus === "active"
                    ? "bg-white text-slate-700 hover:bg-slate-50"
                    : "bg-sky-600 text-white hover:bg-sky-700",
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
                  className="scan-delete-image-button inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-rose-500 px-4 py-3 text-sm font-black text-white shadow-[0_8px_24px_rgba(225,29,72,0.3)] transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
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
          <div className="mt-4 space-y-3">
            {receiptItems.length > 0 ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={selectAllReceiptItems} className="rounded-full bg-sky-50 px-3 py-2 text-[11px] font-black text-sky-700 ring-1 ring-sky-100">Pilih semua</button>
                  <button type="button" onClick={clearSelectedReceiptItems} className="rounded-full bg-slate-50 px-3 py-2 text-[11px] font-black text-slate-600 ring-1 ring-slate-100">Kosongkan</button>
                  <button type="button" onClick={() => setReceiptSplitMode("full_receipt")} className="rounded-full bg-blue-50 px-3 py-2 text-[11px] font-black text-blue-700 ring-1 ring-blue-100">Simpan full struk</button>
                </div>
                <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                  {receiptItems.map((item, index) => {
                    const key = getReceiptItemKey(item, index);
                    const selected = selectedReceiptItems[key];
                    return (
                      <div key={key} className={clsx("rounded-xl border p-3 transition", selected ? "border-sky-200 bg-sky-50/80" : "border-slate-100 bg-white")}>
                        <div className="flex items-start gap-3">
                          <input type="checkbox" checked={Boolean(selected)} onChange={() => toggleReceiptItem(item, index)} className="mt-1 h-5 w-5 rounded border-slate-300 text-sky-600" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-black text-taka-ink">{item.name}</p>
                            <p className="mt-1 text-xs font-bold text-slate-500">{item.qty} x {currency.format(item.price)} • total {currency.format(getReceiptLineTotal(item))}</p>
                            {selected && item.qty > 1 && (
                              <div className="mt-2 flex items-center gap-2">
                                <span className="text-[11px] font-bold text-slate-500">Qty saya</span>
                                <button type="button" onClick={() => updateSelectedReceiptQty(item, index, selected.selectedQty - 1)} className="grid h-7 w-7 place-items-center rounded-lg bg-white font-black text-slate-700 ring-1 ring-slate-200">-</button>
                                <span className="min-w-6 text-center text-xs font-black text-slate-800">{selected.selectedQty}</span>
                                <button type="button" onClick={() => updateSelectedReceiptQty(item, index, selected.selectedQty + 1)} className="grid h-7 w-7 place-items-center rounded-lg bg-white font-black text-slate-700 ring-1 ring-slate-200">+</button>
                              </div>
                            )}
                          </div>
                          <p className="text-right text-sm font-black text-taka-ink">{currency.format(selected?.selectedAmount ?? getReceiptLineTotal(item))}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="rounded-xl bg-slate-950 p-3 text-white">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-sky-200">Pilih Item Saya</p>
                  <div className="mt-2 space-y-1 text-xs font-bold text-slate-300">
                    <div className="flex justify-between"><span>Total struk</span><span>{currency.format(receiptSplitSummary.receiptTotal)}</span></div>
                    <div className="flex justify-between"><span>{receiptSplitSummary.selectedCount} item dipilih</span><span>{currency.format(receiptSplitSummary.selectedSubtotal)}</span></div>
                    <div className="flex justify-between"><span>Alokasi pajak/service/diskon</span><span>{currency.format(receiptSplitSummary.selectedAdjustment)}</span></div>
                    <div className="flex justify-between border-t border-white/10 pt-2 text-sm text-white"><span>Nominal disimpan</span><span>{currency.format(receiptSplitMode === "selected_items" ? receiptSplitSummary.selectedTotal : total)}</span></div>
                  </div>
                  <label className="mt-3 flex items-center gap-2 text-[11px] font-bold text-slate-300">
                    <input type="checkbox" checked={receiptAdjustmentMode === "proportional"} onChange={(event) => setReceiptAdjustmentMode(event.target.checked ? "proportional" : "none")} />
                    Alokasikan pajak/service/diskon proporsional
                  </label>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-700">Item belum terbaca. Kamu tetap bisa simpan full struk atau scan ulang dengan foto lebih jelas.</div>
            )}
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
            <CustomSelect
              label="Jenis Transaksi"
              value={scanType}
              onChange={(value) => {
                const nextType = value as "expense" | "income";
                setScanType(nextType);
                const suggestedCategory = suggestReceiptCategory(scannedReceipt, categories, nextType).category;
                setSelectedScanCategoryId(suggestedCategory ? String(suggestedCategory.id) : "");
              }}
              options={[{ value: "expense", label: "Pengeluaran (Expense)" }, { value: "income", label: "Pemasukan (Income)" }]}
            />
            <div className="mt-3">
              <CustomSelect
                label="Kategori"
                value={selectedScanCategory ? String(selectedScanCategory.id) : ""}
                onChange={setSelectedScanCategoryId}
                options={[{ value: "", label: "Pilih kategori" }, ...availableScanCategories.map((category) => ({ value: String(category.id), label: category.name }))]}
              />
            </div>
            <div className="mt-3">
              <CustomSelect
                label="Akun / Dompet Pembayaran"
                value={scanPaymentAccount}
                onChange={setScanPaymentAccount}
                options={paymentAccountOptions.map((account) => ({ value: account, label: account }))}
              />
            </div>
            <p className="scan-info-panel mt-2 rounded-lg bg-sky-50 px-3 py-2 text-xs font-bold leading-5 text-sky-700">
              AI membaca pembayaran: {scannedReceipt?.payment || "tidak terbaca"}. Dompet tersimpan: {scanPaymentAccount}.
            </p>
            {selectedScanCategory && (
              <p className="scan-category-panel mt-2 rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold leading-5 text-blue-700">
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
            hasScannedReceipt && !isSavingReceipt ? "bg-sky-600 text-white hover:bg-sky-700" : "scan-save-disabled bg-slate-200 text-slate-400",
          )}
        >
          <Check size={18} />
          {isSavingReceipt ? "Menyimpan..." : "Konfirmasi Simpan"}
        </button>
      </section>

      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-xs rounded-2xl bg-white p-5 shadow-[0_8px_32px_rgba(0,0,0,0.18)] text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50">
              <Check size={22} className="text-blue-500" />
            </div>
            <p className="mt-3 text-base font-black text-taka-ink">Berhasil Disimpan!</p>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {lastSavedReceiptMessage}
            </p>
            <button
              type="button"
              onClick={() => {
                setShowSuccessModal(false);
                onNavigate("transactions");
              }}
              className="mt-4 w-full rounded-xl bg-blue-500 py-2.5 text-sm font-black text-white transition hover:bg-blue-600"
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
        headers: { 'Content-Type': 'application/json' },
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
    <div className="chat-layout grid min-w-0 gap-3 xl:grid-cols-[330px_minmax(0,1fr)] xl:gap-4">
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
              className="w-full rounded-lg bg-slate-50 px-3 py-3 text-left text-sm font-bold leading-5 text-slate-700 transition hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {question}
            </button>
          ))}
        </div>
        <div className="mt-4 rounded-xl bg-blue-50 p-4">
          <p className="text-xs font-black uppercase tracking-[0.1em] text-blue-500">Konteks aktif</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">Ringkasan Mei, top kategori, 5 transaksi terbesar, dan tren 3 bulan.</p>
        </div>
      </section>

      {/* Chat area — fills viewport on mobile, fixed height on desktop */}
      <section className="chat-shell relative flex min-h-0 min-w-0 max-w-full flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white/90 p-3 shadow-soft backdrop-blur dark:border-sky-400/20 dark:bg-slate-950/82 sm:p-4 xl:h-[620px] xl:min-h-0">
        <div className="flex items-center justify-between gap-3 border-b border-sky-100/80 pb-2.5 dark:border-sky-400/15">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-sky-400 to-blue-700 text-white shadow-[0_10px_24px_rgba(37,99,235,0.22)] xl:h-11 xl:w-11">
              <Bot size={20} />
            </div>
            <div>
              <p className="text-sm font-black text-taka-ink dark:text-white xl:text-base">Taka AI</p>
              <p className="text-[11px] font-bold text-blue-600 dark:text-sky-300 xl:text-xs">Asisten finansial aktif</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            title="Hapus riwayat chat"
            className="chat-clear-button grid h-9 w-9 shrink-0 place-items-center rounded-2xl border border-rose-100 bg-rose-50 text-rose-500 shadow-sm transition hover:bg-rose-100 hover:text-rose-600 active:scale-95 dark:border-rose-300/20 dark:bg-rose-400/10 dark:text-rose-200 xl:h-10 xl:w-10"
          >
            <Trash2 size={16} />
          </button>
        </div>

        {/* Mobile inline suggested questions — horizontal scroll pills */}
        <div className="no-scrollbar chat-suggestions-row relative z-10 -mx-1 flex shrink-0 gap-2 overflow-x-auto px-1 py-2 xl:hidden">
          {suggestedQuestions.map((question) => (
            <button
              key={question}
              type="button"
              disabled={isTyping}
              onClick={() => sendMessage(question)}
              className="chat-suggestion-pill shrink-0 rounded-full border border-sky-200 bg-sky-50/90 px-3.5 py-2 text-xs font-bold text-sky-700 shadow-sm transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:border-sky-400/20 dark:bg-sky-400/10 dark:text-sky-100"
            >
              {question}
            </button>
          ))}
        </div>

        <div ref={scrollRef} className="no-scrollbar chat-messages-scroll min-h-0 flex-1 space-y-2 overflow-y-auto py-3 scroll-smooth xl:py-4">
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
                  "max-w-[86%] px-3.5 py-2.5 text-sm font-semibold leading-5 shadow-sm",
                  message.role === "user"
                    ? "rounded-[22px_22px_6px_22px] bg-gradient-to-br from-sky-500 to-blue-700 text-white"
                    : "rounded-[22px_22px_22px_6px] bg-white text-slate-800 ring-1 ring-sky-100 dark:bg-slate-800/90 dark:text-slate-100 dark:ring-sky-400/15",
                )}
              >
                {(() => {
                  const parts = message.text.split(/(\*\*.*?\*\*)/g);
                  return (
                    <>
                      {parts.map((part, i) => {
                        if (part.startsWith('**') && part.endsWith('**')) {
                          return <strong key={i} className="font-black text-slate-950 dark:text-white">{part.slice(2, -2)}</strong>;
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
              <div className="max-w-[86%] rounded-[22px_22px_22px_6px] bg-white px-4 py-3 text-sm font-semibold leading-6 text-slate-800 shadow-sm ring-1 ring-sky-100 dark:bg-slate-800/90 dark:text-slate-100 dark:ring-sky-400/15">
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
                  className="flex-1 rounded-xl bg-rose-500/12 py-3 text-sm font-black text-rose-600 ring-1 ring-rose-200 transition hover:bg-rose-500 hover:text-white dark:bg-rose-400/10 dark:text-rose-200 dark:ring-rose-300/20 dark:hover:bg-rose-500"
                >
                  Hapus
                </button>
              </div>
            </div>
          </div>
        )}
        <form
          className="flex gap-2 border-t border-sky-100/80 pt-3 dark:border-sky-400/15 xl:pt-4"
          onSubmit={(event) => {
            event.preventDefault();
            sendMessage(draft);
          }}
        >
          <input
            value={draft}
            disabled={isTyping}
            onChange={(event) => setDraft(event.target.value)}
            className="min-w-0 flex-1 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-sky-400/20 dark:bg-slate-900/80 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:border-sky-400 dark:focus:ring-sky-400/10"
            placeholder="Tanya Taka AI…"
          />
          <button 
            type="submit" 
            disabled={isTyping || !draft.trim()} 
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-sky-500 to-blue-600 px-0 text-sm font-black text-white shadow-[0_10px_24px_rgba(37,99,235,0.22)] transition hover:to-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Kirim pesan"
          >
            <Send size={18} />
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

function ReportsView({ analytics, transactions, statements }: { analytics: ReturnType<typeof getFinanceAnalytics>; transactions: Transaction[]; statements: MonthlyStatement[] }) {
  const totalExpense = analytics.categoryBreakdown.reduce((total, item) => total + item.amount, 0);

  async function downloadStatement(id: number, fileName: string, url: string) {
    try {
      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Gagal download");

      const blob = await response.blob();
      const isNativeApp = Boolean((window as typeof window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());

      if (isNativeApp) {
        const [{ Filesystem, Directory }, { Share }] = await Promise.all([
          import("@capacitor/filesystem"),
          import("@capacitor/share"),
        ]);
        const arrayBuffer = await blob.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        let binary = "";
        const chunkSize = 0x8000;
        for (let index = 0; index < bytes.length; index += chunkSize) {
          binary += String.fromCharCode(...Array.from(bytes.subarray(index, index + chunkSize)));
        }
        const saved = await Filesystem.writeFile({
          path: fileName,
          data: btoa(binary),
          directory: Directory.Documents,
          recursive: true,
        });
        await Share.share({
          title: "Taka FinTrack E-Statement",
          text: `E-Statement ${fileName}`,
          url: saved.uri,
          dialogTitle: "Simpan atau bagikan PDF statement",
        });
        return;
      }

      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      alert("Gagal mengunduh statement. Coba update aplikasi atau buka lewat browser.");
    }
  }

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

      <section className="rounded-[28px] border border-white/70 bg-white/86 p-4 shadow-soft backdrop-blur dark:border-sky-400/15 dark:bg-[#071A33]/80">
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-blue-600 dark:text-sky-300" />
          <h3 className="text-sm font-black text-taka-ink dark:text-sky-50">Monthly E-Statement</h3>
        </div>
        <div className="mt-3 space-y-2">
          {statements.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 p-6 text-center dark:border-white/10">
              <p className="text-[11px] font-bold text-slate-500 dark:text-sky-100/40">Belum ada laporan bulanan otomatis.</p>
            </div>
          )}
          {statements.map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => downloadStatement(st.id, st.fileName, st.downloadUrl)}
              className="flex w-full items-center justify-between rounded-2xl border border-sky-100/50 bg-white p-3 shadow-sm transition active:scale-[0.98] dark:border-white/5 dark:bg-white/5"
            >
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-sky-500/15 dark:text-sky-300">
                  <FileText size={20} />
                </div>
                <div className="text-left">
                  <p className="text-xs font-black text-slate-900 dark:text-sky-50">Statement {st.periodMonth}/{st.periodYear}</p>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-sky-100/40">{st.fileName}</p>
                </div>
              </div>
              <FileDown size={18} className="text-slate-400 dark:text-sky-300/60" />
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <ReportStat label="Income Mei" value={currency.format(analytics.income)} icon={TrendingUp} tone="emerald" />
        <ReportStat label="Expense Mei" value={currency.format(analytics.expense)} icon={TrendingDown} tone="rose" />
        <ReportStat label="Rasio Hemat" value={`${analytics.savingsRatio}%`} icon={ShieldCheck} tone="blue" />
      </section>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="relative overflow-hidden rounded-[32px] border border-sky-100/80 bg-white p-4 text-slate-950 shadow-[0_26px_80px_rgba(37,99,235,0.14)] dark:border-sky-400/15 dark:bg-[#071A33] dark:text-white dark:shadow-[0_26px_80px_rgba(0,0,0,0.32)]">
          <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-sky-300/35 blur-3xl dark:bg-sky-400/18" />
          <div className="pointer-events-none absolute -bottom-28 left-0 h-64 w-64 rounded-full bg-blue-500/12 blur-3xl dark:bg-blue-600/18" />
          <div className="relative flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-sky-600 dark:text-sky-200/80">Cashflow bulanan</p>
              <h3 className="mt-1 text-xl font-black tracking-tight">Tren 6 Bulan</h3>
              <p className="mt-1 text-xs font-bold text-slate-500 dark:text-sky-100/60">Income dan expense dalam juta rupiah</p>
            </div>
            <span className="rounded-2xl bg-sky-50 px-3 py-2 text-right text-[11px] font-black text-sky-700 ring-1 ring-sky-100 dark:bg-white/10 dark:text-sky-100 dark:ring-white/12">6M</span>
          </div>
          <div className="relative mt-4 flex flex-wrap gap-2 text-[11px] font-black">
            <span className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1.5 text-cyan-700 ring-1 ring-cyan-100 dark:bg-cyan-400/12 dark:text-cyan-100 dark:ring-cyan-300/20"><span className="h-2 w-2 rounded-full bg-cyan-400" />Income</span>
            <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1.5 text-rose-700 ring-1 ring-rose-100 dark:bg-rose-400/12 dark:text-rose-100 dark:ring-rose-300/20"><span className="h-2 w-2 rounded-full bg-rose-400" />Expense</span>
          </div>
          <div className="relative mt-4 h-[340px] rounded-[26px] bg-gradient-to-b from-sky-50/90 to-white p-1 ring-1 ring-sky-100/80 dark:from-white/[0.06] dark:to-white/[0.02] dark:ring-white/10 sm:p-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.trend} margin={{ top: 18, right: 10, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="trendIncomeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22D3EE" stopOpacity={0.32} />
                    <stop offset="70%" stopColor="#22D3EE" stopOpacity={0.06} />
                    <stop offset="100%" stopColor="#22D3EE" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="trendExpenseGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FB7185" stopOpacity={0.24} />
                    <stop offset="75%" stopColor="#FB7185" stopOpacity={0.04} />
                    <stop offset="100%" stopColor="#FB7185" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.12} strokeDasharray="4 10" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "currentColor", opacity: 0.62, fontSize: 12, fontWeight: 900 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "currentColor", opacity: 0.42, fontSize: 11, fontWeight: 800 }} />
                <Tooltip content={<ChartTooltip suffix=" jt" />} />
                <Area type="monotone" dataKey="income" name="Income" stroke="#22D3EE" strokeWidth={4.5} fill="url(#trendIncomeGradient)" dot={{ r: 0 }} activeDot={{ r: 7, fill: "#22D3EE", stroke: "#fff", strokeWidth: 3 }} isAnimationActive />
                <Area type="monotone" dataKey="expense" name="Expense" stroke="#FB7185" strokeWidth={4.5} fill="url(#trendExpenseGradient)" dot={{ r: 0 }} activeDot={{ r: 7, fill: "#FB7185", stroke: "#fff", strokeWidth: 3 }} isAnimationActive />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="relative overflow-hidden rounded-[32px] border border-sky-100/80 bg-white/92 p-4 shadow-[0_24px_70px_rgba(37,99,235,0.10)] backdrop-blur-xl dark:border-transparent dark:bg-[#071A33] dark:shadow-[0_26px_80px_rgba(0,0,0,0.30)]">
          <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-sky-300/24 blur-3xl dark:bg-cyan-400/12" />
          <div className="relative">
            <SectionTitle title="Breakdown" eyebrow={currency.format(totalExpense)} />
          </div>
          <div className="relative mt-5 space-y-3">
            {analytics.categoryBreakdown.map((item) => (
              <div key={item.name} className="rounded-[22px] bg-sky-50/80 p-3 ring-1 ring-sky-100/70 dark:bg-white/[0.045] dark:ring-white/[0.07]">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2 font-black text-slate-700 dark:text-sky-50"><span className="h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_14px_currentColor]" style={{ backgroundColor: item.color, color: item.color }} /> <span className="truncate">{item.name}</span></span>
                  <span className="font-black text-slate-900 dark:text-sky-50">{currency.format(item.amount)}</span>
                </div>
                <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-sky-100/80 dark:bg-slate-900/70 dark:ring-1 dark:ring-white/[0.04]">
                  <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${item.value}%`, backgroundColor: item.color }} />
                </div>
              </div>
            ))}
            {analytics.categoryBreakdown.length === 0 && <div className="rounded-[24px] bg-blue-50 p-5 text-center text-sm font-bold text-slate-500 dark:bg-white/[0.045] dark:text-sky-100/70 dark:ring-1 dark:ring-white/[0.07]">Belum ada kategori expense bulan ini.</div>}
          </div>
        </section>
      </div>
      <section className="relative overflow-hidden rounded-[32px] border border-sky-100/80 bg-white p-4 text-slate-950 shadow-[0_26px_80px_rgba(37,99,235,0.14)] dark:border-sky-400/15 dark:bg-[#071A33] dark:text-white dark:shadow-[0_26px_80px_rgba(0,0,0,0.32)]">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-cyan-300/30 blur-3xl dark:bg-cyan-400/18" />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-sky-600 dark:text-sky-200/80">Harian</p>
            <h3 className="mt-1 text-xl font-black tracking-tight">Income vs Expense</h3>
            <p className="mt-1 text-xs font-bold text-slate-500 dark:text-sky-100/60">Pergerakan cashflow 7 hari terakhir</p>
          </div>
          <span className="rounded-2xl bg-sky-50 px-3 py-2 text-[11px] font-black text-sky-700 ring-1 ring-sky-100 dark:bg-white/10 dark:text-sky-100 dark:ring-white/12">7 Hari</span>
        </div>
        <div className="relative mt-4 flex flex-wrap gap-2 text-[11px] font-black">
          <span className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1.5 text-cyan-700 ring-1 ring-cyan-100 dark:bg-cyan-400/12 dark:text-cyan-100 dark:ring-cyan-300/20"><span className="h-2 w-2 rounded-full bg-cyan-400" />Income</span>
          <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1.5 text-rose-700 ring-1 ring-rose-100 dark:bg-rose-400/12 dark:text-rose-100 dark:ring-rose-300/20"><span className="h-2 w-2 rounded-full bg-rose-400" />Expense</span>
        </div>
        <div className="relative mt-4 h-[300px] rounded-[26px] bg-gradient-to-b from-sky-50/90 to-white p-1 ring-1 ring-sky-100/80 dark:from-white/[0.06] dark:to-white/[0.02] dark:ring-white/10 sm:p-3">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={analytics.weekly} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22D3EE" stopOpacity={0.32} />
                  <stop offset="70%" stopColor="#22D3EE" stopOpacity={0.06} />
                  <stop offset="100%" stopColor="#22D3EE" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#FB7185" stopOpacity={0.24} />
                  <stop offset="75%" stopColor="#FB7185" stopOpacity={0.04} />
                  <stop offset="100%" stopColor="#FB7185" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.12} strokeDasharray="4 10" />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "currentColor", opacity: 0.62, fontSize: 12, fontWeight: 900 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "currentColor", opacity: 0.42, fontSize: 11, fontWeight: 800 }} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="income" name="Income" stroke="#22D3EE" strokeWidth={4.5} fill="url(#incomeGradient)" dot={{ r: 0 }} activeDot={{ r: 7, fill: "#22D3EE", stroke: "#fff", strokeWidth: 3 }} isAnimationActive />
              <Area type="monotone" dataKey="expense" name="Expense" stroke="#FB7185" strokeWidth={4.5} fill="url(#expenseGradient)" dot={{ r: 0 }} activeDot={{ r: 7, fill: "#FB7185", stroke: "#fff", strokeWidth: 3 }} isAnimationActive />
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
  tone: "emerald" | "rose" | "blue";
}) {
  const toneClass = {
    emerald: "bg-blue-50 text-blue-600",
    rose: "bg-rose-50 text-rose-500",
    blue: "bg-blue-50 text-blue-600",
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
    <nav className="taka-mobile-nav fixed left-3 right-3 z-40 grid grid-cols-5 items-center gap-1 rounded-[28px] border border-white/80 bg-white/90 p-1.5 shadow-[0_18px_45px_rgba(37,99,235,0.18)] backdrop-blur-xl lg:hidden dark:border-sky-400/20 dark:bg-slate-950/88">
      {navItems.map((item) => {
        const isCenterAction = item.key === "scan";
        const isActive = activeView === item.key;

        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={clsx(
              "grid min-w-0 place-items-center gap-1 text-[10px] font-black transition active:scale-95",
              isCenterAction
                ? "-mt-5 grid h-14 w-14 rounded-[22px] bg-gradient-to-br from-[#0EA5E9] to-[#2563EB] p-0 text-white shadow-[0_14px_34px_rgba(14,165,233,0.34)]"
                : "rounded-[18px] px-1 py-2",
              !isCenterAction && (isActive ? "bg-[#EFF6FF] text-[#2563EB] dark:bg-sky-500/16 dark:text-sky-200" : "text-slate-500 dark:text-slate-300"),
            )}
            aria-label={isCenterAction ? "Tambah atau scan transaksi" : item.label}
            aria-current={isActive ? "page" : undefined}
          >
            <item.icon size={isCenterAction ? 24 : 17} />
            {!isCenterAction && <span className="truncate">{item.label}</span>}
          </button>
        );
      })}
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
      <p className="text-[11px] font-black uppercase tracking-[0.12em] text-blue-600 sm:text-xs">{eyebrow}</p>
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


type SelectOption = { value: string; label: string };

function CustomSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value) ?? options[0];
  const selectRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const close = (event: MouseEvent | TouchEvent) => {
      if (!selectRef.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, [open]);

  return (
    <div ref={selectRef} className="relative block">
      <span className="text-xs font-black uppercase tracking-[0.1em] text-slate-400 dark:text-slate-300">{label}</span>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="mt-2 flex h-12 w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 text-left text-sm font-bold text-taka-ink outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100 dark:border-sky-400/20 dark:bg-slate-950/70 dark:text-slate-100 dark:focus:border-sky-400 dark:focus:ring-sky-400/10"
        aria-expanded={open}
      >
        <span className="truncate">{selected?.label ?? "Pilih"}</span>
        <ChevronRight size={17} className={clsx("shrink-0 text-slate-400 transition", open ? "rotate-90" : "rotate-0")} />
      </button>
      {open && (
        <div className="taka-animate-panel absolute left-0 right-0 top-[calc(100%+8px)] z-[9999] max-h-72 overflow-y-auto rounded-2xl border border-blue-100 bg-white p-1.5 shadow-[0_22px_60px_rgba(15,23,42,0.22)] dark:border-sky-400/20 dark:bg-slate-950 dark:shadow-[0_22px_70px_rgba(0,0,0,0.55)]">
          {options.map((option) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={clsx(
                  "flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-black transition",
                  active ? "bg-blue-50 text-blue-700 dark:bg-sky-400/14 dark:text-sky-100" : "text-slate-600 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-900",
                )}
              >
                <span className="grid h-5 w-5 place-items-center">
                  {active && <Check size={15} strokeWidth={3} />}
                </span>
                <span className="truncate">{option.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CustomDateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const selectedDate = useMemo(() => (value ? new Date(`${value}T00:00:00`) : new Date()), [value]);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  const pickerRef = useRef<HTMLLabelElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const close = (event: MouseEvent | TouchEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setOpen(false);
    };

    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, [open]);

  useEffect(() => {
    if (open) setVisibleMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));
  }, [open, selectedDate]);

  const formatInputDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const displayDate = value
    ? selectedDate.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" })
    : "Pilih tanggal";
  const monthLabel = visibleMonth.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  const firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const offset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: offset + daysInMonth }, (_, index) => index < offset ? null : index - offset + 1);
  const today = new Date();
  const weekDays = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

  const moveMonth = (delta: number) => {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  };

  return (
    <label ref={pickerRef} className="relative block">
      <span className="text-xs font-black uppercase tracking-[0.1em] text-slate-400 dark:text-slate-300">{label}</span>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="mt-2 flex h-12 w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-taka-ink transition hover:border-blue-200 focus:border-blue-300 focus:outline-none focus:ring-4 focus:ring-blue-100 dark:border-sky-400/20 dark:bg-slate-950/70 dark:text-slate-100 dark:hover:border-sky-400/40 dark:focus:border-sky-400 dark:focus:ring-sky-400/10"
        aria-expanded={open}
      >
        <span className="min-w-0 flex-1 text-center">{displayDate}</span>
        <CalendarDays size={17} className="shrink-0 text-sky-500 dark:text-sky-300" />
      </button>

      {open && (
        <div className="taka-animate-panel absolute left-0 right-0 top-[calc(100%+8px)] z-[9999] rounded-[22px] border border-blue-100 bg-white p-3 shadow-[0_24px_70px_rgba(15,23,42,0.22)] dark:border-sky-400/18 dark:bg-slate-950 dark:text-white dark:shadow-[0_24px_80px_rgba(0,0,0,0.58)]">
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={() => moveMonth(-1)} className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-blue-700 transition hover:bg-blue-100 dark:bg-slate-900 dark:text-sky-200 dark:hover:bg-slate-800" aria-label="Bulan sebelumnya">
              <ChevronLeft size={18} />
            </button>
            <div className="text-center">
              <p className="text-sm font-black capitalize text-taka-ink dark:text-white">{monthLabel}</p>
              <p className="text-[11px] font-bold text-slate-400 dark:text-slate-400">Pilih tanggal transaksi</p>
            </div>
            <button type="button" onClick={() => moveMonth(1)} className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-blue-700 transition hover:bg-blue-100 dark:bg-slate-900 dark:text-sky-200 dark:hover:bg-slate-800" aria-label="Bulan berikutnya">
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11px] font-black uppercase text-slate-400 dark:text-slate-500">
            {weekDays.map((day) => <span key={day} className="py-1">{day}</span>)}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {cells.map((day, index) => {
              if (!day) return <span key={`empty-${index}`} className="h-9" />;
              const date = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day);
              const dateValue = formatInputDate(date);
              const isSelected = value === dateValue;
              const isToday = formatInputDate(today) === dateValue;
              return (
                <button
                  key={dateValue}
                  type="button"
                  onClick={() => {
                    onChange(dateValue);
                    setOpen(false);
                  }}
                  className={clsx(
                    "grid h-9 place-items-center rounded-xl text-sm font-black transition",
                    isSelected
                      ? "bg-gradient-to-br from-sky-400 to-blue-700 text-white shadow-[0_10px_22px_rgba(37,99,235,0.28)]"
                      : "text-slate-600 hover:bg-blue-50 hover:text-blue-700 dark:text-slate-200 dark:hover:bg-sky-400/12 dark:hover:text-sky-100",
                    isToday && !isSelected ? "ring-1 ring-sky-300/70 dark:ring-sky-400/40" : "",
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => {
                const todayValue = formatInputDate(today);
                onChange(todayValue);
                setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
                setOpen(false);
              }}
              className="flex-1 rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 transition hover:bg-blue-100 dark:bg-sky-400/12 dark:text-sky-100 dark:hover:bg-sky-400/18"
            >
              Hari ini
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex-1 rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Tutup
            </button>
          </div>
        </div>
      )}
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
  const formatNumber = (val: string) => {
    const num = val.replace(/\D/g, "");
    if (!num) return "";
    return Number(num).toLocaleString("id-ID");
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (inputMode === "numeric") {
      const raw = e.target.value.replace(/\D/g, "");
      onChange(raw);
    } else {
      onChange(e.target.value);
    }
  };

  const displayValue = inputMode === "numeric" && value ? formatNumber(value) : value;

  return (
    <label className="block relative">
      <span className="text-xs font-black uppercase tracking-[0.1em] text-slate-400">{label}</span>
      <input
        type={type}
        inputMode={inputMode}
        value={displayValue}
        placeholder={placeholder}
        onChange={handleChange}
        className={clsx(
          "mt-2 h-12 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-taka-ink outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:ring-4 focus:ring-blue-100 dark:border-sky-400/20 dark:bg-slate-950/70 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-sky-400 dark:focus:ring-sky-400/10",
          type === "date" && "relative z-10 appearance-none overflow-hidden text-center [color-scheme:light] dark:[color-scheme:dark] [&::-webkit-date-and-time-value]:m-0 [&::-webkit-date-and-time-value]:min-h-0 [&::-webkit-date-and-time-value]:text-center [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-70 dark:[&::-webkit-calendar-picker-indicator]:invert",
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
    <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-900/80 dark:ring-1 dark:ring-sky-400/15">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange?.(option)}
          className={clsx(
            "rounded-lg px-3 py-2 text-sm font-black transition",
            option === active ? "bg-white text-blue-700 shadow-sm dark:bg-sky-500/18 dark:text-sky-100" : "text-slate-500 dark:text-slate-300",
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

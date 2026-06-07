"use client";

import { useEffect, useState } from "react";

const STALE_ACTION_PATTERNS = [
  /Failed to find Server Action/i,
  /This request might be from an older or newer deployment/i,
];

function isStaleServerAction(error: Error & { digest?: string }) {
  const haystack = `${error?.message ?? ""} ${error?.digest ?? ""}`;
  return STALE_ACTION_PATTERNS.some((re) => re.test(haystack));
}

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [isStale, setIsStale] = useState(false);

  useEffect(() => {
    console.error("[app-error-boundary]", error);
    if (isStaleServerAction(error)) {
      setIsStale(true);
      // Hard reload to fetch latest build assets and Server Action IDs.
      // Use a short delay so the user sees the message briefly.
      const t = setTimeout(() => {
        window.location.reload();
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [error]);

  if (isStale) {
    return (
      <main className="min-h-screen bg-slate-950 px-5 py-10 text-slate-100">
        <section className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center text-center">
          <div className="mb-5 rounded-3xl border border-cyan-300/20 bg-white/10 px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-cyan-200 shadow-2xl shadow-cyan-950/30">
            Taka FinTrack
          </div>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Versi baru terdeteksi</h1>
          <p className="mt-4 text-sm leading-7 text-slate-300">
            Ada update aplikasi. Halaman akan dimuat ulang otomatis sebentar lagi…
          </p>
          <div className="mt-8 h-1 w-32 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-full origin-left animate-pulse bg-cyan-400" />
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-slate-100">
      <section className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center text-center">
        <div className="mb-5 rounded-3xl border border-cyan-300/20 bg-white/10 px-5 py-3 text-sm font-black uppercase tracking-[0.2em] text-cyan-200 shadow-2xl shadow-cyan-950/30">
          Taka FinTrack
        </div>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Aduh, halaman sempat error.</h1>
        <p className="mt-4 text-sm leading-7 text-slate-300">
          Tenang, data kamu tetap aman. Coba muat ulang halaman ini. Kalau masih muncul, kirim screenshot ke Vera ya.
        </p>
        {error.digest ? <p className="mt-3 text-xs text-slate-500">Kode error: {error.digest}</p> : null}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-300"
          >
            Coba Lagi
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-black text-slate-100 transition hover:bg-white/10"
          >
            Muat Ulang Halaman
          </button>
        </div>
      </section>
    </main>
  );
}

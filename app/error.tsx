"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-error-boundary]", error);
  }, [error]);

  return (
    <html lang="id">
      <body>
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
            <button
              type="button"
              onClick={reset}
              className="mt-8 rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-300"
            >
              Coba Lagi
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}

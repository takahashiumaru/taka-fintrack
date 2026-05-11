"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Taka FinTrack Error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/95 p-8 text-center shadow-2xl">
        <div className="mb-4 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <svg
              className="h-8 w-8 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
        </div>
        <h2 className="mb-2 text-xl font-black text-slate-900">
          Oops! Ada yang salah 😢
        </h2>
        <p className="mb-6 text-sm text-slate-600">
          Sepertinya ada masalah dengan aplikasi. Coba lagi atau hubungi
          administrator jika问题 terus berlanjut.
        </p>
        {error.digest && (
          <p className="mb-4 rounded bg-slate-100 px-3 py-2 text-xs font-mono text-slate-500">
            Error ID: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="inline-flex items-center justify-center rounded-xl bg-taka-cyan px-6 py-3 text-sm font-black text-white transition-all hover:bg-taka-cyan/90 active:scale-95"
        >
          Coba Lagi
        </button>
      </div>
    </div>
  );
}
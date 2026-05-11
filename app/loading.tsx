"use client";

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-taka-cyan border-t-transparent" />
        <p className="mt-4 text-sm font-bold text-slate-400">Memuat...</p>
      </div>
    </div>
  );
}
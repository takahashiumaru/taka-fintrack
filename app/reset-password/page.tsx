"use client";

import { FormEvent, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, Eye, EyeOff, KeyRound, Lock, Mail, ShieldCheck } from "lucide-react";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const params = useMemo(() => {
    if (typeof window === "undefined") return { token: "", email: "" };
    const search = new URLSearchParams(window.location.search);
    return {
      token: search.get("token") ?? "",
      email: search.get("email") ?? "",
    };
  }, []);

  const hasValidLink = Boolean(params.token && params.email);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!hasValidLink) {
      setError("Link reset tidak lengkap. Minta link baru dari halaman login.");
      return;
    }

    if (password.length < 6) {
      setError("Password baru minimal 6 karakter.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Konfirmasi password belum sama.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: params.token, email: params.email, password }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) throw new Error(data?.error || "Gagal reset password.");
      setSuccess(true);
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal reset password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_left,#e9ddff,transparent_34%),radial-gradient(circle_at_top_right,#dbfff1,transparent_30%),linear-gradient(135deg,#f8fbff,#edf4ff)] px-3 py-6 text-taka-ink">
      <section className="w-full max-w-md rounded-[28px] border border-white/75 bg-white/88 p-5 shadow-soft backdrop-blur sm:p-7">
        <div className="flex items-center gap-3">
          <Image
            src="/images/taka-logo-v2.png"
            alt="Taka FinTrack"
            width={56}
            height={56}
            unoptimized
            className="h-14 w-14 shrink-0 object-contain drop-shadow-[0_10px_22px_rgba(15,23,42,0.14)]"
          />
          <div>
            <p className="text-lg font-black">Taka FinTrack</p>
            <p className="text-xs font-bold text-slate-500">Secure password recovery</p>
          </div>
        </div>

        {success ? (
          <div className="mt-8 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-sky-50 text-sky-600">
              <CheckCircle2 size={34} />
            </div>
            <h1 className="mt-5 text-2xl font-black">Password berhasil diganti</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">Silakan login ulang dengan password baru kamu.</p>
            <Link href="/" className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-taka-navy px-5 py-4 text-sm font-black text-white shadow-float transition hover:-translate-y-0.5">
              Kembali ke Login
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-8">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-500">Reset password</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight">Buat password baru</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">Masukkan password baru untuk akun kamu. Link reset hanya berlaku 30 menit.</p>
            </div>

            <div className="mt-5 rounded-2xl border border-sky-100 bg-sky-50/70 p-4 text-sm font-bold text-sky-700">
              <div className="flex items-start gap-3">
                <ShieldCheck size={18} className="mt-0.5 shrink-0" />
                <p>Password diproses aman dan link reset tidak bisa dipakai dua kali.</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  <Mail size={14} /> Email
                </label>
                <input value={params.email} disabled className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-bold text-slate-500 outline-none" />
              </div>

              <div>
                <label className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  <KeyRound size={14} /> Password Baru
                </label>
                <div className="flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-1 focus-within:border-emerald-300 focus-within:ring-4 focus-within:ring-emerald-100">
                  <input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Minimal 6 karakter" className="min-w-0 flex-1 bg-transparent py-3 text-sm font-bold outline-none" />
                  <button type="button" onClick={() => setShowPassword((value) => !value)} className="text-slate-400">{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                </div>
              </div>

              <div>
                <label className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                  <Lock size={14} /> Konfirmasi Password
                </label>
                <div className="flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-1 focus-within:border-emerald-300 focus-within:ring-4 focus-within:ring-emerald-100">
                  <input type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Ulangi password baru" className="min-w-0 flex-1 bg-transparent py-3 text-sm font-bold outline-none" />
                  <button type="button" onClick={() => setShowConfirmPassword((value) => !value)} className="text-slate-400">{showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
                </div>
              </div>

              {error && <p className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-700">{error}</p>}

              <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-taka-navy px-5 py-4 text-sm font-black text-white shadow-float transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-wait disabled:opacity-70">
                {loading ? "Menyimpan..." : "Simpan Password Baru"}
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}

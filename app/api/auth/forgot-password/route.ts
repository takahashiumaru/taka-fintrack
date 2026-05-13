import { createHash, randomBytes } from "crypto";
import * as nodemailer from "nodemailer";
import type { RowDataPacket } from "mysql2";
import { NextResponse } from "next/server";
import { normalizeEmail } from "@/lib/server/auth";
import { ensureSchema, getPool } from "@/lib/server/db";
import { apiError, readJson } from "@/lib/server/http";
import { checkPersistentRateLimit, getClientIp } from "@/lib/server/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UserLookupRow = RowDataPacket & {
  id: number;
  name: string;
  email: string;
};

export async function POST(request: Request) {
  const body = await readJson(request);
  const email = normalizeEmail(body?.email);

  if (!email.includes("@")) return apiError("Email belum valid.");

  await ensureSchema();

  const ip = getClientIp(request);
  const ipLimit = await checkPersistentRateLimit(`forgot-password:ip:${ip}`, 5, 10 * 60_000);
  const emailLimit = await checkPersistentRateLimit(`forgot-password:email:${email}`, 3, 10 * 60_000);
  if (!ipLimit.ok || !emailLimit.ok) {
    return apiError("Terlalu banyak permintaan reset password. Coba lagi nanti.", 429);
  }

  const pool = getPool();
  const [rows] = await pool.execute<UserLookupRow[]>(
    "SELECT id, name, email FROM users WHERE email = ? LIMIT 1",
    [email],
  );

  const user = rows[0];

  // Always return success so attackers cannot enumerate registered emails.
  if (!user) return NextResponse.json({ success: true });

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashResetToken(rawToken);
  await pool.execute(
    "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 MINUTE))",
    [user.id, tokenHash],
  );

  const resetUrl = buildResetUrl(request, rawToken, user.email);
  const emailHtml = buildResetEmailHtml({ name: user.name, resetUrl });

  await sendPasswordResetEmail({ to: user.email, name: user.name, resetUrl, html: emailHtml });

  return NextResponse.json({ success: true });
}

function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function buildResetUrl(request: Request, token: string, email: string) {
  const configuredBaseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
  const origin = configuredBaseUrl || new URL(request.url).origin;
  const url = new URL("/reset-password", origin);
  url.searchParams.set("token", token);
  url.searchParams.set("email", email);
  return url.toString();
}

function buildResetEmailHtml({ name, resetUrl }: { name: string; resetUrl: string }) {
  const safeName = escapeHtml(name || "Taka FinTrack User");
  const safeUrl = escapeHtml(resetUrl);

  return `<!doctype html>
<html lang="id">
  <head>
    <meta charSet="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Reset Password Taka FinTrack</title>
  </head>
  <body style="margin:0;background:#eef6ff;font-family:Inter,Arial,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:linear-gradient(180deg,#f8fbff 0%,#eaf4ff 100%);padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:24px;overflow:hidden;border:1px solid #dbeafe;box-shadow:0 18px 45px rgba(37,99,235,.12);">
            <tr>
              <td style="background:linear-gradient(135deg,#0b1f3a 0%,#0b4aa2 54%,#04a9d8 100%);padding:30px 28px;color:#ffffff;">
                <div style="display:inline-block;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.22);border-radius:999px;padding:7px 12px;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;">Taka FinTrack</div>
                <h1 style="margin:18px 0 0;font-size:28px;line-height:1.15;font-weight:900;">Reset password akunmu</h1>
                <p style="margin:12px 0 0;color:#dbeafe;font-size:14px;line-height:1.6;">Permintaan reset password diterima. Link ini berlaku selama 30 menit.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 28px;">
                <p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:#334155;">Halo <strong style="color:#0f172a;">${safeName}</strong>,</p>
                <p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#334155;">Klik tombol di bawah untuk membuat password baru. Jika kamu tidak meminta reset password, abaikan email ini dan akunmu tetap aman.</p>
                <p style="margin:0 0 24px;text-align:center;">
                  <a href="${safeUrl}" style="display:inline-block;background:linear-gradient(135deg,#38bdf8,#2563eb);color:#ffffff;text-decoration:none;border-radius:14px;padding:14px 22px;font-size:14px;font-weight:900;box-shadow:0 10px 24px rgba(37,99,235,.28);">Reset Password</a>
                </p>
                <div style="background:#f8fbff;border:1px solid #bfdbfe;border-radius:16px;padding:14px 16px;">
                  <p style="margin:0 0 8px;font-size:12px;font-weight:900;color:#2563eb;text-transform:uppercase;letter-spacing:.08em;">Link alternatif</p>
                  <p style="margin:0;font-size:12px;line-height:1.6;color:#1d4ed8;word-break:break-all;">${safeUrl}</p>
                </div>
                <p style="margin:22px 0 0;font-size:12px;line-height:1.6;color:#94a3b8;">Demi keamanan, jangan bagikan link ini ke siapa pun. Taka FinTrack tidak pernah meminta password lewat email.</p>
              </td>
            </tr>
          </table>
          <p style="margin:18px 0 0;font-size:12px;color:#64748b;">© ${new Date().getFullYear()} Taka FinTrack. Smart personal finance assistant.</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function sendPasswordResetEmail({ to, name, resetUrl, html }: { to: string; name: string; resetUrl: string; html: string }) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || user;

  if (!host || !user || !pass || !from) {
    console.warn("[forgot-password] SMTP belum lengkap; reset email belum dikirim.", { to, configuredHost: Boolean(host), configuredUser: Boolean(user), configuredFrom: Boolean(from) });
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: `Taka FinTrack <${from}>`,
    to,
    subject: "Reset Password Taka FinTrack",
    text: `Halo ${name || "Taka FinTrack User"},\n\nKlik link berikut untuk reset password akunmu. Link berlaku 30 menit.\n\n${resetUrl}\n\nJika kamu tidak meminta reset password, abaikan email ini.`,
    html,
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

import * as nodemailer from "nodemailer";

export function getMailFrom() {
  return process.env.SMTP_FROM || process.env.SMTP_USER || "";
}

export async function sendMail({ to, subject, text, html, attachments }: { to: string; subject: string; text: string; html: string; attachments?: Array<{ filename: string; path: string; contentType?: string }> }) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = getMailFrom();

  if (!host || !user || !pass || !from) {
    console.warn("[mail] SMTP belum lengkap; email tidak dikirim.", { to, configuredHost: Boolean(host), configuredUser: Boolean(user), configuredFrom: Boolean(from) });
    return false;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: `Taka FinTrack <${from}>`,
    to,
    subject,
    text,
    html,
    attachments,
  });

  return true;
}

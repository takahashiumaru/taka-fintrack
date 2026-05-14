import * as fs from "fs/promises";
import * as path from "path";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { ensureSchema, getPool } from "./db";
import { sendMail } from "./mail";

const PDFDocument = require("pdfkit") as typeof import("pdfkit");

const statementDir = path.join(process.cwd(), "private", "statements");
const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

type UserRow = RowDataPacket & { id: number; name: string; email: string };
type TxRow = RowDataPacket & { id: number; merchant: string; category: string; amount: number; type: "income" | "expense"; transaction_date: string | null; created_at: string; payment_account: string };
type SummaryRow = RowDataPacket & { category: string; amount: number };
type BalanceRow = RowDataPacket & { income: number | null; expense: number | null };

export function previousMonthPeriod(baseDate = new Date()) {
  const year = baseDate.getMonth() === 0 ? baseDate.getFullYear() - 1 : baseDate.getFullYear();
  const month = baseDate.getMonth() === 0 ? 12 : baseDate.getMonth();
  return { year, month };
}

export function periodBounds(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, "0")}-01 00:00:00`;
  const endDate = month === 12 ? new Date(year + 1, 0, 1) : new Date(year, month, 1);
  const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-01 00:00:00`;
  return { start, end };
}

export async function generateMonthlyStatementsForPreviousMonth() {
  const period = previousMonthPeriod();
  await ensureSchema();
  const [users] = await getPool().execute<UserRow[]>("SELECT id, name, email FROM users ORDER BY id ASC");
  const results = [];
  for (const user of users) results.push(await generateMonthlyStatement(user.id, period.year, period.month, true));
  return { period, results };
}

export async function generateMonthlyStatement(userId: number, year: number, month: number, sendEmail = true) {
  await ensureSchema();
  await fs.mkdir(statementDir, { recursive: true, mode: 0o700 });
  const pool = getPool();
  const [userRows] = await pool.execute<UserRow[]>("SELECT id, name, email FROM users WHERE id = ? LIMIT 1", [userId]);
  const user = userRows[0];
  if (!user) throw new Error("User tidak ditemukan.");

  const { start, end } = periodBounds(year, month);
  const dateExpr = "COALESCE(transaction_date, created_at)";
  const [transactions] = await pool.execute<TxRow[]>(`
    SELECT id, merchant, category, amount, type, transaction_date, created_at, payment_account
    FROM transactions
    WHERE user_id = ? AND ${dateExpr} >= ? AND ${dateExpr} < ?
    ORDER BY ${dateExpr} ASC, id ASC
  `, [user.id, start, end]);
  const [beforeRows] = await pool.execute<BalanceRow[]>(`
    SELECT SUM(CASE WHEN type='income' THEN amount ELSE 0 END) AS income, SUM(CASE WHEN type='expense' THEN amount ELSE 0 END) AS expense
    FROM transactions WHERE user_id = ? AND ${dateExpr} < ?
  `, [user.id, start]);
  const openingBalance = Number(beforeRows[0]?.income ?? 0) - Number(beforeRows[0]?.expense ?? 0);
  const totalIncome = transactions.filter((t) => t.type === "income").reduce((sum, t) => sum + Number(t.amount), 0);
  const totalExpense = transactions.filter((t) => t.type === "expense").reduce((sum, t) => sum + Number(t.amount), 0);
  const netCashflow = totalIncome - totalExpense;
  const closingBalance = openingBalance + netCashflow;
  const incomeByCategory = summarize(transactions, "income");
  const expenseByCategory = summarize(transactions, "expense");
  const topExpenseCategory = expenseByCategory[0] ?? null;

  const fileName = `fintrack-statement-${user.id}-${year}-${String(month).padStart(2, "0")}.pdf`;
  const filePath = path.join(statementDir, fileName);
  await renderStatementPdf({ filePath, user, year, month, transactions, totalIncome, totalExpense, netCashflow, openingBalance, closingBalance, incomeByCategory, expenseByCategory, topExpenseCategory });

  await pool.execute<ResultSetHeader>(`
    INSERT INTO monthly_statements (user_id, period_year, period_month, file_name, file_path, total_income, total_expense, net_cashflow, opening_balance, closing_balance, emailed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${sendEmail ? "NOW()" : "NULL"})
    ON DUPLICATE KEY UPDATE file_name=VALUES(file_name), file_path=VALUES(file_path), total_income=VALUES(total_income), total_expense=VALUES(total_expense), net_cashflow=VALUES(net_cashflow), opening_balance=VALUES(opening_balance), closing_balance=VALUES(closing_balance), emailed_at=${sendEmail ? "NOW()" : "emailed_at"}
  `, [user.id, year, month, fileName, filePath, totalIncome, totalExpense, netCashflow, openingBalance, closingBalance]);

  if (sendEmail) await emailStatement(user, year, month, fileName, filePath);
  return { userId: user.id, fileName, filePath, totalIncome, totalExpense, transactionCount: transactions.length };
}

function summarize(transactions: TxRow[], type: "income" | "expense"): SummaryRow[] {
  const map = new Map<string, number>();
  for (const tx of transactions.filter((item) => item.type === type)) map.set(tx.category, (map.get(tx.category) ?? 0) + Number(tx.amount));
  return Array.from(map.entries()).map(([category, amount]) => ({ category, amount }) as SummaryRow).sort((a, b) => b.amount - a.amount);
}

async function emailStatement(user: UserRow, year: number, month: number, fileName: string, filePath: string) {
  const periodLabel = `${monthNames[month - 1]} ${year}`;
  await sendMail({
    to: user.email,
    subject: `FinTrack Monthly E-Statement - ${periodLabel}`,
    text: `Halo ${user.name},\n\nMonthly E-Statement FinTrack untuk periode ${periodLabel} sudah tersedia. File PDF terlampir pada email ini.\n\nSalam,\nTaka FinTrack`,
    html: `<div style="font-family:Inter,Arial,sans-serif;color:#0f172a;line-height:1.7"><h2 style="color:#0b4aa2">Monthly E-Statement ${periodLabel}</h2><p>Halo <b>${escapeHtml(user.name)}</b>,</p><p>Laporan keuangan bulan sebelumnya sudah tersedia. File PDF e-statement terlampir pada email ini.</p><p style="font-size:12px;color:#64748b">Email ini dikirim otomatis oleh Taka FinTrack.</p></div>`,
    attachments: [{ filename: fileName, path: filePath, contentType: "application/pdf" }],
  });
}

async function renderStatementPdf(input: { filePath: string; user: UserRow; year: number; month: number; transactions: TxRow[]; totalIncome: number; totalExpense: number; netCashflow: number; openingBalance: number; closingBalance: number; incomeByCategory: SummaryRow[]; expenseByCategory: SummaryRow[]; topExpenseCategory: SummaryRow | null }) {
  const doc = new PDFDocument({ size: "A4", margin: 42, info: { Title: `FinTrack Statement ${input.year}-${input.month}` } });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));
  const blue = "#0B4AA2", cyan = "#04A9D8", navy = "#071A33", muted = "#64748B", line = "#DBEAFE";
  const periodLabel = `${monthNames[input.month - 1]} ${input.year}`;

  doc.rect(0, 0, 595, 118).fill(navy);
  doc.fillColor("white").fontSize(20).font("Helvetica-Bold").text("Taka FinTrack", 42, 34);
  doc.fillColor("#BAE6FD").fontSize(10).text("MONTHLY E-STATEMENT", 42, 60);
  doc.fillColor("white").fontSize(12).text(`Periode: ${periodLabel}`, 390, 38, { align: "right", width: 160 });
  doc.fillColor("#BAE6FD").fontSize(9).text(`File dibuat: ${formatDate(new Date())}`, 390, 58, { align: "right", width: 160 });

  let y = 142;
  doc.fillColor(navy).fontSize(14).font("Helvetica-Bold").text(input.user.name, 42, y);
  doc.fillColor(muted).fontSize(9).font("Helvetica").text(input.user.email, 42, y + 18);
  y += 52;
  const cards = [["Saldo Awal", input.openingBalance], ["Pemasukan", input.totalIncome], ["Pengeluaran", input.totalExpense], ["Saldo Akhir", input.closingBalance]] as const;
  cards.forEach(([label, value], i) => drawCard(doc, 42 + i * 128, y, 116, 62, label, rupiah(value), i === 2 ? "#E11D48" : i === 1 ? cyan : blue));
  y += 86;
  drawCard(doc, 42, y, 244, 54, "Net Cashflow", rupiah(input.netCashflow), input.netCashflow >= 0 ? cyan : "#E11D48");
  drawCard(doc, 304, y, 244, 54, "Kategori Pengeluaran Terbesar", input.topExpenseCategory ? `${input.topExpenseCategory.category} • ${rupiah(input.topExpenseCategory.amount)}` : "-", blue, 9);
  y += 78;

  doc.fillColor(navy).fontSize(12).font("Helvetica-Bold").text("Ringkasan Kategori", 42, y); y += 20;
  y = drawSummary(doc, 42, y, "Pemasukan", input.incomeByCategory, cyan);
  y = drawSummary(doc, 304, y - Math.min(input.incomeByCategory.length, 4) * 16 - 22, "Pengeluaran", input.expenseByCategory, "#E11D48");
  y += 24;

  doc.fillColor(navy).fontSize(12).font("Helvetica-Bold").text("Daftar Transaksi", 42, y); y += 18;
  drawTableHeader(doc, y); y += 18;
  if (input.transactions.length === 0) {
    doc.fillColor(muted).fontSize(10).text("Tidak ada transaksi pada periode ini.", 52, y + 10);
    y += 42;
  } else {
    for (const tx of input.transactions) {
      if (y > 742) { doc.addPage(); y = 54; drawTableHeader(doc, y); y += 18; }
      doc.fillColor("#0f172a").fontSize(8).font("Helvetica").text(formatDate(tx.transaction_date || tx.created_at), 48, y, { width: 62 });
      doc.text(tx.merchant, 116, y, { width: 134 });
      doc.text(tx.category, 254, y, { width: 94 });
      doc.text(tx.payment_account || "Cash", 352, y, { width: 72 });
      doc.fillColor(tx.type === "income" ? "#0891B2" : "#E11D48").font("Helvetica-Bold").text(`${tx.type === "income" ? "+" : "-"}${rupiah(tx.amount)}`, 428, y, { width: 120, align: "right" });
      doc.moveTo(42, y + 15).lineTo(550, y + 15).strokeColor(line).lineWidth(0.5).stroke();
      y += 20;
    }
  }
  doc.fillColor(muted).fontSize(8).text(`Dibuat otomatis oleh Taka FinTrack pada ${formatDate(new Date())}. Laporan ini bersifat informasi pribadi dan hanya untuk pemilik akun.`, 42, 782, { width: 508, align: "center" });
  doc.end();
  await fs.writeFile(input.filePath, await done, { mode: 0o600 });
}

function drawCard(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, label: string, value: string, color: string, size = 12) {
  doc.roundedRect(x, y, w, h, 12).fillAndStroke("#F8FBFF", "#DBEAFE");
  doc.fillColor("#64748B").fontSize(7).font("Helvetica-Bold").text(label.toUpperCase(), x + 12, y + 12, { width: w - 24 });
  doc.fillColor(color).fontSize(size).font("Helvetica-Bold").text(value, x + 12, y + 30, { width: w - 24 });
}

function drawSummary(doc: PDFKit.PDFDocument, x: number, y: number, title: string, rows: SummaryRow[], color: string) {
  doc.fillColor(color).fontSize(9).font("Helvetica-Bold").text(title, x, y); y += 16;
  if (!rows.length) { doc.fillColor("#64748B").fontSize(8).font("Helvetica").text("Tidak ada data.", x, y); return y + 16; }
  for (const row of rows.slice(0, 5)) { doc.fillColor("#0f172a").fontSize(8).font("Helvetica").text(row.category, x, y, { width: 130 }); doc.font("Helvetica-Bold").text(rupiah(row.amount), x + 138, y, { width: 72, align: "right" }); y += 16; }
  return y;
}

function drawTableHeader(doc: PDFKit.PDFDocument, y: number) {
  doc.roundedRect(42, y - 4, 508, 18, 6).fill("#EAF4FF");
  doc.fillColor("#0B4AA2").fontSize(7).font("Helvetica-Bold").text("Tanggal", 48, y).text("Merchant", 116, y).text("Kategori", 254, y).text("Akun", 352, y).text("Nominal", 428, y, { width: 120, align: "right" });
}

function rupiah(value: number) { return `Rp ${Math.round(value).toLocaleString("id-ID")}`; }
function formatDate(value: Date | string) { return new Date(value).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }); }
function escapeHtml(value: string) { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;"); }

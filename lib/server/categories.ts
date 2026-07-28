import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getPool } from "./db";

export type CategoryType = "income" | "expense" | "both";

export type CategoryRow = RowDataPacket & {
  id: number;
  name: string;
  type: CategoryType;
  color: string;
  transaction_count?: number;
};

const defaultCategories: Array<{ name: string; type: CategoryType; color: string }> = [
  { name: "Makanan & Minuman", type: "expense", color: "#22C55E" },
  { name: "Belanja Bulanan", type: "expense", color: "#10B981" },
  { name: "Transportasi", type: "expense", color: "#F59E0B" },
  { name: "Tagihan & Utilitas", type: "expense", color: "#06B6D4" },
  { name: "Hiburan", type: "expense", color: "#FF6B6B" },
  { name: "Kesehatan", type: "expense", color: "#EF4444" },
  { name: "Pendidikan", type: "expense", color: "#3B82F6" },
  { name: "Cicilan & Hutang", type: "expense", color: "#6366F1" },
  { name: "Pakaian & Penampilan", type: "expense", color: "#EC4899" },
  { name: "Peralatan Rumah", type: "expense", color: "#8B5CF6" },
  { name: "Keluarga & Pasangan", type: "expense", color: "#D946EF" },
  { name: "Donasi & Amal", type: "expense", color: "#14B8A6" },
  { name: "Pengeluaran Lain", type: "expense", color: "#94A3B8" },
  { name: "Gaji", type: "income", color: "#059669" },
  { name: "Bonus & THR", type: "income", color: "#0284C7" },
  { name: "Pekerjaan Sampingan", type: "income", color: "#8B5CF6" },
  { name: "Hasil Investasi", type: "income", color: "#EAB308" },
  { name: "Penjualan Barang", type: "income", color: "#F97316" },
  { name: "Hadiah & Pemberian", type: "income", color: "#F43F5E" },
  { name: "Pemasukan Lain", type: "income", color: "#64748B" },
];

export async function ensureUserCategories(userId: number) {
  const pool = getPool();

  if (defaultCategories.length === 0) return;

  try {
    // Check if categories already exist to avoid unnecessary INSERT IGNORE locks
    const [existing] = await pool.execute<RowDataPacket[]>(
      "SELECT 1 FROM categories WHERE user_id = ? LIMIT 1",
      [userId]
    );

    if (existing.length > 0) {
      return;
    }

    const placeholders = defaultCategories.map(() => "(?, ?, ?, ?)").join(", ");
    const values = defaultCategories.flatMap((c) => [userId, c.name, c.type, c.color]);

    await pool.execute<ResultSetHeader>(
      `
        INSERT IGNORE INTO categories (user_id, name, type, color)
        VALUES ${placeholders}
      `,
      values,
    );
  } catch (error: unknown) {
    console.error("ensureUserCategories error:", error);
  }
}

export function toApiCategory(row: CategoryRow) {
  return {
    id: Number(row.id),
    name: row.name,
    type: row.type,
    color: row.color,
    transactionCount: Number(row.transaction_count ?? 0),
  };
}

export function normalizeCategoryType(value: unknown): CategoryType {
  return value === "income" || value === "both" ? value : "expense";
}

export function normalizeCategoryColor(value: unknown) {
  if (typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value.trim())) {
    return value.trim().toUpperCase();
  }

  return "#64748B";
}

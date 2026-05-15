import mysql, { type Pool, type RowDataPacket } from "mysql2/promise";

declare global {
  // eslint-disable-next-line no-var
  var takaFinTrackPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var takaFinTrackSchemaReady: Promise<void> | undefined;
}

export function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL belum diset. Isi .env.local dulu.");
  }

  if (!globalThis.takaFinTrackPool) {
    globalThis.takaFinTrackPool = mysql.createPool({
      uri: process.env.DATABASE_URL,
      connectionLimit: 10,
      decimalNumbers: true,
      enableKeepAlive: true,
    });
  }

  return globalThis.takaFinTrackPool;
}

export async function ensureSchema() {
  if (!globalThis.takaFinTrackSchemaReady) {
    globalThis.takaFinTrackSchemaReady = createSchema();
  }

  return globalThis.takaFinTrackSchemaReady;
}

async function createSchema() {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(190) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      avatar_url MEDIUMTEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY users_email_unique (email)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL,
      name VARCHAR(120) NOT NULL,
      type ENUM('income','expense','both') NOT NULL DEFAULT 'expense',
      color VARCHAR(16) NOT NULL DEFAULT '#64748B',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY categories_user_name_unique (user_id, name),
      KEY categories_user_id_idx (user_id),
      CONSTRAINT categories_user_fk
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL,
      category_id BIGINT UNSIGNED NULL,
      merchant VARCHAR(160) NOT NULL,
      category VARCHAR(120) NOT NULL,
      amount BIGINT UNSIGNED NOT NULL,
      type ENUM('income','expense') NOT NULL,
      transaction_date DATETIME NULL,
      source ENUM('Manual','Scan') NOT NULL DEFAULT 'Manual',
      payment_account VARCHAR(80) NOT NULL DEFAULT 'Cash',
      receipt_total_amount DECIMAL(14,2) NULL,
      receipt_selected_amount DECIMAL(14,2) NULL,
      receipt_split_mode ENUM('full_receipt','selected_items') NOT NULL DEFAULT 'full_receipt',
      receipt_items_json JSON NULL,
      receipt_selected_items_json JSON NULL,
      receipt_adjustment_amount DECIMAL(14,2) NULL,
      receipt_adjustment_note VARCHAR(190) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY transactions_user_id_idx (user_id),
      KEY transactions_category_id_idx (category_id),
      CONSTRAINT transactions_user_fk
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await addColumnIfMissing("transactions", "category_id", "ADD COLUMN category_id BIGINT UNSIGNED NULL AFTER user_id");
  await addColumnIfMissing("transactions", "payment_account", "ADD COLUMN payment_account VARCHAR(80) NOT NULL DEFAULT 'Cash' AFTER source");
  await addColumnIfMissing("transactions", "receipt_total_amount", "ADD COLUMN receipt_total_amount DECIMAL(14,2) NULL AFTER payment_account");
  await addColumnIfMissing("transactions", "receipt_selected_amount", "ADD COLUMN receipt_selected_amount DECIMAL(14,2) NULL AFTER receipt_total_amount");
  await addColumnIfMissing("transactions", "receipt_split_mode", "ADD COLUMN receipt_split_mode ENUM('full_receipt','selected_items') NOT NULL DEFAULT 'full_receipt' AFTER receipt_selected_amount");
  await addColumnIfMissing("transactions", "receipt_items_json", "ADD COLUMN receipt_items_json JSON NULL AFTER receipt_split_mode");
  await addColumnIfMissing("transactions", "receipt_selected_items_json", "ADD COLUMN receipt_selected_items_json JSON NULL AFTER receipt_items_json");
  await addColumnIfMissing("transactions", "receipt_adjustment_amount", "ADD COLUMN receipt_adjustment_amount DECIMAL(14,2) NULL AFTER receipt_selected_items_json");
  await addColumnIfMissing("transactions", "receipt_adjustment_note", "ADD COLUMN receipt_adjustment_note VARCHAR(190) NULL AFTER receipt_adjustment_amount");
  await addIndexIfMissing("transactions", "transactions_category_id_idx", "ADD INDEX transactions_category_id_idx (category_id)");
  await addIndexIfMissing("transactions", "transactions_date_idx", "ADD INDEX transactions_date_idx (transaction_date)");
  await addIndexIfMissing(
    "transactions",
    "transactions_user_date_created_id_idx",
    "ADD INDEX transactions_user_date_created_id_idx (user_id, transaction_date, created_at, id)",
  );

  await pool.query(`
    CREATE TABLE IF NOT EXISTS monthly_statements (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL,
      period_year SMALLINT UNSIGNED NOT NULL,
      period_month TINYINT UNSIGNED NOT NULL,
      file_name VARCHAR(190) NOT NULL,
      file_path VARCHAR(500) NOT NULL,
      total_income BIGINT NOT NULL DEFAULT 0,
      total_expense BIGINT NOT NULL DEFAULT 0,
      net_cashflow BIGINT NOT NULL DEFAULT 0,
      opening_balance BIGINT NOT NULL DEFAULT 0,
      closing_balance BIGINT NOT NULL DEFAULT 0,
      emailed_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY monthly_statements_user_period_unique (user_id, period_year, period_month),
      KEY monthly_statements_user_id_idx (user_id),
      CONSTRAINT monthly_statements_user_fk
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL,
      token_hash VARCHAR(255) NOT NULL,
      expires_at DATETIME NOT NULL,
      used_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY password_reset_tokens_hash_unique (token_hash),
      KEY password_reset_tokens_user_id_idx (user_id),
      CONSTRAINT password_reset_tokens_user_fk
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.execute("DELETE FROM password_reset_tokens WHERE expires_at < NOW()");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS rate_limit_buckets (
      rate_key VARCHAR(255) NOT NULL,
      count INT UNSIGNED NOT NULL DEFAULT 0,
      reset_at DATETIME NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (rate_key),
      KEY rate_limit_buckets_reset_at_idx (reset_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.execute("DELETE FROM rate_limit_buckets WHERE reset_at < NOW()");

  await pool.query(`
    CREATE TABLE IF NOT EXISTS receipt_scans (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL,
      merchant VARCHAR(160) NOT NULL,
      receipt_date VARCHAR(80) NULL,
      payment VARCHAR(60) NULL,
      subtotal BIGINT UNSIGNED NOT NULL DEFAULT 0,
      discount BIGINT UNSIGNED NOT NULL DEFAULT 0,
      total BIGINT UNSIGNED NOT NULL DEFAULT 0,
      confidence TINYINT UNSIGNED NOT NULL DEFAULT 0,
      source ENUM('ocr','demo') NOT NULL DEFAULT 'ocr',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY receipt_scans_user_id_idx (user_id),
      CONSTRAINT receipt_scans_user_fk
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS receipt_items (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      receipt_scan_id BIGINT UNSIGNED NOT NULL,
      name VARCHAR(180) NOT NULL,
      qty INT UNSIGNED NOT NULL DEFAULT 1,
      price BIGINT UNSIGNED NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY receipt_items_scan_id_idx (receipt_scan_id),
      CONSTRAINT receipt_items_scan_fk
        FOREIGN KEY (receipt_scan_id) REFERENCES receipt_scans(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function addColumnIfMissing(tableName: string, columnName: string, alterClause: string) {
  const pool = getPool();
  const [rows] = await pool.execute<Array<RowDataPacket & { column_exists: number }>>(
    `
      SELECT COUNT(*) AS column_exists
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
    `,
    [tableName, columnName],
  );

  if (Number(rows[0]?.column_exists ?? 0) === 0) {
    await pool.query(`ALTER TABLE ${tableName} ${alterClause}`);
  }
}

async function addIndexIfMissing(tableName: string, indexName: string, alterClause: string) {
  const pool = getPool();
  const [rows] = await pool.execute<Array<RowDataPacket & { index_exists: number }>>(
    `
      SELECT COUNT(*) AS index_exists
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND INDEX_NAME = ?
    `,
    [tableName, indexName],
  );

  if (Number(rows[0]?.index_exists ?? 0) === 0) {
    await pool.query(`ALTER TABLE ${tableName} ${alterClause}`);
  }
}

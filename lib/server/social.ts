import type { PoolConnection, ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { normalizeEmail, normalizeString, type ApiUser } from "./auth";
import { ensureUserCategories } from "./categories";
import { getPool } from "./db";
import { normalizeReceiptMetadata, parseJsonArray } from "./receipt-metadata";

export class SocialError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

type UserLookupRow = RowDataPacket & {
  id: number;
  name: string;
  email: string;
  avatar_url: string | null;
};

type FriendshipRow = RowDataPacket & {
  id: number;
  requester_user_id: number;
  requester_name: string;
  requester_email: string;
  requester_avatar_url: string | null;
  recipient_user_id: number;
  recipient_name: string;
  recipient_email: string;
  recipient_avatar_url: string | null;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  updated_at: string;
};

type NotificationRow = RowDataPacket & {
  id: number;
  recipient_user_id: number;
  actor_user_id: number | null;
  actor_name: string | null;
  actor_email: string | null;
  actor_avatar_url: string | null;
  type: "friend_request" | "split_request";
  status: "unread" | "read" | "accepted" | "rejected" | "cancelled";
  title: string;
  message: string;
  payload_json: string | Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type SplitRequestRow = RowDataPacket & {
  id: number;
  sender_user_id: number;
  sender_name: string;
  sender_email: string;
  sender_avatar_url: string | null;
  recipient_user_id: number;
  sender_transaction_id: number | null;
  recipient_transaction_id: number | null;
  notification_id: number | null;
  merchant: string;
  category: string;
  amount: number;
  sender_amount: number;
  receipt_total_amount: number | null;
  transaction_date: string | null;
  payment_account: string;
  receipt_items_json: string | null;
  recipient_items_json: string | null;
  sender_items_json: string | null;
  receipt_adjustment_amount: number | null;
  receipt_adjustment_note: string | null;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  created_at: string;
  updated_at: string;
};

type SplitRequestInput = {
  recipientEmail?: unknown;
  recipientUserId?: unknown;
  recipients?: unknown;
  merchant?: unknown;
  category?: unknown;
  amount?: unknown;
  senderAmount?: unknown;
  receiptTotalAmount?: unknown;
  transactionDate?: unknown;
  paymentAccount?: unknown;
  receiptItems?: unknown;
  recipientItems?: unknown;
  senderItems?: unknown;
  receiptAdjustmentAmount?: unknown;
  receiptAdjustmentNote?: unknown;
};

const maxSplitJsonLength = 20_000;

export async function listFriends(userId: number) {
  const [rows] = await getPool().execute<FriendshipRow[]>(
    `
      SELECT
        f.id,
        f.requester_user_id,
        requester.name AS requester_name,
        requester.email AS requester_email,
        requester.avatar_url AS requester_avatar_url,
        f.recipient_user_id,
        recipient.name AS recipient_name,
        recipient.email AS recipient_email,
        recipient.avatar_url AS recipient_avatar_url,
        f.status,
        f.created_at,
        f.updated_at
      FROM friendships f
      JOIN users requester ON requester.id = f.requester_user_id
      JOIN users recipient ON recipient.id = f.recipient_user_id
      WHERE f.requester_user_id = ? OR f.recipient_user_id = ?
      ORDER BY f.updated_at DESC, f.id DESC
    `,
    [userId, userId],
  );

  const friends = rows.filter((row) => row.status === "accepted").map((row) => toFriend(row, userId));
  const pendingIncoming = rows.filter((row) => row.status === "pending" && Number(row.recipient_user_id) === userId).map((row) => toFriend(row, userId));
  const pendingOutgoing = rows.filter((row) => row.status === "pending" && Number(row.requester_user_id) === userId).map((row) => toFriend(row, userId));

  return { friends, pendingIncoming, pendingOutgoing };
}

export async function createFriendRequest(actor: ApiUser, emailValue: unknown) {
  const email = normalizeEmail(emailValue);
  if (!email) throw new SocialError("Email teman wajib diisi.");

  const recipient = await findUserByEmail(email);
  if (!recipient) throw new SocialError("Email belum terdaftar di Taka.", 404);
  if (recipient.id === actor.id) throw new SocialError("Tidak bisa menambahkan diri sendiri.");

  const pairKey = getPairKey(actor.id, recipient.id);
  const connection = await getPool().getConnection();

  try {
    await connection.beginTransaction();

    const [existingRows] = await connection.execute<FriendshipRow[]>(
      `
        SELECT
          f.id,
          f.requester_user_id,
          requester.name AS requester_name,
          requester.email AS requester_email,
          requester.avatar_url AS requester_avatar_url,
          f.recipient_user_id,
          recipient.name AS recipient_name,
          recipient.email AS recipient_email,
          recipient.avatar_url AS recipient_avatar_url,
          f.status,
          f.created_at,
          f.updated_at
        FROM friendships f
        JOIN users requester ON requester.id = f.requester_user_id
        JOIN users recipient ON recipient.id = f.recipient_user_id
        WHERE f.pair_key = ?
        LIMIT 1
        FOR UPDATE
      `,
      [pairKey],
    );
    const existing = existingRows[0];

    if (existing?.status === "accepted") throw new SocialError("Kalian sudah berteman.", 409);
    if (existing?.status === "pending" && Number(existing.requester_user_id) === actor.id) {
      await connection.rollback();
      return { friendship: toFriend(existing, actor.id), alreadyPending: true };
    }
    if (existing?.status === "pending" && Number(existing.recipient_user_id) === actor.id) {
      throw new SocialError("User ini sudah mengirim request. Buka Notifikasi untuk accept.", 409);
    }

    let friendshipId = Number(existing?.id ?? 0);
    if (friendshipId > 0) {
      await connection.execute(
        `
          UPDATE friendships
          SET requester_user_id = ?, recipient_user_id = ?, status = 'pending', responded_at = NULL
          WHERE id = ?
        `,
        [actor.id, recipient.id, friendshipId],
      );
    } else {
      const [result] = await connection.execute<ResultSetHeader>(
        `
          INSERT INTO friendships (requester_user_id, recipient_user_id, pair_key, status)
          VALUES (?, ?, ?, 'pending')
        `,
        [actor.id, recipient.id, pairKey],
      );
      friendshipId = result.insertId;
    }

    await connection.execute(
      `
        INSERT INTO notifications (recipient_user_id, actor_user_id, type, title, message, payload_json)
        VALUES (?, ?, 'friend_request', ?, ?, ?)
      `,
      [
        recipient.id,
        actor.id,
        "Permintaan teman",
        `${actor.name} ingin berteman denganmu.`,
        JSON.stringify({ friendshipId }),
      ],
    );

    await connection.commit();

    return { friendship: await getFriendshipById(friendshipId, actor.id), alreadyPending: false };
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      // Ignore rollback errors; the original error is more useful.
    }
    throw error;
  } finally {
    connection.release();
  }
}

export async function actOnFriendship(userId: number, friendshipId: number, action: "accept" | "reject") {
  if (!Number.isFinite(friendshipId) || friendshipId <= 0) throw new SocialError("Friend request tidak valid.");

  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute<FriendshipRow[]>(
      `
        SELECT
          f.id,
          f.requester_user_id,
          requester.name AS requester_name,
          requester.email AS requester_email,
          requester.avatar_url AS requester_avatar_url,
          f.recipient_user_id,
          recipient.name AS recipient_name,
          recipient.email AS recipient_email,
          recipient.avatar_url AS recipient_avatar_url,
          f.status,
          f.created_at,
          f.updated_at
        FROM friendships f
        JOIN users requester ON requester.id = f.requester_user_id
        JOIN users recipient ON recipient.id = f.recipient_user_id
        WHERE f.id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [friendshipId],
    );
    const friendship = rows[0];

    if (!friendship) throw new SocialError("Friend request tidak ditemukan.", 404);
    if (Number(friendship.recipient_user_id) !== userId) throw new SocialError("Kamu tidak bisa memproses request ini.", 403);
    if (friendship.status !== "pending") {
      await connection.rollback();
      return { friendship: toFriend(friendship, userId), unchanged: true };
    }

    const nextStatus = action === "accept" ? "accepted" : "declined";
    const notificationStatus = action === "accept" ? "accepted" : "rejected";

    await connection.execute(
      "UPDATE friendships SET status = ?, responded_at = NOW() WHERE id = ?",
      [nextStatus, friendshipId],
    );
    await connection.execute(
      `
        UPDATE notifications
        SET status = ?, read_at = COALESCE(read_at, NOW()), acted_at = NOW()
        WHERE recipient_user_id = ?
          AND type = 'friend_request'
          AND JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.friendshipId')) = ?
      `,
      [notificationStatus, userId, String(friendshipId)],
    );
    await connection.commit();

    return { friendship: await getFriendshipById(friendshipId, userId), unchanged: false };
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      // Ignore rollback errors.
    }
    throw error;
  } finally {
    connection.release();
  }
}

export async function deleteFriendship(userId: number, friendshipId: number) {
  if (!Number.isFinite(friendshipId) || friendshipId <= 0) throw new SocialError("Teman tidak valid.");

  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute<FriendshipRow[]>(
      `
        SELECT
          f.id,
          f.requester_user_id,
          requester.name AS requester_name,
          requester.email AS requester_email,
          requester.avatar_url AS requester_avatar_url,
          f.recipient_user_id,
          recipient.name AS recipient_name,
          recipient.email AS recipient_email,
          recipient.avatar_url AS recipient_avatar_url,
          f.status,
          f.created_at,
          f.updated_at
        FROM friendships f
        JOIN users requester ON requester.id = f.requester_user_id
        JOIN users recipient ON recipient.id = f.recipient_user_id
        WHERE f.id = ?
        LIMIT 1
        FOR UPDATE
      `,
      [friendshipId],
    );
    const friendship = rows[0];

    if (!friendship) throw new SocialError("Teman tidak ditemukan.", 404);
    if (Number(friendship.requester_user_id) !== userId && Number(friendship.recipient_user_id) !== userId) {
      throw new SocialError("Kamu tidak bisa menghapus relasi ini.", 403);
    }

    await connection.execute("DELETE FROM friendships WHERE id = ?", [friendshipId]);
    await connection.execute(
      `
        UPDATE notifications
        SET status = 'cancelled', read_at = COALESCE(read_at, NOW()), acted_at = NOW()
        WHERE type = 'friend_request'
          AND status IN ('unread', 'read')
          AND JSON_UNQUOTE(JSON_EXTRACT(payload_json, '$.friendshipId')) = ?
      `,
      [String(friendshipId)],
    );
    await connection.commit();

    return { success: true, friendshipId };
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      // Ignore rollback errors.
    }
    throw error;
  } finally {
    connection.release();
  }
}

export async function listNotifications(userId: number) {
  const [rows] = await getPool().execute<NotificationRow[]>(
    `
      SELECT
        n.id,
        n.recipient_user_id,
        n.actor_user_id,
        actor.name AS actor_name,
        actor.email AS actor_email,
        actor.avatar_url AS actor_avatar_url,
        n.type,
        n.status,
        n.title,
        n.message,
        n.payload_json,
        n.created_at,
        n.updated_at
      FROM notifications n
      LEFT JOIN users actor ON actor.id = n.actor_user_id
      WHERE n.recipient_user_id = ?
      ORDER BY n.created_at DESC, n.id DESC
      LIMIT 80
    `,
    [userId],
  );

  const splitIds = rows
    .map((row) => Number(parsePayload(row.payload_json).splitRequestId ?? 0))
    .filter((id) => id > 0);
  const splitMap = await getSplitRequestMap(splitIds);
  const notifications = rows.map((row) => {
    const notification = toNotification(row);
    const splitRequestId = Number(notification.payload?.splitRequestId ?? 0);
    return splitRequestId > 0 && splitMap.has(splitRequestId)
      ? { ...notification, splitRequest: splitMap.get(splitRequestId) }
      : notification;
  });
  const unreadCount = notifications.filter((item) => item.status === "unread").length;
  const actionableCount = notifications.filter((item) => item.status === "unread" || item.status === "read").length;

  return { notifications, unreadCount, actionableCount };
}

export async function actOnNotification(userId: number, notificationId: number, action: "read" | "accept" | "reject") {
  if (!Number.isFinite(notificationId) || notificationId <= 0) throw new SocialError("Notifikasi tidak valid.");

  const notification = await getNotificationById(userId, notificationId);
  if (!notification) throw new SocialError("Notifikasi tidak ditemukan.", 404);

  if (action === "read") {
    await getPool().execute(
      "UPDATE notifications SET status = IF(status = 'unread', 'read', status), read_at = COALESCE(read_at, NOW()) WHERE id = ? AND recipient_user_id = ?",
      [notificationId, userId],
    );
    return { notification: await getNotificationById(userId, notificationId) };
  }

  if (notification.type === "friend_request") {
    const friendshipId = Number(notification.payload?.friendshipId ?? 0);
    const result = await actOnFriendship(userId, friendshipId, action);
    return { ...result, notification: await getNotificationById(userId, notificationId) };
  }

  if (notification.type === "split_request") {
    const splitRequestId = Number(notification.payload?.splitRequestId ?? 0);
    const result = await actOnSplitRequest(userId, splitRequestId, action);
    return { ...result, notification: await getNotificationById(userId, notificationId) };
  }

  throw new SocialError("Tipe notifikasi belum didukung.");
}

export async function createSplitRequest(sender: ApiUser, input: SplitRequestInput) {
  const recipientsInput = Array.isArray(input.recipients) ? input.recipients : [];
  if (recipientsInput.length > 0) {
    return createSplitRequestsBatch(sender, input, recipientsInput);
  }

  const recipient = await resolveSplitRecipient(sender.id, input);
  const merchant = normalizeString(input.merchant).slice(0, 160);
  const category = normalizeString(input.category).slice(0, 120);
  const amount = normalizeMoney(input.amount);
  const senderAmount = normalizeMoney(input.senderAmount);
  const receiptTotalAmount = normalizeMoney(input.receiptTotalAmount);
  const transactionDate = normalizeTransactionDate(input.transactionDate);
  const paymentAccount = normalizeString(input.paymentAccount).slice(0, 80) || "Cash";
  const receiptAdjustmentAmount = normalizeMoney(input.receiptAdjustmentAmount);
  const receiptAdjustmentNote = normalizeString(input.receiptAdjustmentNote).slice(0, 190) || null;
  const receiptItemsJson = stringifySplitJson(parseJsonArray(input.receiptItems).slice(0, 80));
  const recipientItems = parseJsonArray(input.recipientItems).slice(0, 40);
  const senderItems = parseJsonArray(input.senderItems).slice(0, 40);
  const recipientItemsJson = stringifySplitJson(recipientItems);
  const senderItemsJson = stringifySplitJson(senderItems);

  if (!merchant) throw new SocialError("Merchant wajib diisi.");
  if (!category) throw new SocialError("Kategori wajib diisi.");
  if (!amount || amount <= 0) throw new SocialError("Nominal split penerima belum valid.");
  if (senderAmount < 0) throw new SocialError("Nominal pengirim belum valid.");
  if (receiptItemsJson === false || recipientItemsJson === false || senderItemsJson === false) {
    throw new SocialError("Metadata split terlalu besar.");
  }

  const senderReceiptMetadata = normalizeReceiptMetadata(
    {
      receiptSplitMode: senderItems.length > 0 ? "selected_items" : "full_receipt",
      receiptTotalAmount,
      receiptSelectedAmount: senderAmount,
      receiptItems: parseJsonArray(input.receiptItems),
      receiptSelectedItems: senderItems,
      receiptAdjustmentAmount,
      receiptAdjustmentNote,
    },
    senderAmount,
  );

  if (senderAmount > 0 && (senderReceiptMetadata.error || !senderReceiptMetadata.metadata)) {
    throw new SocialError(senderReceiptMetadata.error || "Metadata porsi pengirim belum valid.");
  }

  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    let senderTransactionId: number | null = null;

    if (senderAmount > 0 && senderReceiptMetadata.metadata) {
      const metadata = senderReceiptMetadata.metadata;
      const [transactionResult] = await connection.execute<ResultSetHeader>(
        `
          INSERT INTO transactions (user_id, category_id, merchant, category, amount, type, transaction_date, source, payment_account, receipt_total_amount, receipt_selected_amount, receipt_split_mode, receipt_items_json, receipt_selected_items_json, receipt_adjustment_amount, receipt_adjustment_note)
          VALUES (?, NULL, ?, ?, ?, 'expense', ?, 'Scan', ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          sender.id,
          merchant,
          category,
          senderAmount,
          transactionDate,
          paymentAccount,
          metadata.receiptTotalAmount,
          metadata.receiptSelectedAmount,
          metadata.receiptSplitMode,
          metadata.receiptItemsJson,
          metadata.receiptSelectedItemsJson,
          metadata.receiptAdjustmentAmount,
          metadata.receiptAdjustmentNote,
        ],
      );
      senderTransactionId = transactionResult.insertId;
    }

    const [splitResult] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO split_requests (sender_user_id, recipient_user_id, sender_transaction_id, merchant, category, amount, sender_amount, receipt_total_amount, transaction_date, source, payment_account, receipt_items_json, recipient_items_json, sender_items_json, receipt_adjustment_amount, receipt_adjustment_note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Scan', ?, ?, ?, ?, ?, ?)
      `,
      [
        sender.id,
        recipient.id,
        senderTransactionId,
        merchant,
        category,
        amount,
        senderAmount,
        receiptTotalAmount || null,
        transactionDate,
        paymentAccount,
        receiptItemsJson || null,
        recipientItemsJson || null,
        senderItemsJson || null,
        receiptAdjustmentAmount || null,
        receiptAdjustmentNote,
      ],
    );

    const splitRequestId = splitResult.insertId;
    const [notificationResult] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO notifications (recipient_user_id, actor_user_id, type, title, message, payload_json)
        VALUES (?, ?, 'split_request', ?, ?, ?)
      `,
      [
        recipient.id,
        sender.id,
        "Permintaan split bill",
        `${sender.name} mengirim split ${merchant}.`,
        JSON.stringify({ splitRequestId }),
      ],
    );

    await connection.execute(
      "UPDATE split_requests SET notification_id = ? WHERE id = ?",
      [notificationResult.insertId, splitRequestId],
    );
    await connection.commit();

    return { splitRequest: await getSplitRequestById(splitRequestId), senderTransactionId };
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      // Ignore rollback errors.
    }
    throw error;
  } finally {
    connection.release();
  }
}

async function createSplitRequestsBatch(sender: ApiUser, input: SplitRequestInput, recipientsInput: unknown[]) {
  if (recipientsInput.length > 12) throw new SocialError("Maksimal 12 penerima split sekali kirim.");

  const merchant = normalizeString(input.merchant).slice(0, 160);
  const category = normalizeString(input.category).slice(0, 120);
  const senderAmount = normalizeMoney(input.senderAmount);
  const receiptTotalAmount = normalizeMoney(input.receiptTotalAmount);
  const transactionDate = normalizeTransactionDate(input.transactionDate);
  const paymentAccount = normalizeString(input.paymentAccount).slice(0, 80) || "Cash";
  const receiptAdjustmentAmount = normalizeMoney(input.receiptAdjustmentAmount);
  const receiptAdjustmentNote = normalizeString(input.receiptAdjustmentNote).slice(0, 190) || null;
  const receiptItems = parseJsonArray(input.receiptItems).slice(0, 80);
  const senderItems = parseJsonArray(input.senderItems).slice(0, 40);
  const receiptItemsJson = stringifySplitJson(receiptItems);
  const senderItemsJson = stringifySplitJson(senderItems);

  if (!merchant) throw new SocialError("Merchant wajib diisi.");
  if (!category) throw new SocialError("Kategori wajib diisi.");
  if (senderAmount < 0) throw new SocialError("Nominal pengirim belum valid.");
  if (receiptItemsJson === false || senderItemsJson === false) throw new SocialError("Metadata split terlalu besar.");

  const preparedRecipients = await Promise.all(recipientsInput.map(async (value) => {
    const recipientInput = value && typeof value === "object" ? value as SplitRequestInput : {};
    const recipient = await resolveSplitRecipient(sender.id, recipientInput);
    const amount = normalizeMoney(recipientInput.amount);
    const recipientItems = parseJsonArray(recipientInput.recipientItems).slice(0, 40);
    const recipientItemsJson = stringifySplitJson(recipientItems);
    const recipientAdjustmentAmount = normalizeMoney(recipientInput.receiptAdjustmentAmount);
    const recipientAdjustmentNote = normalizeString(recipientInput.receiptAdjustmentNote).slice(0, 190) || null;

    if (!amount || amount <= 0) throw new SocialError(`Nominal split untuk ${recipient.email} belum valid.`);
    if (recipientItems.length === 0) throw new SocialError(`Item split untuk ${recipient.email} masih kosong.`);
    if (recipientItemsJson === false) throw new SocialError("Metadata split terlalu besar.");

    return {
      recipient,
      amount,
      recipientItemsJson,
      recipientAdjustmentAmount,
      recipientAdjustmentNote,
    };
  }));

  const recipientIds = new Set<number>();
  for (const prepared of preparedRecipients) {
    if (recipientIds.has(prepared.recipient.id)) throw new SocialError("Penerima split tidak boleh dobel.");
    recipientIds.add(prepared.recipient.id);
  }

  const totalRecipientAmount = preparedRecipients.reduce((total, prepared) => total + prepared.amount, 0);
  if (receiptTotalAmount > 0 && totalRecipientAmount > receiptTotalAmount) {
    throw new SocialError("Total porsi penerima melebihi total struk.");
  }

  const senderReceiptMetadata = normalizeReceiptMetadata(
    {
      receiptSplitMode: senderItems.length > 0 ? "selected_items" : "full_receipt",
      receiptTotalAmount,
      receiptSelectedAmount: senderAmount,
      receiptItems,
      receiptSelectedItems: senderItems,
      receiptAdjustmentAmount,
      receiptAdjustmentNote,
    },
    senderAmount,
  );

  if (senderAmount > 0 && (senderReceiptMetadata.error || !senderReceiptMetadata.metadata)) {
    throw new SocialError(senderReceiptMetadata.error || "Metadata porsi pengirim belum valid.");
  }

  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    let senderTransactionId: number | null = null;

    if (senderAmount > 0 && senderReceiptMetadata.metadata) {
      const metadata = senderReceiptMetadata.metadata;
      const [transactionResult] = await connection.execute<ResultSetHeader>(
        `
          INSERT INTO transactions (user_id, category_id, merchant, category, amount, type, transaction_date, source, payment_account, receipt_total_amount, receipt_selected_amount, receipt_split_mode, receipt_items_json, receipt_selected_items_json, receipt_adjustment_amount, receipt_adjustment_note)
          VALUES (?, NULL, ?, ?, ?, 'expense', ?, 'Scan', ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          sender.id,
          merchant,
          category,
          senderAmount,
          transactionDate,
          paymentAccount,
          metadata.receiptTotalAmount,
          metadata.receiptSelectedAmount,
          metadata.receiptSplitMode,
          metadata.receiptItemsJson,
          metadata.receiptSelectedItemsJson,
          metadata.receiptAdjustmentAmount,
          metadata.receiptAdjustmentNote,
        ],
      );
      senderTransactionId = transactionResult.insertId;
    }

    const splitRequestIds: number[] = [];
    for (const prepared of preparedRecipients) {
      const [splitResult] = await connection.execute<ResultSetHeader>(
        `
          INSERT INTO split_requests (sender_user_id, recipient_user_id, sender_transaction_id, merchant, category, amount, sender_amount, receipt_total_amount, transaction_date, source, payment_account, receipt_items_json, recipient_items_json, sender_items_json, receipt_adjustment_amount, receipt_adjustment_note)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Scan', ?, ?, ?, ?, ?, ?)
        `,
        [
          sender.id,
          prepared.recipient.id,
          senderTransactionId,
          merchant,
          category,
          prepared.amount,
          senderAmount,
          receiptTotalAmount || null,
          transactionDate,
          paymentAccount,
          receiptItemsJson || null,
          prepared.recipientItemsJson || null,
          senderItemsJson || null,
          prepared.recipientAdjustmentAmount || null,
          prepared.recipientAdjustmentNote,
        ],
      );

      const splitRequestId = splitResult.insertId;
      const [notificationResult] = await connection.execute<ResultSetHeader>(
        `
          INSERT INTO notifications (recipient_user_id, actor_user_id, type, title, message, payload_json)
          VALUES (?, ?, 'split_request', ?, ?, ?)
        `,
        [
          prepared.recipient.id,
          sender.id,
          "Permintaan split bill",
          `${sender.name} mengirim split ${merchant}.`,
          JSON.stringify({ splitRequestId }),
        ],
      );

      await connection.execute(
        "UPDATE split_requests SET notification_id = ? WHERE id = ?",
        [notificationResult.insertId, splitRequestId],
      );
      splitRequestIds.push(splitRequestId);
    }

    await connection.commit();

    return {
      splitRequests: await Promise.all(splitRequestIds.map((splitRequestId) => getSplitRequestById(splitRequestId))),
      senderTransactionId,
    };
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      // Ignore rollback errors.
    }
    throw error;
  } finally {
    connection.release();
  }
}

export async function actOnSplitRequest(userId: number, splitRequestId: number, action: "accept" | "reject") {
  if (!Number.isFinite(splitRequestId) || splitRequestId <= 0) throw new SocialError("Split request tidak valid.");

  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const split = await getSplitRequestByIdForUpdate(connection, splitRequestId);

    if (!split) throw new SocialError("Split request tidak ditemukan.", 404);
    if (Number(split.recipient_user_id) !== userId) throw new SocialError("Kamu tidak bisa memproses split ini.", 403);

    if (split.status === "accepted" && split.recipient_transaction_id) {
      await connection.rollback();
      return { splitRequest: toSplitRequest(split), unchanged: true };
    }

    if (split.status !== "pending") {
      await connection.rollback();
      return { splitRequest: toSplitRequest(split), unchanged: true };
    }

    if (action === "reject") {
      await connection.execute(
        "UPDATE split_requests SET status = 'rejected', responded_at = NOW() WHERE id = ?",
        [splitRequestId],
      );
      await updateSplitNotification(connection, split.notification_id, "rejected");
      await connection.commit();
      return { splitRequest: await getSplitRequestById(splitRequestId), unchanged: false };
    }

    await ensureUserCategories(userId);
    const categoryId = await findCategoryIdByName(connection, userId, split.category);
    const recipientItems = parseJsonArray(split.recipient_items_json);
    const metadata = normalizeReceiptMetadata(
      {
        receiptSplitMode: recipientItems.length > 0 ? "selected_items" : "full_receipt",
        receiptTotalAmount: split.receipt_total_amount,
        receiptSelectedAmount: split.amount,
        receiptItems: parseJsonArray(split.receipt_items_json),
        receiptSelectedItems: recipientItems,
        receiptAdjustmentAmount: split.receipt_adjustment_amount,
        receiptAdjustmentNote: split.receipt_adjustment_note,
      },
      Number(split.amount),
    );

    if (metadata.error || !metadata.metadata) {
      throw new SocialError(metadata.error || "Metadata transaksi penerima belum valid.");
    }

    const [transactionResult] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO transactions (user_id, category_id, merchant, category, amount, type, transaction_date, source, payment_account, receipt_total_amount, receipt_selected_amount, receipt_split_mode, receipt_items_json, receipt_selected_items_json, receipt_adjustment_amount, receipt_adjustment_note)
        VALUES (?, ?, ?, ?, ?, 'expense', ?, 'Scan', ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        userId,
        categoryId,
        split.merchant,
        split.category,
        Number(split.amount),
        split.transaction_date,
        split.payment_account || "Cash",
        metadata.metadata.receiptTotalAmount,
        metadata.metadata.receiptSelectedAmount,
        metadata.metadata.receiptSplitMode,
        metadata.metadata.receiptItemsJson,
        metadata.metadata.receiptSelectedItemsJson,
        metadata.metadata.receiptAdjustmentAmount,
        metadata.metadata.receiptAdjustmentNote,
      ],
    );

    await connection.execute(
      "UPDATE split_requests SET status = 'accepted', recipient_transaction_id = ?, responded_at = NOW() WHERE id = ?",
      [transactionResult.insertId, splitRequestId],
    );
    await updateSplitNotification(connection, split.notification_id, "accepted");
    await connection.commit();

    return { splitRequest: await getSplitRequestById(splitRequestId), unchanged: false };
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      // Ignore rollback errors.
    }
    throw error;
  } finally {
    connection.release();
  }
}

function toFriend(row: FriendshipRow, currentUserId: number) {
  const isRequester = Number(row.requester_user_id) === currentUserId;
  const other = isRequester
    ? {
        id: Number(row.recipient_user_id),
        name: row.recipient_name,
        email: row.recipient_email,
        avatarUrl: row.recipient_avatar_url,
      }
    : {
        id: Number(row.requester_user_id),
        name: row.requester_name,
        email: row.requester_email,
        avatarUrl: row.requester_avatar_url,
      };

  return {
    friendshipId: Number(row.id),
    status: row.status,
    direction: isRequester ? "outgoing" : "incoming",
    user: other,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toNotification(row: NotificationRow) {
  const payload = parsePayload(row.payload_json);

  return {
    id: Number(row.id),
    type: row.type,
    status: row.status,
    title: row.title,
    message: row.message,
    payload,
    actor: row.actor_user_id
      ? {
          id: Number(row.actor_user_id),
          name: row.actor_name ?? "User",
          email: row.actor_email ?? "",
          avatarUrl: row.actor_avatar_url,
        }
      : null,
    splitRequest: payload.splitRequestId ? null : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toSplitRequest(row: SplitRequestRow) {
  return {
    id: Number(row.id),
    sender: {
      id: Number(row.sender_user_id),
      name: row.sender_name,
      email: row.sender_email,
      avatarUrl: row.sender_avatar_url,
    },
    recipientUserId: Number(row.recipient_user_id),
    senderTransactionId: row.sender_transaction_id ? Number(row.sender_transaction_id) : null,
    recipientTransactionId: row.recipient_transaction_id ? Number(row.recipient_transaction_id) : null,
    notificationId: row.notification_id ? Number(row.notification_id) : null,
    merchant: row.merchant,
    category: row.category,
    amount: Number(row.amount),
    senderAmount: Number(row.sender_amount),
    receiptTotalAmount: row.receipt_total_amount === null ? null : Number(row.receipt_total_amount),
    transactionDate: row.transaction_date,
    paymentAccount: row.payment_account || "Cash",
    receiptItems: parseJsonArray(row.receipt_items_json),
    recipientItems: parseJsonArray(row.recipient_items_json),
    senderItems: parseJsonArray(row.sender_items_json),
    receiptAdjustmentAmount: row.receipt_adjustment_amount === null ? null : Number(row.receipt_adjustment_amount),
    receiptAdjustmentNote: row.receipt_adjustment_note,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function findUserByEmail(email: string) {
  const [rows] = await getPool().execute<UserLookupRow[]>(
    "SELECT id, name, email, avatar_url FROM users WHERE email = ? LIMIT 1",
    [email],
  );
  const row = rows[0];
  return row
    ? {
        id: Number(row.id),
        name: row.name,
        email: row.email,
        avatarUrl: row.avatar_url,
      }
    : null;
}

async function resolveSplitRecipient(senderUserId: number, input: SplitRequestInput) {
  const recipientUserId = Number(input.recipientUserId);
  const recipientEmail = normalizeEmail(input.recipientEmail);

  let rows: UserLookupRow[] = [];
  if (Number.isFinite(recipientUserId) && recipientUserId > 0) {
    [rows] = await getPool().execute<UserLookupRow[]>(
      "SELECT id, name, email, avatar_url FROM users WHERE id = ? LIMIT 1",
      [recipientUserId],
    );
  } else if (recipientEmail) {
    [rows] = await getPool().execute<UserLookupRow[]>(
      "SELECT id, name, email, avatar_url FROM users WHERE email = ? LIMIT 1",
      [recipientEmail],
    );
  }

  const row = rows[0];
  if (!row) throw new SocialError("Email penerima belum terdaftar di Taka.", 404);
  if (Number(row.id) === senderUserId) throw new SocialError("Tidak bisa split ke diri sendiri.");

  return {
    id: Number(row.id),
    name: row.name,
    email: row.email,
    avatarUrl: row.avatar_url,
  };
}

async function getFriendshipById(friendshipId: number, currentUserId: number) {
  const [rows] = await getPool().execute<FriendshipRow[]>(
    `
      SELECT
        f.id,
        f.requester_user_id,
        requester.name AS requester_name,
        requester.email AS requester_email,
        requester.avatar_url AS requester_avatar_url,
        f.recipient_user_id,
        recipient.name AS recipient_name,
        recipient.email AS recipient_email,
        recipient.avatar_url AS recipient_avatar_url,
        f.status,
        f.created_at,
        f.updated_at
      FROM friendships f
      JOIN users requester ON requester.id = f.requester_user_id
      JOIN users recipient ON recipient.id = f.recipient_user_id
      WHERE f.id = ?
      LIMIT 1
    `,
    [friendshipId],
  );

  return rows[0] ? toFriend(rows[0], currentUserId) : null;
}

async function getNotificationById(userId: number, notificationId: number) {
  const [rows] = await getPool().execute<NotificationRow[]>(
    `
      SELECT
        n.id,
        n.recipient_user_id,
        n.actor_user_id,
        actor.name AS actor_name,
        actor.email AS actor_email,
        actor.avatar_url AS actor_avatar_url,
        n.type,
        n.status,
        n.title,
        n.message,
        n.payload_json,
        n.created_at,
        n.updated_at
      FROM notifications n
      LEFT JOIN users actor ON actor.id = n.actor_user_id
      WHERE n.id = ? AND n.recipient_user_id = ?
      LIMIT 1
    `,
    [notificationId, userId],
  );

  return rows[0] ? toNotification(rows[0]) : null;
}

async function getSplitRequestById(splitRequestId: number) {
  const [rows] = await getPool().execute<SplitRequestRow[]>(
    splitRequestSelectSql("WHERE sr.id = ? LIMIT 1"),
    [splitRequestId],
  );
  return rows[0] ? toSplitRequest(rows[0]) : null;
}

async function getSplitRequestMap(splitRequestIds: number[]) {
  const uniqueIds = Array.from(new Set(splitRequestIds)).filter((id) => id > 0);
  const map = new Map<number, ReturnType<typeof toSplitRequest>>();
  if (uniqueIds.length === 0) return map;

  const placeholders = uniqueIds.map(() => "?").join(", ");
  const [rows] = await getPool().execute<SplitRequestRow[]>(
    splitRequestSelectSql(`WHERE sr.id IN (${placeholders})`),
    uniqueIds,
  );

  for (const row of rows) {
    map.set(Number(row.id), toSplitRequest(row));
  }

  return map;
}

async function getSplitRequestByIdForUpdate(connection: PoolConnection, splitRequestId: number) {
  const [rows] = await connection.execute<SplitRequestRow[]>(
    splitRequestSelectSql("WHERE sr.id = ? LIMIT 1 FOR UPDATE"),
    [splitRequestId],
  );
  return rows[0] ?? null;
}

function splitRequestSelectSql(whereClause: string) {
  return `
    SELECT
      sr.id,
      sr.sender_user_id,
      sender.name AS sender_name,
      sender.email AS sender_email,
      sender.avatar_url AS sender_avatar_url,
      sr.recipient_user_id,
      sr.sender_transaction_id,
      sr.recipient_transaction_id,
      sr.notification_id,
      sr.merchant,
      sr.category,
      sr.amount,
      sr.sender_amount,
      sr.receipt_total_amount,
      sr.transaction_date,
      sr.payment_account,
      sr.receipt_items_json,
      sr.recipient_items_json,
      sr.sender_items_json,
      sr.receipt_adjustment_amount,
      sr.receipt_adjustment_note,
      sr.status,
      sr.created_at,
      sr.updated_at
    FROM split_requests sr
    JOIN users sender ON sender.id = sr.sender_user_id
    ${whereClause}
  `;
}

async function updateSplitNotification(connection: PoolConnection, notificationId: number | null, status: "accepted" | "rejected") {
  if (!notificationId) return;
  await connection.execute(
    "UPDATE notifications SET status = ?, read_at = COALESCE(read_at, NOW()), acted_at = NOW() WHERE id = ?",
    [status, notificationId],
  );
}

async function findCategoryIdByName(connection: PoolConnection, userId: number, categoryName: string) {
  const [rows] = await connection.execute<Array<RowDataPacket & { id: number }>>(
    "SELECT id FROM categories WHERE user_id = ? AND LOWER(name) = LOWER(?) LIMIT 1",
    [userId, categoryName],
  );
  return rows[0]?.id ? Number(rows[0].id) : null;
}

function getPairKey(a: number, b: number) {
  return [Math.min(a, b), Math.max(a, b)].join(":");
}

function normalizeMoney(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Math.max(0, Math.round(numberValue)) : 0;
}

function normalizeTransactionDate(value: unknown) {
  const rawDate = normalizeString(value);
  if (!rawDate) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    return `${rawDate} ${hours}:${minutes}:${seconds}`;
  }

  const parsedDate = new Date(rawDate);
  if (Number.isNaN(parsedDate.getTime())) return null;

  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
  const date = String(parsedDate.getDate()).padStart(2, "0");
  const hours = String(parsedDate.getHours()).padStart(2, "0");
  const minutes = String(parsedDate.getMinutes()).padStart(2, "0");
  const seconds = String(parsedDate.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${date} ${hours}:${minutes}:${seconds}`;
}

function stringifySplitJson(value: unknown[]) {
  if (value.length === 0) return null;
  const json = JSON.stringify(value);
  return json.length > maxSplitJsonLength ? false : json;
}

function parsePayload(value: NotificationRow["payload_json"]) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

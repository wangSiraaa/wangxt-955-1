import { getQuery, allQuery, runQuery } from '../config/database.js';
import type { Notification, NotificationType } from '../../shared/types.js';
import { toCamelCase, generateId } from '../utils/helpers.js';

interface NotificationRow {
  id: string;
  order_id: string;
  user_id: string;
  type: NotificationType;
  content: string;
  sent_at: string;
  read_at: string | null;
}

export async function findAll(): Promise<Notification[]> {
  const rows = await allQuery<NotificationRow>(
    'SELECT * FROM notifications ORDER BY sent_at DESC'
  );
  return rows.map(row => toCamelCase<Notification>(row as unknown as Record<string, unknown>));
}

export async function findByUserId(userId: string): Promise<Notification[]> {
  const rows = await allQuery<NotificationRow>(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY sent_at DESC',
    [userId]
  );
  return rows.map(row => toCamelCase<Notification>(row as unknown as Record<string, unknown>));
}

export async function findByOrderId(orderId: string): Promise<Notification[]> {
  const rows = await allQuery<NotificationRow>(
    'SELECT * FROM notifications WHERE order_id = ? ORDER BY sent_at DESC',
    [orderId]
  );
  return rows.map(row => toCamelCase<Notification>(row as unknown as Record<string, unknown>));
}

export async function findById(id: string): Promise<Notification | null> {
  const row = await getQuery<NotificationRow>('SELECT * FROM notifications WHERE id = ?', [id]);
  if (!row) return null;
  return toCamelCase<Notification>(row as unknown as Record<string, unknown>);
}

export async function create(notificationData: {
  orderId: string;
  userId: string;
  type: NotificationType;
  content: string;
}): Promise<Notification> {
  const id = generateId('n_');

  await runQuery(
    `INSERT INTO notifications (id, order_id, user_id, type, content)
     VALUES (?, ?, ?, ?, ?)`,
    [id, notificationData.orderId, notificationData.userId, notificationData.type, notificationData.content]
  );

  const created = await findById(id);
  if (!created) throw new Error('Failed to create notification');
  return created;
}

export async function markAsRead(id: string, readAt: string): Promise<Notification | null> {
  await runQuery(
    'UPDATE notifications SET read_at = ? WHERE id = ?',
    [readAt, id]
  );
  return findById(id);
}

export async function markAllAsRead(userId: string, readAt: string): Promise<void> {
  await runQuery(
    'UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL',
    [readAt, userId]
  );
}

export async function getUnreadCount(userId: string): Promise<number> {
  const result = await getQuery<{ count: number }>(
    'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read_at IS NULL',
    [userId]
  );
  return result?.count || 0;
}

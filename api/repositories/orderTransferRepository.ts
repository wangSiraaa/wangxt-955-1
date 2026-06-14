import { getQuery, allQuery, runQuery } from '../config/database.js';
import type { OrderTransfer, OrderTransferStatus } from '../../shared/types.js';
import { toCamelCase, generateId } from '../utils/helpers.js';

interface OrderTransferRow {
  id: string;
  order_id: string;
  from_user_id: string;
  from_user_name: string;
  to_user_id: string;
  to_user_name: string;
  status: OrderTransferStatus;
  remark?: string;
  created_at: string;
  completed_at?: string;
}

export async function findAll(): Promise<OrderTransfer[]> {
  const rows = await allQuery<OrderTransferRow>(
    'SELECT * FROM order_transfers ORDER BY created_at DESC'
  );
  return rows.map(row => toCamelCase<OrderTransfer>(row as unknown as Record<string, unknown>));
}

export async function findByOrderId(orderId: string): Promise<OrderTransfer[]> {
  const rows = await allQuery<OrderTransferRow>(
    'SELECT * FROM order_transfers WHERE order_id = ? ORDER BY created_at DESC',
    [orderId]
  );
  return rows.map(row => toCamelCase<OrderTransfer>(row as unknown as Record<string, unknown>));
}

export async function findByToUserId(toUserId: string): Promise<OrderTransfer[]> {
  const rows = await allQuery<OrderTransferRow>(
    'SELECT * FROM order_transfers WHERE to_user_id = ? ORDER BY created_at DESC',
    [toUserId]
  );
  return rows.map(row => toCamelCase<OrderTransfer>(row as unknown as Record<string, unknown>));
}

export async function findByFromUserId(fromUserId: string): Promise<OrderTransfer[]> {
  const rows = await allQuery<OrderTransferRow>(
    'SELECT * FROM order_transfers WHERE from_user_id = ? ORDER BY created_at DESC',
    [fromUserId]
  );
  return rows.map(row => toCamelCase<OrderTransfer>(row as unknown as Record<string, unknown>));
}

export async function findById(id: string): Promise<OrderTransfer | null> {
  const row = await getQuery<OrderTransferRow>('SELECT * FROM order_transfers WHERE id = ?', [id]);
  if (!row) return null;
  return toCamelCase<OrderTransfer>(row as unknown as Record<string, unknown>);
}

export async function create(transferData: {
  orderId: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  remark?: string;
}): Promise<OrderTransfer> {
  const id = generateId('t_');

  await runQuery(
    `INSERT INTO order_transfers (id, order_id, from_user_id, from_user_name, to_user_id, to_user_name, remark)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      transferData.orderId,
      transferData.fromUserId,
      transferData.fromUserName,
      transferData.toUserId,
      transferData.toUserName,
      transferData.remark || null,
    ]
  );

  const created = await findById(id);
  if (!created) throw new Error('Failed to create order transfer');
  return created;
}

export async function updateStatus(
  id: string,
  status: OrderTransferStatus,
  completedAt?: string
): Promise<OrderTransfer | null> {
  if (completedAt) {
    await runQuery(
      'UPDATE order_transfers SET status = ?, completed_at = ? WHERE id = ?',
      [status, completedAt, id]
    );
  } else {
    await runQuery('UPDATE order_transfers SET status = ? WHERE id = ?', [status, id]);
  }
  return findById(id);
}

export async function hasCompletedTransfer(orderId: string): Promise<boolean> {
  const result = await getQuery<{ count: number }>(
    'SELECT COUNT(*) as count FROM order_transfers WHERE order_id = ? AND status = ?',
    [orderId, 'completed']
  );
  return (result?.count || 0) > 0;
}

export async function hasPendingTransfer(orderId: string): Promise<boolean> {
  const result = await getQuery<{ count: number }>(
    'SELECT COUNT(*) as count FROM order_transfers WHERE order_id = ? AND status = ?',
    [orderId, 'pending']
  );
  return (result?.count || 0) > 0;
}

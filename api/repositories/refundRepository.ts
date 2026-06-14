import { getQuery, allQuery, runQuery } from '../config/database.js';
import type { RefundRecord, RefundType, RefundStatus, RefundReason } from '../../shared/types.js';
import { toCamelCase, generateId } from '../utils/helpers.js';

interface RefundRecordRow {
  id: string;
  order_id: string;
  presale_id: string;
  user_id: string;
  user_name: string;
  refund_type: RefundType;
  refund_status: RefundStatus;
  refund_reason: RefundReason;
  refund_amount: number;
  deposit_amount: number;
  remark?: string;
  operator_id?: string;
  created_at: string;
  completed_at?: string;
}

export async function findAll(): Promise<RefundRecord[]> {
  const rows = await allQuery<RefundRecordRow>(
    'SELECT * FROM refund_records ORDER BY created_at DESC'
  );
  return rows.map(row => toCamelCase<RefundRecord>(row as unknown as Record<string, unknown>));
}

export async function findByOrderId(orderId: string): Promise<RefundRecord[]> {
  const rows = await allQuery<RefundRecordRow>(
    'SELECT * FROM refund_records WHERE order_id = ? ORDER BY created_at DESC',
    [orderId]
  );
  return rows.map(row => toCamelCase<RefundRecord>(row as unknown as Record<string, unknown>));
}

export async function findByPresaleId(presaleId: string): Promise<RefundRecord[]> {
  const rows = await allQuery<RefundRecordRow>(
    'SELECT * FROM refund_records WHERE presale_id = ? ORDER BY created_at DESC',
    [presaleId]
  );
  return rows.map(row => toCamelCase<RefundRecord>(row as unknown as Record<string, unknown>));
}

export async function findByUserId(userId: string): Promise<RefundRecord[]> {
  const rows = await allQuery<RefundRecordRow>(
    'SELECT * FROM refund_records WHERE user_id = ? ORDER BY created_at DESC',
    [userId]
  );
  return rows.map(row => toCamelCase<RefundRecord>(row as unknown as Record<string, unknown>));
}

export async function findById(id: string): Promise<RefundRecord | null> {
  const row = await getQuery<RefundRecordRow>('SELECT * FROM refund_records WHERE id = ?', [id]);
  if (!row) return null;
  return toCamelCase<RefundRecord>(row as unknown as Record<string, unknown>);
}

export async function create(refundData: {
  orderId: string;
  presaleId: string;
  userId: string;
  userName: string;
  refundType: RefundType;
  refundStatus: RefundStatus;
  refundReason: RefundReason;
  refundAmount: number;
  depositAmount: number;
  remark?: string;
  operatorId?: string;
}): Promise<RefundRecord> {
  const id = generateId('r_');

  await runQuery(
    `INSERT INTO refund_records (
      id, order_id, presale_id, user_id, user_name,
      refund_type, refund_status, refund_reason, refund_amount, deposit_amount,
      remark, operator_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      refundData.orderId,
      refundData.presaleId,
      refundData.userId,
      refundData.userName,
      refundData.refundType,
      refundData.refundStatus,
      refundData.refundReason,
      refundData.refundAmount,
      refundData.depositAmount,
      refundData.remark || null,
      refundData.operatorId || null,
    ]
  );

  const created = await findById(id);
  if (!created) throw new Error('Failed to create refund record');
  return created;
}

export async function updateStatus(
  id: string,
  status: RefundStatus,
  completedAt?: string
): Promise<RefundRecord | null> {
  if (completedAt) {
    await runQuery(
      'UPDATE refund_records SET refund_status = ?, completed_at = ? WHERE id = ?',
      [status, completedAt, id]
    );
  } else {
    await runQuery('UPDATE refund_records SET refund_status = ? WHERE id = ?', [status, id]);
  }
  return findById(id);
}

import { getQuery, allQuery, runQuery } from '../config/database.js';
import type { StockReleaseRecord, StockReleaseReason } from '../../shared/types.js';
import { toCamelCase, generateId } from '../utils/helpers.js';

interface StockReleaseRecordRow {
  id: string;
  order_id: string;
  presale_id: string;
  user_id: string;
  user_name: string;
  quantity: number;
  deposit_amount: number;
  deposit_retained: number;
  reason: StockReleaseReason;
  remark?: string;
  operator_id?: string;
  created_at: string;
}

function parseStockReleaseRow(row: StockReleaseRecordRow): StockReleaseRecord {
  const obj = toCamelCase<StockReleaseRecord>(row as unknown as Record<string, unknown>);
  return {
    ...obj,
    depositRetained: row.deposit_retained === 1,
  };
}

export async function findAll(): Promise<StockReleaseRecord[]> {
  const rows = await allQuery<StockReleaseRecordRow>(
    'SELECT * FROM stock_release_records ORDER BY created_at DESC'
  );
  return rows.map(parseStockReleaseRow);
}

export async function findByOrderId(orderId: string): Promise<StockReleaseRecord[]> {
  const rows = await allQuery<StockReleaseRecordRow>(
    'SELECT * FROM stock_release_records WHERE order_id = ? ORDER BY created_at DESC',
    [orderId]
  );
  return rows.map(parseStockReleaseRow);
}

export async function findByPresaleId(presaleId: string): Promise<StockReleaseRecord[]> {
  const rows = await allQuery<StockReleaseRecordRow>(
    'SELECT * FROM stock_release_records WHERE presale_id = ? ORDER BY created_at DESC',
    [presaleId]
  );
  return rows.map(parseStockReleaseRow);
}

export async function findByUserId(userId: string): Promise<StockReleaseRecord[]> {
  const rows = await allQuery<StockReleaseRecordRow>(
    'SELECT * FROM stock_release_records WHERE user_id = ? ORDER BY created_at DESC',
    [userId]
  );
  return rows.map(parseStockReleaseRow);
}

export async function findById(id: string): Promise<StockReleaseRecord | null> {
  const row = await getQuery<StockReleaseRecordRow>('SELECT * FROM stock_release_records WHERE id = ?', [id]);
  if (!row) return null;
  return parseStockReleaseRow(row);
}

export async function create(releaseData: {
  orderId: string;
  presaleId: string;
  userId: string;
  userName: string;
  quantity: number;
  depositAmount: number;
  depositRetained: boolean;
  reason: StockReleaseReason;
  remark?: string;
  operatorId?: string;
}): Promise<StockReleaseRecord> {
  const id = generateId('s_');

  await runQuery(
    `INSERT INTO stock_release_records (
      id, order_id, presale_id, user_id, user_name,
      quantity, deposit_amount, deposit_retained, reason, remark, operator_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      releaseData.orderId,
      releaseData.presaleId,
      releaseData.userId,
      releaseData.userName,
      releaseData.quantity,
      releaseData.depositAmount,
      releaseData.depositRetained ? 1 : 0,
      releaseData.reason,
      releaseData.remark || null,
      releaseData.operatorId || null,
    ]
  );

  const created = await findById(id);
  if (!created) throw new Error('Failed to create stock release record');
  return created;
}

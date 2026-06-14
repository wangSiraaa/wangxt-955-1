import { getQuery, allQuery, runQuery } from '../config/database.js';
import type { PresaleBatch, PresaleBatchStatus } from '../../shared/types.js';
import { toCamelCase, generateId } from '../utils/helpers.js';

interface PresaleBatchRow {
  id: string;
  presale_id: string;
  batch_no: number;
  expected_arrival_date: string;
  quantity: number;
  arrived_quantity: number;
  status: PresaleBatchStatus;
  remark: string;
  created_at: string;
  arrived_at?: string;
}

export async function findAll(): Promise<PresaleBatch[]> {
  const rows = await allQuery<PresaleBatchRow>(
    'SELECT * FROM presale_batches ORDER BY batch_no ASC'
  );
  return rows.map(row => toCamelCase<PresaleBatch>(row as unknown as Record<string, unknown>));
}

export async function findByPresaleId(presaleId: string): Promise<PresaleBatch[]> {
  const rows = await allQuery<PresaleBatchRow>(
    'SELECT * FROM presale_batches WHERE presale_id = ? ORDER BY batch_no ASC',
    [presaleId]
  );
  return rows.map(row => toCamelCase<PresaleBatch>(row as unknown as Record<string, unknown>));
}

export async function findById(id: string): Promise<PresaleBatch | null> {
  const row = await getQuery<PresaleBatchRow>('SELECT * FROM presale_batches WHERE id = ?', [id]);
  if (!row) return null;
  return toCamelCase<PresaleBatch>(row as unknown as Record<string, unknown>);
}

export async function create(batchData: {
  presaleId: string;
  batchNo: number;
  expectedArrivalDate: string;
  quantity: number;
  arrivedQuantity?: number;
  status?: PresaleBatchStatus;
  remark?: string;
}): Promise<PresaleBatch> {
  const id = generateId('b_');
  const status = batchData.status || 'pending';
  const arrivedQuantity = batchData.arrivedQuantity || 0;

  await runQuery(
    `INSERT INTO presale_batches (id, presale_id, batch_no, expected_arrival_date, quantity, arrived_quantity, status, remark)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      batchData.presaleId,
      batchData.batchNo,
      batchData.expectedArrivalDate,
      batchData.quantity,
      arrivedQuantity,
      status,
      batchData.remark || null,
    ]
  );

  const created = await findById(id);
  if (!created) throw new Error('Failed to create presale batch');
  return created;
}

export async function update(
  id: string,
  updates: Partial<PresaleBatch>
): Promise<PresaleBatch | null> {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.expectedArrivalDate !== undefined) {
    fields.push('expected_arrival_date = ?');
    values.push(updates.expectedArrivalDate);
  }
  if (updates.quantity !== undefined) {
    fields.push('quantity = ?');
    values.push(updates.quantity);
  }
  if (updates.arrivedQuantity !== undefined) {
    fields.push('arrived_quantity = ?');
    values.push(updates.arrivedQuantity);
  }
  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(updates.status);
  }
  if (updates.remark !== undefined) {
    fields.push('remark = ?');
    values.push(updates.remark);
  }
  if (updates.arrivedAt !== undefined) {
    fields.push('arrived_at = ?');
    values.push(updates.arrivedAt);
  }

  if (fields.length === 0) return findById(id);

  values.push(id);
  await runQuery(`UPDATE presale_batches SET ${fields.join(', ')} WHERE id = ?`, values);
  return findById(id);
}

export async function remove(id: string): Promise<void> {
  await runQuery('DELETE FROM presale_batches WHERE id = ?', [id]);
}

export async function incrementArrivedQuantity(
  batchId: string,
  quantity: number
): Promise<void> {
  await runQuery(
    'UPDATE presale_batches SET arrived_quantity = arrived_quantity + ? WHERE id = ?',
    [quantity, batchId]
  );
}

export async function getMaxBatchNo(presaleId: string): Promise<number> {
  const result = await getQuery<{ max: number | null }>(
    'SELECT MAX(batch_no) as max FROM presale_batches WHERE presale_id = ?',
    [presaleId]
  );
  return result?.max || 0;
}

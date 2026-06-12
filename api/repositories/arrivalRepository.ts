import { getQuery, allQuery, runQuery } from '../config/database.js';
import type { Arrival } from '../../shared/types.js';
import { toCamelCase, generateId } from '../utils/helpers.js';

interface ArrivalRow {
  id: string;
  presale_id: string;
  quantity: number;
  arrived_at: string;
  operator_id: string;
  remark: string;
}

export async function findAll(): Promise<Arrival[]> {
  const rows = await allQuery<ArrivalRow>('SELECT * FROM arrivals ORDER BY arrived_at DESC');
  return rows.map(row => toCamelCase<Arrival>(row as unknown as Record<string, unknown>));
}

export async function findByPresaleId(presaleId: string): Promise<Arrival[]> {
  const rows = await allQuery<ArrivalRow>(
    'SELECT * FROM arrivals WHERE presale_id = ? ORDER BY arrived_at DESC',
    [presaleId]
  );
  return rows.map(row => toCamelCase<Arrival>(row as unknown as Record<string, unknown>));
}

export async function findById(id: string): Promise<Arrival | null> {
  const row = await getQuery<ArrivalRow>('SELECT * FROM arrivals WHERE id = ?', [id]);
  if (!row) return null;
  return toCamelCase<Arrival>(row as unknown as Record<string, unknown>);
}

export async function create(arrivalData: {
  presaleId: string;
  quantity: number;
  operatorId: string;
  remark: string;
}): Promise<Arrival> {
  const id = generateId('a_');

  await runQuery(
    `INSERT INTO arrivals (id, presale_id, quantity, operator_id, remark)
     VALUES (?, ?, ?, ?, ?)`,
    [id, arrivalData.presaleId, arrivalData.quantity, arrivalData.operatorId, arrivalData.remark]
  );

  const created = await findById(id);
  if (!created) throw new Error('Failed to create arrival record');
  return created;
}

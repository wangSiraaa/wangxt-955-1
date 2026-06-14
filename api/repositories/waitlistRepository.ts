import { getQuery, allQuery, runQuery } from '../config/database.js';
import type { WaitlistEntry, WaitlistStatus, MemberLevel } from '../../shared/types.js';
import { toCamelCase, generateId } from '../utils/helpers.js';

interface WaitlistEntryRow {
  id: string;
  presale_id: string;
  order_id: string;
  user_id: string;
  user_name: string;
  quantity: number;
  deposit_amount: number;
  status: WaitlistStatus;
  priority: number;
  member_level: MemberLevel;
  deposit_time: string;
  notified_at?: string;
  confirmed_at?: string;
  created_at: string;
}

export async function findAll(): Promise<WaitlistEntry[]> {
  const rows = await allQuery<WaitlistEntryRow>(
    'SELECT * FROM waitlist_entries ORDER BY priority ASC, deposit_time ASC'
  );
  return rows.map(row => toCamelCase<WaitlistEntry>(row as unknown as Record<string, unknown>));
}

export async function findByPresaleId(presaleId: string): Promise<WaitlistEntry[]> {
  const rows = await allQuery<WaitlistEntryRow>(
    `SELECT * FROM waitlist_entries 
     WHERE presale_id = ? 
     ORDER BY priority ASC, deposit_time ASC`,
    [presaleId]
  );
  return rows.map(row => toCamelCase<WaitlistEntry>(row as unknown as Record<string, unknown>));
}

export async function findByUserId(userId: string): Promise<WaitlistEntry[]> {
  const rows = await allQuery<WaitlistEntryRow>(
    'SELECT * FROM waitlist_entries WHERE user_id = ? ORDER BY created_at DESC',
    [userId]
  );
  return rows.map(row => toCamelCase<WaitlistEntry>(row as unknown as Record<string, unknown>));
}

export async function findByOrderId(orderId: string): Promise<WaitlistEntry | null> {
  const row = await getQuery<WaitlistEntryRow>(
    'SELECT * FROM waitlist_entries WHERE order_id = ?',
    [orderId]
  );
  if (!row) return null;
  return toCamelCase<WaitlistEntry>(row as unknown as Record<string, unknown>);
}

export async function findById(id: string): Promise<WaitlistEntry | null> {
  const row = await getQuery<WaitlistEntryRow>('SELECT * FROM waitlist_entries WHERE id = ?', [id]);
  if (!row) return null;
  return toCamelCase<WaitlistEntry>(row as unknown as Record<string, unknown>);
}

export async function findWaitingByPresaleId(presaleId: string): Promise<WaitlistEntry[]> {
  const rows = await allQuery<WaitlistEntryRow>(
    `SELECT * FROM waitlist_entries 
     WHERE presale_id = ? AND status = 'waiting'
     ORDER BY priority ASC, deposit_time ASC`,
    [presaleId]
  );
  return rows.map(row => toCamelCase<WaitlistEntry>(row as unknown as Record<string, unknown>));
}

export async function create(entryData: {
  presaleId: string;
  orderId: string;
  userId: string;
  userName: string;
  quantity: number;
  depositAmount: number;
  priority: number;
  memberLevel: MemberLevel;
  depositTime: string;
}): Promise<WaitlistEntry> {
  const id = generateId('w_');

  await runQuery(
    `INSERT INTO waitlist_entries (
      id, presale_id, order_id, user_id, user_name, quantity,
      deposit_amount, priority, member_level, deposit_time
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      entryData.presaleId,
      entryData.orderId,
      entryData.userId,
      entryData.userName,
      entryData.quantity,
      entryData.depositAmount,
      entryData.priority,
      entryData.memberLevel,
      entryData.depositTime,
    ]
  );

  const created = await findById(id);
  if (!created) throw new Error('Failed to create waitlist entry');
  return created;
}

export async function updateStatus(
  id: string,
  status: WaitlistStatus,
  extraFields?: { notifiedAt?: string; confirmedAt?: string }
): Promise<WaitlistEntry | null> {
  const fields: string[] = ['status = ?'];
  const values: unknown[] = [status];

  if (extraFields?.notifiedAt) {
    fields.push('notified_at = ?');
    values.push(extraFields.notifiedAt);
  }
  if (extraFields?.confirmedAt) {
    fields.push('confirmed_at = ?');
    values.push(extraFields.confirmedAt);
  }

  values.push(id);
  await runQuery(`UPDATE waitlist_entries SET ${fields.join(', ')} WHERE id = ?`, values);
  return findById(id);
}

export async function getCountByPresaleId(presaleId: string): Promise<number> {
  const result = await getQuery<{ count: number }>(
    'SELECT COUNT(*) as count FROM waitlist_entries WHERE presale_id = ?',
    [presaleId]
  );
  return result?.count || 0;
}

export async function getWaitingCountByPresaleId(presaleId: string): Promise<number> {
  const result = await getQuery<{ count: number }>(
    "SELECT COUNT(*) as count FROM waitlist_entries WHERE presale_id = ? AND status = 'waiting'",
    [presaleId]
  );
  return result?.count || 0;
}

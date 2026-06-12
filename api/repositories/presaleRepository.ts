import { getQuery, allQuery, runQuery } from '../config/database.js';
import type { Presale, PresaleStatus } from '../../shared/types.js';
import { toCamelCase } from '../utils/helpers.js';

interface PresaleRow {
  id: string;
  book_title: string;
  book_author: string;
  book_cover: string;
  book_isbn: string;
  price: number;
  deposit: number;
  total_stock: number;
  locked_stock: number;
  sold_stock: number;
  presale_start_time: string;
  presale_end_time: string;
  pickup_deadline: string;
  status: PresaleStatus;
  description: string;
  created_at: string;
}

export async function findAll(): Promise<Presale[]> {
  const rows = await allQuery<PresaleRow>('SELECT * FROM presales ORDER BY created_at DESC');
  return rows.map(row => toCamelCase<Presale>(row as unknown as Record<string, unknown>));
}

export async function findById(id: string): Promise<Presale | null> {
  const row = await getQuery<PresaleRow>('SELECT * FROM presales WHERE id = ?', [id]);
  if (!row) return null;
  return toCamelCase<Presale>(row as unknown as Record<string, unknown>);
}

export async function findByStatus(status: PresaleStatus): Promise<Presale[]> {
  const rows = await allQuery<PresaleRow>(
    'SELECT * FROM presales WHERE status = ? ORDER BY created_at DESC',
    [status]
  );
  return rows.map(row => toCamelCase<Presale>(row as unknown as Record<string, unknown>));
}

export async function create(presale: Omit<Presale, 'id' | 'createdAt' | 'lockedStock' | 'soldStock'>): Promise<Presale> {
  const id = `p_${Date.now().toString(36)}`;
  
  await runQuery(
    `INSERT INTO presales (id, book_title, book_author, book_cover, book_isbn, price, deposit, 
      total_stock, presale_start_time, presale_end_time, pickup_deadline, status, description)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, presale.bookTitle, presale.bookAuthor, presale.bookCover, presale.bookIsbn,
      presale.price, presale.deposit, presale.totalStock,
      presale.presaleStartTime, presale.presaleEndTime, presale.pickupDeadline,
      presale.status, presale.description
    ]
  );

  const created = await findById(id);
  if (!created) throw new Error('Failed to create presale');
  return created;
}

export async function update(id: string, updates: Partial<Presale>): Promise<Presale | null> {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.bookTitle !== undefined) {
    fields.push('book_title = ?');
    values.push(updates.bookTitle);
  }
  if (updates.bookAuthor !== undefined) {
    fields.push('book_author = ?');
    values.push(updates.bookAuthor);
  }
  if (updates.bookCover !== undefined) {
    fields.push('book_cover = ?');
    values.push(updates.bookCover);
  }
  if (updates.price !== undefined) {
    fields.push('price = ?');
    values.push(updates.price);
  }
  if (updates.deposit !== undefined) {
    fields.push('deposit = ?');
    values.push(updates.deposit);
  }
  if (updates.totalStock !== undefined) {
    fields.push('total_stock = ?');
    values.push(updates.totalStock);
  }
  if (updates.lockedStock !== undefined) {
    fields.push('locked_stock = ?');
    values.push(updates.lockedStock);
  }
  if (updates.soldStock !== undefined) {
    fields.push('sold_stock = ?');
    values.push(updates.soldStock);
  }
  if (updates.presaleStartTime !== undefined) {
    fields.push('presale_start_time = ?');
    values.push(updates.presaleStartTime);
  }
  if (updates.presaleEndTime !== undefined) {
    fields.push('presale_end_time = ?');
    values.push(updates.presaleEndTime);
  }
  if (updates.pickupDeadline !== undefined) {
    fields.push('pickup_deadline = ?');
    values.push(updates.pickupDeadline);
  }
  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(updates.status);
  }
  if (updates.description !== undefined) {
    fields.push('description = ?');
    values.push(updates.description);
  }

  if (fields.length === 0) return findById(id);

  values.push(id);
  await runQuery(`UPDATE presales SET ${fields.join(', ')} WHERE id = ?`, values);
  return findById(id);
}

export async function incrementLockedStock(presaleId: string, quantity: number): Promise<void> {
  await runQuery(
    'UPDATE presales SET locked_stock = locked_stock + ? WHERE id = ?',
    [quantity, presaleId]
  );
}

export async function decrementLockedStock(presaleId: string, quantity: number): Promise<void> {
  await runQuery(
    'UPDATE presales SET locked_stock = locked_stock - ? WHERE id = ?',
    [quantity, presaleId]
  );
}

export async function incrementSoldStock(presaleId: string, quantity: number): Promise<void> {
  await runQuery(
    'UPDATE presales SET sold_stock = sold_stock + ?, locked_stock = locked_stock - ? WHERE id = ?',
    [quantity, quantity, presaleId]
  );
}

import { getQuery, allQuery, runQuery } from '../config/database.js';
import type { User, UserRole } from '../../shared/types.js';
import { toCamelCase } from '../utils/helpers.js';

interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  role: UserRole;
  name: string;
  phone: string;
  created_at: string;
}

export async function findByUsernameAndRole(username: string, role: UserRole): Promise<User | null> {
  const row = await getQuery<UserRow>(
    'SELECT * FROM users WHERE username = ? AND role = ?',
    [username, role]
  );
  
  if (!row) return null;
  
  const { password_hash: _passwordHash, created_at: _createdAt, ...userData } = row;
  return toCamelCase<User>(userData as unknown as Record<string, unknown>);
}

export async function findById(id: string): Promise<User | null> {
  const row = await getQuery<UserRow>('SELECT * FROM users WHERE id = ?', [id]);
  
  if (!row) return null;
  
  const { password_hash: _passwordHash, created_at: _createdAt, ...userData } = row;
  return toCamelCase<User>(userData as unknown as Record<string, unknown>);
}

export async function findByUsername(username: string): Promise<{ user: User; passwordHash: string } | null> {
  const row = await getQuery<UserRow>('SELECT * FROM users WHERE username = ?', [username]);
  
  if (!row) return null;
  
  const { password_hash: passwordHash, created_at: _createdAt, ...userData } = row;
  return {
    user: toCamelCase<User>(userData as unknown as Record<string, unknown>),
    passwordHash,
  };
}

export async function findAll(): Promise<User[]> {
  const rows = await allQuery<UserRow>('SELECT * FROM users');
  return rows.map(row => {
    const { password_hash: _passwordHash, created_at: _createdAt, ...userData } = row;
    return toCamelCase<User>(userData as unknown as Record<string, unknown>);
  });
}

import dayjs from 'dayjs';
import crypto from 'crypto';

export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}${timestamp}${random}`;
}

export function generateOrderNo(): string {
  const dateStr = dayjs().format('YYYYMMDD');
  const random = Math.floor(1000 + Math.random() * 9000);
  return `PS${dateStr}${random}`;
}

export function generatePickupCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

export function formatDate(date: string | Date | null): string {
  if (!date) return '';
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss');
}

export function isPresaleActive(startTime: string, endTime: string): boolean {
  const now = dayjs();
  return now.isAfter(dayjs(startTime)) && now.isBefore(dayjs(endTime));
}

export function isPresaleUpcoming(startTime: string): boolean {
  return dayjs().isBefore(dayjs(startTime));
}

export function isPresaleEnded(endTime: string): boolean {
  return dayjs().isAfter(dayjs(endTime));
}

export function isPickupExpired(deadline: string): boolean {
  return dayjs().isAfter(dayjs(deadline));
}

export function getCountdown(targetTime: string): { days: number; hours: number; minutes: number; seconds: number; expired: boolean } {
  const target = dayjs(targetTime);
  const now = dayjs();
  const diff = target.diff(now);
  
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  }
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  return { days, hours, minutes, seconds, expired: false };
}

export function successResponse<T>(data?: T, message: string = 'success') {
  return {
    code: 200,
    message,
    data,
  };
}

export function errorResponse(message: string, code: number = 400) {
  return {
    code,
    message,
  };
}

export function toCamelCase<T>(obj: Record<string, unknown>): T {
  const result: Record<string, unknown> = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      result[camelKey] = obj[key];
    }
  }
  return result as T;
}

export function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

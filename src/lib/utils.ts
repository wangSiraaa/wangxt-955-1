import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import dayjs from 'dayjs';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr: string): string {
  return dayjs(dateStr).format('YYYY-MM-DD');
}

export function formatDateTime(dateStr: string): string {
  return dayjs(dateStr).format('YYYY-MM-DD HH:mm:ss');
}

export function getCountdown(targetDateStr: string): string {
  const now = dayjs();
  const target = dayjs(targetDateStr);
  const diff = target.diff(now);

  if (diff <= 0) return '已结束';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  if (days > 0) {
    return `${days}天 ${hours}时 ${minutes}分`;
  } else if (hours > 0) {
    return `${hours}时 ${minutes}分 ${seconds}秒`;
  } else if (minutes > 0) {
    return `${minutes}分 ${seconds}秒`;
  } else {
    return `${seconds}秒`;
  }
}

export function toCamelCase<T = Record<string, unknown>>(obj: Record<string, unknown>): T {
  const result: Record<string, unknown> = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      result[camelKey] = obj[key];
    }
  }
  return result as T;
}

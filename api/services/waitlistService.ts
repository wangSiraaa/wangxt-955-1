import * as waitlistRepository from '../repositories/waitlistRepository.js';
import * as presaleRepository from '../repositories/presaleRepository.js';
import * as orderRepository from '../repositories/orderRepository.js';
import * as notificationService from './notificationService.js';
import type { WaitlistEntry, MemberLevel, User, Order } from '../../shared/types.js';
import { memberLevelConfig } from '../../shared/types.js';
import dayjs from 'dayjs';

export async function getWaitlistByPresaleId(presaleId: string): Promise<WaitlistEntry[]> {
  return waitlistRepository.findByPresaleId(presaleId);
}

export async function getWaitlistByUserId(userId: string): Promise<WaitlistEntry[]> {
  return waitlistRepository.findByUserId(userId);
}

export async function getWaitlistEntryById(id: string): Promise<WaitlistEntry | null> {
  return waitlistRepository.findById(id);
}

export async function getWaitlistByOrderId(orderId: string): Promise<WaitlistEntry | null> {
  return waitlistRepository.findByOrderId(orderId);
}

export function calculatePriority(memberLevel: MemberLevel): number {
  return memberLevelConfig[memberLevel]?.priority || 4;
}

export async function addToWaitlist(
  order: Order,
  presaleId: string
): Promise<WaitlistEntry> {
  const priority = calculatePriority(order.memberLevel || 'normal');

  const entry = await waitlistRepository.create({
    presaleId,
    orderId: order.id,
    userId: order.userId,
    userName: order.userName,
    quantity: order.quantity,
    depositAmount: order.depositAmount,
    priority,
    memberLevel: order.memberLevel || 'normal',
    depositTime: order.paidAt || order.createdAt,
  });

  await presaleRepository.incrementWaitlistedStock(presaleId, order.quantity);

  return entry;
}

export async function notifyWaitlistEntry(
  entryId: string,
  _operator: User
): Promise<WaitlistEntry | null> {
  const entry = await waitlistRepository.findById(entryId);
  if (!entry) {
    throw new Error('候补记录不存在');
  }

  if (entry.status !== 'waiting') {
    throw new Error('候补状态不能通知');
  }

  const updated = await waitlistRepository.updateStatus(entryId, 'notified', {
    notifiedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
  });

  const presale = await presaleRepository.findById(entry.presaleId);
  if (updated && presale) {
    await notificationService.createNotification({
      orderId: entry.orderId,
      userId: entry.userId,
      type: 'waitlist_notify',
      content: `恭喜！您候补的《${presale.bookTitle}》有货了，请尽快确认是否购买。`,
      relatedId: entryId,
    });
  }

  return updated;
}

export async function confirmWaitlist(
  entryId: string,
  user: User
): Promise<{ entry: WaitlistEntry | null; order: Order | null }> {
  const entry = await waitlistRepository.findById(entryId);
  if (!entry) {
    throw new Error('候补记录不存在');
  }

  if (entry.userId !== user.id) {
    throw new Error('无权操作此候补记录');
  }

  if (entry.status !== 'notified') {
    throw new Error('候补状态不能确认');
  }

  const updatedEntry = await waitlistRepository.updateStatus(entryId, 'confirmed', {
    confirmedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
  });

  await presaleRepository.incrementLockedStock(entry.presaleId, entry.quantity);
  await presaleRepository.decrementWaitlistedStock(entry.presaleId, entry.quantity);

  const updatedOrder = await orderRepository.updatePickupStatus(
    entry.orderId,
    'ready'
  );

  if (updatedOrder) {
    const presale = await presaleRepository.findById(entry.presaleId);
    if (presale) {
      await notificationService.createNotification({
        orderId: entry.orderId,
        userId: entry.userId,
        type: 'pickup_ready',
        content: `您候补确认的《${presale.bookTitle}》已准备好，请在 ${dayjs(presale.pickupDeadline).format('YYYY-MM-DD')} 前取书。`,
      });
    }
  }

  return { entry: updatedEntry, order: updatedOrder };
}

export async function declineWaitlist(
  entryId: string,
  user: User
): Promise<WaitlistEntry | null> {
  const entry = await waitlistRepository.findById(entryId);
  if (!entry) {
    throw new Error('候补记录不存在');
  }

  if (entry.userId !== user.id) {
    throw new Error('无权操作此候补记录');
  }

  if (entry.status !== 'notified') {
    throw new Error('候补状态不能拒绝');
  }

  const updatedEntry = await waitlistRepository.updateStatus(entryId, 'refunded');

  await presaleRepository.decrementWaitlistedStock(entry.presaleId, entry.quantity);

  return updatedEntry;
}

export async function confirmWaitlistForOrder(
  orderId: string
): Promise<WaitlistEntry | null> {
  const entry = await waitlistRepository.findByOrderId(orderId);
  if (!entry) return null;

  if (entry.status === 'confirmed') return entry;

  const updated = await waitlistRepository.updateStatus(entry.id, 'confirmed', {
    confirmedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
  });

  return updated;
}

export async function processWaitlistForArrival(
  presaleId: string,
  availableQuantity: number,
  batchNo: number
): Promise<WaitlistEntry[]> {
  const waitingEntries = await waitlistRepository.findWaitingByPresaleId(presaleId);
  const notifiedEntries: WaitlistEntry[] = [];
  let remaining = availableQuantity;

  for (const entry of waitingEntries) {
    if (remaining <= 0) break;
    if (entry.quantity <= remaining) {
      try {
        const updated = await waitlistRepository.updateStatus(entry.id, 'notified', {
          notifiedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        });

        if (updated) {
          notifiedEntries.push(updated);
          remaining -= entry.quantity;

          const presale = await presaleRepository.findById(presaleId);
          if (presale) {
            await notificationService.createNotification({
              orderId: entry.orderId,
              userId: entry.userId,
              type: 'waitlist_notify',
              content: `恭喜！您候补的《${presale.bookTitle}》第 ${batchNo} 批次有货了，请尽快确认是否购买。`,
              relatedId: entry.id,
            });
          }
        }
      } catch (err) {
        console.error(`Failed to notify waitlist entry ${entry.id}:`, err);
      }
    }
  }

  return notifiedEntries;
}

import * as notificationRepository from '../repositories/notificationRepository.js';
import type { Notification, NotificationType, User } from '../../shared/types.js';
import dayjs from 'dayjs';

export async function getAllNotifications(user?: User): Promise<Notification[]> {
  if (user?.role === 'member') {
    return notificationRepository.findByUserId(user.id);
  }
  return notificationRepository.findAll();
}

export async function getNotificationsByUserId(userId: string): Promise<Notification[]> {
  return notificationRepository.findByUserId(userId);
}

export async function getNotificationsByOrderId(orderId: string): Promise<Notification[]> {
  return notificationRepository.findByOrderId(orderId);
}

export async function createNotification(notificationData: {
  orderId: string;
  userId: string;
  type: NotificationType;
  content: string;
  relatedId?: string;
}): Promise<Notification> {
  return notificationRepository.create(notificationData);
}

export async function markNotificationAsRead(id: string, user: User): Promise<Notification | null> {
  const notification = await notificationRepository.findById(id);
  
  if (!notification) {
    return null;
  }

  if (notification.userId !== user.id) {
    throw new Error('无权操作此通知');
  }

  return notificationRepository.markAsRead(id, dayjs().format('YYYY-MM-DD HH:mm:ss'));
}

export async function markAllAsRead(user: User): Promise<void> {
  await notificationRepository.markAllAsRead(user.id, dayjs().format('YYYY-MM-DD HH:mm:ss'));
}

export async function getUnreadCount(userId: string): Promise<number> {
  return notificationRepository.getUnreadCount(userId);
}

export async function sendPickupNotifications(
  presaleId: string,
  orders: { id: string; userId: string; pickupCode: string }[],
  bookTitle: string,
  pickupDeadline: string
): Promise<Notification[]> {
  const notifications: Notification[] = [];
  
  for (const order of orders) {
    try {
      const notification = await createNotification({
        orderId: order.id,
        userId: order.userId,
        type: 'pickup_ready',
        content: `您预订的《${bookTitle}》已到货，请在 ${dayjs(pickupDeadline).format('YYYY-MM-DD')} 前凭取书码 ${order.pickupCode} 到店取书。`,
      });
      notifications.push(notification);
    } catch (err) {
      console.error(`Failed to send notification for order ${order.id}:`, err);
    }
  }

  return notifications;
}

export async function sendExpiryWarningNotifications(
  orders: { id: string; userId: string; bookTitle: string; pickupDeadline: string }[]
): Promise<Notification[]> {
  const notifications: Notification[] = [];
  
  for (const order of orders) {
    try {
      const notification = await createNotification({
        orderId: order.id,
        userId: order.userId,
        type: 'expiry_warning',
        content: `您预订的《${order.bookTitle}》取书期限将至，请在 ${dayjs(order.pickupDeadline).format('YYYY-MM-DD')} 前到店取书，逾期订单将自动取消。`,
      });
      notifications.push(notification);
    } catch (err) {
      console.error(`Failed to send expiry warning for order ${order.id}:`, err);
    }
  }

  return notifications;
}

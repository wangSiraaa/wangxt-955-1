import * as orderRepository from '../repositories/orderRepository.js';
import * as presaleRepository from '../repositories/presaleRepository.js';
import * as presaleService from './presaleService.js';
import * as notificationService from './notificationService.js';
import * as waitlistService from './waitlistService.js';
import * as refundService from './refundService.js';
import * as orderTransferService from './orderTransferService.js';
import * as orderTransferRepository from '../repositories/orderTransferRepository.js';
import * as refundRepository from '../repositories/refundRepository.js';
import * as stockReleaseRepository from '../repositories/stockReleaseRepository.js';
import * as waitlistRepository from '../repositories/waitlistRepository.js';
import type {
  Order,
  CreateOrderRequest,
  User,
  OrderDetailWithRelations,
} from '../../shared/types.js';
import dayjs from 'dayjs';

export async function getAllOrders(user?: User): Promise<Order[]> {
  let orders: Order[];
  if (user?.role === 'member') {
    orders = await orderRepository.findByUserId(user.id);
  } else {
    orders = await orderRepository.findAll();
  }
  return checkAndAutoExpireOrders(orders);
}

export async function getOrderById(id: string, user?: User): Promise<Order | null> {
  const order = await orderRepository.findById(id);

  if (!order) return null;

  if (user?.role === 'member' && order.userId !== user.id) {
    return null;
  }

  return checkAndAutoExpire(order);
}

export async function getOrderDetail(id: string, user?: User): Promise<OrderDetailWithRelations | null> {
  const order = await getOrderById(id, user);
  if (!order) return null;

  const [presale, transfers, refunds, waitlist, stockReleases, notifications] =
    await Promise.all([
      presaleRepository.findById(order.presaleId),
      orderTransferRepository.findByOrderId(id),
      refundRepository.findByOrderId(id),
      waitlistRepository.findByOrderId(id),
      stockReleaseRepository.findByOrderId(id),
      notificationService.getNotificationsByOrderId(id),
    ]);

  return {
    ...order,
    presale: presale || undefined,
    transfers,
    refunds,
    waitlist: waitlist || undefined,
    stockReleases,
    notifications,
  };
}

export async function createOrder(
  request: CreateOrderRequest,
  user: User
): Promise<Order> {
  const availability = await presaleService.checkPresaleAvailability(
    request.presaleId,
    request.quantity,
    user
  );

  if (!availability.available || !availability.presale) {
    throw new Error(availability.message);
  }

  const presale = availability.presale;
  const totalAmount = presale.price * request.quantity;
  const depositAmount = presale.deposit * request.quantity;
  const balanceAmount = totalAmount - depositAmount;

  const order = await orderRepository.create({
    presaleId: request.presaleId,
    userId: user.id,
    userName: user.name,
    memberLevel: user.memberLevel,
    quantity: request.quantity,
    totalAmount,
    depositAmount,
    balanceAmount,
  });

  return order;
}

export async function payOrder(orderId: string, user: User): Promise<Order> {
  const order = await orderRepository.findById(orderId);

  if (!order) {
    throw new Error('订单不存在');
  }

  if (order.userId !== user.id) {
    throw new Error('无权支付此订单');
  }

  if (order.paymentStatus === 'paid') {
    throw new Error('订单已支付');
  }

  const presale = await presaleRepository.findById(order.presaleId);
  if (!presale) {
    throw new Error('预售不存在');
  }

  const availability = await presaleService.checkPresaleAvailability(
    order.presaleId,
    order.quantity,
    user
  );

  if (!availability.available) {
    if (availability.canWaitlist) {
      throw new Error('库存不足，可加入候补');
    }
    throw new Error(availability.message);
  }

  await presaleRepository.incrementLockedStock(order.presaleId, order.quantity);

  const updatedOrder = await orderRepository.updatePaymentStatus(
    orderId,
    'paid',
    dayjs().format('YYYY-MM-DD HH:mm:ss')
  );

  if (!updatedOrder) {
    throw new Error('支付失败');
  }

  return updatedOrder;
}

export async function payOrderWithWaitlist(
  orderId: string,
  user: User
): Promise<{ order: Order; waitlisted: boolean }> {
  const order = await orderRepository.findById(orderId);

  if (!order) {
    throw new Error('订单不存在');
  }

  if (order.userId !== user.id) {
    throw new Error('无权支付此订单');
  }

  if (order.paymentStatus === 'paid') {
    throw new Error('订单已支付');
  }

  const presale = await presaleRepository.findById(order.presaleId);
  if (!presale) {
    throw new Error('预售不存在');
  }

  const availability = await presaleService.checkPresaleAvailability(
    order.presaleId,
    order.quantity,
    user
  );

  if (availability.available) {
    const paidOrder = await payOrder(orderId, user);
    return { order: paidOrder, waitlisted: false };
  }

  if (!availability.canWaitlist) {
    throw new Error(availability.message);
  }

  const updatedOrder = await orderRepository.updatePaymentStatus(
    orderId,
    'paid',
    dayjs().format('YYYY-MM-DD HH:mm:ss')
  );

  if (!updatedOrder) {
    throw new Error('支付失败');
  }

  const waitlistEntry = await waitlistService.addToWaitlist(updatedOrder, order.presaleId);

  const orderWithWaitlist = await orderRepository.updatePickupStatus(
    orderId,
    'waitlisted'
  );

  return { order: orderWithWaitlist!, waitlisted: true };
}

export async function pickupOrder(pickupCode: string, operator: User): Promise<Order> {
  const order = await orderRepository.findByPickupCode(pickupCode);

  if (!order) {
    throw new Error('取书码无效');
  }

  if (order.paymentStatus !== 'paid') {
    throw new Error('订单未支付，无法取书');
  }

  if (order.pickupStatus === 'picked') {
    throw new Error('订单已取书');
  }

  if (order.pickupStatus === 'expired') {
    throw new Error('订单已逾期，取书码已失效');
  }

  if (order.pickupStatus === 'waitlisted') {
    throw new Error('订单在候补中，无法取书');
  }

  const presale = await presaleRepository.findById(order.presaleId);
  if (!presale) {
    throw new Error('预售不存在');
  }

  if (dayjs().isAfter(dayjs(presale.pickupDeadline))) {
    throw new Error('已超过取书期限，取书码已失效');
  }

  await presaleRepository.incrementSoldStock(order.presaleId, order.quantity);

  const updatedOrder = await orderRepository.updatePickupStatus(
    order.id,
    'picked',
    dayjs().format('YYYY-MM-DD HH:mm:ss')
  );

  if (!updatedOrder) {
    throw new Error('取书确认失败');
  }

  return updatedOrder;
}

export async function expireSingleOrder(orderId: string, operator: User): Promise<Order> {
  const order = await orderRepository.findById(orderId);

  if (!order) {
    throw new Error('订单不存在');
  }

  if (order.pickupStatus === 'expired') {
    throw new Error('订单已逾期，无需重复操作');
  }

  if (order.pickupStatus === 'picked') {
    throw new Error('订单已取书，无法逾期取消');
  }

  if (order.paymentStatus !== 'paid') {
    throw new Error('订单未支付，无需库存释放');
  }

  const presale = await presaleRepository.findById(order.presaleId);
  if (!presale) {
    throw new Error('预售不存在');
  }

  if (dayjs().isBefore(dayjs(presale.pickupDeadline))) {
    throw new Error('未超过取书截止日期，不能提前取消');
  }

  const isWaitlisted = order.pickupStatus === 'waitlisted';

  if (isWaitlisted) {
    await presaleRepository.decrementWaitlistedStock(order.presaleId, order.quantity);
  } else {
    await presaleRepository.decrementLockedStock(order.presaleId, order.quantity);
  }

  const depositRetained = false;
  await refundService.createExpiredRefund(order, presale, depositRetained, operator);

  await stockReleaseRepository.create({
    orderId: order.id,
    presaleId: presale.id,
    userId: order.userId,
    userName: order.userName,
    quantity: order.quantity,
    depositAmount: order.depositAmount,
    depositRetained,
    reason: 'expired',
    remark: '逾期未取书，释放库存',
    operatorId: operator.id,
  });

  const updatedOrder = await orderRepository.expireOrder(order.id);

  if (!updatedOrder) {
    throw new Error('订单逾期处理失败');
  }

  await notificationService.createNotification({
    orderId: order.id,
    userId: order.userId,
    type: 'order_cancelled',
    content: `您预订的《${presale.bookTitle}》已超过取书期限，订单已取消，订金 ¥${order.depositAmount} 将退还。`,
  });

  return updatedOrder;
}

export async function releaseExpiredStock(): Promise<{ count: number; orders: Order[] }> {
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const expiredOrders = await orderRepository.findExpiredOrders(now);

  const releasedOrders: Order[] = [];

  for (const order of expiredOrders) {
    try {
      const presale = await presaleRepository.findById(order.presaleId);
      const isWaitlisted = order.pickupStatus === 'waitlisted';

      if (isWaitlisted) {
        await presaleRepository.decrementWaitlistedStock(order.presaleId, order.quantity);
      } else {
        await presaleRepository.decrementLockedStock(order.presaleId, order.quantity);
      }

      if (presale) {
        await refundService.createExpiredRefund(order, presale, false);

        await stockReleaseRepository.create({
          orderId: order.id,
          presaleId: presale.id,
          userId: order.userId,
          userName: order.userName,
          quantity: order.quantity,
          depositAmount: order.depositAmount,
          depositRetained: false,
          reason: 'expired',
          remark: '逾期未取书，自动释放库存',
        });
      }

      const updatedOrder = await orderRepository.expireOrder(order.id);

      if (updatedOrder) {
        releasedOrders.push(updatedOrder);

        await notificationService.createNotification({
          orderId: order.id,
          userId: order.userId,
          type: 'order_cancelled',
          content: `您预订的《${presale?.bookTitle || '书籍'}》已超过取书期限，订单已取消，订金 ¥${order.depositAmount} 将退还。`,
        });
      }
    } catch (err) {
      console.error(`Failed to release stock for order ${order.id}:`, err);
    }
  }

  return {
    count: releasedOrders.length,
    orders: releasedOrders,
  };
}

export async function checkAndAutoExpire(order: Order): Promise<Order> {
  if (order.pickupStatus === 'expired' || order.pickupStatus === 'picked') {
    return order;
  }

  if (order.paymentStatus !== 'paid') {
    return order;
  }

  const presale = await presaleRepository.findById(order.presaleId);
  if (!presale) {
    return order;
  }

  if (dayjs().isAfter(dayjs(presale.pickupDeadline))) {
    try {
      const isWaitlisted = order.pickupStatus === 'waitlisted';

      if (isWaitlisted) {
        await presaleRepository.decrementWaitlistedStock(order.presaleId, order.quantity);
      } else {
        await presaleRepository.decrementLockedStock(order.presaleId, order.quantity);
      }

      await refundService.createExpiredRefund(order, presale, false);

      await stockReleaseRepository.create({
        orderId: order.id,
        presaleId: presale.id,
        userId: order.userId,
        userName: order.userName,
        quantity: order.quantity,
        depositAmount: order.depositAmount,
        depositRetained: false,
        reason: 'expired',
        remark: '逾期未取书，自动释放库存',
      });

      const updatedOrder = await orderRepository.expireOrder(order.id);
      if (updatedOrder) {
        await notificationService.createNotification({
          orderId: order.id,
          userId: order.userId,
          type: 'order_cancelled',
          content: `您预订的《${presale.bookTitle}》已超过取书期限，订单已取消，订金 ¥${order.depositAmount} 将退还。`,
        });
        return updatedOrder;
      }
    } catch (err) {
      console.error(`Auto expire order ${order.id} failed:`, err);
    }
  }

  return order;
}

export async function checkAndAutoExpireOrders(orders: Order[]): Promise<Order[]> {
  const result: Order[] = [];
  for (const order of orders) {
    const updated = await checkAndAutoExpire(order);
    result.push(updated);
  }
  return result;
}

export async function getOrderByPickupCode(pickupCode: string): Promise<Order | null> {
  const order = await orderRepository.findByPickupCode(pickupCode);
  if (!order) return null;
  return checkAndAutoExpire(order);
}

export async function getOrdersByPresaleId(presaleId: string): Promise<Order[]> {
  return orderRepository.findByPresaleId(presaleId);
}

export async function getReadyForPickupOrders(presaleId: string): Promise<Order[]> {
  return orderRepository.findReadyForPickupOrders(presaleId);
}

export async function updatePickupStatusInternal(
  orderId: string,
  pickupStatus: Order['pickupStatus']
): Promise<Order | null> {
  return orderRepository.updatePickupStatus(orderId, pickupStatus);
}

export async function getPendingOrdersSorted(presaleId: string): Promise<Order[]> {
  return orderRepository.findPaidOrdersByPresaleIdSorted(presaleId);
}

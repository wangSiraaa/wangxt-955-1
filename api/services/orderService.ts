import * as orderRepository from '../repositories/orderRepository.js';
import * as presaleRepository from '../repositories/presaleRepository.js';
import * as presaleService from './presaleService.js';
import * as notificationService from './notificationService.js';
import type { Order, CreateOrderRequest, User, Presale } from '../../shared/types.js';
import dayjs from 'dayjs';

export async function getAllOrders(user?: User): Promise<Order[]> {
  if (user?.role === 'member') {
    return orderRepository.findByUserId(user.id);
  }
  return orderRepository.findAll();
}

export async function getOrderById(id: string, user?: User): Promise<Order | null> {
  const order = await orderRepository.findById(id);
  
  if (!order) return null;
  
  if (user?.role === 'member' && order.userId !== user.id) {
    return null;
  }
  
  return order;
}

export async function createOrder(
  request: CreateOrderRequest,
  user: User
): Promise<Order> {
  const availability = await presaleService.checkPresaleAvailability(
    request.presaleId,
    request.quantity
  );

  if (!availability.available || !availability.presale) {
    throw new Error(availability.message);
  }

  const presale = availability.presale;
  const totalAmount = presale.price * request.quantity;
  const depositAmount = presale.deposit * request.quantity;

  const order = await orderRepository.create({
    presaleId: request.presaleId,
    userId: user.id,
    userName: user.name,
    quantity: request.quantity,
    totalAmount,
    depositAmount,
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
    order.quantity
  );

  if (!availability.available) {
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

export async function releaseExpiredStock(): Promise<{ count: number; orders: Order[] }> {
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const expiredOrders = await orderRepository.findExpiredOrders(now);
  
  const releasedOrders: Order[] = [];

  for (const order of expiredOrders) {
    try {
      await presaleRepository.decrementLockedStock(order.presaleId, order.quantity);
      
      const updatedOrder = await orderRepository.updatePickupStatus(order.id, 'expired');
      
      if (updatedOrder) {
        releasedOrders.push(updatedOrder);
        
        await notificationService.createNotification({
          orderId: order.id,
          userId: order.userId,
          type: 'order_cancelled',
          content: `您预订的书籍已超过取书期限，订单已取消，订金将退还。`,
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

export async function getOrderByPickupCode(pickupCode: string): Promise<Order | null> {
  return orderRepository.findByPickupCode(pickupCode);
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

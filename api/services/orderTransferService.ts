import * as orderTransferRepository from '../repositories/orderTransferRepository.js';
import * as orderRepository from '../repositories/orderRepository.js';
import * as userRepository from '../repositories/userRepository.js';
import * as notificationService from './notificationService.js';
import type { OrderTransfer, User, Order } from '../../shared/types.js';
import dayjs from 'dayjs';

export async function getTransferById(id: string): Promise<OrderTransfer | null> {
  return orderTransferRepository.findById(id);
}

export async function getTransfersByOrderId(orderId: string): Promise<OrderTransfer[]> {
  return orderTransferRepository.findByOrderId(orderId);
}

export async function getTransfersByUser(userId: string): Promise<{
  outgoing: OrderTransfer[];
  incoming: OrderTransfer[];
}> {
  const [outgoing, incoming] = await Promise.all([
    orderTransferRepository.findByFromUserId(userId),
    orderTransferRepository.findByToUserId(userId),
  ]);
  return { outgoing, incoming };
}

export async function requestTransfer(
  orderId: string,
  toUserId: string,
  fromUser: User,
  remark?: string
): Promise<OrderTransfer> {
  const order = await orderRepository.findById(orderId);
  if (!order) {
    throw new Error('订单不存在');
  }

  if (order.userId !== fromUser.id) {
    throw new Error('只能转让自己的订单');
  }

  if (order.paymentStatus !== 'paid') {
    throw new Error('未支付的订单不能转让');
  }

  if (order.pickupStatus === 'picked') {
    throw new Error('已取书的订单不能转让');
  }

  if (order.pickupStatus === 'expired') {
    throw new Error('已逾期的订单不能转让');
  }

  const hasCompleted = await orderTransferRepository.hasCompletedTransfer(orderId);
  if (hasCompleted) {
    throw new Error('订单已转让过，只能转让一次');
  }

  const hasPending = await orderTransferRepository.hasPendingTransfer(orderId);
  if (hasPending) {
    throw new Error('订单已有待处理的转让申请');
  }

  if (toUserId === fromUser.id) {
    throw new Error('不能转让给自己');
  }

  const toUser = await userRepository.findById(toUserId);
  if (!toUser) {
    throw new Error('目标会员不存在');
  }

  if (toUser.role !== 'member') {
    throw new Error('只能转让给会员');
  }

  const transfer = await orderTransferRepository.create({
    orderId,
    fromUserId: fromUser.id,
    fromUserName: fromUser.name,
    toUserId,
    toUserName: toUser.name,
    remark,
  });

  await notificationService.createNotification({
    orderId,
    userId: toUserId,
    type: 'transfer_request',
    content: `${fromUser.name} 向您转让了一本预售书订单，请确认是否接受。`,
    relatedId: transfer.id,
  });

  return transfer;
}

export async function acceptTransfer(
  transferId: string,
  toUser: User
): Promise<{ transfer: OrderTransfer; order: Order | null }> {
  const transfer = await orderTransferRepository.findById(transferId);
  if (!transfer) {
    throw new Error('转让记录不存在');
  }

  if (transfer.toUserId !== toUser.id) {
    throw new Error('无权处理此转让申请');
  }

  if (transfer.status !== 'pending') {
    throw new Error('转让申请已处理');
  }

  const order = await orderRepository.findById(transfer.orderId);
  if (!order) {
    throw new Error('订单不存在');
  }

  if (order.pickupStatus === 'picked' || order.pickupStatus === 'expired') {
    throw new Error('订单状态不允许转让');
  }

  const updatedTransfer = await orderTransferRepository.updateStatus(
    transferId,
    'completed',
    dayjs().format('YYYY-MM-DD HH:mm:ss')
  );

  const updatedOrder = await orderRepository.transferOrder(
    transfer.orderId,
    toUser.id,
    toUser.name,
    transfer.fromUserId
  );

  if (updatedOrder) {
    await notificationService.createNotification({
      orderId: transfer.orderId,
      userId: transfer.fromUserId,
      type: 'transfer_completed',
      content: `您的订单转让已被 ${toUser.name} 接受。`,
      relatedId: transferId,
    });
  }

  return {
    transfer: updatedTransfer!,
    order: updatedOrder,
  };
}

export async function rejectTransfer(
  transferId: string,
  toUser: User,
  remark?: string
): Promise<OrderTransfer | null> {
  const transfer = await orderTransferRepository.findById(transferId);
  if (!transfer) {
    throw new Error('转让记录不存在');
  }

  if (transfer.toUserId !== toUser.id) {
    throw new Error('无权处理此转让申请');
  }

  if (transfer.status !== 'pending') {
    throw new Error('转让申请已处理');
  }

  const updatedTransfer = await orderTransferRepository.updateStatus(transferId, 'cancelled');

  if (updatedTransfer) {
    await notificationService.createNotification({
      orderId: transfer.orderId,
      userId: transfer.fromUserId,
      type: 'transfer_request',
      content: `您的订单转让被 ${toUser.name} 拒绝了。${remark ? '原因：' + remark : ''}`,
      relatedId: transferId,
    });
  }

  return updatedTransfer;
}

export async function cancelTransfer(
  transferId: string,
  fromUser: User
): Promise<OrderTransfer | null> {
  const transfer = await orderTransferRepository.findById(transferId);
  if (!transfer) {
    throw new Error('转让记录不存在');
  }

  if (transfer.fromUserId !== fromUser.id) {
    throw new Error('无权取消此转让申请');
  }

  if (transfer.status !== 'pending') {
    throw new Error('转让申请已处理，不能取消');
  }

  return orderTransferRepository.updateStatus(transferId, 'cancelled');
}

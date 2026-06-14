import * as refundRepository from '../repositories/refundRepository.js';
import * as orderRepository from '../repositories/orderRepository.js';
import * as presaleRepository from '../repositories/presaleRepository.js';
import * as stockReleaseRepository from '../repositories/stockReleaseRepository.js';
import * as notificationService from './notificationService.js';
import type {
  RefundRecord,
  RefundType,
  RefundReason,
  User,
  Order,
  Presale,
} from '../../shared/types.js';
import dayjs from 'dayjs';

export async function getRefundById(id: string): Promise<RefundRecord | null> {
  return refundRepository.findById(id);
}

export async function getRefundsByOrderId(orderId: string): Promise<RefundRecord[]> {
  return refundRepository.findByOrderId(orderId);
}

export async function getRefundsByPresaleId(presaleId: string): Promise<RefundRecord[]> {
  return refundRepository.findByPresaleId(presaleId);
}

export async function getRefundsByUserId(userId: string): Promise<RefundRecord[]> {
  return refundRepository.findByUserId(userId);
}

export async function createRefund(
  order: Order,
  presale: Presale,
  refundType: RefundType,
  refundReason: RefundReason,
  refundAmount: number,
  operator: User,
  remark?: string
): Promise<RefundRecord> {
  const refund = await refundRepository.create({
    orderId: order.id,
    presaleId: presale.id,
    userId: order.userId,
    userName: order.userName,
    refundType,
    refundStatus: 'processing',
    refundReason,
    refundAmount,
    depositAmount: order.depositAmount,
    remark,
    operatorId: operator.id,
  });

  return refund;
}

export async function processRefund(
  refundId: string,
  operator: User
): Promise<{ refund: RefundRecord | null; order: Order | null }> {
  const refund = await refundRepository.findById(refundId);
  if (!refund) {
    throw new Error('退款记录不存在');
  }

  if (refund.refundStatus !== 'processing') {
    throw new Error('退款已处理');
  }

  const order = await orderRepository.findById(refund.orderId);
  if (!order) {
    throw new Error('订单不存在');
  }

  const updatedRefund = await refundRepository.updateStatus(
    refundId,
    'completed',
    dayjs().format('YYYY-MM-DD HH:mm:ss')
  );

  let updatedOrder: Order | null = null;
  if (refund.refundType === 'full') {
    updatedOrder = await orderRepository.updatePaymentStatus(refund.orderId, 'refunded');
  } else if (refund.refundType === 'partial') {
    updatedOrder = await orderRepository.updatePaymentStatus(refund.orderId, 'partial_refunded');
  }

  if (updatedRefund) {
    await notificationService.createNotification({
      orderId: refund.orderId,
      userId: refund.userId,
      type: 'refund_completed',
      content: `您的退款 ¥${refund.refundAmount} 已处理完成。`,
      relatedId: refundId,
    });
  }

  return { refund: updatedRefund, order: updatedOrder };
}

export async function createWaitlistRefund(
  order: Order,
  presale: Presale,
  operator: User
): Promise<RefundRecord> {
  const refund = await createRefund(
    order,
    presale,
    'deposit',
    'out_of_stock',
    order.depositAmount,
    operator,
    '候补失败，退还订金'
  );

  await stockReleaseRepository.create({
    orderId: order.id,
    presaleId: presale.id,
    userId: order.userId,
    userName: order.userName,
    quantity: order.quantity,
    depositAmount: order.depositAmount,
    depositRetained: false,
    reason: 'waitlist_refund',
    remark: '候补失败退还订金',
    operatorId: operator.id,
  });

  await processRefund(refund.id, operator);

  return refund;
}

export async function createExpiredRefund(
  order: Order,
  presale: Presale,
  depositRetained: boolean,
  operator?: User
): Promise<RefundRecord> {
  const refundAmount = depositRetained ? 0 : order.depositAmount;
  const refundType: RefundType = depositRetained ? 'deposit' : 'deposit';
  const refundStatus = depositRetained ? 'failed' : 'processing';

  const refund = await refundRepository.create({
    orderId: order.id,
    presaleId: presale.id,
    userId: order.userId,
    userName: order.userName,
    refundType,
    refundStatus,
    refundReason: 'expired',
    refundAmount,
    depositAmount: order.depositAmount,
    remark: depositRetained ? '逾期未取书，订金不予退还' : '逾期未取书，退还订金',
    operatorId: operator?.id,
  });

  if (!depositRetained) {
    await refundRepository.updateStatus(
      refund.id,
      'completed',
      dayjs().format('YYYY-MM-DD HH:mm:ss')
    );
  }

  return refund;
}

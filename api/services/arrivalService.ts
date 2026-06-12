import * as arrivalRepository from '../repositories/arrivalRepository.js';
import * as presaleRepository from '../repositories/presaleRepository.js';
import * as orderService from './orderService.js';
import * as notificationService from './notificationService.js';
import type { Arrival, ArrivalRequest, User, Order } from '../../shared/types.js';
import dayjs from 'dayjs';

export async function getAllArrivals(): Promise<Arrival[]> {
  return arrivalRepository.findAll();
}

export async function getArrivalsByPresaleId(presaleId: string): Promise<Arrival[]> {
  return arrivalRepository.findByPresaleId(presaleId);
}

export async function recordArrival(
  request: ArrivalRequest,
  operator: User
): Promise<{ arrival: Arrival; notifiedOrders: Order[] }> {
  const presale = await presaleRepository.findById(request.presaleId);
  
  if (!presale) {
    throw new Error('预售不存在');
  }

  const arrival = await arrivalRepository.create({
    presaleId: request.presaleId,
    quantity: request.quantity,
    operatorId: operator.id,
    remark: request.remark,
  });

  await presaleRepository.update(request.presaleId, { status: 'arrived' });

  const readyOrders = await orderService.getReadyForPickupOrders(request.presaleId);
  const notifiedOrders: Order[] = [];

  for (const order of readyOrders) {
    try {
      const updatedOrder = await orderService.updatePickupStatusInternal(
        order.id,
        'ready'
      );

      if (updatedOrder) {
        notifiedOrders.push(updatedOrder);
        
        await notificationService.createNotification({
          orderId: order.id,
          userId: order.userId,
          type: 'pickup_ready',
          content: `您预订的《${presale.bookTitle}》已到货，请在 ${dayjs(presale.pickupDeadline).format('YYYY-MM-DD')} 前凭取书码 ${order.pickupCode} 到店取书。`,
        });
      }
    } catch (err) {
      console.error(`Failed to process order ${order.id}:`, err);
    }
  }

  return { arrival, notifiedOrders };
}

export async function getArrivalById(id: string): Promise<Arrival | null> {
  return arrivalRepository.findById(id);
}

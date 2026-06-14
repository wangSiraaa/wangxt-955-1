import * as arrivalRepository from '../repositories/arrivalRepository.js';
import * as presaleRepository from '../repositories/presaleRepository.js';
import * as presaleBatchRepository from '../repositories/presaleBatchRepository.js';
import * as orderRepository from '../repositories/orderRepository.js';
import * as waitlistService from './waitlistService.js';
import * as notificationService from './notificationService.js';
import type {
  Arrival,
  ArrivalRequest,
  User,
  Order,
  WaitlistEntry,
} from '../../shared/types.js';
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
): Promise<{
  arrival: Arrival;
  allocatedOrders: Order[];
  waitlistNotifications: WaitlistEntry[];
  batchNo: number;
}> {
  const presale = await presaleRepository.findById(request.presaleId);

  if (!presale) {
    throw new Error('预售不存在');
  }

  const batches = await presaleBatchRepository.findByPresaleId(request.presaleId);
  let batchNo = request.batchNo;

  if (!batchNo) {
    const maxBatchNo = await presaleBatchRepository.getMaxBatchNo(request.presaleId);
    batchNo = maxBatchNo + 1;
  }

  const arrival = await arrivalRepository.create({
    presaleId: request.presaleId,
    quantity: request.quantity,
    operatorId: operator.id,
    remark: request.remark,
    batchNo,
  });

  const existingBatch = batches.find((b) => b.batchNo === batchNo);
  if (existingBatch) {
    await presaleBatchRepository.incrementArrivedQuantity(
      existingBatch.id,
      request.quantity
    );
  } else {
    await presaleBatchRepository.create({
      presaleId: request.presaleId,
      batchNo,
      expectedArrivalDate: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      quantity: request.quantity,
      arrivedQuantity: request.quantity,
      status: 'arrived',
      remark: request.remark,
    });
  }

  const pendingOrders = await orderRepository.findPaidOrdersByPresaleIdSorted(
    request.presaleId
  );

  const actualPending = pendingOrders.filter(
    (o) => o.pickupStatus === 'pending' || o.pickupStatus === 'waitlisted'
  );

  const allocatedOrders: Order[] = [];
  let remainingStock = request.quantity;

  for (const order of actualPending) {
    if (remainingStock <= 0) break;

    if (order.quantity <= remainingStock) {
      try {
        const wasWaitlisted = order.pickupStatus === 'waitlisted';

        if (wasWaitlisted) {
          await presaleRepository.incrementLockedStock(
            request.presaleId,
            order.quantity
          );
          await presaleRepository.decrementWaitlistedStock(
            request.presaleId,
            order.quantity
          );
          await waitlistService.confirmWaitlistForOrder(order.id);
        }

        const updatedOrder = await orderRepository.updatePickupStatusAndBatch(
          order.id,
          'ready',
          batchNo
        );

        if (updatedOrder) {
          allocatedOrders.push(updatedOrder);
          remainingStock -= order.quantity;

          await notificationService.createNotification({
            orderId: order.id,
            userId: order.userId,
            type: 'pickup_ready',
            content: `您预订的《${presale.bookTitle}》第 ${batchNo} 批次已到货，请在 ${dayjs(presale.pickupDeadline).format('YYYY-MM-DD')} 前凭取书码 ${order.pickupCode} 到店取书。`,
          });
        }
      } catch (err) {
        console.error(`Failed to allocate order ${order.id}:`, err);
      }
    }
  }

  const waitlistEntries = await waitlistService.processWaitlistForArrival(
    request.presaleId,
    remainingStock,
    batchNo
  );

  const allBatches = await presaleBatchRepository.findByPresaleId(request.presaleId);
  const totalArrived = allBatches.reduce((sum, b) => sum + (b.arrivedQuantity || 0), 0);
  const totalExpected = allBatches.reduce((sum, b) => sum + b.quantity, 0);

  if (totalArrived >= presale.totalStock || totalArrived >= totalExpected) {
    await presaleRepository.update(request.presaleId, { status: 'arrived' });
  } else {
    await presaleRepository.update(request.presaleId, { status: 'partial_arrived' });
  }

  return {
    arrival,
    allocatedOrders,
    waitlistNotifications: waitlistEntries,
    batchNo,
  };
}

export async function getArrivalById(id: string): Promise<Arrival | null> {
  return arrivalRepository.findById(id);
}

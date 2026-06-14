import * as presaleBatchRepository from '../repositories/presaleBatchRepository.js';
import * as presaleRepository from '../repositories/presaleRepository.js';
import type { PresaleBatch, User } from '../../shared/types.js';
import dayjs from 'dayjs';

export async function getBatchesByPresaleId(presaleId: string): Promise<PresaleBatch[]> {
  return presaleBatchRepository.findByPresaleId(presaleId);
}

export async function getBatchById(id: string): Promise<PresaleBatch | null> {
  return presaleBatchRepository.findById(id);
}

export async function createBatch(
  presaleId: string,
  batchData: {
    expectedArrivalDate: string;
    quantity: number;
    remark?: string;
  },
  _user: User
): Promise<PresaleBatch> {
  const presale = await presaleRepository.findById(presaleId);
  if (!presale) {
    throw new Error('预售不存在');
  }

  const maxBatchNo = await presaleBatchRepository.getMaxBatchNo(presaleId);
  const batchNo = maxBatchNo + 1;

  return presaleBatchRepository.create({
    presaleId,
    batchNo,
    expectedArrivalDate: batchData.expectedArrivalDate,
    quantity: batchData.quantity,
    remark: batchData.remark,
  });
}

export async function updateBatch(
  batchId: string,
  updates: Partial<PresaleBatch>,
  _user: User
): Promise<PresaleBatch | null> {
  const batch = await presaleBatchRepository.findById(batchId);
  if (!batch) {
    throw new Error('批次不存在');
  }

  return presaleBatchRepository.update(batchId, updates);
}

export async function deleteBatch(batchId: string, _user: User): Promise<void> {
  const batch = await presaleBatchRepository.findById(batchId);
  if (!batch) {
    throw new Error('批次不存在');
  }

  if (batch.status === 'arrived') {
    throw new Error('已到货的批次不能删除');
  }

  await presaleBatchRepository.remove(batchId);
}

export async function delayBatch(
  batchId: string,
  newExpectedDate: string,
  remark: string,
  _user: User
): Promise<PresaleBatch | null> {
  const batch = await presaleBatchRepository.findById(batchId);
  if (!batch) {
    throw new Error('批次不存在');
  }

  if (dayjs(newExpectedDate).isBefore(dayjs(batch.expectedArrivalDate))) {
    throw new Error('新的预计到货日期不能早于原日期');
  }

  const delayRemark = remark ? `延期：${remark}` : '延期';
  
  return presaleBatchRepository.update(batchId, {
    expectedArrivalDate: newExpectedDate,
    remark: batch.remark ? `${batch.remark}；${delayRemark}` : delayRemark,
  });
}

export async function markBatchArrived(
  batchId: string,
  arrivedQuantity: number,
  _user: User
): Promise<PresaleBatch | null> {
  const batch = await presaleBatchRepository.findById(batchId);
  if (!batch) {
    throw new Error('批次不存在');
  }

  if (batch.status === 'arrived') {
    throw new Error('批次已标记到货');
  }

  const totalArrived = (batch.arrivedQuantity || 0) + arrivedQuantity;
  const isFullyArrived = totalArrived >= batch.quantity;

  return presaleBatchRepository.update(batchId, {
    arrivedQuantity: totalArrived,
    status: isFullyArrived ? 'arrived' : batch.status,
    arrivedAt: isFullyArrived ? dayjs().format('YYYY-MM-DD HH:mm:ss') : batch.arrivedAt,
  });
}

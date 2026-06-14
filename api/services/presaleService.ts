import * as presaleRepository from '../repositories/presaleRepository.js';
import * as presaleBatchRepository from '../repositories/presaleBatchRepository.js';
import * as orderRepository from '../repositories/orderRepository.js';
import * as refundRepository from '../repositories/refundRepository.js';
import * as stockReleaseRepository from '../repositories/stockReleaseRepository.js';
import * as waitlistRepository from '../repositories/waitlistRepository.js';
import * as arrivalRepository from '../repositories/arrivalRepository.js';
import type {
  Presale,
  CreatePresaleRequest,
  User,
  PresaleDetailWithRelations,
  MemberLevel,
} from '../../shared/types.js';
import { isPresaleActive, isPresaleUpcoming, formatDate } from '../utils/helpers.js';
import { memberLevelConfig } from '../../shared/types.js';
import dayjs from 'dayjs';

export async function getAllPresales(): Promise<Presale[]> {
  const presales = await presaleRepository.findAll();
  return presales.map(updatePresaleStatus);
}

export async function getPresaleById(id: string): Promise<Presale | null> {
  const presale = await presaleRepository.findById(id);
  if (!presale) return null;
  return updatePresaleStatus(presale);
}

export async function getPresaleDetail(id: string): Promise<PresaleDetailWithRelations | null> {
  const presale = await getPresaleById(id);
  if (!presale) return null;

  const [batches, arrivals, refunds, stockReleases, waitlistCount, orders] =
    await Promise.all([
      presaleBatchRepository.findByPresaleId(id),
      arrivalRepository.findByPresaleId(id),
      refundRepository.findByPresaleId(id),
      stockReleaseRepository.findByPresaleId(id),
      waitlistRepository.getCountByPresaleId(id),
      orderRepository.findByPresaleId(id),
    ]);

  return {
    ...presale,
    batches,
    arrivals,
    refunds,
    stockReleases,
    waitlistCount,
    orderCount: orders.length,
  };
}

export async function createPresale(
  request: CreatePresaleRequest,
  _user: User
): Promise<Presale> {
  let status: Presale['status'] = 'draft';

  if (isPresaleUpcoming(request.presaleStartTime)) {
    status = 'upcoming';
  } else if (isPresaleActive(request.presaleStartTime, request.presaleEndTime)) {
    status = 'active';
  } else {
    status = 'ended';
  }

  const presale = await presaleRepository.create({
    ...request,
    status,
  });

  if (request.batches && request.batches.length > 0) {
    for (let i = 0; i < request.batches.length; i++) {
      const batch = request.batches[i];
      await presaleBatchRepository.create({
        presaleId: presale.id,
        batchNo: i + 1,
        expectedArrivalDate: batch.expectedArrivalDate,
        quantity: batch.quantity,
        remark: batch.remark,
      });
    }
  }

  return presale;
}

export async function updatePresale(
  id: string,
  updates: Partial<Presale>,
  _user: User
): Promise<Presale | null> {
  return presaleRepository.update(id, updates);
}

function updatePresaleStatus(presale: Presale): Presale {
  if (
    presale.status === 'arrived' ||
    presale.status === 'draft' ||
    presale.status === 'partial_arrived'
  ) {
    return presale;
  }

  let newStatus = presale.status;

  if (isPresaleUpcoming(presale.presaleStartTime)) {
    newStatus = 'upcoming';
  } else if (isPresaleActive(presale.presaleStartTime, presale.presaleEndTime)) {
    newStatus = 'active';
  } else {
    newStatus = 'ended';
  }

  if (newStatus !== presale.status) {
    presaleRepository.update(presale.id, { status: newStatus }).catch(console.error);
    return { ...presale, status: newStatus };
  }

  return presale;
}

export async function checkMemberLevelLimit(
  presaleId: string,
  userId: string,
  memberLevel: MemberLevel,
  quantity: number
): Promise<{ allowed: boolean; message: string }> {
  const presale = await getPresaleById(presaleId);
  if (!presale) {
    return { allowed: false, message: '预售不存在' };
  }

  if (!presale.memberLevelLimit) {
    return { allowed: true, message: '无会员等级限制' };
  }

  const limit = presale.memberLevelLimit[memberLevel];
  if (limit === undefined || limit === 0) {
    return { allowed: false, message: `${memberLevelConfig[memberLevel].name}不可预订此书` };
  }

  const userOrders = await orderRepository.findByUserId(userId);
  const userPresaleOrders = userOrders.filter(
    (o) =>
      o.presaleId === presaleId &&
      o.paymentStatus === 'paid' &&
      o.pickupStatus !== 'transferred'
  );
  const userTotalQty = userPresaleOrders.reduce((sum, o) => sum + o.quantity, 0);

  if (userTotalQty + quantity > limit) {
    return {
      allowed: false,
      message: `${memberLevelConfig[memberLevel].name}限购 ${limit} 本，您已预订 ${userTotalQty} 本`,
    };
  }

  return { allowed: true, message: '符合限购条件' };
}

export async function checkPresaleAvailability(
  presaleId: string,
  quantity: number,
  user?: User
): Promise<{
  available: boolean;
  message: string;
  presale: Presale | null;
  canWaitlist: boolean;
}> {
  const presale = await getPresaleById(presaleId);

  if (!presale) {
    return { available: false, message: '预售不存在', presale: null, canWaitlist: false };
  }

  if (presale.status === 'upcoming') {
    return {
      available: false,
      message: `预售尚未开始，开始时间：${formatDate(presale.presaleStartTime)}`,
      presale,
      canWaitlist: false,
    };
  }

  if (presale.status === 'ended') {
    return {
      available: false,
      message: `预售已结束，结束时间：${formatDate(presale.presaleEndTime)}`,
      presale,
      canWaitlist: false,
    };
  }

  if (presale.status !== 'active') {
    return { available: false, message: '预售当前不可预订', presale, canWaitlist: false };
  }

  if (user && user.role === 'member' && user.memberLevel) {
    const limitCheck = await checkMemberLevelLimit(
      presaleId,
      user.id,
      user.memberLevel,
      quantity
    );
    if (!limitCheck.allowed) {
      return { available: false, message: limitCheck.message, presale, canWaitlist: false };
    }
  }

  const availableStock = presale.totalStock - presale.lockedStock;

  if (availableStock < quantity) {
    return {
      available: false,
      message: `库存不足，剩余可预订：${availableStock} 本，可加入候补`,
      presale,
      canWaitlist: true,
    };
  }

  return { available: true, message: '可以预订', presale, canWaitlist: false };
}

export async function markAsArrived(presaleId: string, _user: User): Promise<Presale | null> {
  return presaleRepository.update(presaleId, { status: 'arrived' });
}

export async function markAsPartialArrived(
  presaleId: string,
  _user: User
): Promise<Presale | null> {
  return presaleRepository.update(presaleId, { status: 'partial_arrived' });
}

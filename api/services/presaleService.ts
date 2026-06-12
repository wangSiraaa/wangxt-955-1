import * as presaleRepository from '../repositories/presaleRepository.js';
import type { Presale, CreatePresaleRequest, User } from '../../shared/types.js';
import { isPresaleActive, isPresaleUpcoming, formatDate } from '../utils/helpers.js';
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

  return presaleRepository.create({
    ...request,
    status,
  });
}

export async function updatePresale(
  id: string,
  updates: Partial<Presale>,
  _user: User
): Promise<Presale | null> {
  return presaleRepository.update(id, updates);
}

function updatePresaleStatus(presale: Presale): Presale {
  if (presale.status === 'arrived' || presale.status === 'draft') {
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

export async function checkPresaleAvailability(presaleId: string, quantity: number): Promise<{
  available: boolean;
  message: string;
  presale: Presale | null;
}> {
  const presale = await getPresaleById(presaleId);
  
  if (!presale) {
    return { available: false, message: '预售不存在', presale: null };
  }

  if (presale.status === 'upcoming') {
    return { 
      available: false, 
      message: `预售尚未开始，开始时间：${formatDate(presale.presaleStartTime)}`, 
      presale 
    };
  }

  if (presale.status === 'ended') {
    return { 
      available: false, 
      message: `预售已结束，结束时间：${formatDate(presale.presaleEndTime)}`, 
      presale 
    };
  }

  if (presale.status !== 'active') {
    return { 
      available: false, 
      message: '预售当前不可预订', 
      presale 
    };
  }

  const availableStock = presale.totalStock - presale.lockedStock;
  
  if (availableStock < quantity) {
    return { 
      available: false, 
      message: `库存不足，剩余可预订：${availableStock} 本`, 
      presale 
    };
  }

  return { available: true, message: '可以预订', presale };
}

export async function markAsArrived(presaleId: string, _user: User): Promise<Presale | null> {
  return presaleRepository.update(presaleId, { status: 'arrived' });
}

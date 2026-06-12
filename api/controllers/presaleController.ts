import { Request, Response } from 'express';
import * as presaleService from '../services/presaleService.js';
import { successResponse, errorResponse } from '../utils/helpers.js';
import type { AuthRequest } from '../middleware/auth.js';

export async function getAllPresales(req: Request, res: Response) {
  try {
    const presales = await presaleService.getAllPresales();
    res.json(successResponse(presales));
  } catch (err) {
    res.status(500).json(errorResponse('获取预售列表失败'));
  }
}

export async function getPresaleById(req: Request, res: Response) {
  try {
    const presale = await presaleService.getPresaleById(req.params.id);
    if (!presale) {
      return res.status(404).json(errorResponse('预售不存在'));
    }
    res.json(successResponse(presale));
  } catch (err) {
    res.status(500).json(errorResponse('获取预售详情失败'));
  }
}

export async function createPresale(req: AuthRequest, res: Response) {
  try {
    const presale = await presaleService.createPresale(req.body, req.user!);
    res.status(201).json(successResponse(presale));
  } catch (err) {
    res.status(400).json(errorResponse(err instanceof Error ? err.message : '创建预售失败'));
  }
}

export async function updatePresale(req: AuthRequest, res: Response) {
  try {
    const presale = await presaleService.updatePresale(req.params.id, req.body, req.user!);
    if (!presale) {
      return res.status(404).json(errorResponse('预售不存在'));
    }
    res.json(successResponse(presale));
  } catch (err) {
    res.status(400).json(errorResponse(err instanceof Error ? err.message : '更新预售失败'));
  }
}

export async function checkAvailability(req: Request, res: Response) {
  try {
    const { presaleId, quantity } = req.query;
    const result = await presaleService.checkPresaleAvailability(
      presaleId as string,
      parseInt(quantity as string) || 1
    );
    res.json(successResponse(result));
  } catch (err) {
    res.status(500).json(errorResponse('检查库存失败'));
  }
}

export async function markAsArrived(req: AuthRequest, res: Response) {
  try {
    const presale = await presaleService.markAsArrived(req.params.id, req.user!);
    if (!presale) {
      return res.status(404).json(errorResponse('预售不存在'));
    }
    res.json(successResponse(presale));
  } catch (err) {
    res.status(400).json(errorResponse(err instanceof Error ? err.message : '标记到货失败'));
  }
}

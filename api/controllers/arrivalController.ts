import { Request, Response } from 'express';
import * as arrivalService from '../services/arrivalService.js';
import { successResponse, errorResponse } from '../utils/helpers.js';
import type { AuthRequest } from '../middleware/auth.js';

export async function getAllArrivals(req: AuthRequest, res: Response) {
  try {
    const arrivals = await arrivalService.getAllArrivals();
    res.json(successResponse(arrivals));
  } catch (err) {
    res.status(500).json(errorResponse('获取到货记录失败'));
  }
}

export async function getArrivalsByPresaleId(req: AuthRequest, res: Response) {
  try {
    const arrivals = await arrivalService.getArrivalsByPresaleId(req.params.presaleId);
    res.json(successResponse(arrivals));
  } catch (err) {
    res.status(500).json(errorResponse('获取到货记录失败'));
  }
}

export async function recordArrival(req: AuthRequest, res: Response) {
  try {
    const result = await arrivalService.recordArrival(req.body, req.user!);
    res.status(201).json(successResponse(result));
  } catch (err) {
    res.status(400).json(errorResponse(err instanceof Error ? err.message : '登记到货失败'));
  }
}

export async function getArrivalById(req: AuthRequest, res: Response) {
  try {
    const arrival = await arrivalService.getArrivalById(req.params.id);
    if (!arrival) {
      return res.status(404).json(errorResponse('到货记录不存在'));
    }
    res.json(successResponse(arrival));
  } catch (err) {
    res.status(500).json(errorResponse('获取到货记录失败'));
  }
}

import { Request, Response } from 'express';
import * as orderService from '../services/orderService.js';
import { successResponse, errorResponse } from '../utils/helpers.js';
import type { AuthRequest } from '../middleware/auth.js';

export async function getAllOrders(req: AuthRequest, res: Response) {
  try {
    const orders = await orderService.getAllOrders(req.user);
    res.json(successResponse(orders));
  } catch (err) {
    res.status(500).json(errorResponse('获取订单列表失败'));
  }
}

export async function getOrderById(req: AuthRequest, res: Response) {
  try {
    const order = await orderService.getOrderById(req.params.id, req.user);
    if (!order) {
      return res.status(404).json(errorResponse('订单不存在或无权查看'));
    }
    res.json(successResponse(order));
  } catch (err) {
    res.status(500).json(errorResponse('获取订单详情失败'));
  }
}

export async function createOrder(req: AuthRequest, res: Response) {
  try {
    const order = await orderService.createOrder(req.body, req.user!);
    res.status(201).json(successResponse(order));
  } catch (err) {
    res.status(400).json(errorResponse(err instanceof Error ? err.message : '创建订单失败'));
  }
}

export async function payOrder(req: AuthRequest, res: Response) {
  try {
    const order = await orderService.payOrder(req.params.id, req.user!);
    res.json(successResponse(order));
  } catch (err) {
    res.status(400).json(errorResponse(err instanceof Error ? err.message : '支付失败'));
  }
}

export async function pickupOrder(req: AuthRequest, res: Response) {
  try {
    const { pickupCode } = req.body;
    const order = await orderService.pickupOrder(pickupCode, req.user!);
    res.json(successResponse(order));
  } catch (err) {
    res.status(400).json(errorResponse(err instanceof Error ? err.message : '取书确认失败'));
  }
}

export async function getOrderByPickupCode(req: AuthRequest, res: Response) {
  try {
    const order = await orderService.getOrderByPickupCode(req.params.pickupCode);
    if (!order) {
      return res.status(404).json(errorResponse('取书码无效'));
    }
    res.json(successResponse(order));
  } catch (err) {
    res.status(500).json(errorResponse('查询订单失败'));
  }
}

export async function getOrdersByPresaleId(req: AuthRequest, res: Response) {
  try {
    const orders = await orderService.getOrdersByPresaleId(req.params.presaleId);
    res.json(successResponse(orders));
  } catch (err) {
    res.status(500).json(errorResponse('获取订单列表失败'));
  }
}

export async function releaseExpiredStock(req: AuthRequest, res: Response) {
  try {
    const result = await orderService.releaseExpiredStock();
    res.json(successResponse(result));
  } catch (err) {
    res.status(500).json(errorResponse('释放逾期库存失败'));
  }
}

export async function expireOrder(req: AuthRequest, res: Response) {
  try {
    const order = await orderService.expireSingleOrder(req.params.id, req.user!);
    res.json(successResponse(order));
  } catch (err) {
    res.status(400).json(errorResponse(err instanceof Error ? err.message : '订单逾期处理失败'));
  }
}

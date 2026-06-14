import { Request, Response } from 'express';
import * as orderService from '../services/orderService.js';
import * as orderTransferService from '../services/orderTransferService.js';
import * as waitlistService from '../services/waitlistService.js';
import * as refundService from '../services/refundService.js';
import * as presaleService from '../services/presaleService.js';
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

export async function getOrderDetail(req: AuthRequest, res: Response) {
  try {
    const detail = await orderService.getOrderDetail(req.params.id, req.user);
    if (!detail) {
      return res.status(404).json(errorResponse('订单不存在或无权查看'));
    }
    res.json(successResponse(detail));
  } catch (err) {
    res.status(500).json(errorResponse('获取订单详情失败'));
  }
}

export async function payOrderWithWaitlist(req: AuthRequest, res: Response) {
  try {
    const result = await orderService.payOrderWithWaitlist(req.params.id, req.user!);
    res.json(successResponse(result));
  } catch (err) {
    res.status(400).json(errorResponse(err instanceof Error ? err.message : '支付失败'));
  }
}

export async function requestTransfer(req: AuthRequest, res: Response) {
  try {
    const { toUserId, remark } = req.body;
    const transfer = await orderTransferService.requestTransfer(
      req.params.id,
      toUserId,
      req.user!,
      remark
    );
    res.json(successResponse(transfer));
  } catch (err) {
    res.status(400).json(errorResponse(err instanceof Error ? err.message : '转单申请失败'));
  }
}

export async function acceptTransfer(req: AuthRequest, res: Response) {
  try {
    const { transferId } = req.body;
    const result = await orderTransferService.acceptTransfer(transferId, req.user!);
    res.json(successResponse(result));
  } catch (err) {
    res.status(400).json(errorResponse(err instanceof Error ? err.message : '接受转单失败'));
  }
}

export async function rejectTransfer(req: AuthRequest, res: Response) {
  try {
    const { transferId, remark } = req.body;
    const transfer = await orderTransferService.rejectTransfer(transferId, req.user!, remark);
    res.json(successResponse(transfer));
  } catch (err) {
    res.status(400).json(errorResponse(err instanceof Error ? err.message : '拒绝转单失败'));
  }
}

export async function cancelTransfer(req: AuthRequest, res: Response) {
  try {
    const { transferId } = req.body;
    const transfer = await orderTransferService.cancelTransfer(transferId, req.user!);
    res.json(successResponse(transfer));
  } catch (err) {
    res.status(400).json(errorResponse(err instanceof Error ? err.message : '取消转单失败'));
  }
}

export async function getPendingTransfers(req: AuthRequest, res: Response) {
  try {
    const result = await orderTransferService.getTransfersByUser(req.user!.id);
    res.json(successResponse(result.incoming.filter((t) => t.status === 'pending')));
  } catch (err) {
    res.status(500).json(errorResponse('获取待处理转单失败'));
  }
}

export async function confirmWaitlist(req: AuthRequest, res: Response) {
  try {
    const { waitlistId, confirm } = req.body;
    if (confirm) {
      const result = await waitlistService.confirmWaitlist(waitlistId, req.user!);
      res.json(successResponse(result));
    } else {
      const result = await waitlistService.declineWaitlist(waitlistId, req.user!);
      res.json(successResponse({ entry: result }));
    }
  } catch (err) {
    res.status(400).json(errorResponse(err instanceof Error ? err.message : '候补处理失败'));
  }
}

export async function getWaitlistByUserId(req: AuthRequest, res: Response) {
  try {
    const entries = await waitlistService.getWaitlistByUserId(req.user!.id);
    res.json(successResponse(entries));
  } catch (err) {
    res.status(500).json(errorResponse('获取候补列表失败'));
  }
}

export async function createRefund(req: AuthRequest, res: Response) {
  try {
    const { refundType, refundReason, refundAmount, remark } = req.body;
    const order = await orderService.getOrderById(req.params.id);
    if (!order) {
      res.status(404).json(errorResponse('订单不存在'));
      return;
    }
    const presale = await presaleService.getPresaleById(order.presaleId);
    if (!presale) {
      res.status(404).json(errorResponse('预售不存在'));
      return;
    }
    const refund = await refundService.createRefund(
      order,
      presale,
      refundType,
      refundReason,
      refundAmount,
      req.user!,
      remark
    );
    res.json(successResponse(refund));
  } catch (err) {
    res.status(400).json(errorResponse(err instanceof Error ? err.message : '退款申请失败'));
  }
}

import { Request, Response } from 'express';
import * as notificationService from '../services/notificationService.js';
import { successResponse, errorResponse } from '../utils/helpers.js';
import type { AuthRequest } from '../middleware/auth.js';

export async function getAllNotifications(req: AuthRequest, res: Response) {
  try {
    const notifications = await notificationService.getAllNotifications(req.user);
    res.json(successResponse(notifications));
  } catch (err) {
    res.status(500).json(errorResponse('获取通知列表失败'));
  }
}

export async function getNotificationsByUserId(req: AuthRequest, res: Response) {
  try {
    const notifications = await notificationService.getNotificationsByUserId(req.params.userId);
    res.json(successResponse(notifications));
  } catch (err) {
    res.status(500).json(errorResponse('获取通知列表失败'));
  }
}

export async function getMyNotifications(req: AuthRequest, res: Response) {
  try {
    const notifications = await notificationService.getNotificationsByUserId(req.user!.id);
    res.json(successResponse(notifications));
  } catch (err) {
    res.status(500).json(errorResponse('获取我的通知失败'));
  }
}

export async function getUnreadCount(req: AuthRequest, res: Response) {
  try {
    const count = await notificationService.getUnreadCount(req.user!.id);
    res.json(successResponse({ unreadCount: count }));
  } catch (err) {
    res.status(500).json(errorResponse('获取未读数量失败'));
  }
}

export async function markAsRead(req: AuthRequest, res: Response) {
  try {
    const notification = await notificationService.markNotificationAsRead(req.params.id, req.user!);
    if (!notification) {
      return res.status(404).json(errorResponse('通知不存在'));
    }
    res.json(successResponse(notification));
  } catch (err) {
    res.status(400).json(errorResponse(err instanceof Error ? err.message : '标记已读失败'));
  }
}

export async function markAllAsRead(req: AuthRequest, res: Response) {
  try {
    await notificationService.markAllAsRead(req.user!);
    res.json(successResponse({ message: '所有通知已标记为已读' }));
  } catch (err) {
    res.status(500).json(errorResponse('标记已读失败'));
  }
}

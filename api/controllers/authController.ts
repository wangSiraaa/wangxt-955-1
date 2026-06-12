import { Request, Response } from 'express';
import * as authService from '../services/authService.js';
import { successResponse, errorResponse } from '../utils/helpers.js';
import type { AuthRequest } from '../middleware/auth.js';

export async function login(req: Request, res: Response) {
  try {
    const result = await authService.login(req.body);
    res.json(successResponse(result));
  } catch (err) {
    res.status(401).json(errorResponse(err instanceof Error ? err.message : '登录失败'));
  }
}

export async function getCurrentUser(req: AuthRequest, res: Response) {
  try {
    res.json(successResponse({ user: req.user }));
  } catch (err) {
    res.status(500).json(errorResponse('获取用户信息失败'));
  }
}

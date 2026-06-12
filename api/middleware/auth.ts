import { type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { User, UserRole } from '../../shared/types.js';
import { errorResponse } from '../utils/helpers.js';

const JWT_SECRET = process.env.JWT_SECRET || 'bookstore-presale-secret-key';

export interface AuthRequest extends Request {
  user?: User;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json(errorResponse('未提供认证令牌', 401));
    return;
  }

  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as User;
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json(errorResponse('认证令牌无效或已过期', 401));
  }
}

export function roleMiddleware(roles: UserRole | UserRole[]) {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json(errorResponse('请先登录', 401));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json(errorResponse('权限不足', 403));
      return;
    }

    next();
  };
}

export function generateToken(user: User): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
}

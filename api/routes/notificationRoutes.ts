import express from 'express';
import * as notificationController from '../controllers/notificationController.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authMiddleware, notificationController.getAllNotifications);
router.get('/my', authMiddleware, notificationController.getMyNotifications);
router.get('/unread-count', authMiddleware, notificationController.getUnreadCount);
router.post('/mark-all-read', authMiddleware, notificationController.markAllAsRead);
router.put('/:id/read', authMiddleware, notificationController.markAsRead);
router.get('/user/:userId', authMiddleware, notificationController.getNotificationsByUserId);

export default router;

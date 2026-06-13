import express from 'express';
import * as orderController from '../controllers/orderController.js';
import { authMiddleware, roleMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authMiddleware, orderController.getAllOrders);
router.get('/:id', authMiddleware, orderController.getOrderById);
router.get('/pickup-code/:pickupCode', authMiddleware, orderController.getOrderByPickupCode);
router.get('/presale/:presaleId', authMiddleware, orderController.getOrdersByPresaleId);
router.post('/', authMiddleware, roleMiddleware('member'), orderController.createOrder);
router.put('/:id/pay', authMiddleware, roleMiddleware('member'), orderController.payOrder);
router.post('/pickup', authMiddleware, roleMiddleware(['clerk', 'warehouse']), orderController.pickupOrder);
router.post('/release-expired', authMiddleware, roleMiddleware(['clerk', 'warehouse']), orderController.releaseExpiredStock);
router.put('/:id/expire', authMiddleware, roleMiddleware(['clerk', 'warehouse']), orderController.expireOrder);

export default router;

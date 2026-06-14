import express from 'express';
import * as orderController from '../controllers/orderController.js';
import { authMiddleware, roleMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authMiddleware, orderController.getAllOrders);
router.get('/waitlist', authMiddleware, roleMiddleware('member'), orderController.getWaitlistByUserId);
router.get('/transfers/pending', authMiddleware, orderController.getPendingTransfers);
router.get('/:id', authMiddleware, orderController.getOrderById);
router.get('/:id/detail', authMiddleware, orderController.getOrderDetail);
router.get('/pickup-code/:pickupCode', authMiddleware, orderController.getOrderByPickupCode);
router.get('/presale/:presaleId', authMiddleware, orderController.getOrdersByPresaleId);
router.post('/', authMiddleware, roleMiddleware('member'), orderController.createOrder);
router.put('/:id/pay', authMiddleware, roleMiddleware('member'), orderController.payOrder);
router.put('/:id/pay-waitlist', authMiddleware, roleMiddleware('member'), orderController.payOrderWithWaitlist);
router.post('/pickup', authMiddleware, roleMiddleware(['clerk', 'warehouse']), orderController.pickupOrder);
router.post('/release-expired', authMiddleware, roleMiddleware(['clerk', 'warehouse']), orderController.releaseExpiredStock);
router.put('/:id/expire', authMiddleware, roleMiddleware(['clerk', 'warehouse']), orderController.expireOrder);

router.post('/:id/transfer', authMiddleware, roleMiddleware('member'), orderController.requestTransfer);
router.post('/transfer/accept', authMiddleware, roleMiddleware('member'), orderController.acceptTransfer);
router.post('/transfer/reject', authMiddleware, roleMiddleware('member'), orderController.rejectTransfer);
router.post('/transfer/cancel', authMiddleware, roleMiddleware('member'), orderController.cancelTransfer);

router.post('/waitlist/confirm', authMiddleware, roleMiddleware('member'), orderController.confirmWaitlist);

router.post('/:id/refund', authMiddleware, orderController.createRefund);

export default router;

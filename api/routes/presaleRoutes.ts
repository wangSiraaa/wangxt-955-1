import express from 'express';
import * as presaleController from '../controllers/presaleController.js';
import { authMiddleware, roleMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.get('/', presaleController.getAllPresales);
router.get('/check-availability', presaleController.checkAvailability);
router.get('/:id', presaleController.getPresaleById);
router.post('/', authMiddleware, roleMiddleware('clerk'), presaleController.createPresale);
router.put('/:id', authMiddleware, roleMiddleware('clerk'), presaleController.updatePresale);
router.put('/:id/arrived', authMiddleware, roleMiddleware(['clerk', 'warehouse']), presaleController.markAsArrived);

export default router;

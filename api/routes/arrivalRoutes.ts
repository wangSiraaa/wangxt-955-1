import express from 'express';
import * as arrivalController from '../controllers/arrivalController.js';
import { authMiddleware, roleMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authMiddleware, roleMiddleware(['clerk', 'warehouse']), arrivalController.getAllArrivals);
router.get('/:id', authMiddleware, roleMiddleware(['clerk', 'warehouse']), arrivalController.getArrivalById);
router.get('/presale/:presaleId', authMiddleware, roleMiddleware(['clerk', 'warehouse']), arrivalController.getArrivalsByPresaleId);
router.post('/', authMiddleware, roleMiddleware('warehouse'), arrivalController.recordArrival);

export default router;

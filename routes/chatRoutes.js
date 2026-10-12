import express from 'express';
import { sendMessage } from '../controllers/chatController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Chat endpoint requires authentication
router.post('/', authenticateToken, sendMessage);

export default router;

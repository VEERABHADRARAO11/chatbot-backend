import express from 'express';
import {
  getConversations,
  createConversation,
  getConversationById,
  updateConversation,
  deleteConversation,
  getMessagesByConversation
} from '../controllers/conversationController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All conversation routes require authentication
router.use(authenticateToken);

router.route('/')
  .get(getConversations)
  .post(createConversation);

router.route('/:id')
  .get(getConversationById)
  .put(updateConversation)
  .delete(deleteConversation);

router.get('/:id/messages', getMessagesByConversation);

export default router;

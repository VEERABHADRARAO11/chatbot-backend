import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';

// @desc    Get all conversations for current user
// @route   GET /api/conversations
// @access  Private
export const getConversations = async (req, res, next) => {
  try {
    const conversations = await Conversation.find({ userId: req.user._id })
      .sort({ updatedAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      count: conversations.length,
      conversations
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create a new conversation
// @route   POST /api/conversations
// @access  Private
export const createConversation = async (req, res, next) => {
  try {
    const { title } = req.body;

    const conversation = await Conversation.create({
      userId: req.user._id,
      title: title && title.trim() ? title.trim() : 'New Conversation'
    });

    res.status(201).json({
      success: true,
      conversation
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single conversation by ID
// @route   GET /api/conversations/:id
// @access  Private
export const getConversationById = async (req, res, next) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found.'
      });
    }

    res.status(200).json({
      success: true,
      conversation
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update conversation title
// @route   PUT /api/conversations/:id
// @access  Private
export const updateConversation = async (req, res, next) => {
  try {
    const { title } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Title is required.'
      });
    }

    const conversation = await Conversation.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { title: title.trim() },
      { new: true, runValidators: true }
    );

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found.'
      });
    }

    res.status(200).json({
      success: true,
      conversation
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete a conversation and its messages
// @route   DELETE /api/conversations/:id
// @access  Private
export const deleteConversation = async (req, res, next) => {
  try {
    const conversation = await Conversation.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found.'
      });
    }

    // Cascade delete all messages associated with this conversation
    const deletedMessages = await Message.deleteMany({
      conversationId: req.params.id
    });

    res.status(200).json({
      success: true,
      message: 'Conversation and all associated messages deleted successfully.',
      deletedMessagesCount: deletedMessages.deletedCount
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all messages for a specific conversation
// @route   GET /api/conversations/:id/messages
// @access  Private
export const getMessagesByConversation = async (req, res, next) => {
  try {
    // Check conversation ownership first
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found.'
      });
    }

    const messages = await Message.find({ conversationId: req.params.id })
      .sort({ createdAt: 1 })
      .lean();

    res.status(200).json({
      success: true,
      conversation,
      count: messages.length,
      messages
    });
  } catch (error) {
    next(error);
  }
};

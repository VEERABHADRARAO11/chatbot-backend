import { GoogleGenerativeAI } from '@google/generative-ai';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';

// Format and sanitize history for Gemini multi-turn chat
const formatGeminiHistory = (messages) => {
  const formatted = [];
  let expectedRole = 'user';

  for (const msg of messages) {
    const role = msg.role === 'user' ? 'user' : 'model';

    // Gemini history must start with user and strictly alternate user -> model
    if (role === expectedRole) {
      formatted.push({
        role,
        parts: [{ text: msg.content }]
      });
      expectedRole = expectedRole === 'user' ? 'model' : 'user';
    }
  }

  // History must end with a 'model' turn so the next incoming message is 'user'
  if (formatted.length > 0 && formatted[formatted.length - 1].role === 'user') {
    formatted.pop();
  }

  return formatted;
};

// @desc    Send a message to Gemini and get a reply (with context)
// @route   POST /chat
// @access  Private
export const sendMessage = async (req, res, next) => {
  try {
    const { conversationId, message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Message content cannot be empty.'
      });
    }

    const trimmedMessage = message.trim();

    // Verify Gemini API key is configured
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey.trim() === '' || apiKey.includes('your_google_gemini_api_key')) {
      return res.status(500).json({
        success: false,
        message:
          'GEMINI_API_KEY is not configured. Please add your Gemini API key in server/.env file.'
      });
    }

    let conversation;

    // If conversationId is provided, look it up; otherwise create a new conversation
    if (conversationId) {
      conversation = await Conversation.findOne({
        _id: conversationId,
        userId: req.user._id
      });

      if (!conversation) {
        return res.status(404).json({
          success: false,
          message: 'Conversation not found or does not belong to you.'
        });
      }
    } else {
      const generatedTitle =
        trimmedMessage.length > 35
          ? `${trimmedMessage.slice(0, 35)}...`
          : trimmedMessage;

      conversation = await Conversation.create({
        userId: req.user._id,
        title: generatedTitle
      });
    }

    // Fetch prior messages for multi-turn context
    const previousMessages = await Message.find({
      conversationId: conversation._id
    })
      .sort({ createdAt: 1 })
      .limit(30)
      .lean();

    // 1. Save user's message to MongoDB
    const userMessage = await Message.create({
      conversationId: conversation._id,
      role: 'user',
      content: trimmedMessage
    });

    // 2. Auto-update title if it's currently default 'New Conversation'
    if (
      conversation.title === 'New Conversation' ||
      conversation.title === 'New Chat'
    ) {
      const updatedTitle =
        trimmedMessage.length > 35
          ? `${trimmedMessage.slice(0, 35)}...`
          : trimmedMessage;
      conversation.title = updatedTitle;
      await conversation.save();
    }

    // 3. Prepare Gemini API call with previous context
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction:
        'You are an intelligent, helpful, and friendly AI assistant. Answer queries clearly and use Markdown for formatting code, lists, and headings.'
    });

    const formattedHistory = formatGeminiHistory(previousMessages);

    let botReplyText = '';
    try {
      const chat = model.startChat({
        history: formattedHistory
      });

      const result = await chat.sendMessage(trimmedMessage);
      const response = await result.response;
      botReplyText = response.text();
    } catch (aiError) {
      console.error('Gemini API invocation error:', aiError);
      return res.status(502).json({
        success: false,
        message: `Gemini API Error: ${aiError.message || 'Failed to generate reply.'}`,
        userMessage // Return userMessage so UI doesn't lose user's input
      });
    }

    // 4. Save Gemini's reply to MongoDB
    const botMessage = await Message.create({
      conversationId: conversation._id,
      role: 'model',
      content: botReplyText
    });

    // 5. Update conversation timestamp
    conversation.updatedAt = new Date();
    await conversation.save();

    res.status(200).json({
      success: true,
      conversation,
      userMessage,
      botMessage
    });
  } catch (error) {
    next(error);
  }
};

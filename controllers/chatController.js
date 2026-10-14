import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';

// Query Wikipedia REST API and return a formatted markdown answer
const queryWikipedia = async (query) => {
  const encoded = encodeURIComponent(query.trim());

  // Step 1: Search for the best matching page title
  const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encoded}&srlimit=1&format=json&origin=*`;
  const searchRes = await fetch(searchUrl);
  const searchData = await searchRes.json();

  const results = searchData?.query?.search;
  if (!results || results.length === 0) {
    return `I searched Wikipedia but couldn't find any results for **"${query}"**. Try rephrasing your question.`;
  }

  const pageTitle = results[0].title;

  // Step 2: Fetch the page summary from REST API
  const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`;
  const summaryRes = await fetch(summaryUrl);

  if (!summaryRes.ok) {
    return `I found a Wikipedia page for **"${pageTitle}"** but couldn't retrieve its content. Try visiting: https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle)}`;
  }

  const summaryData = await summaryRes.json();

  const title = summaryData.title || pageTitle;
  const extract = summaryData.extract || 'No summary available.';
  const wikiUrl = summaryData.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle)}`;

  // Format as clean markdown
  return `## ${title}\n\n${extract}\n\n---\n📖 **Read more:** [${title} on Wikipedia](${wikiUrl})`;
};

// @desc    Send a message and get a Wikipedia-powered reply (with context)
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

    // 1. Save user's message to MongoDB
    const userMessage = await Message.create({
      conversationId: conversation._id,
      role: 'user',
      content: trimmedMessage
    });

    // 2. Auto-update title if it's currently a default placeholder
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

    // 3. Query Wikipedia for the answer
    let botReplyText = '';
    try {
      botReplyText = await queryWikipedia(trimmedMessage);
    } catch (wikiError) {
      console.error('Wikipedia API error:', wikiError);
      return res.status(502).json({
        success: false,
        message: `Wikipedia API Error: ${wikiError.message || 'Failed to fetch reply.'}`,
        userMessage
      });
    }

    // 4. Save bot's reply to MongoDB
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

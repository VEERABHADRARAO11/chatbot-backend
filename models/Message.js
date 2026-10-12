import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: [true, 'Conversation ID is required'],
      index: true
    },
    role: {
      type: String,
      required: [true, 'Role is required'],
      enum: {
        values: ['user', 'model', 'assistant'],
        message: '{VALUE} is not a valid role'
      }
    },
    content: {
      type: String,
      required: [true, 'Message content is required'],
      trim: true
    }
  },
  {
    timestamps: true
  }
);

const Message = mongoose.model('Message', messageSchema);
export default Message;

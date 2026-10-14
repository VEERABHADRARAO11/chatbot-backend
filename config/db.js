import mongoose from 'mongoose';

let cached = global._mongoose;
if (!cached) cached = global._mongoose = { conn: null, promise: null };

const connectDB = async () => {
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  const rawUri = process.env.MONGODB_URI;
  if (!rawUri) {
    throw new Error('MONGODB_URI is not defined in environment variables');
  }

  // Strip accidental outer quotes or whitespace
  const mongoUri = rawUri.trim().replace(/^["']|["']$/g, '');

  if (!cached.promise || mongoose.connection.readyState === 0) {
    cached.promise = mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000
    });
  }

  try {
    cached.conn = await cached.promise;
    console.log(`MongoDB Connected successfully: ${cached.conn.connection.host}`);
  } catch (error) {
    cached.promise = null;
    cached.conn = null;
    console.error(`MongoDB Connection Error: ${error.message}`);
    throw error;
  }

  return cached.conn;
};

export default connectDB;
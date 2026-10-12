import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(` MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(` MongoDB Connection Error: ${error.message}`);
    console.error('Make sure your local MongoDB service is running or check your MongoDB Atlas URI in server/.env');
    process.exit(1);
  }
};

export default connectDB;

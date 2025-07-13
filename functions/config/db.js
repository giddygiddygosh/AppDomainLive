const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // ✅ CORRECTED for v2 Functions: Directly use process.env.
        const dbUrl = process.env.DATABASE_URL;

        if (!dbUrl) {
            console.error('Database Connection Error: DATABASE_URL is not defined in the environment.');
            throw new Error('Database URL is not configured.');
        }

        const conn = await mongoose.connect(dbUrl);

        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Database Connection Error: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;


// ✅ ADDED: This line loads your .env file for local development/testing.
require('dotenv').config();

const functions = require("firebase-functions");
const express = require('express');
const connectDB = require('./config/db');
const cors = require('cors');
const admin = require('firebase-admin');
const path = require('path');
const morgan = require('morgan'); // ✅ CORRECTED: Properly require the morgan package

// Initialize Firebase Admin SDK
admin.initializeApp();

// Connect to your MongoDB database
connectDB();

const app = express();

// Middleware
app.use(morgan('dev')); // ✅ RE-ENABLED: Logging is useful for debugging

// Use a specific origin for better security
app.use(cors({ origin: 'https://finalproject-35af4.web.app' }));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Note: This static path for '/uploads' will only work for temporary files
// written to the /tmp directory in the Cloud Functions environment.
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/customers', require('./routes/customerRoutes'));
app.use('/api/leads', require('./routes/leadRoutes'));
app.use('/api/forms', require('./routes/formRoutes'));
app.use('/api/settings', require('./routes/settingsRoutes'));
app.use('/api/uploads', require('./routes/uploadRoutes'));
app.use('/api/staff', require('./routes/staffRoutes'));
app.use('/api/jobs', require('./routes/jobRoutes'));
app.use('/api/stock', require('./routes/stockRoutes'));
app.use('/api/email-templates', require('./routes/emailTemplateRoutes'));
app.use('/api/invoices', require('./routes/invoiceRoutes'));
app.use('/api/daily-time', require('./routes/dailyTimeRoutes'));
app.use('/api/payroll', require('./routes/payrollRoutes'));
app.use('/api/public', require('./routes/publicRoutes'));
app.use('/api/customer-portal', require('./routes/customerPortalRoutes'));
app.use('/api/mail', require('./routes/mailRoutes'));
app.use('/api/routes', require('./routes/routePlannerRoutes'));
app.use('/api/reports', require('./routes/commissionReportRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/stripe', require('./routes/stripeRoutes'));
app.use('/api/quickbooks', require('./routes/quickbooksRoutes'));

// Home route for API testing
app.get('/', (req, res) => {
    res.send('API is running...');
});

// Export the Express app as a Cloud Function
exports.api = functions.https.onRequest(app);


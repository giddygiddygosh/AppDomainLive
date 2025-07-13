const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

// ✅ Import all the necessary controller functions.
const {
    getSummaryStats,
    getJobsOverview,
    getJobsByStatus,
    getStaffAvailability,
    getRecentActivity,
    getFinancialData
} = require('../controllers/dashboardController');

// ✅ All routes now have a valid, imported handler function.
router.get('/summary-stats', protect, getSummaryStats);
router.get('/financials', protect, getFinancialData);
router.get('/jobs-overview', protect, getJobsOverview);
router.get('/jobs-by-status', protect, getJobsByStatus);
router.get('/staff-availability', protect, getStaffAvailability);
router.get('/recent-activity', protect, getRecentActivity);

module.exports = router;


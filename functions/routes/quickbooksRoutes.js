// routes/quickbooksRoutes.js

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware'); // Keep this import if 'protect' is used elsewhere, like on '/callback'
const {
    connectToQuickBooks,
    handleQuickBooksCallback
} = require('../controllers/quickbooksController');

// Route that starts the connection process - REMOVED 'protect' middleware
router.get('/connect', connectToQuickBooks);

// Route that QuickBooks redirects back to
// Keep 'protect' here for now if 'req.user' (from auth) is needed in handleQuickBooksCallback
// If this also causes an auth error after the redirect, you might need to re-evaluate auth for this specific callback.
router.get('/callback', protect, handleQuickBooksCallback);

console.log('DEBUG: quickbooksRoutes.js loaded and defining routes.');
console.log('DEBUG: connectToQuickBooks is:', typeof connectToQuickBooks);
// Corrected typo: Changed 'handleQuickbooksCallback' to 'handleQuickBooksCallback'
console.log('DEBUG: handleQuickBooksCallback is:', typeof handleQuickBooksCallback);

module.exports = router;

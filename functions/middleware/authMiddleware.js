const jwt = require('jsonwebtoken');
const User = require('../models/User'); // Assuming this model is correct for your user fetching
const asyncHandler = require('express-async-handler');

const protect = asyncHandler(async (req, res, next) => {
    let token;

    // 1. Check if Authorization header exists and starts with 'Bearer'
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            // Extract the token part (after 'Bearer ')
            token = req.headers.authorization.split(' ')[1];

            // 2. IMPORTANT: Check if the token was actually extracted
            if (!token || token.length === 0) {
                res.status(401);
                throw new Error('Not authorized, token string missing after "Bearer ".');
            }

            // Log secret for debugging verifying
            console.log("JWT_SECRET used for verifying:", process.env.JWT_SECRET); 

            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Fetch user from DB using decoded ID
            // Assuming `decoded.id` from the JWT payload corresponds to `user._id` in your User model
            req.user = await User.findById(decoded.id).select('-password');

            if (!req.user) {
                res.status(401);
                throw new Error('Not authorized, user not found in DB.');
            }

            // Your app requires the companyId to be attached to the user object
            // This ensures companyId is available for subsequent middleware like 'authorize'
            if (req.user.company) {
                req.user.companyId = req.user.company.toString();
            } else {
                req.user.companyId = null; // Or handle as an error if company is always required
            }

            next(); // Move to the next middleware/route handler

        } catch (error) {
            // Log the specific error for debugging
            console.error('JWT Verification or User Fetching Failed in protect middleware:', error.message);
            // Re-throw a more user-friendly error to the client based on the specific JWT error
            res.status(401);
            if (error.name === 'TokenExpiredError') {
                throw new Error('Not authorized, token has expired. Please log in again.');
            } else if (error.name === 'JsonWebTokenError') {
                // This covers 'jwt malformed', 'invalid signature', etc.
                throw new Error('Not authorized, invalid token.');
            } else {
                // Generic fallback for other errors during user fetching or unexpected issues
                throw new Error('Not authorized, an unexpected authentication error occurred.');
            }
        }
    } else {
        // If no Authorization header or it doesn't start with 'Bearer'
        res.status(401);
        throw new Error('Not authorized, no token provided or invalid format.');
    }
});

// This function creates middleware that checks for specific roles.
const authorize = (...roles) => {
    // Ensure roles is always an array of strings, flattening if a nested array was passed
    const allowedRoles = roles.flat().map(role => role.trim().toLowerCase());

    return (req, res, next) => {
        // Check if user object and role exist on the request (populated by 'protect' middleware)
        if (!req.user || !req.user.role) {
            return res.status(403).json({ message: 'Forbidden: User role not found or not authenticated.' });
        }
        
        const userRole = req.user.role.trim().toLowerCase();
        const isAuthorized = allowedRoles.includes(userRole);

        if (!isAuthorized) {
            return res.status(403).json({
                message: `Forbidden: User role '${req.user.role}' is not authorized to access this route.`
            });
        }
        next(); // User is authorized, proceed to the next middleware/route handler
    };
};

// Create the 'adminManager' middleware by calling authorize with the correct roles.
// This is a convenience export for commonly used role combinations.
const adminManager = authorize('admin', 'manager');


// Export all the middleware functions for use in routes
module.exports = { protect, authorize, adminManager };
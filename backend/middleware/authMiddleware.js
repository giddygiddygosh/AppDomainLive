// backend/middleware/authMiddleware.js

const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.id).select('-password');
            if (!req.user) {
                return res.status(401).json({ message: 'Not authorized, user not found' });
            }
            next();
        } catch (error) {
            return res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }
    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }
};

const authorize = (...roles) => {
    return (req, res, next) => {
        // ✅ THE FIX: Added 'typeof role === "string"' to prevent crashes on non-string roles.
        if (!req.user || !roles.some(role => typeof role === 'string' && role.trim() === req.user.role.trim())) {
            return res.status(403).json({
                message: `Forbidden: User role '${req.user ? req.user.role : 'guest'}' is not authorized to access this route.`
            });
        }
        next();
    };
};

module.exports = { protect, authorize };
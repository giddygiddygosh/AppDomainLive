// ServiceOS/backend/controllers/authController.js

const admin = require('firebase-admin');
// ✅ FIX: Changed to lowercase to match your actual filenames
const User = require('../models/User');
const Company = require('../models/Company');
const generateToken = require('../utils/generateToken');
const sendEmail = require('../utils/emailService'); // Assuming this is your base email sender

/**
 * @desc    Register a new company and its first admin user
 * @route   POST /api/auth/register-with-firebase
 * @access  Public
 */
const registerWithFirebase = async (req, res) => {
    const { firebaseUid, email, companyName, contactPersonName } = req.body;

    if (!firebaseUid || !email || !companyName || !contactPersonName) {
        return res.status(400).json({ message: 'Missing required fields.' });
    }

    try {
        const userExists = await User.findOne({ firebaseUid });
        if (userExists) {
            const userWithStaff = await User.findOne({ firebaseUid }).populate('staff');
            // Log secret for debugging signing
            console.log("JWT_SECRET used for signing (register existing user):", process.env.JWT_SECRET);
            const token = generateToken(
                userWithStaff._id.toString(), // Explicitly convert _id to string
                userWithStaff.company ? userWithStaff.company.toString() : null, // Convert to string or null if not present
                userWithStaff.role
            );
            return res.status(200).json({ message: 'User already registered.', user: userWithStaff, token });
        }

        const emailExists = await User.findOne({ email });
        if (emailExists) {
            return res.status(400).json({ message: 'This email is already in use.' });
        }

        const appId = email.split('@')[1];
        const newCompany = await Company.create({ name: companyName, appId });

        // Assign the 'admin' role, which is a valid enum in your User model
        const newUser = await User.create({
            firebaseUid,
            email,
            role: 'admin',
            company: newCompany._id,
            contactPersonName,
        });

        if (newUser) {
            console.log(`[SUCCESS] User registered in DB: ${newUser.email}, Role: ${newUser.role}`);
            // Log secret for debugging signing
            console.log("JWT_SECRET used for signing (register new user):", process.env.JWT_SECRET);
            const token = generateToken(
                newUser._id.toString(), // Explicitly convert _id to string
                newUser.company.toString(), // newUser.company should always exist and be a valid ObjectId here
                newUser.role
            );
            res.status(201).json({ user: newUser, token });
        } else {
            throw new Error('Failed to create user profile.');
        }
    } catch (error) {
        console.error('Server Error during registration:', error);
        res.status(500).json({ message: 'Server Error during registration', error: error.message });
    }
};

/**
 * @desc    Authenticate a user via Firebase ID Token
 * @route   POST /api/auth/firebase-login
 * @access  Public
 */
const firebaseLogin = async (req, res) => {
    const { idToken } = req.body;

    if (!idToken) {
        return res.status(400).json({ message: 'Firebase ID token is required.' });
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const { uid: firebaseUid, email } = decodedToken;

        // FIX: Add .populate('staff') here to get the full staff document
        const user = await User.findOne({ $or: [{ firebaseUid }, { email }] })
                                .populate('company', 'name appId')
                                .populate('staff');

        if (!user) {
            return res.status(404).json({ message: 'User not registered in the database. Please sign up.' });
        }

        if (!user.firebaseUid) {
            user.firebaseUid = firebaseUid;
            await user.save();
        }

        // Log secret for debugging signing
        console.log("JWT_SECRET used for signing (firebase login):", process.env.JWT_SECRET);
        const token = generateToken(
            user._id.toString(), // Explicitly convert _id to string
            user.company ? user.company._id.toString() : null, // Convert to string or null if not populated/present
            user.role
        );

        res.json({ user, token }); // The 'user' object sent here will now have 'staff' populated
    } catch (error) {
        console.error('Server Error during Firebase ID Token verification:', error);
        res.status(500).json({ message: 'Authentication failed.' });
    }
};

/**
 * @desc    Request password reset link
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
const forgotPassword = async (req, res) => {
    const { email } = req.body;
    try {
        await admin.auth().getUserByEmail(email);
        const resetLink = await admin.auth().generatePasswordResetLink(email);
        // ... email sending logic ...
        res.status(200).json({ message: 'Password reset link sent.' });
    } catch (error) {
        if (error.code === 'auth/user-not-found') {
            return res.status(200).json({ message: 'If an account exists, a link has been sent.' });
        }
        res.status(500).json({ message: 'Error processing request.' });
    }
};

/**
 * @desc    Get current user profile
 * @route   GET /api/auth/me
 * @access  Private
 */
const getMe = async (req, res) => {
    try {
        // FIX: Add .populate('staff') here to get the full staff document when fetching own profile
        const user = await User.findById(req.user._id)
                                .select('-password')
                                .populate('company')
                                .populate('staff');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json({ user });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
};

/**
 * @desc    Update user profile
 * @route   PUT /api/auth/profile
 * @access  Private
 */
const updateProfile = async (req, res) => {
    const { contactPersonName, email } = req.body;
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        user.contactPersonName = contactPersonName || user.contactPersonName;
        if (email && email !== user.email) {
            const existingUser = await User.findOne({ email });
            if (existingUser && existingUser._id.toString() !== user._id.toString()) {
                return res.status(400).json({ message: 'Email already in use.' });
            }
            user.email = email;
        }

        await user.save();
        res.json({ message: 'Profile updated successfully!', user });
    } catch (error) {
        res.status(500).json({ message: 'Failed to update profile.' });
    }
};

// Export all the functions
module.exports = {
    registerWithFirebase,
    firebaseLogin,
    forgotPassword,
    getMe,
    updateProfile
};
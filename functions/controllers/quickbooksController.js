const QuickBooks = require('node-quickbooks');
const asyncHandler = require('express-async-handler');
const { v4: uuidv4 } = require('uuid'); // Install with: npm install uuid

// Make sure these environment variables are loaded in your app's entry point
const consumerKey = process.env.QUICKBOOKS_CLIENT_ID;
const consumerSecret = process.env.QUICKBOOKS_CLIENT_SECRET;
const redirectUri = process.env.QUICKBOOKS_REDIRECT_URI;

/**
 * @desc    Step 1: Redirect the user to QuickBooks to grant permission.
 * @route   GET /api/quickbooks/connect
 * @access  Private
 */
exports.connectToQuickBooks = asyncHandler(async (req, res) => {
    // FIX: Use the raw string value for the scope directly.
    const scopes = [
        'com.intuit.quickbooks.accounting',
        // Add other necessary scopes here, e.g., 'com.intuit.quickbooks.payment'
    ];

    // Generate a unique and secure state token to prevent CSRF attacks.
    // This requires a session middleware like `express-session` to be set up.
    const state = uuidv4(); 
    req.session.oauth_state = state;

    // Use the library's static method to generate the authorization URI.
    const authUri = QuickBooks.getAuthUri({
        clientId: consumerKey,
        scopes: scopes,
        state: state,
        redirectUri: redirectUri
    });

    // Redirect the user to QuickBooks to authorize the application.
    console.log(`Redirecting to QuickBooks authorization page...`);
    res.redirect(authUri);
});

/**
 * @desc    Step 2: Handle the callback from QuickBooks after user grants permission.
 * @route   GET /api/quickbooks/callback
 * @access  Private
 */
exports.handleQuickBooksCallback = asyncHandler(async (req, res) => {
    // Verify the 'state' parameter to ensure the request is legitimate.
    if (req.query.state !== req.session.oauth_state) {
        return res.status(401).send('Authorization failed. Invalid state parameter (CSRF detected).');
    }

    // Instantiate the QuickBooks client to exchange the authorization code for a token.
    const qbo = QuickBooks.newClient({
        clientId: consumerKey,
        clientSecret: consumerSecret,
        redirectUri: redirectUri,
        environment: 'sandbox' // Use 'production' for your live app
    });

    try {
        // Use the full callback URL to let the library parse the authorization code.
        const authResponse = await qbo.getToken(req.url);
        
        // --- SUCCESS! ---
        // The token object contains the access token, refresh token, and expiry details.
        const tokenData = authResponse.getJson();
        console.log('QuickBooks tokens have been successfully received:', tokenData);

        //
        // TODO: Persist the tokens to your database.
        // Associate them with the currently logged-in user or their company.
        // Example:
        // const companyId = req.user.company; 
        // await Company.findByIdAndUpdate(companyId, {
        //     quickbooksAccessToken: tokenData.access_token,
        //     quickbooksRefreshToken: tokenData.refresh_token,
        //     quickbooksRealmId: req.query.realmId,
        //     quickbooksTokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        //     quickbooksRefreshTokenExpiresAt: new Date(Date.now() + tokenData.x_refresh_token_expires_in * 1000),
        //     isQuickbooksConnected: true
        // });
        //

        // Redirect the user back to a relevant page in your frontend application.
        res.redirect(`${process.env.FRONTEND_URL}/settings?qbo_success=true`);

    } catch (e) {
        console.error('An error occurred during the QuickBooks token exchange:', e.originalMessage || e);
        res.status(500).send(`ERROR: Could not retrieve QuickBooks tokens. Please try connecting again.`);
    }
});
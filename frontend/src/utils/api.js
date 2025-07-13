import axios from 'axios';

// Determine the API base URL based on the environment
const API_BASE_URL = process.env.NODE_ENV === 'production'
    ? 'https://api-asjhbgjbha-uc.a.run.app/api' // <--- YOUR ACTUAL DEPLOYED FUNCTION URL
    : 'http://localhost:5004/api'; // Your local backend server

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor to add the authorization token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token'); // Get the token from localStorage
        if (token) {
            config.headers.Authorization = `Bearer ${token}`; // Add it to the Authorization header
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor to handle token expiration or invalidation
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        // If the error is 401 Unauthorized and it's not a retry already
        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true; // Mark as retried to prevent infinite loops

            // Attempt to refresh token or log out user
            console.error('Authentication token expired or invalid. Logging out...');
            localStorage.removeItem('token');
            window.location.href = '/login'; // Adjust to your login route
        }
        return Promise.reject(error);
    }
);

export default api;
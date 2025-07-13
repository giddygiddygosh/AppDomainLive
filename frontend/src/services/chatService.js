import io from 'socket.io-client';
import api from '../utils/api';

// CHANGE THIS LINE: Set the URL to '/'
// This tells Socket.IO to connect to the same server that is hosting the website,
// which is correct for your Firebase setup.
const SOCKET_URL = '/';

let socket = null;

const chatService = {
    // Connects to the Socket.IO server with authentication
    connectSocket: () => {
        if (socket) {
            return socket;
        }
        const token = localStorage.getItem('token');
        if (!token) {
            console.error("Chat Service: No token found, cannot connect to WebSocket.");
            return null;
        }
        socket = io(SOCKET_URL, {
            auth: {
                token: `Bearer ${token}`
            },
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            transports: ['websocket'],
        });
        socket.on('connect', () => {
            console.log('✅ Successfully connected to WebSocket server with authentication.');
        });
        socket.on('connect_error', (err) => {
            console.error('❌ WebSocket connection error:', err.message);
        });
        return socket;
    },

    disconnectSocket: () => {
        if (socket) {
            socket.disconnect();
            socket = null;
        }
    },

    getStaffList: async () => {
        try {
            const response = await api.get('/chat/staff'); 
            return response.data;
        } catch (error) {
            console.error('Error fetching staff list:', error);
            throw error;
        }
    },
 
    getAdminList: async () => {
        try {
            const response = await api.get('/users/roles/admin');
            return response.data;
        } catch (error) {
            console.error('Error fetching admin list:', error);
            throw error;
        }
    },

    getChatHistory: async (userId1, userId2) => {
        try {
            const response = await api.get(`/chat/history?user1=${userId1}&user2=${userId2}`);
            return response.data;
        } catch (error) {
            console.error('Error fetching chat history:', error);
            throw error;
        }
    },

    saveMessage: async (messageData) => {
        try {
            const response = await api.post('/chat/messages', messageData);
            return response.data;
        } catch (error) {
            console.error('Error saving message:', error);
            throw error;
        }
    },
};

export default chatService;


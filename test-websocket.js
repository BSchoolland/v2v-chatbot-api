const WebSocket = require('ws');

// Create WebSocket connection
const ws = new WebSocket('ws://localhost:3000/chatbot/api/ws');

// Connection opened
ws.on('open', () => {
    console.log('Connected to WebSocket server');
});

// Listen for messages
ws.on('message', (data) => {
    const message = JSON.parse(data.toString());
    console.log('Received:', message);
});

// Handle errors
ws.on('error', (error) => {
    console.error('WebSocket error:', error);
});

// Connection closed
ws.on('close', () => {
    console.log('Disconnected from WebSocket server');
}); 
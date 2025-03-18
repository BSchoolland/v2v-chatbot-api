/**
 * WebSocket Manager for handling real-time tool usage notifications
 * This singleton class manages WebSocket connections and broadcasts tool usage events
 * to specific clients based on their chat ID.
 */
const WebSocket = require('ws');

class WebSocketManager {
    constructor() {
        this.wss = null;
        // Map of chatId to WebSocket connection
        this.clientsByChatId = new Map();
    }

    /**
     * Initialize the WebSocket server with an existing WebSocket.Server instance
     * @param {WebSocket.Server} wss - The WebSocket server instance from express-ws
     */
    initialize(wss) {
        if (this.wss) {
            console.warn('WebSocket server already initialized');
            return;
        }

        this.wss = wss;
        
        this.wss.on('connection', (ws, req) => {
            
            // Extract chatId from query parameters
            const url = new URL(req.url, 'ws://localhost');
            const chatId = url.searchParams.get('chatId');
            
            if (!chatId) {
                console.warn('WebSocket connection attempt without chatId');
                ws.close(1008, 'ChatId required');
                return;
            }

            // Store the connection with its chatId
            this.clientsByChatId.set(chatId, ws);
            
            ws.on('close', () => {
                this.clientsByChatId.delete(chatId);
            });

            ws.on('error', (error) => {
                console.error(`WebSocket error for chat ${chatId}:`, error);
            });

            // Send confirmation of successful connection
            const confirmationMessage = {
                type: 'connection_status',
                status: 'connected',
                chatId: chatId
            };
            ws.send(JSON.stringify(confirmationMessage));
        });
    }

    /**
     * Send a tool usage event to the specific client for a chat session
     * @param {string} chatId - ID of the chat session
     * @param {string} toolName - Name of the tool being used
     * @param {string} reference - Reference information about the tool usage
     */
    sendToolUsage(chatId, toolName, reference) {
        if (!this.wss) {
            console.warn('WebSocket server not initialized');
            return;
        }

        const client = this.clientsByChatId.get(chatId);
        
        if (!client) {
            return;
        }

        if (client.readyState === WebSocket.OPEN) {
            const message = {
                type: 'tool_usage',
                toolName,
                reference,
                chatId
            };
            client.send(JSON.stringify(message));
        } else {
            console.warn(`Client for chatId ${chatId} is not in OPEN state (state: ${client.readyState})`);
        }
    }
}

// Export a singleton instance
const wsManager = new WebSocketManager();
module.exports = wsManager; 
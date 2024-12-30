/**
 * WebSocket Manager for handling real-time tool usage notifications
 * This singleton class manages WebSocket connections and broadcasts tool usage events
 * to all connected clients.
 */
const WebSocket = require('ws');

class WebSocketManager {
    constructor() {
        this.wss = null;
        this.clients = new Set();
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
        console.log('WebSocket server initialized');
        
        this.wss.on('connection', (ws) => {
            console.log('New WebSocket connection');
            this.clients.add(ws);
            
            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
            });
            
            ws.on('close', () => {
                console.log('Client disconnected');
                this.clients.delete(ws);
            });

            // Send a test message to confirm connection
            ws.send(JSON.stringify({
                type: 'connection_status',
                status: 'connected'
            }));
        });
    }

    /**
     * Broadcast a tool usage event to all connected clients
     * @param {string} toolName - The name of the tool being used
     * @param {string} reference - The reference (e.g., file path, search query) being accessed
     */
    broadcastToolUsage(toolName, reference) {
        if (!this.wss) {
            console.warn('WebSocket server not initialized');
            return;
        }

        const message = JSON.stringify({
            type: 'tool_usage',
            toolName,
            reference
        });

        this.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    }
}

// Export a singleton instance
module.exports = new WebSocketManager(); 
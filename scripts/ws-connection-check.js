/**
 * Regression check for backend/api/chat-core/wsManager.js.
 *
 *   node scripts/ws-connection-check.js
 *
 * Runs the real wsManager against a throwaway WebSocket server on 127.0.0.1 and
 * asserts three things, exiting non-zero on the first failure:
 *   1. a stale socket's close does not de-register the live socket on the same chatId
 *   2. a live socket's close does de-register it (the map does not leak)
 *   3. the server pings idle clients, so a reverse proxy does not time the socket out
 */
const http = require('http');
const WebSocket = require('ws');
const wsManager = require('../backend/api/chat-core/wsManager.js');

const PING_DEADLINE_MS = 30000;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const open = (ws) => new Promise((r) => ws.on('open', r));

const failures = [];
const check = (label, ok) => {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
    if (!ok) failures.push(label);
};

const server = http.createServer();
wsManager.initialize(new WebSocket.Server({ server }));

server.listen(0, '127.0.0.1', async () => {
    const url = `ws://127.0.0.1:${server.address().port}/?chatId=`;

    const chatId = 'stale-close';
    const stale = new WebSocket(url + chatId);
    await open(stale);
    const live = new WebSocket(url + chatId);
    await open(live);
    await wait(200);

    stale.close();
    await wait(400);
    const registered = wsManager.clientsByChatId.get(chatId);
    check('live client stays registered when a stale socket closes',
        registered !== undefined && registered.readyState === WebSocket.OPEN);

    let delivered = false;
    live.on('message', (m) => { delivered = delivered || JSON.parse(m).type === 'tool_usage'; });
    wsManager.sendToolUsage(chatId, 'searchPage', 'https://example.com', 'Searching...');
    await wait(400);
    check('tool usage reaches the live client', delivered);

    live.close();
    await wait(400);
    check('closing the live client de-registers it', !wsManager.clientsByChatId.has(chatId));

    const idle = new WebSocket(url + 'idle');
    await open(idle);
    const pinged = await new Promise((resolve) => {
        const timer = setTimeout(() => resolve(false), PING_DEADLINE_MS);
        idle.on('ping', () => { clearTimeout(timer); resolve(true); });
    });
    check(`server pings an idle client within ${PING_DEADLINE_MS / 1000}s`, pinged);
    idle.close();

    server.close();
    process.exit(failures.length ? 1 : 0);
});

// Checks that protected routes reject unauthenticated callers.
// Boots the real authMiddleware and the real admin router — no mocks.
//   node scripts/verify-auth.js
process.env.ENV = 'development';
process.env.JWT_SECRET = 'verify-auth-secret';

const fs = require('fs');
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

fs.mkdirSync(path.resolve(__dirname, '../backend/storage'), { recursive: true });

const { authMiddleware } = require('../backend/api/middleware/middleware.js');
const adminRoutes = require('../backend/api/admin/index.js');
const { initializeLoggingDatabase } = require('../backend/database/logging/database.js');

const app = express();
app.use(cookieParser());
// Stands in for any authMiddleware-protected route (billing, profile, conversations, files).
app.get('/website/api/users/me', authMiddleware, (req, res) =>
    res.json({ reachedHandler: true, userId: req.userId }));
app.use('/api/admin', adminRoutes);

const validSession = 'session=' + jwt.sign({ userId: 7, email: 'real@user.test' }, process.env.JWT_SECRET);

const CASES = [
    ['/website/api/users/me', null, 401],
    ['/website/api/users/me?admin=true', null, 401],
    ['/api/admin/logging/scrape-jobs', null, 401],
    ['/api/admin/logging/scrape-jobs/stats', null, 401],
    ['/website/api/users/me', validSession, 200],
    ['/api/admin/logging/scrape-jobs', validSession, 200],
];

async function main() {
    await initializeLoggingDatabase();
    const server = app.listen(0);
    await new Promise(resolve => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;

    let failures = 0;
    for (const [route, cookie, expected] of CASES) {
        const res = await fetch(base + route, cookie ? { headers: { cookie } } : undefined);
        const ok = res.status === expected;
        if (!ok) failures++;
        const who = cookie ? 'valid session' : 'no cookie';
        console.log(`${ok ? 'PASS' : 'FAIL'}  ${route.padEnd(40)} (${who.padEnd(13)}) -> ${res.status}, want ${expected}`);
    }

    server.close();
    process.exit(failures ? 1 : 0);
}

main();

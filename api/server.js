require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { ensureSchema } = require('./db');
const { registerRoute, loginRoute, forgotPasswordRoute, authGuard } = require('./auth');
const { getScheduleRoute, saveScheduleRoute } = require('./schedules');
const { getLiveListRoute } = require('./live-session');
const { errorHandler } = require('./middleware');

const app = express();
const PORT = Number(process.env.PORT) || 4000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || '*';

app.use(cors({ origin: FRONTEND_ORIGIN === '*' ? true : FRONTEND_ORIGIN }));
app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.post('/api/auth/register', ...registerRoute);
app.post('/api/auth/login', ...loginRoute);
app.post('/api/auth/forgot-password', ...forgotPasswordRoute);

app.get('/api/schedules', authGuard, getScheduleRoute);
app.post('/api/schedules', authGuard, saveScheduleRoute);
app.get('/api/schedule', authGuard, getScheduleRoute);

app.get('/api/live-session', authGuard, getLiveListRoute);

app.use(errorHandler);

ensureSchema()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`GymRats LK server running on http://localhost:${PORT}`);
        });
    })
    .catch((error) => {
        console.error('Failed to start server:', error);
        process.exit(1);
    });

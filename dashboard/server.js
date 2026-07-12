const express = require('express');
const session = require('express-session');
const passport = require('passport');
const path = require('path');
const Strategy = require('passport-discord').Strategy;
const { MongoStore } = require('connect-mongo');
const db = require('../database/db');
const healthCheckEndpoint = require('../utils/healthCheckEndpoint');
const { generalLimiter, dashboardLimiter } = require('../utils/rateLimitMiddleware');

module.exports = (client) => {
    if (process.env.DISABLE_DASHBOARD === 'true') {
        console.log('[Dashboard] Dashboard is disabled via DISABLE_DASHBOARD env variable.');
        return;
    }

    if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET) {
        console.log('[Dashboard] Skipping dashboard setup: Missing CLIENT_ID or CLIENT_SECRET in .env');
        return;
    }

    const app = express();
    app.set('trust proxy', 1);
    const PORT = process.env.PORT || 3000;

    passport.serializeUser((user, done) => done(null, user));
    passport.deserializeUser((obj, done) => done(null, obj));

    const callbackURL = process.env.CALLBACK_URL || `http://localhost:${PORT}/auth/callback`;

    passport.use(new Strategy({
        clientID: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        callbackURL: callbackURL,
        scope: ['identify', 'guilds']
    }, (accessToken, refreshToken, profile, done) => {
        process.nextTick(() => done(null, profile));
    }));

    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, 'views'));

    app.use((req, res, next) => {
        if (req.headers['x-forwarded-proto'] && !req.secure) {
            return res.redirect(`https://${req.get('host')}${req.url}`);
        }
        next();
    });

    app.use(generalLimiter);
    app.use(express.static(path.join(__dirname, 'public')));
    app.use('/uploads', express.static(path.join(__dirname, '..', 'database', 'uploads')));
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    app.use(session({
        secret: process.env.SESSION_SECRET || process.env.CLIENT_SECRET,
        resave: false,
        saveUninitialized: false,
        store: MongoStore.create({
            mongoUrl: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/e246',
            collectionName: 'sessions',
            ttl: 24 * 60 * 60
        }),
        cookie: { maxAge: 1000 * 60 * 60 * 24, httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' }
    }));

    app.use(passport.initialize());
    app.use(passport.session());

    app.use((req, res, next) => {
        res.locals.user = req.user || null;
        next();
    });

    app.get('/health', healthCheckEndpoint(client));

    app.use('/', require('./routes/index')(client));
    app.use('/auth', require('./routes/auth'));
    app.use('/dashboard', dashboardLimiter, require('./routes/dashboard')(client));

    const server = app.listen(PORT, () => {
        console.log(`[Dashboard] Web interface running on port ${PORT} (Callback: ${callbackURL})`);
    });

    server.on('error', (err) => {
        console.error('[Dashboard] Failed to start server:', err.message);
        console.log('[Dashboard] Bot will continue running without the dashboard.');
    });
};

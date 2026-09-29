// server.js
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const compression = require('compression');
const { getEventsInRange } = require('./discord-events');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.disable('x-powered-by');
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'tiny'));
app.use(compression()); // gzip HTML, CSS, JS and JSON (images are already compressed and are skipped)
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ limit: '10kb', extended: true }));

if (process.env.NODE_ENV === 'production') {
    // In production the app sits behind the host's proxy (that's why x-forwarded-proto is
    // read below). Trusting it lets the rate limiter see each visitor's real IP instead of
    // the proxy's. The number is how many proxies sit in front of the app: 1 for a host
    // like Heroku; use 2 if something like Cloudflare is added in front of it.
    app.set('trust proxy', 1);
    app.use((req, res, next) => {
        if (req.headers['x-forwarded-proto'] !== 'https') {
            return res.redirect(`https://${req.headers.host}${req.url}`);
        }
        next();
    });
}

const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many requests, please try again later.',
});

// Pages live at clean URLs (/about, not /about.html or /about/). Send those variants
// to the clean address. This must run before express.static, which would otherwise
// serve /about.html directly. (htmlPages is defined below and only read per request.)
app.use((req, res, next) => {
    const pagePath = req.path.replace(/\/+$/, '') || '/';
    const route = Object.keys(htmlPages).find(r => r === pagePath || '/' + htmlPages[r] === pagePath);
    if (!route || req.path === route) return next();
    const query = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
    res.redirect(301, route + query);
});

app.use(cors());

// Images rarely change, so let browsers keep them instead of re-checking on every visit.
// HTML, CSS and JS keep the default (re-check every time) so edits show up right away.
// If you replace an image under the same file name, visitors may see the old one until
// its cache lifetime runs out (1 day, or 1 week for the About page gallery photos).
const ONE_DAY = 'public, max-age=86400';
const ONE_WEEK = 'public, max-age=604800';
function setCacheHeaders(res, filePath) {
    const rel = path.relative(path.join(__dirname, 'public'), filePath).split(path.sep).join('/');
    if (rel.startsWith('images/gallery/')) {
        res.setHeader('Cache-Control', ONE_WEEK);
    } else if (/\.(jpe?g|png|gif|webp|svg|ico|pdf)$/i.test(rel)) {
        res.setHeader('Cache-Control', ONE_DAY);
    }
}

// Static files are served before the rate limiter so that a page full of images
// (the About page gallery has 58 thumbnails) doesn't use up a visitor's allowance.
app.use(express.static(path.join(__dirname, 'public'), { setHeaders: setCacheHeaders }));
app.use(generalLimiter);

// Serve HTML pages
app.use(express.static(path.join(__dirname, 'public'), {
    index: false
}));

// 2. Manual HTML routing for ALL HTML files
const htmlPages = {
    '/': 'index.html',
    '/ramble': 'ramble.html',
    '/about': 'about.html',
    '/zine': 'zine.html'
};

// Create routes for all HTML pages
Object.entries(htmlPages).forEach(([route, file]) => {
    app.get(route, (req, res) => {
        res.sendFile(path.join(__dirname, 'public', file));
    });
});

// Serves upcoming Discord "Scheduled Events" as calendar occurrences for the
// month-view calendar on the home page. FullCalendar calls this with the visible
// date range every time the user changes months, so start/end come from the query string.
app.get('/api/events', async (req, res, next) => {
    try {
        const start = req.query.start ? new Date(req.query.start) : new Date();
        const end = req.query.end ? new Date(req.query.end) : new Date(start.getTime() + 31 * 24 * 60 * 60 * 1000);
        if (isNaN(start) || isNaN(end) || end <= start) {
            return res.status(400).json({ error: 'start and end must be valid ISO dates, with end after start' });
        }
        const events = await getEventsInRange(start, end);
        res.json(events);
    } catch (error) {
        next(error);
    }
});

// Centralized error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// Start the server
app.listen(PORT, (err) => {
    if (err) {
        console.error('Error starting server:', err);
        process.exit(1);
    } else {
        console.log(`Server running on port ${PORT}`);
    }
});
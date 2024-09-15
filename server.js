// server.js
const express = require('express');
const path = require('path');
const helmet = require('helmet'); // Security headers
const fs = require('fs').promises;
const xml2js = require('xml2js');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit'); // Optional: Rate limiting middleware
const cors = require('cors'); // CORS (if needed)

const app = express();
const PORT = process.env.PORT || 3000;
const GPX_FILE_PATH = process.env.GPX_FILE_PATH || './Afternoon_Ride.gpx';

// Middleware for security headers (CSP, etc.)
app.use(helmet());

// Disable 'x-powered-by' header
app.disable('x-powered-by');

// Logger for HTTP requests
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'tiny'));

// Limit request body size to prevent large payloads
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ limit: '10kb', extended: true }));

// Enforce HTTPS in production
if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
        if (req.headers['x-forwarded-proto'] !== 'https') {
            return res.redirect(`https://${req.headers.host}${req.url}`);
        }
        next();
    });
}

// Optional: Rate limiter for overall protection
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
    message: 'Too many requests, please try again later.',
});
app.use(generalLimiter); // Apply rate limiting globally

// CORS configuration (optional, only if you're serving assets across domains)
app.use(cors());

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Cache for parsed GPX data
let cachedCoordinates = null;

// Utility function to parse GPX file and extract coordinates
async function parseGPX(filePath) {
    try {
        if (cachedCoordinates) return cachedCoordinates; // Return cached data if available

        const gpxContent = await fs.readFile(filePath, 'utf8');
        const parser = new xml2js.Parser();
        const result = await parser.parseStringPromise(gpxContent);

        const trackPoints = result.gpx.trk[0].trkseg[0].trkpt;
        cachedCoordinates = trackPoints.map(point => [
            parseFloat(point.$.lat),
            parseFloat(point.$.lon)
        ]);

        return cachedCoordinates;
    } catch (error) {
        console.error('Error parsing GPX file:', error);
        throw new Error('Failed to parse GPX file');
    }
}

// Endpoint to serve parsed GPX data as JSON
app.get('/get-coordinates', async (req, res, next) => {
    try {
        const coordinates = await parseGPX(GPX_FILE_PATH);
        res.json(coordinates);
    } catch (error) {
        next(error); // Pass error to centralized error handler
    }
});

// Centralized error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// Start the server with error handling
app.listen(PORT, (err) => {
    if (err) {
        console.error('Error starting server:', err);
        process.exit(1); // Exit if the server fails to start
    } else {
        console.log(`Server running on port ${PORT}`);
    }
});

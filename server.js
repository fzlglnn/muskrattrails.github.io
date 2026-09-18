// server.js
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const fs = require('fs').promises;
const xml2js = require('xml2js');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

const AVAILABLE_MAPS = {
  'Sunday-Slow-Ride': {
    path: path.join(__dirname, 'public', 'gpx_files', 'Afternoon_Ride.gpx'),
    name: 'Sunday Slow Ride',
    description: 'Map of possible routes for Sunday slow ride'
  },
  'Ramble-Map': {
    path: path.join(__dirname, 'public', 'gpx_files', '2025_Ramble.gpx'),
    name: 'Ramble Map',
    description: 'Map of Ramble route'
  }

};

// Middleware
app.use(helmet());
app.disable('x-powered-by');
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'tiny'));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ limit: '10kb', extended: true }));

if (process.env.NODE_ENV === 'production') {
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
// Static files are served before the rate limiter so that a page full of images
// (the About page gallery has 58 thumbnails) doesn't use up a visitor's allowance.
app.use(express.static(path.join(__dirname, 'public')));
app.use(generalLimiter);

const cachedCoordinates = {};  // ← Changed from null to {}

// Utility function to parse GPX file and extract coordinates
async function parseGPX(filePath, mapId) {
    try {
        // Return cached data if available
        if (cachedCoordinates[mapId]) {
            console.log(`Returning cached coordinates for ${mapId}`);
            return cachedCoordinates[mapId];
        }

        console.log(`Parsing GPX file: ${filePath} for map: ${mapId}`);
        const gpxContent = await fs.readFile(filePath, 'utf8');
        const parser = new xml2js.Parser();
        const result = await parser.parseStringPromise(gpxContent);

        // Extract coordinates from GPX data
        const trackPoints = result.gpx.trk[0].trkseg[0].trkpt;
        const coordinates = trackPoints.map(point => [
            parseFloat(point.$.lat),
            parseFloat(point.$.lon)
        ]);

        // Cache the coordinates with the map ID
        cachedCoordinates[mapId] = coordinates;
        console.log(`Cached coordinates for ${mapId}, points: ${coordinates.length}`);
        
        return coordinates;
    } catch (error) {
        console.error('Error parsing GPX file:', error);
        throw new Error('Failed to parse GPX file');
    }
}

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

// Endpoint to serve parsed GPX data
app.get('/get-coordinates/:mapId', async (req, res, next) => {
    try {
        const mapId = req.params.mapId;
        console.log(`Request received for map: ${mapId}`);
        
        // Check if the requested map exists
        if (!AVAILABLE_MAPS[mapId]) {
            console.warn(`Map not found: ${mapId}`);
            return res.status(404).json({ 
                error: 'Map not found',
                availableMaps: Object.keys(AVAILABLE_MAPS)
            });
        }
        
        // Get the file path for the requested map
        const filePath = AVAILABLE_MAPS[mapId].path;
        
        // Parse the GPX file and get coordinates
        const coordinates = await parseGPX(filePath, mapId);
        
        // Return the coordinates as JSON
        res.json(coordinates);
        
    } catch (error) {
        console.error('Error in get-coordinates endpoint:', error);
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
        console.log('Available maps:');
        Object.keys(AVAILABLE_MAPS).forEach(key => {
            console.log(`- ${key}: ${AVAILABLE_MAPS[key].name}`);
        });
    }
});
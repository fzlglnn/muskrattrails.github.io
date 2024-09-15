// server.js
const express = require('express');
const path = require('path');
const helmet = require('helmet'); // Security headers middleware
const fs = require('fs').promises; // File system promises API for async operations
const xml2js = require('xml2js'); // Library for parsing XML (GPX is XML-based)
const morgan = require('morgan'); // Logging middleware for HTTP requests

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';
const GPX_FILE_PATH = process.env.GPX_FILE_PATH || './Afternoon_Ride.gpx'; // Fallback to a default GPX file

// Middleware for security headers
app.use(helmet());

// Logger for HTTP requests
app.use(morgan('tiny'));

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Utility function to parse GPX file and extract coordinates
async function parseGPX(filePath) {
    try {
        // Step 1: Read the GPX file asynchronously
        const gpxContent = await fs.readFile(filePath, 'utf8');

        // Step 2: Parse the GPX content into JavaScript objects
        const parser = new xml2js.Parser();
        const result = await parser.parseStringPromise(gpxContent);

        // Step 3: Extract the track points (trkpt) and build coordinates array
        const trackPoints = result.gpx.trk[0].trkseg[0].trkpt;
        const coordinates = trackPoints.map(point => [
            parseFloat(point.$.lat),
            parseFloat(point.$.lon)
        ]);

        return coordinates; // Return the coordinates array
    } catch (error) {
        console.error('Error parsing GPX file:', error);
        throw new Error('Failed to parse GPX file'); // Create a descriptive error message
    }
}

// Endpoint to serve parsed GPX data as JSON
app.get('/get-coordinates', async (req, res, next) => {
    try {
        const coordinates = await parseGPX(GPX_FILE_PATH); // Use environment variable or default GPX file
        res.json(coordinates); // Send the coordinates as a JSON response
    } catch (error) {
        next(error); // Pass error to the centralized error handler
    }
});

// Centralized error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack); // Log the error stack for debugging
    res.status(500).json({ error: err.message || 'Internal Server Error' }); // Send error details as JSON
});

// Start the server
app.listen(PORT, HOST, (err) => {
    if (err) {
        console.error(`Error starting server: ${err}`);
        return;
    }

    // Production environment doesn't require logging localhost
    if (process.env.NODE_ENV === 'production') {
        console.log(`Server running on port ${PORT}`);
    } else {
        console.log(`Server running at http://${HOST}:${PORT}`);
    }
});

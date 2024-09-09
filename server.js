// server.js
const express = require('express');
const path = require('path');
const fs = require('fs').promises; // Using fs.promises for async/await
const xml2js = require('xml2js');

const app = express();
const port = 3000;

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Utility function to parse GPX file and extract coordinates
async function parseGPX(filePath) {
    try {
        // Step 1: Read the GPX file asynchronously
        console.log('Reading file...');
        const gpxContent = await fs.readFile(filePath, 'utf8');

        // Step 2: Parse the GPX content
        const parser = new xml2js.Parser();
        const result = await parser.parseStringPromise(gpxContent); // Using parseStringPromise for async parsing

        // Step 3: Extract the track points (trkpt) and build coordinates array
        const trackPoints = result.gpx.trk[0].trkseg[0].trkpt;
        const coordinates = trackPoints.map(point => [
            parseFloat(point.$.lat),
            parseFloat(point.$.lon)
        ]);

        return coordinates;
    } catch (error) {
        console.error('Error parsing GPX file:', error);
        throw error; // Propagate the error to handle it in the endpoint
    }
}

// Endpoint to serve parsed GPX data as JSON
app.get('/get-coordinates', async (req, res) => {
    try {
        const coordinates = await parseGPX('./Afternoon_Ride.gpx'); // Provide the path to your GPX file
        res.json(coordinates); // Send the coordinates as JSON response
    } catch (error) {
        res.status(500).send('Error reading or parsing GPX file');
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

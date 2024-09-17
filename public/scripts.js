// script.js

// Initialize the map and set its view to a default location
const initMap = () => {
    const map = L.map('map').setView([0,0], 13); // Default center (replace with your preferred coordinates)

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    return map;
};

// Fetch the coordinates from the server
const fetchCoordinates = async () => {
    try {
        const response = await fetch('/get-coordinates');
        
        // Check if the response is successful
        if (!response.ok) {
            throw new Error(`Failed to fetch coordinates: ${response.statusText}`);
        }
        
        const coordinates = await response.json();

        // Validate the data format
        if (!Array.isArray(coordinates) || coordinates.length === 0) {
            throw new Error('Invalid coordinates data received from the server.');
        }

        return coordinates;
    } catch (error) {
        console.error('Error fetching coordinates:', error);
        alert('An error occurred while fetching the route data. Please try again later.');
        return null;
    }
};

// Render the polyline on the map
const renderRouteOnMap = (map, coordinates) => {
    if (!coordinates) return; // If no valid coordinates are passed, do nothing

    // Create a polyline for the route using the fetched coordinates
    const polyline = L.polyline(coordinates, { color: 'blue' }).addTo(map);

    // Adjust the map view to fit the polyline
    map.fitBounds(polyline.getBounds());
};

// Main function to initialize the map and fetch/display the route
const init = async () => {
    const map = initMap();  // Initialize the map
    const coordinates = await fetchCoordinates();  // Fetch coordinates from the server

    renderRouteOnMap(map, coordinates);  // Render the route on the map
};

// Run the main function on load
window.onload = init;

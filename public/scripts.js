// script.js

// Function to get map ID based on the div ID containing the map
const getMapIdFromDivId = (divId) => {
    // This mapping object connects HTML div IDs to server map IDs
    const divMapMapping = {
        'slow-ride-map': 'Sunday-Slow-Ride',
        'ramble-map': 'Ramble-Map'
    };    
    // Return the corresponding server map ID, or undefined if not found
    return divMapMapping[divId];
};

// Function to get a color for the map based on map ID
const getColorForMap = (mapId) => {
    const colorMap = {
        'Sunday-Slow-Ride': 'blue',
        'Ramble-Map': 'purple'
    };
    return colorMap[mapId] || 'red'; // Default to red if not found
};

// Initialize a map in a specific container
const initMap = (containerId) => {
    // Create a Leaflet map inside the HTML element with the given ID
    const map = L.map(containerId).setView([39.8283, -98.5795], 4);

    // Add OpenStreetMap tiles as the base layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    return map;
};

// Fetch the coordinates from the server for a specific map
const fetchCoordinates = async (mapId) => {
    try {
        // Build the API endpoint URL: /get-coordinates/Sunday-Slow-Ride
        const endpoint = `/get-coordinates/${mapId}`;
        
        // Make HTTP request to our server
        const response = await fetch(endpoint);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch coordinates: ${response.statusText}`);
        }
        
        // Parse the JSON response from server
        const coordinates = await response.json();

        // Validate the data
        if (!Array.isArray(coordinates) || coordinates.length === 0) {
            throw new Error('Invalid coordinates data received from the server.');
        }

        return coordinates;
    } catch (error) {
        console.error('Error fetching coordinates for', mapId, ':', error);
        return null;
    }
};

// Render the polyline on the map
const renderRouteOnMap = (map, coordinates, color = 'blue') => {
    if (!coordinates) return; // If no valid coordinates are passed, do nothing

    // Clear any existing polylines from previous renders
    map.eachLayer(layer => {
        if (layer instanceof L.Polyline) {
            map.removeLayer(layer);
        }
    });

    // Create a polyline for the route using the fetched coordinates
    const polyline = L.polyline(coordinates, { color }).addTo(map);

    // Adjust the map view to fit the polyline
    map.fitBounds(polyline.getBounds());
};

// Initialize and load a single map
const initSingleMap = async (containerId) => {
    // Convert HTML div ID to server map ID
    const mapId = getMapIdFromDivId(containerId);
    console.log('Initializing map:', containerId, '->', mapId);
    
    if (!mapId) {
        console.error('No map mapping found for container ID:', containerId);
        return null;
    }
    
    // Initialize the Leaflet map
    const map = initMap(containerId);
    
    // Fetch coordinate data from server
    const coordinates = await fetchCoordinates(mapId);
    
    // Get appropriate color for this map
    const color = getColorForMap(mapId);
    
    // Render the route on the map
    renderRouteOnMap(map, coordinates, color);
    
    return map;
};

// Main function to initialize all maps on the page
const initAllMaps = async () => {
    // Define all possible map container IDs
    const mapContainerIds = ['slow-ride-map', 'ramble-map'];
    
    // Initialize each map
    for (const containerId of mapContainerIds) {
        const container = document.getElementById(containerId);
        if (container) {
            console.log('Found map container:', containerId);
            await initSingleMap(containerId);
        } else {
            console.log('Map container not found:', containerId);
        }
    }
};

// Run the main function on load
window.onload = initAllMaps;
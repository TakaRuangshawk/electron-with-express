// Function to fetch JSON data
async function fetchJson(filename) {
    try {
        const response = await fetch(filename);
        if (!response.ok) {
            throw new Error('Failed to fetch JSON');
        }
        const jsonData = await response.json();
        return jsonData;
    } catch (error) {
        console.error('Error fetching JSON:', error);
        return null;
    }
}

// Function to load JSON data
async function loadJsonData(filename) {
    try {
        let configData = await fetchJson('/config/' + filename + '.json');
        return configData;
    } catch (error) {
        console.error('Error loading JSON data:', error);
        return null;
    }
}
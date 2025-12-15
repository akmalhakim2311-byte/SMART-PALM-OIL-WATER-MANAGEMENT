const admin = JSON.parse(localStorage.getItem("currentUser"));
document.getElementById("adminName").innerText = admin.firstname;

// Map center (Kuala Kubu Bharu)
const map = L.map('map').setView([3.5639, 101.6596], 14);

// OpenStreetMap tiles (FREE)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
}).addTo(map);

// Draw controls
const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

const drawControl = new L.Control.Draw({
    draw: {
        polygon: true,
        marker: false,
        polyline: false,
        circle: false,
        rectangle: false,
        circlemarker: false
    },
    edit: {
        featureGroup: drawnItems
    }
});
map.addControl(drawControl);

// Weather API
const WEATHER_KEY = "adb0eb54d909230353f3589a97c08521";

// Handle polygon creation
map.on(L.Draw.Event.CREATED, async function (e) {
    const layer = e.layer;
    drawnItems.addLayer(layer);

    const center = layer.getBounds().getCenter();
    const weather = await fetchWeather(center.lat, center.lng);

    layer.weather = weather;
    updatePolygonColor(layer);
});

// Fetch 7-day forecast
async function fetchWeather(lat, lon) {
    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${WEATHER_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    return data.list;
}

// Check rain on selected date
function isRaining(weatherList, date) {
    return weatherList.some(w => {
        return w.dt_txt.startsWith(date) && w.rain;
    });
}

// Update polygon color
function updatePolygonColor(layer) {
    const date = document.getElementById("datePicker").value;
    if (!date || !layer.weather) return;

    if (isRaining(layer.weather, date)) {
        layer.setStyle({ color: "blue" });
    } else {
        layer.setStyle({ color: "green" });
    }
}

// Update all polygons when date changes
document.getElementById("datePicker").addEventListener("change", () => {
    drawnItems.eachLayer(layer => updatePolygonColor(layer));
});

// Admin
const admin = JSON.parse(localStorage.getItem("currentUser"));
document.getElementById("adminName").innerText = admin.firstname;

// Map location (Kuala Kubu Bharu)
const map = L.map("map").setView([3.5639, 101.6596], 14);

// Free tiles
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap"
}).addTo(map);

// Draw setup
const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

const drawControl = new L.Control.Draw({
  draw: { polygon: true, marker: false, polyline: false, rectangle: false, circle: false },
  edit: { featureGroup: drawnItems }
});
map.addControl(drawControl);

// Weather API
const WEATHER_KEY = "PUT_YOUR_OWN_API_KEY";

// Polygon creation
map.on(L.Draw.Event.CREATED, async e => {
  const layer = e.layer;
  drawnItems.addLayer(layer);

  const center = layer.getBounds().getCenter();
  const weather = await fetchWeather(center.lat, center.lng);

  layer.weather = weather;
  layer.waterOn = false;
  updatePolygon(layer);

  layer.on("click", () => toggleWater(layer));
});

// Fetch weather
async function fetchWeather(lat, lon) {
  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${WEATHER_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.list;
}

// Rain check
function isRaining(weather, date) {
  return weather.some(w => w.dt_txt.startsWith(date) && w.rain);
}

// Area calculation (hectares)
function calculateArea(layer) {
  const area = L.GeometryUtil.geodesicArea(layer.getLatLngs()[0]);
  return area / 10000;
}

// Update polygon style
function updatePolygon(layer) {
  const date = datePicker.value;
  if (!date || !layer.weather) return;

  if (isRaining(layer.weather, date)) {
    layer.setStyle({ color: "blue" });
    layer.waterOn = false;
  } else {
    layer.setStyle({ color: layer.waterOn ? "darkgreen" : "green" });
  }
}

// Toggle watering
function toggleWater(layer) {
  const date = datePicker.value;
  if (isRaining(layer.weather, date)) {
    alert("Raining today. Watering disabled.");
    return;
  }
  layer.waterOn = !layer.waterOn;
  updatePolygon(layer);
}

// Update on date change
datePicker.addEventListener("change", () => {
  drawnItems.eachLayer(updatePolygon);
});

// Calculate total & receipt
function calculateTotal() {
  let total = 0;
  let receipt = `Palm Oil Watering Receipt\n\n`;

  drawnItems.eachLayer(layer => {
    if (layer.waterOn) {
      const area = calculateArea(layer);
      const cost = area * 5; // RM5 per hectare
      total += cost;
      receipt += `Area: ${area.toFixed(2)} ha | RM ${cost.toFixed(2)}\n`;
    }
  });

  receipt += `\nTOTAL: RM ${total.toFixed(2)}`;

  document.getElementById("summary").innerText = receipt;

  if (total > 0) {
    const msg = encodeURIComponent(receipt);
    window.open(`https://wa.me/60174909836?text=${msg}`, "_blank");
  }
}

// Logout
function logout() {
  localStorage.removeItem("currentUser");
  window.location.href = "login.html";
}

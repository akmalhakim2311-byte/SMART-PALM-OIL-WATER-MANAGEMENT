// ===== LOGIN CHECK =====
const user = JSON.parse(localStorage.getItem("currentUser"));
if (!user) window.location.href = "index.html";
document.getElementById("adminName").textContent = user.firstname;

// ===== LOGOUT =====
document.getElementById("logoutBtn").onclick = () => {
  localStorage.removeItem("currentUser");
  window.location.href = "index.html";
};

// ===== DATE PICKER =====
const datePicker = document.getElementById("datePicker");
datePicker.valueAsDate = new Date();

// ===== MAP =====
const map = L.map("map").setView([3.7026, 102.5455], 14);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap"
}).addTo(map);

// ===== DRAW GROUP =====
const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

// ===== DRAW CONTROLS =====
const drawControl = new L.Control.Draw({
  draw: {
    polygon: true,
    circle: true,
    circlemarker: true,
    marker: false,
    polyline: false,
    rectangle: false
  },
  edit: { featureGroup: drawnItems }
});
map.addControl(drawControl);

// ===== COST =====
const COST_PER_AREA = 0.05;
let totalCost = 0;

// ===== WEATHER =====
const WEATHER_API_KEY = "adb0eb54d909230353f3589a97c08521";
async function isRaining(lat, lng, date) {
  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&appid=${WEATHER_API_KEY}`
    );
    const data = await res.json();
    const selectedDate = new Date(date).toDateString();
    return data.list.some(i =>
      new Date(i.dt_txt).toDateString() === selectedDate &&
      i.weather[0].main.toLowerCase().includes("rain")
    );
  } catch {
    return false;
  }
}

// ===== AREA =====
function calculateArea(layer) {
  if (layer instanceof L.Polygon) {
    return L.GeometryUtil.geodesicArea(layer.getLatLngs()[0]);
  }
  return 0;
}

// ===== WATER LABEL =====
function showWaterLabel(circle) {
  removeWaterLabel(circle);
  const icon = L.divIcon({
    className: "water-label",
    html: "💧 Water ON",
    iconSize: [80, 24],
    iconAnchor: [40, -10]
  });
  circle._waterLabel = L.marker(circle.getLatLng(), {
    icon,
    interactive: false
  }).addTo(map);
}

function removeWaterLabel(layer) {
  if (layer._waterLabel) {
    map.removeLayer(layer._waterLabel);
    layer._waterLabel = null;
  }
}

function removeAllWaterLabels() {
  drawnItems.eachLayer(removeWaterLabel);
}

// ===== UPDATE LAYER =====
async function updateLayer(layer) {
  const center = layer.getBounds
    ? layer.getBounds().getCenter()
    : layer.getLatLng();

  layer.raining = await isRaining(center.lat, center.lng, datePicker.value);

  if (layer.raining) {
    layer.waterOn = false;
    layer.setStyle?.({ color: "blue" });
    removeWaterLabel(layer);
  } else {
    if (layer instanceof L.Polygon) {
      const area = calculateArea(layer);
      layer.area = area.toFixed(2);
      layer.cost = (area * COST_PER_AREA).toFixed(2);
      layer.setStyle({ color: "green" });
    }

    if (layer instanceof L.Circle && layer.waterOn) {
      showWaterLabel(layer);
    }
  }

  updateTotal();
}

// ===== TOGGLE WATER =====
function toggleWater(layer) {
  if (!(layer instanceof L.Circle) || layer.raining) return;
  layer.waterOn = !layer.waterOn;
  updateLayer(layer);
}

// ===== DRAW CREATED =====
map.on(L.Draw.Event.CREATED, async e => {
  const layer = e.layer;
  layer.waterOn = false;

  drawnItems.addLayer(layer);

  if (layer instanceof L.CircleMarker) {
    layer.setStyle({
      radius: 8,
      color: "#ff6f00",
      fillColor: "#ff9800",
      fillOpacity: 0.9
    });
    layer.bindPopup("📡 Sensor Point (No cost)");
  } else {
    layer.on("click", () => toggleWater(layer));
    await updateLayer(layer);
  }
});

// ===== TOTAL =====
function updateTotal() {
  totalCost = 0;
  drawnItems.eachLayer(layer => {
    if (layer instanceof L.Polygon && layer.cost) {
      totalCost += parseFloat(layer.cost);
    }
  });
  document.getElementById("totalCost").textContent = totalCost.toFixed(2);
}

// ===== SAVE =====
document.getElementById("saveBtn").onclick = () => {
  const data = [];
  drawnItems.eachLayer(layer => {
    data.push({
      type:
        layer instanceof L.Circle ? "circle" :
        layer instanceof L.Polygon ? "polygon" :
        "circlemarker",
      latlng: layer.getLatLng ? [layer.getLatLng().lat, layer.getLatLng().lng] : null,
      latlngs: layer.getLatLngs ? layer.getLatLngs()[0].map(p => [p.lat, p.lng]) : null,
      radius: layer.getRadius ? layer.getRadius() : null,
      waterOn: layer.waterOn || false
    });
  });

  localStorage.setItem("palmOilData_" + datePicker.value, JSON.stringify(data));
  alert("Data saved");
};

// ===== LOAD =====
function loadDateData() {
  drawnItems.clearLayers();
  removeAllWaterLabels();

  const saved = JSON.parse(
    localStorage.getItem("palmOilData_" + datePicker.value) || "[]"
  );

  saved.forEach(async d => {
    let layer;
    if (d.type === "circle") layer = L.circle(d.latlng, { radius: d.radius });
    if (d.type === "polygon") layer = L.polygon(d.latlngs.map(p => ({ lat: p[0], lng: p[1] })));
    if (d.type === "circlemarker") layer = L.circleMarker(d.latlng);

    layer.waterOn = d.waterOn;
    drawnItems.addLayer(layer);

    if (!(layer instanceof L.CircleMarker)) {
      layer.on("click", () => toggleWater(layer));
      await updateLayer(layer);
    }
  });

  updateTotal();
}

// ===== CLEAR ALL =====
document.getElementById("clearBtn").onclick = () => {
  drawnItems.clearLayers();
  removeAllWaterLabels();
  updateTotal();
};

// ===== DATE CHANGE =====
datePicker.addEventListener("change", loadDateData);

// ===== INIT =====
loadDateData();

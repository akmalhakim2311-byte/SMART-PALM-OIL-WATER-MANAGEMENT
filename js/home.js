// ===== LOGIN CHECK =====
const user = JSON.parse(localStorage.getItem("currentUser"));
if (!user) {
  window.location.href = "index.html";
}
document.getElementById("adminName").textContent = user.firstname;

// ===== LOGOUT =====
document.getElementById("logoutBtn").onclick = () => {
  localStorage.removeItem("currentUser");
  window.location.href = "index.html";
};

// ===== DATE PICKER =====
const datePicker = document.getElementById("datePicker");
datePicker.valueAsDate = new Date();

// ===== MAP INITIALIZATION (FELDA JENGKA) =====
const map = L.map("map").setView([3.7026, 102.5455], 14);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap"
}).addTo(map);

// ===== DRAW GROUP =====
const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

// ===== DRAW CONTROLS (ONLY POLYGON + CIRCLE) =====
const drawControl = new L.Control.Draw({
  draw: {
    polygon: true,
    circle: true,
    marker: false,
    polyline: false,
    rectangle: false
  },
  edit: {
    featureGroup: drawnItems
  }
});
map.addControl(drawControl);

// ===== COST SETTINGS =====
const COST_PER_AREA = 0.05; // RM per m²
let totalCost = 0;

// ===== WEATHER =====
const WEATHER_API_KEY = "adb0eb54d909230353f3589a97c08521";

async function isRaining(lat, lng, date) {
  const res = await fetch(
    `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&appid=${WEATHER_API_KEY}`
  );
  const data = await res.json();
  const selectedDate = new Date(date).toDateString();

  return data.list.some(i =>
    new Date(i.dt_txt).toDateString() === selectedDate &&
    i.weather[0].main.toLowerCase().includes("rain")
  );
}

// ===== STORAGE PER DATE =====
function saveDayData() {
  const date = datePicker.value;
  const layers = [];

  drawnItems.eachLayer(layer => {
    layers.push({
      type: layer instanceof L.Circle ? "circle" : "polygon",
      latlngs: layer.getLatLngs ? layer.getLatLngs() : layer.getLatLng(),
      radius: layer.getRadius ? layer.getRadius() : null,
      waterOn: layer.waterOn || false,
      cost: layer.cost || 0
    });
  });

  localStorage.setItem(`irrigation_${date}`, JSON.stringify(layers));
  alert("Saved");
}

document.getElementById("saveDay").onclick = saveDayData;

// ===== LOAD DAY DATA =====
function loadDayData() {
  drawnItems.clearLayers();
  totalCost = 0;

  const date = datePicker.value;
  const saved = JSON.parse(localStorage.getItem(`irrigation_${date}`)) || [];

  saved.forEach(obj => {
    let layer;

    if (obj.type === "circle") {
      layer = L.circle(obj.latlngs, { radius: obj.radius });
      layer.waterOn = obj.waterOn;
      if (layer.waterOn) showWaterLabel(layer);
    } else {
      layer = L.polygon(obj.latlngs);
      layer.waterOn = obj.waterOn;
      layer.cost = obj.cost;
      if (layer.waterOn) layer.setStyle({ color: "darkgreen" });
    }

    attachLayerEvents(layer);
    drawnItems.addLayer(layer);
  });

  updateTotal();
}

datePicker.addEventListener("change", loadDayData);

// ===== WATER LABEL =====
function showWaterLabel(layer) {
  layer.bindTooltip("💧 WATER ON", {
    permanent: true,
    direction: "center",
    className: "water-label"
  }).openTooltip();
}

function hideWaterLabel(layer) {
  layer.unbindTooltip();
}

// ===== AREA CALC =====
function calculateArea(layer) {
  return L.GeometryUtil.geodesicArea(layer.getLatLngs()[0]);
}

// ===== UPDATE POLYGON =====
async function updatePolygon(layer) {
  const center = layer.getBounds().getCenter();
  const raining = await isRaining(center.lat, center.lng, datePicker.value);

  if (raining) {
    layer.setStyle({ color: "blue" });
    layer.waterOn = false;
    hideWaterLabel(layer);
  } else {
    layer.setStyle({ color: layer.waterOn ? "darkgreen" : "green" });
    const area = calculateArea(layer);
    layer.cost = (area * COST_PER_AREA).toFixed(2);
  }
  updateTotal();
}

// ===== TOGGLE WATER (FROM CIRCLE CLICK) =====
function toggleWater(layer) {
  layer.waterOn = !layer.waterOn;

  if (layer.waterOn) {
    showWaterLabel(layer);
  } else {
    hideWaterLabel(layer);
  }

  drawnItems.eachLayer(l => {
    if (l instanceof L.Polygon) updatePolygon(l);
  });
}

// ===== ATTACH EVENTS =====
function attachLayerEvents(layer) {
  if (layer instanceof L.Circle) {
    layer.on("click", () => toggleWater(layer));
  }

  if (layer instanceof L.Polygon) {
    layer.on("click", () => updatePolygon(layer));
  }
}

// ===== DRAW EVENT =====
map.on(L.Draw.Event.CREATED, async function (e) {
  const layer = e.layer;
  layer.waterOn = false;
  drawnItems.addLayer(layer);
  attachLayerEvents(layer);

  if (layer instanceof L.Polygon) {
    await updatePolygon(layer);
  }
});

// ===== CLEAR ALL EVENT =====
map.on("draw:deleted", () => {
  updateTotal();
});

// ===== TOTAL COST =====
function updateTotal() {
  totalCost = 0;

  drawnItems.eachLayer(layer => {
    if (layer.waterOn && layer.cost) {
      totalCost += parseFloat(layer.cost);
    }
  });

  document.getElementById("totalCost").textContent = totalCost.toFixed(2);
}

// ===== INITIAL LOAD =====
loadDayData();

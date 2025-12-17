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

// ===== MAP INITIALIZATION =====
const map = L.map("map").setView([3.7026, 102.5455], 14);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap"
}).addTo(map);

// ===== DRAW CONTROLS =====
const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

const drawControl = new L.Control.Draw({
  draw: {
    polygon: true,
    circle: true,
    marker: false,
    polyline: false,
    rectangle: false,
    circlemarker: false
  },
  edit: { featureGroup: drawnItems }
});
map.addControl(drawControl);

// ===== COST SETTINGS =====
const COST_PER_AREA = 0.05;
let totalCost = 0;

// ===== WEATHER CHECK =====
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

// ===== AREA CALCULATION =====
function calculateArea(layer) {
  if (layer instanceof L.Polygon) {
    return L.GeometryUtil.geodesicArea(layer.getLatLngs()[0]);
  }
  return 0;
}

// ===== REMOVE ALL WATER LABELS =====
function removeAllWaterLabels() {
  drawnItems.eachLayer(layer => {
    if (layer._waterLabel) {
      map.removeLayer(layer._waterLabel);
      layer._waterLabel = null;
    }
  });
}

// ===== UPDATE LAYER =====
async function updateLayer(layer) {
  const center = layer.getBounds
    ? layer.getBounds().getCenter()
    : layer.getLatLng();

  layer.raining = await isRaining(center.lat, center.lng, datePicker.value);

  if (layer.raining) {
    layer.setStyle?.({ color: "blue" });
    layer.waterOn = false;
    layer.bindPopup("🌧️ Raining – Watering disabled");
    if (layer._waterLabel) removeAllWaterLabels();
  } else {
    if (layer instanceof L.Polygon) {
      const area = calculateArea(layer).toFixed(2);
      layer.cost = (area * COST_PER_AREA).toFixed(2);
      layer.area = area;
      layer.bindPopup(`☀️ Clear<br>Area: ${area} m²<br>Cost: RM ${layer.cost}`);
    }

    if (layer instanceof L.Circle) {
      layer.setStyle({ color: layer.waterOn ? "darkgreen" : "green" });
      if (layer.waterOn) showWaterLabel(layer);
      else removeAllWaterLabels();
    }
  }
  updateTotal();
}

// ===== WATER LABEL =====
function showWaterLabel(circle) {
  removeAllWaterLabels();
  circle._waterLabel = L.marker(circle.getLatLng(), {
    icon: L.divIcon({
      className: "water-label",
      html: "💧 Water ON",
      iconSize: [80, 24],
      iconAnchor: [40, -10]
    }),
    interactive: false
  }).addTo(map);
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

  if (layer instanceof L.Circle) layer.on("click", () => toggleWater(layer));
  await updateLayer(layer);
});

// ===== TOTAL COST =====
function updateTotal(show = true) {
  totalCost = 0;
  drawnItems.eachLayer(layer => {
    if (layer instanceof L.Polygon && layer.cost) {
      totalCost += parseFloat(layer.cost);
    }
  });
  document.getElementById("totalCost").textContent = totalCost.toFixed(2);
  document.getElementById("totalWrapper").style.display = show ? "block" : "none";
}

// ===== SAVE =====
document.getElementById("saveBtn").onclick = () => {
  const dateKey = datePicker.value;
  const data = [];

  drawnItems.eachLayer(layer => {
    data.push({
      type: layer instanceof L.Circle ? "circle" : "polygon",
      latlngs:
        layer instanceof L.Circle
          ? [layer.getLatLng().lat, layer.getLatLng().lng]
          : layer.getLatLngs()[0].map(p => [p.lat, p.lng]),
      radius: layer instanceof L.Circle ? layer.getRadius() : null,
      waterOn: layer.waterOn || false
    });
  });

  localStorage.setItem("palmOilData_" + dateKey, JSON.stringify(data));
  alert("Data saved");
};

// ===== LOAD =====
function loadDateData() {
  removeAllWaterLabels();
  drawnItems.clearLayers();

  const data = JSON.parse(localStorage.getItem("palmOilData_" + datePicker.value) || "[]");

  data.forEach(async d => {
    let layer;
    if (d.type === "circle") layer = L.circle(d.latlngs, { radius: d.radius });
    if (d.type === "polygon") layer = L.polygon(d.latlngs);

    if (!layer) return;

    layer.waterOn = d.waterOn;
    drawnItems.addLayer(layer);

    if (layer instanceof L.Circle) layer.on("click", () => toggleWater(layer));
    await updateLayer(layer);
  });
}

// ===== CLEAR =====
document.getElementById("clearBtn").onclick = () => {
  removeAllWaterLabels();
  drawnItems.clearLayers();
  updateTotal(false);
};

// ===== INITIAL =====
loadDateData();

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

// ===== MAP INITIALIZATION (FELDA Jengka) =====
const map = L.map("map").setView([3.7026, 102.5455], 14);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap"
}).addTo(map);

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

// ===== DRAW CONTROLS (Only Polygon & Circle) =====
const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

const drawControl = new L.Control.Draw({
  draw: {
    polygon: true,   // show polygon
    circle: true,    // show circle
    rectangle: false,
    marker: false,
    polyline: false
  },
  edit: {
    featureGroup: drawnItems
  }
});
map.addControl(drawControl);

// ===== COST SETTINGS =====
const COST_PER_AREA = 0.05; // RM per m²
let totalCost = 0;

// ===== AREA CALCULATION =====
function calculateArea(layer) {
  if (layer instanceof L.Circle) {
    const radius = layer.getRadius();
    return Math.PI * radius * radius; // circle area in m²
  } else if (layer instanceof L.Polygon) {
    return L.GeometryUtil.geodesicArea(layer.getLatLngs()[0]);
  }
  return 0;
}

// ===== UPDATE POLYGON/CIRCLE STYLE =====
async function updateLayer(layer) {
  const center = layer.getBounds().getCenter ? layer.getBounds().getCenter() : layer.getLatLng();
  const raining = await isRaining(center.lat, center.lng, datePicker.value);

  if (raining) {
    layer.setStyle ? layer.setStyle({ color: "blue" }) : null;
    layer.waterOn = false;
    layer.bindPopup("🌧️ Raining today – Watering disabled");
  } else {
    layer.setStyle ? layer.setStyle({ color: layer.waterOn ? "darkgreen" : "green" }) : null;
    const area = calculateArea(layer);
    const cost = (area * COST_PER_AREA).toFixed(2);
    layer.cost = cost;

    const popupContent = layer instanceof L.Circle
      ? `<b>Click circle to toggle Water ON/OFF</b><br>Area: ${area.toFixed(2)} m²<br>Cost: RM ${cost}`
      : `<b>Click polygon to toggle Water ON/OFF</b><br>Area: ${area.toFixed(2)} m²<br>Cost: RM ${cost}`;

    layer.bindPopup(popupContent);
  }

  updateTotal();
}

// ===== TOGGLE WATER =====
function toggleWater(layer) {
  if (layer.waterOn === undefined) layer.waterOn = false;
  layer.waterOn = !layer.waterOn;
  updateLayer(layer);
}

// ===== DRAW EVENT =====
map.on(L.Draw.Event.CREATED, async function (e) {
  const layer = e.layer;
  layer.waterOn = false;
  drawnItems.addLayer(layer);

  await updateLayer(layer);

  layer.on("click", () => toggleWater(layer));
});

// ===== DATE CHANGE EVENT =====
datePicker.addEventListener("change", () => {
  drawnItems.eachLayer(layer => updateLayer(layer));
});

// ===== TOTAL COST =====
function updateTotal() {
  totalCost = 0;
  drawnItems.eachLayer(layer => {
    if (layer.waterOn && layer.cost) totalCost += parseFloat(layer.cost);
  });
  document.getElementById("totalCost").textContent = totalCost.toFixed(2);
}

// ===== SAVE & LOAD PER DATE =====
function saveData() {
  const dateKey = datePicker.value;
  const layersData = [];
  drawnItems.eachLayer(layer => {
    const type = layer instanceof L.Circle ? "circle" : "polygon";
    const latlngs = layer instanceof L.Circle ? layer.getLatLng() : layer.getLatLngs();
    layersData.push({ type, latlngs, waterOn: layer.waterOn, cost: layer.cost });
  });
  localStorage.setItem("mapData-" + dateKey, JSON.stringify(layersData));
}

function loadData() {
  const dateKey = datePicker.value;
  const saved = JSON.parse(localStorage.getItem("mapData-" + dateKey)) || [];
  drawnItems.clearLayers();
  saved.forEach(d => {
    let layer;
    if (d.type === "circle") {
      layer = L.circle(d.latlngs, { radius: 50, color: d.waterOn ? "darkgreen" : "green" });
    } else {
      layer = L.polygon(d.latlngs, { color: d.waterOn ? "darkgreen" : "green" });
    }
    layer.waterOn = d.waterOn;
    layer.cost = d.cost;
    layer.bindPopup("Click to toggle Water ON/OFF");
    layer.on("click", () => toggleWater(layer));
    drawnItems.addLayer(layer);
  });
  updateTotal();
}

document.getElementById("saveBtn").onclick = saveData;
datePicker.addEventListener("change", loadData);

// ===== CLEAR ALL =====
document.getElementById("clearBtn").onclick = () => {
  drawnItems.clearLayers();
  updateTotal();
};

// ===== PDF RECEIPT =====
document.getElementById("generatePDF").onclick = async () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text("Palm Oil Irrigation Receipt", 10, 20);
  doc.setFontSize(12);
  doc.text(`Admin: ${user.firstname}`, 10, 30);
  doc.text(`Date: ${datePicker.value}`, 10, 40);

  let y = 50;
  drawnItems.eachLayer(layer => {
    if (layer.waterOn) {
      const area = calculateArea(layer).toFixed(2);
      doc.text(`${layer instanceof L.Circle ? 'Circle' : 'Polygon'}: Area ${area} m² | Cost RM ${layer.cost}`, 10, y);
      y += 10;
    }
  });

  doc.text(`Total Cost: RM ${totalCost.toFixed(2)}`, 10, y + 10);

  doc.save("receipt.pdf");

  const msg = encodeURIComponent(`Palm Oil Irrigation Receipt\nAdmin: ${user.firstname}\nDate: ${datePicker.value}\nTotal Cost: RM ${totalCost.toFixed(2)}`);
  window.open(`https://wa.me/60174909836?text=${msg}`, "_blank");
};

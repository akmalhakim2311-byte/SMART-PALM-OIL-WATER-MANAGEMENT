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

// ===== DRAW CONTROLS (Polygon + Circle) =====
const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

const drawControl = new L.Control.Draw({
  draw: {
    polygon: true,
    circle: true,
    marker: false,
    polyline: false,
    rectangle: false
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

// ===== AREA CALCULATION =====
function calculateArea(layer) {
  if (layer instanceof L.Polygon) {
    return L.GeometryUtil.geodesicArea(layer.getLatLngs()[0]);
  }
  return 0; // Circles do not contribute to cost
}

// ===== UPDATE LAYER =====
async function updateLayer(layer) {
  const center = layer.getBounds ? layer.getBounds().getCenter() : layer.getLatLng();
  const raining = await isRaining(center.lat, center.lng, datePicker.value);

  if (raining) {
    if (layer.setStyle) layer.setStyle({ color: "blue" });
    layer.waterOn = false;
    layer.bindPopup("🌧️ Raining – Watering disabled");
    if (layer._waterLabel) map.removeLayer(layer._waterLabel);
  } else {
    if (layer instanceof L.Polygon) {
      layer.setStyle({ color: layer.waterOn ? "darkgreen" : "green" });
      const area = calculateArea(layer).toFixed(2);
      const cost = (area * COST_PER_AREA).toFixed(2);
      layer.area = area;
      layer.cost = cost;
      layer.bindPopup(`
        ☀️ No rain<br>
        Area: ${area} m²<br>
        Cost: RM ${cost}<br>
        <b>Click polygon to toggle Water ON/OFF</b>
      `);
    } else if (layer instanceof L.Circle) {
      layer.setStyle({ color: layer.waterOn ? "darkgreen" : "green" });
      if (layer.waterOn) {
        if (layer._waterLabel) map.removeLayer(layer._waterLabel);
        const icon = L.divIcon({
          className: "water-label",
          html: `💧 Water ON`,
          iconSize: [70, 20],
          iconAnchor: [35, -10]
        });
        layer._waterLabel = L.marker(layer.getLatLng(), { icon, interactive: false }).addTo(map);
      } else if (layer._waterLabel) {
        map.removeLayer(layer._waterLabel);
        layer._waterLabel = null;
      }
    }
  }
  updateTotal();
}

// ===== TOGGLE WATER (Circle Only) =====
function toggleWater(layer) {
  if (!(layer instanceof L.Circle)) return;
  layer.waterOn = !layer.waterOn;
  updateLayer(layer);
}

// ===== DRAW EVENT =====
map.on(L.Draw.Event.CREATED, async function(e) {
  const layer = e.layer;
  layer.waterOn = layer instanceof L.Circle; // Circles default Water ON
  drawnItems.addLayer(layer);
  await updateLayer(layer);

  // Click to toggle
  layer.on("click", () => {
    if (layer instanceof L.Polygon) layer.waterOn = !layer.waterOn;
    if (layer instanceof L.Circle) toggleWater(layer);
    updateLayer(layer);
  });
});

// ===== DATE CHANGE EVENT =====
datePicker.addEventListener("change", () => {
  drawnItems.clearLayers();
  updateTotal();
});

// ===== TOTAL COST =====
function updateTotal() {
  totalCost = 0;
  drawnItems.eachLayer(layer => {
    if (layer instanceof L.Polygon && layer.waterOn && layer.cost) totalCost += parseFloat(layer.cost);
  });
  document.getElementById("totalCost").textContent = totalCost.toFixed(2);
}

// ===== SAVE CURRENT DATE DATA =====
document.getElementById("saveBtn").onclick = () => {
  const dateKey = datePicker.value;
  const data = [];

  drawnItems.eachLayer(layer => {
    data.push({
      type: layer instanceof L.Circle ? "circle" : "polygon",
      latlngs: layer instanceof L.Circle ? [layer.getLatLng().lat, layer.getLatLng().lng] : layer.getLatLngs()[0].map(p => [p.lat, p.lng]),
      radius: layer instanceof L.Circle ? layer.getRadius() : null,
      waterOn: layer.waterOn
    });
  });

  localStorage.setItem("palmOilData_" + dateKey, JSON.stringify(data));
  alert("Data saved for " + dateKey);

  // Clear map for new date automatically
  drawnItems.clearLayers();
  updateTotal();
};

// ===== GENERATE PDF & WHATSAPP =====
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
    if (layer instanceof L.Polygon && layer.waterOn) {
      doc.text(`Polygon: Area ${layer.area} m² | Cost RM ${layer.cost}`, 10, y);
      y += 10;
    }
  });

  doc.text(`Total Cost: RM ${totalCost.toFixed(2)}`, 10, y + 10);
  doc.save("PalmOil_Receipt.pdf");

  const msg = `Palm Oil Irrigation Receipt\nAdmin: ${user.firstname}\nDate: ${datePicker.value}\nTotal Cost: RM ${totalCost.toFixed(2)}`;
  window.open(`https://wa.me/60174909836?text=${encodeURIComponent(msg)}`, "_blank");
};

// ===== INITIAL LOAD =====
loadDateData();

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
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

// ===== DRAW =====
const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

map.addControl(new L.Control.Draw({
  draw: {
    polygon: true,
    circle: true,
    marker: false,
    polyline: false,
    rectangle: false
  },
  edit: { featureGroup: drawnItems }
}));

// ===== SETTINGS =====
const COST_PER_AREA = 0.05;
let totalCost = 0;
let waterConfirmed = false;

// ===== WEATHER CHECK (OpenWeatherMap) =====
const WEATHER_API_KEY = "adb0eb54d909230353f3589a97c08521";

// Check if polygon will rain on selected date
async function isRaining(lat, lng, date) {
  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&appid=${WEATHER_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  const selectedDate = new Date(date).toDateString();
  return data.list.some(item =>
    new Date(item.dt_txt).toDateString() === selectedDate &&
    item.weather[0].main.toLowerCase().includes("rain")
  );
}
// ===== AREA =====
function polygonArea(layer) {
  return L.GeometryUtil.geodesicArea(layer.getLatLngs()[0]);
}

// ===== WATER LABEL =====
function showWaterLabel(circle) {
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

// ===== TOTAL COST =====
function updateTotal(show = false) {
  totalCost = 0;

  drawnItems.eachLayer(layer => {
    if (layer instanceof L.Polygon && layer.cost) {
      totalCost += layer.cost;
    }
  });

  document.getElementById("totalCost").textContent = totalCost.toFixed(2);
  document.getElementById("totalWrapper").style.display = show ? "block" : "none";
}

// ===== DRAW CREATED =====
map.on(L.Draw.Event.CREATED, async e => {
  const layer = e.layer;
  drawnItems.addLayer(layer);

  if (layer instanceof L.Polygon) {
    const area = polygonArea(layer);
    layer.cost = area * COST_PER_AREA;
    layer.bindPopup(
      `Area: ${area.toFixed(2)} m²<br>Cost: RM ${layer.cost.toFixed(2)}`
    );
    layer.on("click", () => updateTotal(false));
  }

  if (layer instanceof L.Circle) {
    const c = layer.getLatLng();
    const raining = await isRaining(c.lat, c.lng, datePicker.value);

    if (raining) {
      alert("🌧️ Raining – Watering disabled");
      drawnItems.removeLayer(layer);
      return;
    }

    waterConfirmed = true;
    showWaterLabel(layer);
    updateTotal(true);
  }
});

// ===== SAVE =====
document.getElementById("saveBtn").onclick = () => {
  const data = [];
  drawnItems.eachLayer(l => {
    data.push({
      type: l instanceof L.Circle ? "circle" : "polygon",
      latlngs: l instanceof L.Circle
        ? [l.getLatLng().lat, l.getLatLng().lng]
        : l.getLatLngs()[0].map(p => [p.lat, p.lng]),
      radius: l instanceof L.Circle ? l.getRadius() : null
    });
  });
  localStorage.setItem("palmOil_" + datePicker.value, JSON.stringify(data));
  alert("Saved for " + datePicker.value);
};

// ===== LOAD DATE =====
function loadDate() {
  drawnItems.clearLayers();
  waterConfirmed = false;
  updateTotal(false);

  const data = JSON.parse(
    localStorage.getItem("palmOil_" + datePicker.value) || "[]"
  );

  data.forEach(d => {
    let l;
    if (d.type === "polygon") {
      l = L.polygon(d.latlngs.map(p => ({ lat: p[0], lng: p[1] })));
      const area = polygonArea(l);
      l.cost = area * COST_PER_AREA;
      l.bindPopup(
        `Area: ${area.toFixed(2)} m²<br>Cost: RM ${l.cost.toFixed(2)}`
      );
      l.on("click", () => updateTotal(false));
    } else {
      l = L.circle(d.latlngs, { radius: d.radius });
      showWaterLabel(l);
      waterConfirmed = true;
    }
    drawnItems.addLayer(l);
  });

  if (waterConfirmed) updateTotal(true);
}

datePicker.addEventListener("change", loadDate);

// ===== CLEAR ALL =====
document.getElementById("clearBtn").onclick = () => {
  drawnItems.clearLayers();
  waterConfirmed = false;
  updateTotal(false);
};

// ===== PDF + WHATSAPP =====
document.getElementById("generatePDF").onclick = () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.text("Palm Oil Irrigation Receipt", 10, 20);
  doc.text(`Admin: ${user.firstname}`, 10, 30);
  doc.text(`Date: ${datePicker.value}`, 10, 40);
  doc.text(`Total Cost: RM ${totalCost.toFixed(2)}`, 10, 50);

  doc.save("PalmOil_Receipt.pdf");

  const msg =
    `Palm Oil Irrigation Receipt\nAdmin: ${user.firstname}\nDate: ${datePicker.value}\nTotal Cost: RM ${totalCost.toFixed(2)}`;

  window.open(
    "https://wa.me/60174909836?text=" + encodeURIComponent(msg),
    "_blank"
  );
};

// ===== INIT =====
loadDate();

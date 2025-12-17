// ===== LOGIN =====
const user = JSON.parse(localStorage.getItem("currentUser"));
if (!user) location.href = "index.html";
document.getElementById("adminName").textContent = user.firstname;

// ===== LOGOUT =====
document.getElementById("logoutBtn").onclick = () => {
  localStorage.removeItem("currentUser");
  location.href = "index.html";
};

// ===== DATE =====
const datePicker = document.getElementById("datePicker");
datePicker.valueAsDate = new Date();

// ===== MAP =====
const map = L.map("map").setView([3.7026, 102.5455], 14);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

// ===== DRAW CONTROL (NO CIRCLEMARKER) =====
map.addControl(new L.Control.Draw({
  draw: {
    polygon: true,
    circle: true,
    marker: false,
    polyline: false,
    rectangle: false,
    circlemarker: false
  },
  edit: { featureGroup: drawnItems }
}));

// ===== COST =====
const COST_PER_AREA = 0.05;
let totalCost = 0;

// ===== WEATHER CHECK =====
const WEATHER_API_KEY = "adb0eb54d909230353f3589a97c08521";
async function isRaining(lat, lng, date) {
  try {
    const res = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&appid=${WEATHER_API_KEY}`);
    const data = await res.json();
    const selectedDate = new Date(date).toDateString();
    return data.list.some(i =>
      new Date(i.dt_txt).toDateString() === selectedDate &&
      i.weather[0].main.toLowerCase().includes("rain")
    );
  } catch (e) {
    console.error("Weather API error", e);
    return false;
  }
}

// ===== AREA CALCULATION =====
function calculateArea(layer) {
  if (layer instanceof L.Polygon) {
    return L.GeometryUtil.geodesicArea(layer.getLatLngs()[0]);
  }
  return 0; // Circles do not contribute to cost
}

// ===== WATER LABEL =====
function removeWaterLabel(layer) {
  if (layer._waterLabel) {
    map.removeLayer(layer._waterLabel);
    layer._waterLabel = null;
  }
}

function showWaterLabel(circle) {
  removeWaterLabel(circle);
  circle._waterLabel = L.marker(circle.getLatLng(), {
    icon: L.divIcon({
      className: "water-label",
      html: "💧 Water ON"
    }),
    interactive: false
  }).addTo(map);
}

// ===== RAIN CHECK (SIMPLIFIED FLAG) =====
function isRaining() {
  return false; // replace with real API later
}

// ===== AREA =====
function calcArea(layer) {
  return layer instanceof L.Polygon
    ? L.GeometryUtil.geodesicArea(layer.getLatLngs()[0])
    : 0;
}

// ===== UPDATE LAYER =====
function updateLayer(layer) {
  removeWaterLabel(layer);

  if (isRaining()) {
    layer.raining = true;
    layer.waterOn = false;
    layer.setStyle?.({ color: "blue" });
    layer.bindPopup("🌧️ Raining – No watering");
  } else {
    layer.raining = false;

    if (layer instanceof L.Polygon) {
      const area = calcArea(layer);
      layer.cost = (area * COST_PER_AREA).toFixed(2);
      layer.setStyle({ color: "green" });
    }

    if (layer instanceof L.Circle && layer.waterOn) {
      layer.setStyle({ color: "darkgreen" });
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
map.on(L.Draw.Event.CREATED, e => {
  const layer = e.layer;
  layer.waterOn = false;
  drawnItems.addLayer(layer);

  if (layer instanceof L.Circle) {
    layer.on("click", () => toggleWater(layer));
  }

  updateLayer(layer);
});

// ===== DATE CHANGE =====
datePicker.addEventListener("change", () => {
  loadDateData();
});

// ===== TOTAL =====
function updateTotal() {
  totalCost = 0;
  drawnItems.eachLayer(l => {
    if (l.cost) totalCost += parseFloat(l.cost);
  });
  document.getElementById("totalCost").textContent = totalCost.toFixed(2);
}

// ===== SAVE =====
document.getElementById("saveBtn").onclick = () => {
  const data = [];
  drawnItems.eachLayer(l => {
    data.push({
      type: l instanceof L.Circle ? "circle" : "polygon",
      latlngs: l instanceof L.Circle
        ? [l.getLatLng().lat, l.getLatLng().lng]
        : l.getLatLngs()[0].map(p => [p.lat, p.lng]),
      radius: l instanceof L.Circle ? l.getRadius() : null,
      waterOn: l.waterOn || false
    });
  });
  localStorage.setItem("palmOil_" + datePicker.value, JSON.stringify(data));
  alert("Saved");
};

// ===== LOAD =====
function loadDate() {
  drawnItems.clearLayers();
  const saved = JSON.parse(localStorage.getItem("palmOil_" + datePicker.value) || "[]");

  saved.forEach(d => {
    let l;
    if (d.type === "circle") {
      l = L.circle(d.latlngs, { radius: d.radius });
      l.waterOn = d.waterOn;
      l.on("click", () => toggleWater(l));
    } else {
      l = L.polygon(d.latlngs.map(p => ({ lat: p[0], lng: p[1] })));
    }
    drawnItems.addLayer(l);
    updateLayer(l);
  });
}

datePicker.onchange = loadDate;

// ===== CLEAR =====
document.getElementById("clearBtn").onclick = () => {
  drawnItems.clearLayers();
  updateTotal();
};

// ===== PDF & WHATSAPP =====
document.getElementById("generatePDF").onclick = () => {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();

  pdf.text("Palm Oil Irrigation Receipt", 10, 20);
  pdf.text(`Admin: ${user.firstname}`, 10, 30);
  pdf.text(`Date: ${datePicker.value}`, 10, 40);
  pdf.text(`Total Cost: RM ${totalCost.toFixed(2)}`, 10, 60);

  pdf.save(`PalmOil_${datePicker.value}.pdf`);

  window.open(
    `https://wa.me/60174909836?text=${encodeURIComponent(
      `Palm Oil Irrigation\nDate: ${datePicker.value}\nTotal: RM ${totalCost.toFixed(2)}`
    )}`,
    "_blank"
  );
};

// ===== INIT =====
loadDate();

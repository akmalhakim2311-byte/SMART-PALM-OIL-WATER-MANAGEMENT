// ================= LOGIN CHECK =================
const user = JSON.parse(localStorage.getItem("currentUser"));
if (!user) window.location.href = "index.html";
document.getElementById("adminName").textContent = user.firstname;

// ================= LOGOUT =================
document.getElementById("logoutBtn").onclick = () => {
  localStorage.removeItem("currentUser");
  window.location.href = "index.html";
};

// ================= DATE PICKER =================
const datePicker = document.getElementById("datePicker");
datePicker.valueAsDate = new Date();

// ================= MAP INITIALIZATION =================
const map = L.map("map").setView([3.7026, 102.5455], 14);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap"
}).addTo(map);

// ================= DRAW CONTROLS =================
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

// ================= COST SETTINGS =================
const COST_PER_AREA = 0.05;
let totalCost = 0;

// ================= WEATHER CHECK =================
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

// ================= AREA CALCULATION =================
function calculatePolygonArea(layer) {
  return L.GeometryUtil.geodesicArea(layer.getLatLngs()[0]);
}

// ================= WATER LABEL =================
function showWaterLabel(circle) {
  if (circle._label) return;

  circle._label = L.marker(circle.getLatLng(), {
    icon: L.divIcon({
      className: "water-label",
      html: "💧 Water ON",
      iconSize: [80, 24],
      iconAnchor: [40, -15]
    }),
    interactive: false
  }).addTo(map);
}

function removeAllWaterLabels() {
  drawnItems.eachLayer(layer => {
    if (layer._label) {
      map.removeLayer(layer._label);
      layer._label = null;
    }
  });
}

// ================= UPDATE LAYER =================
async function updateLayer(layer) {
  const center = layer.getBounds
    ? layer.getBounds().getCenter()
    : layer.getLatLng();

  const raining = await isRaining(center.lat, center.lng, datePicker.value);

  if (raining) {
    layer.setStyle?.({ color: "blue" });
    layer.bindPopup("🌧️ Raining – Watering disabled");
    return;
  }

  if (layer instanceof L.Polygon) {
    layer.setStyle({ color: "green" });
    layer.area = calculatePolygonArea(layer);
    layer.cost = layer.area * COST_PER_AREA;

    layer.bindPopup(`
      ☀️ No rain<br>
      Area: ${layer.area.toFixed(2)} m²<br>
      Cost: RM ${layer.cost.toFixed(2)}
    `);
  }

  if (layer instanceof L.Circle) {
    layer.setStyle({ color: "darkgreen" });
    showWaterLabel(layer);
    updateTotal(true);
  }
}

// ================= TOTAL COST =================
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

// ================= DRAW CREATED =================
map.on(L.Draw.Event.CREATED, async e => {
  const layer = e.layer;
  drawnItems.addLayer(layer);

  if (layer instanceof L.Polygon) {
    await updateLayer(layer);
  }

  if (layer instanceof L.Circle) {
    await updateLayer(layer);
  }
});

// ================= DATE CHANGE =================
datePicker.addEventListener("change", () => {
  removeAllWaterLabels();
  loadDateData();
});

// ================= SAVE =================
document.getElementById("saveBtn").onclick = () => {
  const dateKey = datePicker.value;
  const data = [];

  drawnItems.eachLayer(layer => {
    data.push({
      type: layer instanceof L.Circle ? "circle" : "polygon",
      latlngs: layer instanceof L.Circle
        ? [layer.getLatLng().lat, layer.getLatLng().lng]
        : layer.getLatLngs()[0].map(p => [p.lat, p.lng]),
      radius: layer instanceof L.Circle ? layer.getRadius() : null
    });
  });

  localStorage.setItem("palmOilData_" + dateKey, JSON.stringify(data));
  alert("Data saved for " + dateKey);
};

// ================= LOAD DATE DATA =================
function loadDateData() {
  drawnItems.clearLayers();
  updateTotal(false);

  const savedData = JSON.parse(
    localStorage.getItem("palmOilData_" + datePicker.value) || "[]"
  );

  savedData.forEach(async d => {
    let layer;

    if (d.type === "circle") {
      layer = L.circle(d.latlngs, { radius: d.radius });
    } else {
      layer = L.polygon(d.latlngs.map(p => ({ lat: p[0], lng: p[1] })));
    }

    drawnItems.addLayer(layer);
    await updateLayer(layer);
  });
}

// ================= CLEAR ALL =================
document.getElementById("clearBtn").onclick = () => {
  removeAllWaterLabels();
  drawnItems.clearLayers();
  updateTotal(false);
};

// ================= PDF & WHATSAPP =================
document.getElementById("generatePDF").onclick = () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.text("Palm Oil Irrigation Receipt", 10, 20);
  doc.text(`Admin: ${user.firstname}`, 10, 30);
  doc.text(`Date: ${datePicker.value}`, 10, 40);

  let y = 50;
  drawnItems.eachLayer(layer => {
    if (layer instanceof L.Polygon && layer.cost) {
      doc.text(
        `Polygon Area: ${layer.area.toFixed(2)} m² | Cost: RM ${layer.cost.toFixed(2)}`,
        10,
        y
      );
      y += 10;
    }
  });

  doc.text(`Total Cost: RM ${totalCost.toFixed(2)}`, 10, y + 10);
  doc.save("PalmOil_Receipt.pdf");

  const msg = `Palm Oil Irrigation Receipt
Admin: ${user.firstname}
Date: ${datePicker.value}
Total Cost: RM ${totalCost.toFixed(2)}`;

  window.open(
    `https://wa.me/60174909836?text=${encodeURIComponent(msg)}`,
    "_blank"
  );
};

// ================= INITIAL LOAD =================
loadDateData();

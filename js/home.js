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

// ================= MAP =================
const map = L.map("map").setView([3.7026, 102.5455], 14);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap"
}).addTo(map);

// ================= DRAW =================
const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

map.addControl(new L.Control.Draw({
  draw: {
    polygon: true,
    circle: true,
    rectangle: false,
    polyline: false,
    marker: false
  },
  edit: { featureGroup: drawnItems }
}));

// ================= COST =================
const COST_PER_AREA = 0.05;
let totalCost = 0;

// ================= WEATHER =================
const WEATHER_API_KEY = "adb0eb54d909230353f3589a97c08521";

async function isRaining(lat, lng, date) {
  const res = await fetch(
    `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&appid=${WEATHER_API_KEY}`
  );
  const data = await res.json();
  const target = new Date(date).toDateString();

  return data.list.some(i =>
    new Date(i.dt_txt).toDateString() === target &&
    i.weather[0].main.toLowerCase().includes("rain")
  );
}

// ================= AREA =================
function polygonArea(layer) {
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

// ================= UPDATE TOTAL =================
function updateTotal() {
  totalCost = 0;

  drawnItems.eachLayer(layer => {
    if (layer instanceof L.Polygon && layer.waterOn) {
      totalCost += layer.cost;
    }
  });

  document.getElementById("totalCost").textContent = totalCost.toFixed(2);
}

// ================= DRAW CREATED =================
map.on(L.Draw.Event.CREATED, async e => {
  const layer = e.layer;
  layer.waterOn = false;
  drawnItems.addLayer(layer);

  // ---------- POLYGON ----------
  if (layer instanceof L.Polygon) {
    const area = polygonArea(layer);
    layer.area = area;
    layer.cost = area * COST_PER_AREA;

    const center = layer.getBounds().getCenter();
    const raining = await isRaining(center.lat, center.lng, datePicker.value);

    if (raining) {
      layer.setStyle({ color: "blue" });
      layer.bindPopup("🌧️ Raining – Water disabled");
    } else {
      layer.setStyle({ color: "green" });
      layer.bindPopup(`
        Area: ${area.toFixed(2)} m²<br>
        Cost: RM ${layer.cost.toFixed(2)}<br>
        <b>Click polygon to toggle cost</b>
      `);
    }

    layer.on("click", () => {
      layer.waterOn = !layer.waterOn;
      layer.setStyle({ color: layer.waterOn ? "darkgreen" : "green" });
      updateTotal();
    });
  }

  // ---------- CIRCLE ----------
  if (layer instanceof L.Circle) {
    showWaterLabel(layer);

    drawnItems.eachLayer(l => {
      if (l instanceof L.Polygon) {
        l.waterOn = true;
        l.setStyle({ color: "darkgreen" });
      }
    });

    updateTotal();
  }
});

// ================= SAVE =================
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
      waterOn: layer.waterOn
    });
  });

  localStorage.setItem("palmOilData_" + dateKey, JSON.stringify(data));
  alert("Saved for " + dateKey);
};

// ================= LOAD =================
function loadDateData() {
  drawnItems.clearLayers();
  updateTotal();

  const saved = JSON.parse(
    localStorage.getItem("palmOilData_" + datePicker.value) || "[]"
  );

  saved.forEach(d => {
    let layer;

    if (d.type === "circle") {
      layer = L.circle(d.latlngs, { radius: d.radius });
      showWaterLabel(layer);
    } else {
      layer = L.polygon(d.latlngs.map(p => ({ lat: p[0], lng: p[1] })));
      layer.area = polygonArea(layer);
      layer.cost = layer.area * COST_PER_AREA;
    }

    layer.waterOn = d.waterOn;
    drawnItems.addLayer(layer);
  });

  updateTotal();
}

// ================= CLEAR =================
document.getElementById("clearBtn").onclick = () => {
  drawnItems.clearLayers();
  updateTotal();
};

// ================= PDF + WHATSAPP =================
document.getElementById("generatePDF").onclick = () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.text("Palm Oil Irrigation Receipt", 10, 20);
  doc.text(`Admin: ${user.firstname}`, 10, 30);
  doc.text(`Date: ${datePicker.value}`, 10, 40);

  let y = 50;
  drawnItems.eachLayer(layer => {
    if (layer instanceof L.Polygon && layer.waterOn) {
      doc.text(`Area ${layer.area.toFixed(2)} m² | RM ${layer.cost.toFixed(2)}`, 10, y);
      y += 8;
    }
  });

  doc.text(`Total: RM ${totalCost.toFixed(2)}`, 10, y + 10);
  doc.save("PalmOil_Receipt.pdf");

  const msg = `Palm Oil Irrigation\nDate: ${datePicker.value}\nTotal RM ${totalCost.toFixed(2)}`;
  window.open(
    `https://wa.me/60174909836?text=${encodeURIComponent(msg)}`,
    "_blank"
  );
};

// ================= INIT =================
datePicker.addEventListener("change", loadDateData);
loadDateData();

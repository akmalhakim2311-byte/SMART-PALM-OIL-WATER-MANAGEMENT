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
  draw: { polygon: true, circle: true, marker: false, polyline: false, rectangle: false },
  edit: { featureGroup: drawnItems }
});
map.addControl(drawControl);

const drawControl = new L.Control.Draw({
  draw: {
    polygon: true,
    circle: true,
    circlemarker: true,   // ✅ ENABLE SENSOR MARKER
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

// ===== UPDATE LAYER =====
async function updateLayer(layer) {
  const center = layer.getBounds ? layer.getBounds().getCenter() : layer.getLatLng();
  const raining = await isRaining(center.lat, center.lng, datePicker.value);
  layer.raining = raining;

  if (raining) {
    layer.setStyle?.({ color: "blue" });
    layer.waterOn = false;
    layer.bindPopup("🌧️ Raining – Watering disabled");
    if (layer._waterLabel) map.removeLayer(layer._waterLabel);
  } else {
    if (layer instanceof L.Polygon) {
      layer.setStyle?.({ color: "green" });
      const area = calculateArea(layer).toFixed(2);
      const cost = (area * COST_PER_AREA).toFixed(2);
      layer.area = area;
      layer.cost = cost;
      layer.bindPopup(`☀️ No rain<br>Area: ${area} m²<br>Cost: RM ${cost}`);
    } else if (layer instanceof L.Circle) {
      layer.setStyle?.({ color: layer.waterOn ? "darkgreen" : "green" });
      if (layer.waterOn) showWaterLabel(layer);
      else if (layer._waterLabel) { map.removeLayer(layer._waterLabel); layer._waterLabel = null; }
    }
  }
  updateTotal();
}

// ===== WATER LABEL =====
function showWaterLabel(circle) {
  if (circle._waterLabel) map.removeLayer(circle._waterLabel);
  const icon = L.divIcon({
    className: "water-label",
    html: "💧 Water ON",
    iconSize: [80, 24],
    iconAnchor: [40, -10]
  });
  circle._waterLabel = L.marker(circle.getLatLng(), { icon, interactive: false }).addTo(map);
}

// ===== TOGGLE WATER (Circle Only) =====
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
  if (layer instanceof L.Polygon) layer.on("click", () => updateTotal(false));

  await updateLayer(layer);
});

map.on(L.Draw.Event.CREATED, async function (e) {
  const layer = e.layer;

  // Default flags
  layer.waterOn = false;
  layer.isSensor = layer instanceof L.CircleMarker;

  drawnItems.addLayer(layer);

  // Style sensor marker
  if (layer instanceof L.CircleMarker) {
    layer.setStyle({
      radius: 8,
      color: "#ff6f00",
      fillColor: "#ff9800",
      fillOpacity: 0.9
    });

    layer.bindPopup("📡 Sensor Point (No cost)");
  } else {
    await updateLayer(layer);
    layer.on("click", () => toggleWater(layer));
  }
});

// ===== DATE CHANGE =====
datePicker.addEventListener("change", () => {
  loadDateData();
});

// ===== TOTAL COST =====
function updateTotal(show = true) {
  totalCost = 0;
  drawnItems.eachLayer(layer => {
    if (layer instanceof L.Polygon && layer.cost) totalCost += parseFloat(layer.cost);
  });
  document.getElementById("totalCost").textContent = totalCost.toFixed(2);
  document.getElementById("totalWrapper").style.display = show ? "block" : "none";
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
};

document.getElementById("saveBtn").onclick = () => {
  const dateKey = datePicker.value;
  const data = [];

  drawnItems.eachLayer(layer => {
    data.push({
      type:
        layer instanceof L.Circle ? "circle" :
        layer instanceof L.Polygon ? "polygon" :
        layer instanceof L.CircleMarker ? "circlemarker" : "unknown",

      latlng:
        layer instanceof L.CircleMarker
          ? [layer.getLatLng().lat, layer.getLatLng().lng]
          : null,

      latlngs:
        layer instanceof L.Circle
          ? [layer.getLatLng().lat, layer.getLatLng().lng]
          : layer instanceof L.Polygon
          ? layer.getLatLngs()[0].map(p => [p.lat, p.lng])
          : null,

      radius:
        layer instanceof L.Circle ? layer.getRadius() : null,

      waterOn: layer.waterOn || false
    });
  });

  localStorage.setItem("palmOilData_" + dateKey, JSON.stringify(data));
  alert("Data saved for " + dateKey);
};

// ===== LOAD DATA =====
function loadDateData() {
  // Remove old layers and water labels
  drawnItems.eachLayer(layer => {
    if (layer._waterLabel) map.removeLayer(layer._waterLabel);
  });
  drawnItems.clearLayers();

  const dateKey = datePicker.value;
  const savedData = JSON.parse(localStorage.getItem("palmOilData_" + dateKey) || "[]");

  savedData.forEach(async d => {
    let layer;
    if (d.type === "circle") {
      layer = L.circle([d.latlngs[0], d.latlngs[1]], { radius: d.radius });
    } else if (d.type === "polygon") {
      layer = L.polygon(d.latlngs.map(p => ({ lat: p[0], lng: p[1] })));
    }
    layer.waterOn = d.waterOn;
    drawnItems.addLayer(layer);

    if (layer instanceof L.Circle) layer.on("click", () => toggleWater(layer));
    if (layer instanceof L.Polygon) layer.on("click", () => updateTotal(false));

    await updateLayer(layer);
  });
}

function loadDateData() {
  drawnItems.clearLayers();
  removeAllWaterLabels();

  const dateKey = datePicker.value;
  const savedData = JSON.parse(
    localStorage.getItem("palmOilData_" + dateKey) || "[]"
  );

  savedData.forEach(async d => {
    let layer;

    if (d.type === "circle") {
      layer = L.circle([d.latlngs[0], d.latlngs[1]], { radius: d.radius });
    }

    if (d.type === "polygon") {
      layer = L.polygon(d.latlngs.map(p => ({ lat: p[0], lng: p[1] })));
    }

    if (d.type === "circlemarker") {
      layer = L.circleMarker(d.latlng, {
        radius: 8,
        color: "#ff6f00",
        fillColor: "#ff9800",
        fillOpacity: 0.9
      });
      layer.bindPopup("📡 Sensor Point (No cost)");
    }

    if (!layer) return;

    layer.waterOn = d.waterOn || false;
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
  drawnItems.eachLayer(layer => { if (layer._waterLabel) map.removeLayer(layer._waterLabel); });
  drawnItems.clearLayers();
  updateTotal(false);
};

document.getElementById("clearBtn").onclick = () => {
  drawnItems.clearLayers();
  removeAllWaterLabels();
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
  let anyIrrigation = false;

  drawnItems.eachLayer(layer => {
    if (layer instanceof L.Polygon) {
      anyIrrigation = true;
      doc.text(`Polygon: Area ${layer.area} m² | Cost RM ${layer.cost}`, 10, y);
      y += 10;
    } else if (layer instanceof L.Circle) {
      const status = layer.waterOn ? "Water ON" : "No Water Usage";
      const note = layer.raining ? "🌧️ Raining – Watering disabled" : status;
      doc.text(`Circle at (${layer.getLatLng().lat.toFixed(5)}, ${layer.getLatLng().lng.toFixed(5)}): ${note}`, 10, y);
      y += 10;
    }
  });

  if (!anyIrrigation) {
    doc.text("No irrigation performed.", 10, y);
    y += 10;
  }

  doc.text(`Total Cost: RM ${totalCost.toFixed(2)}`, 10, y + 10);

  const filename = `PalmOil_Receipt_${datePicker.value}.pdf`;
  doc.save(filename);

  const msg = `Palm Oil Irrigation Receipt\nAdmin: ${user.firstname}\nDate: ${datePicker.value}\nTotal Cost: RM ${totalCost.toFixed(2)}`;
  window.open(`https://wa.me/60174909836?text=${encodeURIComponent(msg)}`, "_blank");
};

// ===== INITIAL LOAD =====
loadDateData();

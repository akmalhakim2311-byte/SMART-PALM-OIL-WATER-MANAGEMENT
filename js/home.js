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

// ===== MAP INITIALIZATION (FELDA Jengka) =====
const map = L.map("map").setView([3.7026, 102.5455], 14);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap"
}).addTo(map);

// ===== DRAW CONTROLS (ONLY POLYGON AND CIRCLE) =====
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

// ===== CALCULATE AREA =====
function calculateArea(layer) {
  if (layer instanceof L.Circle) {
    const r = layer.getRadius(); // in meters
    return Math.PI * r * r;
  } else {
    return L.GeometryUtil.geodesicArea(layer.getLatLngs()[0]);
  }
}

// ===== Water ON LABEL =====
const waterOnLabel = document.getElementById("waterOnLabel");

// ===== UPDATE POLYGON / CIRCLE =====
async function updateLayer(layer) {
  const center = layer.getBounds ? layer.getBounds().getCenter() : layer.getLatLng();
  const raining = await isRaining(center.lat, center.lng, datePicker.value);

  if (raining) {
    layer.setStyle && layer.setStyle({ color: "blue" });
    layer.waterOn = false;
    layer.bindPopup("🌧️ Raining today – Watering disabled");
  } else {
    if (layer.waterOn) {
      layer.setStyle && layer.setStyle({ color: "darkgreen" });
    } else {
      layer.setStyle && layer.setStyle({ color: "green" });
    }
    const area = calculateArea(layer);
    const cost = (area * COST_PER_AREA).toFixed(2);
    layer.cost = cost;

    let popupText = `☀️ No rain<br>Area: ${area.toFixed(2)} m²<br>Cost: RM ${cost}`;
    if (layer instanceof L.Circle) popupText += `<br><b>💧 Click to toggle Water ON/OFF</b>`;
    else popupText += `<br><b>Click polygon to toggle Water ON/OFF</b>`;
    layer.bindPopup(popupText);
  }
  updateTotal();
}

// ===== TOGGLE WATER ON =====
function toggleWater(layer) {
  if (layer.waterOn === undefined) layer.waterOn = false;
  layer.waterOn = !layer.waterOn;

  // Show water label for circle only
  if (layer instanceof L.Circle) {
    waterOnLabel.style.display = layer.waterOn ? "block" : "none";
  }

  updateLayer(layer);
}

// ===== DRAW EVENT =====
map.on(L.Draw.Event.CREATED, async function (e) {
  const layer = e.layer;
  layer.waterOn = false;
  drawnItems.addLayer(layer);

  await updateLayer(layer);

  // Toggle water when clicked
  layer.on("click", () => toggleWater(layer));
});

// ===== DATE CHANGE =====
datePicker.addEventListener("change", () => {
  drawnItems.eachLayer(layer => updateLayer(layer));
});

// ===== UPDATE TOTAL COST =====
function updateTotal() {
  totalCost = 0;
  drawnItems.eachLayer(layer => {
    if (layer.waterOn && layer.cost) totalCost += parseFloat(layer.cost);
  });
  document.getElementById("totalCost").textContent = totalCost.toFixed(2);
}

// ===== SAVE BY DATE =====
document.getElementById("saveBtn").onclick = () => {
  const saveData = [];
  drawnItems.eachLayer(layer => {
    const layerData = {
      type: layer instanceof L.Circle ? "circle" : "polygon",
      latlngs: layer.getLatLngs ? layer.getLatLngs() : layer.getLatLng(),
      radius: layer.getRadius ? layer.getRadius() : null,
      waterOn: layer.waterOn,
      cost: layer.cost
    };
    saveData.push(layerData);
  });
  localStorage.setItem("data_" + datePicker.value, JSON.stringify(saveData));
  alert("Data saved for " + datePicker.value);
});

// ===== LOAD DATA ON DATE CHANGE =====
datePicker.addEventListener("change", () => {
  drawnItems.clearLayers();
  waterOnLabel.style.display = "none";
  const saved = localStorage.getItem("data_" + datePicker.value);
  if (saved) {
    const layers = JSON.parse(saved);
    layers.forEach(item => {
      let layer;
      if (item.type === "circle") {
        layer = L.circle(item.latlng, { radius: item.radius });
      } else {
        layer = L.polygon(item.latlngs[0]);
      }
      layer.waterOn = item.waterOn;
      layer.cost = item.cost;
      drawnItems.addLayer(layer);
      updateLayer(layer);
      layer.on("click", () => toggleWater(layer));
    });
  }
});

// ===== CLEAR ALL =====
document.getElementById("clearAllBtn").onclick = () => {
  drawnItems.clearLayers();
  waterOnLabel.style.display = "none";
  totalCost = 0;
  document.getElementById("totalCost").textContent = totalCost.toFixed(2);
};

// ===== PDF + WHATSAPP =====
document.getElementById("generatePDF").onclick = () => {
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
      doc.text(`Polygon: Area ${area} m² | Cost RM ${layer.cost}`, 10, y);
      y += 10;
    }
  });
  doc.text(`Total Cost: RM ${totalCost.toFixed(2)}`, 10, y + 10);

  doc.save("receipt.pdf");

  // WhatsApp
  const msg = encodeURIComponent(`Palm Oil Irrigation Receipt\nAdmin: ${user.firstname}\nDate: ${datePicker.value}\nTotal Cost: RM ${totalCost.toFixed(2)}`);
  window.open(`https://wa.me/60174909836?text=${msg}`, "_blank");
};

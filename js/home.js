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

// ===== DRAW CONTROLS =====
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

// ===== AREA CALCULATION =====
function calculateArea(layer) {
  if (layer instanceof L.Polygon) return L.GeometryUtil.geodesicArea(layer.getLatLngs()[0]);
  return 0;
}

// ===== UPDATE POLYGON/CIRCLE =====
async function updateLayer(layer) {
  const center = layer.getBounds().getCenter();
  const raining = await isRaining(center.lat, center.lng, datePicker.value);

  if (layer instanceof L.Polygon) {
    const area = calculateArea(layer);
    const cost = (area * COST_PER_AREA).toFixed(2);
    layer.cost = cost;

    layer.setStyle({ color: raining ? "blue" : "green" });

    layer.bindPopup(`
      ${raining ? "🌧️ Raining today – Watering disabled" :
      `☀️ No rain<br>Area: ${area.toFixed(2)} m²<br>Cost: RM ${cost}`}`);
  }

  if (layer instanceof L.Circle) {
    layer.setStyle({ color: "orange" });
    layer.waterOn = false;
    layer.bindPopup("Click to toggle Water ON/OFF");
    layer.on("click", () => {
      layer.waterOn = !layer.waterOn;
      if (layer.waterOn) layer.bindPopup("💧 Water ON").openPopup();
      else layer.bindPopup("Click to toggle Water ON/OFF").openPopup();
      updateTotal();
    });
  }

  updateTotal();
}

// ===== DRAW EVENT =====
map.on(L.Draw.Event.CREATED, async function (e) {
  const layer = e.layer;
  drawnItems.addLayer(layer);
  await updateLayer(layer);
});

// ===== DATE CHANGE =====
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

// ===== CLEAR ALL =====
document.getElementById("clearBtn").onclick = () => {
  drawnItems.clearLayers();
  totalCost = 0;
  document.getElementById("totalCost").textContent = "0.00";
};

// ===== SAVE =====
document.getElementById("saveBtn").onclick = () => {
  const saveData = {
    date: datePicker.value,
    layers: drawnItems.toGeoJSON()
  };
  localStorage.setItem(`palmOil-${datePicker.value}`, JSON.stringify(saveData));
  alert(`Data saved for ${datePicker.value}`);
};

// ===== LOAD SAVED DATA =====
function loadSavedData(date) {
  const saved = JSON.parse(localStorage.getItem(`palmOil-${date}`));
  if (saved) {
    drawnItems.clearLayers();
    L.geoJSON(saved.layers, {
      onEachFeature: (feature, layer) => {
        drawnItems.addLayer(layer);
        updateLayer(layer);
      }
    });
  }
}
datePicker.addEventListener("change", () => loadSavedData(datePicker.value));
loadSavedData(datePicker.value);

// ===== PDF RECEIPT =====
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
    if (layer.waterOn && layer.cost) {
      const area = calculateArea(layer).toFixed(2);
      doc.text(`Layer: Area ${area} m² | Cost RM ${layer.cost}`, 10, y);
      y += 10;
    }
  });

  doc.text(`Total Cost: RM ${totalCost.toFixed(2)}`, 10, y + 10);

  doc.save("receipt.pdf");

  const msg = encodeURIComponent(`Palm Oil Irrigation Receipt\nAdmin: ${user.firstname}\nDate: ${datePicker.value}\nTotal Cost: RM ${totalCost.toFixed(2)}`);
  window.open(`https://wa.me/60174909836?text=${msg}`, "_blank");
};

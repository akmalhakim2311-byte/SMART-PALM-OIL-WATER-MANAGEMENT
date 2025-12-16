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

// ===== MAP INITIALIZATION (FELDA Jengka) =====
const map = L.map("map").setView([3.7026, 102.5455], 14);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap"
}).addTo(map);

// ===== DRAW CONTROLS (Polygon & Circle Only) =====
const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

const drawControl = new L.Control.Draw({
  draw: {
    polygon: true,
    circle: true,
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
  if (layer instanceof L.Circle) {
    const r = layer.getRadius();
    return Math.PI * r * r;
  } else {
    return L.GeometryUtil.geodesicArea(layer.getLatLngs()[0]);
  }
}

// ===== UPDATE POLYGON/CIRCLE STYLE =====
async function updateLayer(layer) {
  const center = layer.getBounds ? layer.getBounds().getCenter() : layer.getLatLng();
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
    layer.bindPopup(`☀️ No rain<br>Area: ${area.toFixed(2)} m²<br>Cost: RM ${cost}<br><b>Click circle to toggle Water ON</b>`);
  }

  updateTotal();
}

// ===== TOGGLE WATER FOR CIRCLE =====
function toggleWater(layer) {
  if (!(layer instanceof L.Circle)) return; // Only toggle for circle
  layer.waterOn = !layer.waterOn;
  updateLayer(layer);
}

// ===== DRAW EVENT =====
map.on(L.Draw.Event.CREATED, async function(e) {
  const layer = e.layer;
  layer.waterOn = false;
  drawnItems.addLayer(layer);

  await updateLayer(layer);

  layer.on("click", () => toggleWater(layer));
});

// ===== DATE CHANGE =====
datePicker.addEventListener("change", () => {
  loadDataForDate(datePicker.value);
});

// ===== TOTAL COST =====
function updateTotal() {
  totalCost = 0;
  drawnItems.eachLayer(layer => {
    if (layer.waterOn && layer.cost) totalCost += parseFloat(layer.cost);
  });
  document.getElementById("totalCost").textContent = totalCost.toFixed(2);
}

// ===== SAVE DATA =====
document.getElementById("saveData").onclick = () => {
  const date = datePicker.value;
  const dataToSave = [];

  drawnItems.eachLayer(layer => {
    const latlngs = layer.getLatLngs ? layer.getLatLngs() : [layer.getLatLng()];
    dataToSave.push({
      type: layer instanceof L.Circle ? 'circle' : 'polygon',
      latlngs,
      waterOn: layer.waterOn || false,
      cost: layer.cost || 0
    });
  });

  localStorage.setItem('irrigation_' + date, JSON.stringify(dataToSave));
  alert('Data saved for ' + date);
};

// ===== LOAD DATA =====
function loadDataForDate(date) {
  drawnItems.clearLayers();
  const savedData = JSON.parse(localStorage.getItem('irrigation_' + date));
  if (!savedData) return;

  savedData.forEach(item => {
    let layer;
    if (item.type === 'polygon') {
      layer = L.polygon(item.latlngs);
    } else if (item.type === 'circle') {
      layer = L.circle(item.latlngs[0], { radius: item.latlngs[0].radius || 10 });
    }
    layer.waterOn = item.waterOn;
    layer.cost = item.cost;
    drawnItems.addLayer(layer);

    if (layer.waterOn) {
      layer.bindPopup(`<b>Water ON</b><br>Cost: RM ${layer.cost}`);
    }

    layer.on("click", () => toggleWater(layer));
  });

  updateTotal();
}

// ===== LOAD LAST SAVED DATE ON PAGE LOAD =====
const savedDates = Object.keys(localStorage).filter(k => k.startsWith('irrigation_'));
if (savedDates.length > 0) {
  const lastDateKey = savedDates[savedDates.length - 1];
  const lastDate = lastDateKey.replace('irrigation_', '');
  datePicker.value = lastDate;
  loadDataForDate(lastDate);
} else {
  datePicker.valueAsDate = new Date();
}

// ===== CLEAR ALL =====
document.getElementById("clearAll").onclick = () => {
  drawnItems.clearLayers();
  updateTotal();
};

// ===== PDF/WHATSAPP RECEIPT =====
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
      doc.text(`Area: ${area} m² | Cost: RM ${layer.cost}`, 10, y);
      y += 10;
    }
  });

  doc.text(`Total Cost: RM ${totalCost.toFixed(2)}`, 10, y + 10);

  doc.save("receipt.pdf");

  const msg = encodeURIComponent(`Palm Oil Irrigation Receipt\nAdmin: ${user.firstname}\nDate: ${datePicker.value}\nTotal Cost: RM ${totalCost.toFixed(2)}`);
  window.open(`https://wa.me/60174909836?text=${msg}`, "_blank");
};

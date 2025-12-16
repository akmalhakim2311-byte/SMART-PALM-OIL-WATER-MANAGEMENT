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

// ===== DRAW CONTROLS (only polygon and circle) =====
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
  else if (layer instanceof L.Circle) return Math.PI * Math.pow(layer.getRadius(), 2);
  return 0;
}

// ===== UPDATE POLYGON/CIRCLE STYLE =====
async function updateLayer(layer) {
  const center = layer.getBounds ? layer.getBounds().getCenter() : layer.getLatLng();
  const raining = await isRaining(center.lat, center.lng, datePicker.value);

  if (raining) {
    layer.setStyle({ color: "blue" });
    layer.waterOn = false;
    layer.bindPopup("🌧️ Raining today – Watering disabled");
  } else {
    if (layer instanceof L.Polygon) {
      layer.setStyle({ color: layer.waterOn ? "darkgreen" : "green" });
      const area = calculateArea(layer);
      const cost = (area * COST_PER_AREA).toFixed(2);
      layer.cost = cost;
      layer.bindPopup(`
        ☀️ No rain<br>
        Area: ${area.toFixed(2)} m²<br>
        Cost: RM ${cost}<br>
        <b>Click to toggle Water ON/OFF</b>
      `);
    } else if (layer instanceof L.Circle) {
      layer.setStyle({ color: layer.waterOn ? "orange" : "red" });
      layer.bindPopup(layer.waterOn ? "💧 Water ON" : "Click to toggle Water ON/OFF");
    }
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

  // Click to toggle water for polygons or circles
  layer.on("click", () => toggleWater(layer));
});

// ===== DATE CHANGE EVENT =====
datePicker.addEventListener("change", () => {
  drawnItems.eachLayer(layer => updateLayer(layer));
  // Load saved data for this date if exists
  const savedData = localStorage.getItem(`mapData-${datePicker.value}`);
  if (savedData) {
    const parsed = JSON.parse(savedData);
    drawnItems.clearLayers();
    parsed.forEach(l => {
      let layer;
      if (l.type === "polygon") layer = L.polygon(l.latlngs);
      else if (l.type === "circle") layer = L.circle(l.latlngs[0], { radius: l.radius });
      layer.waterOn = l.waterOn;
      layer.cost = l.cost;
      drawnItems.addLayer(layer);
      updateLayer(layer);
      layer.on("click", () => toggleWater(layer));
    });
  } else {
    updateTotal();
  }
});

// ===== TOTAL COST =====
function updateTotal() {
  totalCost = 0;
  drawnItems.eachLayer(layer => {
    if (layer.waterOn && layer.cost) totalCost += parseFloat(layer.cost);
  });
  document.getElementById("totalCost").textContent = totalCost.toFixed(2);
}

// ===== SAVE MAP DATA =====
document.getElementById("saveBtn").onclick = () => {
  const dataToSave = [];
  drawnItems.eachLayer(layer => {
    let obj = {};
    if (layer instanceof L.Polygon) {
      obj.type = "polygon";
      obj.latlngs = layer.getLatLngs();
    } else if (layer instanceof L.Circle) {
      obj.type = "circle";
      obj.latlngs = [layer.getLatLng()];
      obj.radius = layer.getRadius();
    }
    obj.waterOn = layer.waterOn;
    obj.cost = layer.cost;
    dataToSave.push(obj);
  });
  localStorage.setItem(`mapData-${datePicker.value}`, JSON.stringify(dataToSave));
  alert(`Map data saved for ${datePicker.value}`);
};

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
      doc.text(`Polygon/Circle: Area ${area} m² | Cost RM ${layer.cost}`, 10, y);
      y += 10;
    }
  });

  doc.text(`Total Cost: RM ${totalCost.toFixed(2)}`, 10, y + 10);

  doc.save("receipt.pdf");

  const msg = encodeURIComponent(
    `Palm Oil Irrigation Receipt\nAdmin: ${user.firstname}\nDate: ${datePicker.value}\nTotal Cost: RM ${totalCost.toFixed(2)}`
  );
  window.open(`https://wa.me/60174909836?text=${msg}`, "_blank");
};

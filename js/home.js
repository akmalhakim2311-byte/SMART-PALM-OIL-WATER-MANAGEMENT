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

// ===== WATER ON LABEL =====
let waterOnLabel = document.createElement("div");
waterOnLabel.id = "waterOnLabel";
waterOnLabel.style.position = "absolute";
waterOnLabel.style.top = "10px";
waterOnLabel.style.right = "20px";
waterOnLabel.style.padding = "5px 10px";
waterOnLabel.style.background = "rgba(45,106,79,0.9)";
waterOnLabel.style.color = "#fff";
waterOnLabel.style.fontWeight = "bold";
waterOnLabel.style.borderRadius = "4px";
waterOnLabel.style.zIndex = 1000;
waterOnLabel.style.display = "none"; // hidden by default
waterOnLabel.innerHTML = "💧 Water ON";
document.getElementById("map").appendChild(waterOnLabel);

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
    const r = layer.getRadius();
    return Math.PI * r * r;
  } else {
    return L.GeometryUtil.geodesicArea(layer.getLatLngs()[0]);
  }
}

// ===== UPDATE LAYER =====
async function updateLayer(layer) {
  const center = layer.getBounds ? layer.getBounds().getCenter() : layer.getLatLng();
  const raining = await isRaining(center.lat, center.lng, datePicker.value);

  if (raining) {
    layer.setStyle && layer.setStyle({ color: "blue" });
    layer.waterOn = false;
    layer.bindPopup("🌧️ Raining today – Watering disabled");
    if (layer instanceof L.Circle) waterOnLabel.style.display = "none";
  } else {
    layer.setStyle && layer.setStyle({ color: layer.waterOn ? "darkgreen" : "green" });
    const area = calculateArea(layer);
    const cost = (area * COST_PER_AREA).toFixed(2);
    layer.cost = cost;
    layer.bindPopup(`☀️ No rain<br>Area: ${area.toFixed(2)} m²<br>Cost: RM ${cost}<br><b>Click to toggle Water ON/OFF</b>`);
    
    // Show Water ON label only for circle marker when waterOn is true
    if (layer instanceof L.Circle && layer.waterOn) {
      waterOnLabel.style.display = "block";
    }
  }
  updateTotal();
}

// ===== TOGGLE WATER =====
function toggleWater(layer) {
  if (layer.waterOn === undefined) layer.waterOn = false;
  layer.waterOn = !layer.waterOn;

  // Circle marker toggles the label
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
  layer.on("click", () => toggleWater(layer));
});

// ===== DATE CHANGE =====
datePicker.addEventListener("change", () => {
  drawnItems.eachLayer(layer => updateLayer(layer));
});

// ===== UPDATE TOTAL =====
function updateTotal() {
  totalCost = 0;
  drawnItems.eachLayer(layer => {
    if (layer.waterOn && layer.cost) totalCost += parseFloat(layer.cost);
  });
  document.getElementById("totalCost").textContent = totalCost.toFixed(2);
}

// ===== SAVE BUTTON =====
document.getElementById("saveBtn").onclick = () => {
  const saveData = [];
  drawnItems.eachLayer(layer => {
    saveData.push({
      type: layer instanceof L.Circle ? "circle" : "polygon",
      latlngs: layer.getLatLngs ? layer.getLatLngs() : layer.getLatLng(),
      radius: layer.getRadius ? layer.getRadius() : null,
      waterOn: layer.waterOn,
      cost: layer.cost
    });
  });
  localStorage.setItem("data_" + datePicker.value, JSON.stringify(saveData));
  alert("Data saved for " + datePicker.value);
};

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

  const msg = encodeURIComponent(`Palm Oil Irrigation Receipt\nAdmin: ${user.firstname}\nDate: ${datePicker.value}\nTotal Cost: RM ${totalCost.toFixed(2)}`);
  window.open(`https://wa.me/60174909836?text=${msg}`, "_blank");
};

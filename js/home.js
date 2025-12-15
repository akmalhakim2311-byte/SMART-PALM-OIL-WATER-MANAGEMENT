// ===== LOGIN CHECK =====
const user = JSON.parse(localStorage.getItem("currentUser"));
if (!user) {
  window.location.href = "login.html";
}
document.getElementById("adminName").textContent = user.firstname;

// ===== LOGOUT =====
document.getElementById("logoutBtn").onclick = () => {
  localStorage.removeItem("currentUser");
  window.location.href = "login.html";
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
    marker: false,
    polyline: false,
    rectangle: false,
    circle: false
  },
  edit: {
    featureGroup: drawnItems
  }
});
map.addControl(drawControl);

// ===== COST SETTINGS =====
const COST_PER_AREA = 0.05; // RM per m²
let totalCost = 0;

// ===== WEATHER CHECK =====
const WEATHER_API_KEY = "adb0eb54d909230353f3589a97c08521";

// Fetch hourly forecast for the polygon center
async function getRainProbability(lat, lng, date) {
  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&appid=${WEATHER_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();

  const selectedDate = new Date(date).toDateString();
  let rainHours = 0;
  let totalHours = 0;

  data.list.forEach(item => {
    if (new Date(item.dt_txt).toDateString() === selectedDate) {
      totalHours++;
      if (item.pop && item.pop > 0) rainHours += item.pop; // pop = probability of precipitation (0–1)
    }
  });

  if (totalHours === 0) return 0;
  return (rainHours / totalHours) * 100; // Percentage 0–100%
}

// ===== AREA CALCULATION =====
function calculateArea(layer) {
  return L.GeometryUtil.geodesicArea(layer.getLatLngs()[0]);
}

// ===== UPDATE POLYGON STYLE =====
async function updatePolygon(layer) {
  const center = layer.getBounds().getCenter();
  const rainProb = await getRainProbability(center.lat, center.lng, datePicker.value);

  // Color gradient: 0% rain = green, 100% rain = blue
  const green = [0, 200, 0]; // RGB
  const blue = [0, 0, 200];
  const r = Math.round(green[0] + (blue[0] - green[0]) * (rainProb / 100));
  const g = Math.round(green[1] + (blue[1] - green[1]) * (rainProb / 100));
  const b = Math.round(green[2] + (blue[2] - green[2]) * (rainProb / 100));
  const color = `rgb(${r},${g},${b})`;

  layer.setStyle({ color: color });
  layer.rainProb = rainProb;

  const area = calculateArea(layer);
  const cost = (area * COST_PER_AREA).toFixed(2);
  layer.area = area;
  layer.cost = cost;

  // Watering allowed only if rainProb < 50%
  layer.waterOn = layer.waterOn && rainProb < 50;

  layer.bindPopup(`
    🌦 Rain probability: ${rainProb.toFixed(0)}%<br>
    Area: ${area.toFixed(2)} m²<br>
    Cost: RM ${cost}<br>
    Watering ${layer.waterOn ? "ON" : "OFF"} (Click polygon to toggle)
  `);

  updateTotal();
}

// ===== TOGGLE WATER =====
function toggleWater(layer) {
  if (layer.rainProb >= 50) return alert("🌧 Too rainy today. Watering disabled.");
  layer.waterOn = !layer.waterOn;
  updatePolygon(layer);
}

// ===== DRAW EVENT =====
map.on(L.Draw.Event.CREATED, async function (e) {
  const layer = e.layer;
  layer.waterOn = false;
  drawnItems.addLayer(layer);
  await updatePolygon(layer);

  layer.on("click", () => toggleWater(layer));
});

// ===== DATE CHANGE EVENT =====
datePicker.addEventListener("change", () => {
  drawnItems.eachLayer(layer => updatePolygon(layer));
});

// ===== TOTAL COST =====
function updateTotal() {
  totalCost = 0;
  drawnItems.eachLayer(layer => {
    if (layer.waterOn && layer.cost) totalCost += parseFloat(layer.cost);
  });
  document.getElementById("totalCost").textContent = totalCost.toFixed(2);
}

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
    if (layer.waterOn) {
      doc.text(
        `Polygon: Area ${layer.area.toFixed(2)} m² | Cost RM ${layer.cost} | Rain ${layer.rainProb.toFixed(0)}%`,
        10,
        y
      );
      y += 10;
    }
  });

  doc.text(`Total Cost: RM ${totalCost.toFixed(2)}`, 10, y + 10);

  // Save PDF
  doc.save("receipt.pdf");

  // WhatsApp link (send PDF manually or link message)
  const msg = encodeURIComponent(
    `Palm Oil Irrigation Receipt\nAdmin: ${user.firstname}\nDate: ${datePicker.value}\nTotal Cost: RM ${totalCost.toFixed(2)}`
  );
  window.open(`https://wa.me/60174909836?text=${msg}`, "_blank");
};

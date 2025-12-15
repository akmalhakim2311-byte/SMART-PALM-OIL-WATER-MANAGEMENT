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
  draw: { polygon: true, marker: false, polyline: false, rectangle: false, circle: false },
  edit: { featureGroup: drawnItems }
});
map.addControl(drawControl);

// ===== COST SETTINGS =====
const COST_PER_AREA = 0.05; // RM per m²

// ===== WEATHER CHECK (OpenWeatherMap) =====
const WEATHER_API_KEY = "adb0eb54d909230353f3589a97c08521";

async function isRaining(lat, lng, date) {
  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&appid=${WEATHER_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  const selectedDate = new Date(date).toDateString();

  return data.list.some(item =>
    new Date(item.dt_txt).toDateString() === selectedDate &&
    item.weather[0].main.toLowerCase().includes("rain")
  );
}

// ===== HELPER: UPDATE TOTAL COST =====
function updateTotal() {
  let totalCost = 0;
  drawnItems.eachLayer(layer => {
    if (layer.waterOn) totalCost += parseFloat(layer.cost);
  });
  document.getElementById("totalCost").textContent = totalCost.toFixed(2);
}

// ===== DRAW EVENT =====
map.on(L.Draw.Event.CREATED, async function(e) {
  const layer = e.layer;
  drawnItems.addLayer(layer);

  const center = layer.getBounds().getCenter();
  const raining = await isRaining(center.lat, center.lng, datePicker.value);

  const area = L.GeometryUtil.geodesicArea(layer.getLatLngs()[0]);
  const cost = (area * COST_PER_AREA).toFixed(2);

  layer.area = area;
  layer.cost = cost;
  layer.waterOn = false; // default OFF

  if (raining) {
    layer.setStyle({ color: "blue" });
    layer.bindPopup("🌧️ Raining today – Watering disabled");
  } else {
    layer.setStyle({ color: "green" });
    layer.bindPopup(`
      ☀️ No rain<br>
      Area: ${area.toFixed(2)} m²<br>
      Cost: RM ${cost}<br>
      <b>Click polygon to toggle water</b>
    `);

    // Toggle watering on click
    layer.on("click", () => {
      layer.waterOn = !layer.waterOn;
      layer.bindPopup(`
        ☀️ No rain<br>
        Area: ${area.toFixed(2)} m²<br>
        Cost: RM ${cost}<br>
        <b>Watering ${layer.waterOn ? "ON" : "OFF"}</b>
      `).openPopup();
      updateTotal();
    });
  }
});

// ===== WHATSAPP PDF RECEIPT =====
document.getElementById("sendReceipt").onclick = () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text("Palm Oil Irrigation Receipt", 10, 20);
  doc.text(`Admin: ${user.firstname}`, 10, 30);
  doc.text(`Date: ${datePicker.value}`, 10, 40);

  let y = 50;
  drawnItems.eachLayer((layer, i) => {
    if (layer.waterOn) {
      doc.text(`Polygon ${i+1}: Area ${layer.area.toFixed(2)} m², Cost RM ${layer.cost}`, 10, y);
      y += 10;
    }
  });

  const total = Array.from(drawnItems.getLayers())
    .filter(l => l.waterOn)
    .reduce((sum, l) => sum + parseFloat(l.cost), 0);

  doc.text(`Total Cost: RM ${total.toFixed(2)}`, 10, y + 10);

  // Save PDF as blob URI for WhatsApp
  const pdfData = doc.output("datauristring");
  const whatsappUrl = "https://wa.me/60174909836?text=" + encodeURIComponent(
    "Please see attached PDF receipt: " + pdfData
  );
  window.open(whatsappUrl, "_blank");
};

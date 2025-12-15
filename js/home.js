// ===== LOGIN CHECK ===== 
const user = JSON.parse(localStorage.getItem("currentUser"));
if (!user) window.location.href = "index.html";
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
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap" }).addTo(map);

// ===== DRAW CONTROLS =====
const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);
const drawControl = new L.Control.Draw({
  draw: { polygon: true, marker: false, polyline: false, rectangle: false, circle: false },
  edit: { featureGroup: drawnItems }
});
map.addControl(drawControl);

// ===== COST SETTINGS =====
const COST_PER_AREA = 0.05;
let totalCost = 0;

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

// ===== DRAW EVENT =====
map.on(L.Draw.Event.CREATED, async function (e) {
  const layer = e.layer;
  drawnItems.addLayer(layer);

  const center = layer.getBounds().getCenter();
  const raining = await isRaining(center.lat, center.lng, datePicker.value);

  const area = L.GeometryUtil.geodesicArea(layer.getLatLngs()[0]);
  const cost = (area * COST_PER_AREA).toFixed(2);

  layer.waterOn = false;
  layer.area = area;
  layer.cost = cost;

  if (raining) {
    layer.setStyle({ color: "blue" });
    layer.bindPopup("🌧️ Raining today – Watering disabled");
  } else {
    layer.setStyle({ color: "green" });
    layer.bindPopup(`☀️ No rain<br>Area: ${area.toFixed(2)} m²<br>Cost: RM ${cost}<br><b>Click polygon to toggle water</b>`);
  }

  // Toggle water on click
  layer.on("click", () => {
    if (!raining) {
      layer.waterOn = !layer.waterOn;
      const popupText = `☀️ No rain<br>Area: ${area.toFixed(2)} m²<br>Cost: RM ${cost}<br><b>Watering ${layer.waterOn ? "ON" : "OFF"}</b>`;
      layer.bindPopup(popupText).openPopup();
      updateTotal();
    }
  });
});

// ===== UPDATE TOTAL COST =====
function updateTotal() {
  totalCost = 0;
  drawnItems.eachLayer(layer => {
    if(layer.waterOn) totalCost += parseFloat(layer.cost);
  });
  document.getElementById("totalCost").textContent = totalCost.toFixed(2);
}

// ===== WHATSAPP PDF RECEIPT =====
document.getElementById("sendReceipt").onclick = () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text("Palm Oil Irrigation Receipt", 10, 20);
  doc.text(`Admin: ${user.firstname}`, 10, 30);
  doc.text(`Date: ${datePicker.value}`, 10, 40);
  doc.text(`Total Cost: RM ${totalCost.toFixed(2)}`, 10, 50);

  let yOffset = 60;
  drawnItems.eachLayer((layer, i) => {
    if(layer.waterOn){
      doc.text(`Polygon ${i+1}: Area ${layer.area.toFixed(2)} m², Cost RM ${layer.cost}`, 10, yOffset);
      yOffset += 10;
    }
  });

  const pdfData = doc.output("datauristring");
  const whatsappUrl = "https://wa.me/60174909836?text=" + encodeURIComponent("Please see attached PDF receipt: " + pdfData);
  window.open(whatsappUrl, "_blank");
};

  const pdfData = doc.output("datauristring");
  const whatsappUrl = "https://wa.me/60174909836?text=" + encodeURIComponent("Please see attached PDF receipt: " + pdfData);
  window.open(whatsappUrl, "_blank");
};

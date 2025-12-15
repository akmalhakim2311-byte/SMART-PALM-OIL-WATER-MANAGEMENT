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
    marker: true,      // enable marker for toggling water
    polyline: false,
    rectangle: false,
    circle: false
  },
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

// ===== UPDATE TOTAL COST =====
function updateTotal() {
  let totalCost = 0;
  drawnItems.eachLayer(layer => {
    if (layer.waterOn) totalCost += parseFloat(layer.cost || 0);
  });
  document.getElementById("totalCost").textContent = totalCost.toFixed(2);
}

// ===== DRAW EVENT =====
map.on(L.Draw.Event.CREATED, async function (e) {
  const layer = e.layer;
  drawnItems.addLayer(layer);

  if (layer instanceof L.Marker) {
    // Marker click toggles water ON/OFF for nearest polygon
    layer.on("click", () => {
      let nearestPolygon = null;
      let minDist = Infinity;

      drawnItems.eachLayer(l => {
        if (l instanceof L.Polygon) {
          const dist = layer.getLatLng().distanceTo(l.getBounds().getCenter());
          if (dist < minDist) {
            minDist = dist;
            nearestPolygon = l;
          }
        }
      });

      if (nearestPolygon) {
        nearestPolygon.waterOn = !nearestPolygon.waterOn;
        nearestPolygon.bindPopup(`
          ${nearestPolygon.waterOn ? "💧 Water ON" : "❌ Water OFF"}
        `).openPopup();
        updateTotal();
      }
    });
  }

  if (layer instanceof L.Polygon) {
    const center = layer.getBounds().getCenter();
    const raining = await isRaining(center.lat, center.lng, datePicker.value);
    const area = L.GeometryUtil.geodesicArea(layer.getLatLngs()[0]);
    const cost = (area * COST_PER_AREA).toFixed(2);

    layer.area = area;
    layer.cost = cost;
    layer.waterOn = false; // initially OFF

    if (raining) {
      layer.setStyle({ color: "blue" });
      layer.bindPopup("🌧️ Raining today – Watering disabled");
    } else {
      layer.setStyle({ color: "green" });
      layer.bindPopup(`☀️ No rain<br>Click marker nearby to toggle water`).openPopup();
    }
  }
});

// ===== WHATSAPP RECEIPT =====
document.getElementById("sendReceipt").onclick = () => {
  const msg = `
Palm Oil Irrigation Receipt
Admin: ${user.firstname}
Date: ${datePicker.value}
Total Cost: RM ${document.getElementById("totalCost").textContent}
`;

  const url = "https://wa.me/60174909836?text=" + encodeURIComponent(msg);
  window.open(url, "_blank");
};

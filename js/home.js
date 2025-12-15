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

// ===== WEATHER CHECK (OpenWeatherMap) =====
const WEATHER_API_KEY = "YOUR_OPENWEATHERMAP_API_KEY";

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

  if (raining) {
    layer.setStyle({ color: "blue" });
    layer.bindPopup("🌧️ Raining today – Watering disabled");
  } else {
    layer.setStyle({ color: "green" });

    const area = L.GeometryUtil.geodesicArea(layer.getLatLngs()[0]);
    const cost = (area * COST_PER_AREA).toFixed(2);
    totalCost += parseFloat(cost);

    document.getElementById("totalCost").textContent = totalCost.toFixed(2);

    layer.bindPopup(`
      ☀️ No rain<br>
      Area: ${area.toFixed(2)} m²<br>
      Cost: RM ${cost}<br>
      <b>Watering ON</b>
    `);
  }
});

// ===== WHATSAPP RECEIPT =====
document.getElementById("sendReceipt").onclick = () => {
  const msg = `
Palm Oil Irrigation Receipt
Admin: ${user.firstname}
Date: ${datePicker.value}
Total Cost: RM ${totalCost.toFixed(2)}
`;

  const url = "https://wa.me/60174909836?text=" + encodeURIComponent(msg);
  window.open(url, "_blank");
};

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

// ===== MAP INIT (FELDA JENGKA) =====
const map = L.map("map").setView([3.7026, 102.5455], 14);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap"
}).addTo(map);

// ===== DRAW GROUP =====
const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

// ===== DRAW CONTROL (ONLY POLYGON & CIRCLE) =====
const drawControl = new L.Control.Draw({
  draw: {
    polygon: {
      allowIntersection: false,
      showArea: true
    },
    circle: true,
    marker: false,
    polyline: false,
    rectangle: false,
    circlemarker: false
  },
  edit: false
});
map.addControl(drawControl);

// ===== COST =====
const COST_PER_AREA = 0.05;
let totalCost = 0;
let waterLabels = [];

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

// ===== AREA =====
function polygonArea(layer) {
  return L.GeometryUtil.geodesicArea(layer.getLatLngs()[0]);
}

// ===== TOTAL =====
function updateTotal() {
  totalCost = 0;
  drawnItems.eachLayer(l => {
    if (l instanceof L.Polygon && l.waterOn) {
      totalCost += parseFloat(l.cost);
    }
  });
  document.getElementById("totalCost").textContent = totalCost.toFixed(2);
}

// ===== DRAW EVENT =====
map.on(L.Draw.Event.CREATED, async e => {
  const layer = e.layer;
  drawnItems.addLayer(layer);

  // ===== POLYGON =====
  if (layer instanceof L.Polygon) {
    layer.waterOn = false;
    const center = layer.getBounds().getCenter();
    const raining = await isRaining(center.lat, center.lng, datePicker.value);
    const area = polygonArea(layer);
    layer.cost = (area * COST_PER_AREA).toFixed(2);

    if (raining) {
      layer.setStyle({ color: "blue" });
      layer.bindPopup("🌧️ Raining – Watering not allowed");
    } else {
      layer.setStyle({ color: "green" });
      layer.bindPopup(`
        Area: ${area.toFixed(2)} m²<br>
        Cost: RM ${layer.cost}<br>
        Status: <b>Not confirmed</b><br>
        <small>Draw & click circle to activate water</small>
      `);
    }
  }

  // ===== CIRCLE (CONFIRM WATER) =====
  if (layer instanceof L.Circle) {
    layer.bindPopup("Click to confirm water usage");

    layer.on("click", () => {
      let targetPolygon = null;

      drawnItems.eachLayer(p => {
        if (p instanceof L.Polygon && p.getBounds().contains(layer.getLatLng())) {
          targetPolygon = p;
        }
      });

      if (!targetPolygon) {
        alert("Circle must be inside a polygon");
        return;
      }

      if (targetPolygon.waterOn) return;

      targetPolygon.waterOn = true;
      targetPolygon.setStyle({ color: "darkgreen" });

      const label = L.marker(targetPolygon.getBounds().getCenter(), {
        icon: L.divIcon({
          className: "water-label",
          html: "💧 Water ON",
          iconSize: [90, 20]
        }),
        interactive: false
      }).addTo(map);

      waterLabels.push(label);
      updateTotal();

      targetPolygon.bindPopup(`
        💧 Water ON<br>
        Area: ${polygonArea(targetPolygon).toFixed(2)} m²<br>
        Cost: RM ${targetPolygon.cost}
      `);

      layer.bindPopup("✅ Water activated");
    });
  }
});

// ===== DATE CHANGE =====
datePicker.addEventListener("change", () => {
  drawnItems.eachLayer(l => {
    if (l instanceof L.Polygon) {
      l.waterOn = false;
      l.setStyle({ color: "green" });
    }
  });
  waterLabels.forEach(label => map.removeLayer(label));
  waterLabels = [];
  updateTotal();
});

// ===== CLEAR ALL =====
document.getElementById("clearAll").onclick = () => {
  drawnItems.clearLayers();
  waterLabels.forEach(label => map.removeLayer(label));
  waterLabels = [];
  totalCost = 0;
  document.getElementById("totalCost").textContent = "0.00";
};

// ===== PDF + WHATSAPP =====
document.getElementById("generatePDF").onclick = () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.text("Palm Oil Irrigation Receipt", 10, 20);
  doc.text(`Admin: ${user.firstname}`, 10, 30);
  doc.text(`Date: ${datePicker.value}`, 10, 40);

  let y = 50;
  drawnItems.eachLayer(l => {
    if (l instanceof L.Polygon && l.waterOn) {
      doc.text(
        `Area: ${polygonArea(l).toFixed(2)} m² | Cost RM ${l.cost}`,
        10,
        y
      );
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

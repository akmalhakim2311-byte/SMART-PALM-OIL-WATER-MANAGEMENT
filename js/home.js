// ===== LOGIN =====
const user = JSON.parse(localStorage.getItem("currentUser"));
if (!user) location.href = "index.html";
document.getElementById("adminName").textContent = user.firstname;

// ===== LOGOUT =====
document.getElementById("logoutBtn").onclick = () => {
  localStorage.removeItem("currentUser");
  location.href = "index.html";
};

// ===== DATE =====
const datePicker = document.getElementById("datePicker");
datePicker.valueAsDate = new Date();

// ===== MAP =====
const map = L.map("map").setView([3.7026, 102.5455], 14);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

// ===== DRAW CONTROL (NO CIRCLEMARKER) =====
map.addControl(new L.Control.Draw({
  draw: {
    polygon: true,
    circle: true,
    marker: false,
    polyline: false,
    rectangle: false,
    circlemarker: false
  },
  edit: { featureGroup: drawnItems }
}));

// ===== COST =====
const COST_PER_AREA = 0.05;
let totalCost = 0;

// ===== WEATHER CHECK =====
const WEATHER_API_KEY = "adb0eb54d909230353f3589a97c08521";
async function isRaining(lat, lng, date) {
  try {
    const res = await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&appid=${WEATHER_API_KEY}`);
    const data = await res.json();
    const selectedDate = new Date(date).toDateString();
    return data.list.some(i =>
      new Date(i.dt_txt).toDateString() === selectedDate &&
      i.weather[0].main.toLowerCase().includes("rain")
    );
  } catch (e) {
    console.error("Weather API error", e);
    return false;
  }
}

// ===== AREA CALCULATION =====
function calculateArea(layer) {
  if (layer instanceof L.Polygon) {
    return L.GeometryUtil.geodesicArea(layer.getLatLngs()[0]);
  }
  return 0; // Circles do not contribute to cost
}

// ===== WATER LABEL =====
function removeWaterLabel(layer) {
  if (layer._waterLabel) {
    map.removeLayer(layer._waterLabel);
    layer._waterLabel = null;
  }
}

function showWaterLabel(circle) {
  removeWaterLabel(circle);
  circle._waterLabel = L.marker(circle.getLatLng(), {
    icon: L.divIcon({
      className: "water-label",
      html: "💧 Water ON"
    }),
    interactive: false
  }).addTo(map);
}

// ===== RAIN CHECK (SIMPLIFIED FLAG) =====
function isRaining() {
  return false; // replace with real API later
}

// ===== AREA =====
function calcArea(layer) {
  return layer instanceof L.Polygon
    ? L.GeometryUtil.geodesicArea(layer.getLatLngs()[0])
    : 0;
}

// ===== UPDATE LAYER =====
function updateLayer(layer) {
  removeWaterLabel(layer);

  if (isRaining()) {
    layer.raining = true;
    layer.waterOn = false;
    layer.setStyle?.({ color: "blue" });
    layer.bindPopup("🌧️ Raining – No watering");
  } else {
    layer.raining = false;

    if (layer instanceof L.Polygon) {
      const area = calcArea(layer);
      layer.cost = (area * COST_PER_AREA).toFixed(2);
      layer.setStyle({ color: "green" });
    }

    if (layer instanceof L.Circle && layer.waterOn) {
      layer.setStyle({ color: "darkgreen" });
      showWaterLabel(layer);
    }
  }

  updateTotal();
}

// ===== TOGGLE WATER =====
function toggleWater(layer) {
  if (!(layer instanceof L.Circle) || layer.raining) return;
  layer.waterOn = !layer.waterOn;
  updateLayer(layer);
}

// ===== DRAW CREATED =====
map.on(L.Draw.Event.CREATED, e => {
  const layer = e.layer;
  layer.waterOn = false;
  drawnItems.addLayer(layer);

  if (layer instanceof L.Circle) {
    layer.on("click", () => toggleWater(layer));
  }

  updateLayer(layer);
});

// ===== DATE CHANGE =====
datePicker.addEventListener("change", () => {
  loadDateData();
});

// ===== TOTAL =====
function updateTotal() {
  totalCost = 0;
  drawnItems.eachLayer(l => {
    if (l.cost) totalCost += parseFloat(l.cost);
  });
  document.getElementById("totalCost").textContent = totalCost.toFixed(2);
}

// ===== SAVE =====
document.getElementById("saveBtn").onclick = () => {
  const data = [];
  drawnItems.eachLayer(l => {
    data.push({
      type: l instanceof L.Circle ? "circle" : "polygon",
      latlngs: l instanceof L.Circle
        ? [l.getLatLng().lat, l.getLatLng().lng]
        : l.getLatLngs()[0].map(p => [p.lat, p.lng]),
      radius: l instanceof L.Circle ? l.getRadius() : null,
      waterOn: l.waterOn || false
    });
  });
  localStorage.setItem("palmOil_" + datePicker.value, JSON.stringify(data));
  alert("Saved");
};

// ===== LOAD =====
function loadDate() {
  drawnItems.clearLayers();
  const saved = JSON.parse(localStorage.getItem("palmOil_" + datePicker.value) || "[]");

  saved.forEach(d => {
    let l;
    if (d.type === "circle") {
      l = L.circle(d.latlngs, { radius: d.radius });
      l.waterOn = d.waterOn;
      l.on("click", () => toggleWater(l));
    } else {
      l = L.polygon(d.latlngs.map(p => ({ lat: p[0], lng: p[1] })));
    }
    drawnItems.addLayer(l);
    updateLayer(l);
  });
}

datePicker.onchange = loadDate;

// ===== CLEAR =====
document.getElementById("clearBtn").onclick = () => {
  drawnItems.clearLayers();
  updateTotal();
};

// ===== PDF & WHATSAPP =====
document.getElementById("generatePDF").onclick = () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const invoiceNo = "INV-" + Date.now();
  const date = datePicker.value;

  // ===== HEADER =====
  doc.setFontSize(18);
  doc.text("PALM OIL IRRIGATION INVOICE", 105, 20, { align: "center" });

  doc.setFontSize(10);
  doc.text("Smart Palm Oil Water Management System", 105, 26, { align: "center" });

  doc.line(10, 30, 200, 30);

  // ===== INVOICE INFO =====
  doc.setFontSize(11);
  doc.text(`Invoice No: ${invoiceNo}`, 10, 40);
  doc.text(`Date: ${date}`, 10, 46);
  doc.text(`Admin: ${user.firstname}`, 10, 52);

  // ===== TABLE HEADER =====
  let y = 65;
  doc.setFontSize(11);
  doc.text("No", 10, y);
  doc.text("Zone / Area", 25, y);
  doc.text("Weather", 95, y);
  doc.text("Water Usage", 130, y);
  doc.text("Cost (RM)", 170, y);

  doc.line(10, y + 2, 200, y + 2);

  // ===== TABLE CONTENT =====
  let index = 1;
  y += 10;

  drawnItems.eachLayer(layer => {
    if (layer instanceof L.Polygon) {
      const weather = layer.raining ? "Raining" : "Clear";
      const water = layer.raining ? "Disabled" : "Active";
      const cost = layer.raining ? "0.00" : layer.cost;

      doc.text(String(index++), 10, y);
      doc.text(`Polygon Area`, 25, y);
      doc.text(weather, 95, y);
      doc.text(water, 130, y);
      doc.text(cost, 170, y);

      y += 8;
    }

    if (layer instanceof L.Circle) {
      const weather = layer.raining ? "Raining" : "Clear";
      const water = layer.waterOn ? "Water ON" : "No Water";
      const cost = layer.raining ? "0.00" : "0.00";

      doc.text(String(index++), 10, y);
      doc.text("Water Point", 25, y);
      doc.text(weather, 95, y);
      doc.text(water, 130, y);
      doc.text(cost, 170, y);

      y += 8;
    }
  });

  // ===== TOTAL =====
  doc.line(120, y + 5, 200, y + 5);
  doc.setFontSize(12);
  doc.text("TOTAL", 130, y + 12);
  doc.text(`RM ${totalCost.toFixed(2)}`, 170, y + 12);

  // ===== FOOTER =====
  doc.setFontSize(9);
  doc.text(
    "This invoice is system generated. Rainy days incur zero irrigation cost.",
    105,
    285,
    { align: "center" }
  );

  const filename = `Invoice_${date}.pdf`;
  doc.save(filename);

  // ===== WHATSAPP MESSAGE =====
  const msg = `
Palm Oil Irrigation Invoice
Invoice: ${invoiceNo}
Date: ${date}
Total: RM ${totalCost.toFixed(2)}
`;

  window.open(
    `https://wa.me/60174909836?text=${encodeURIComponent(msg)}`,
    "_blank"
  );
};

// ===== INIT =====
loadDate();

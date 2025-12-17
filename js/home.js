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

// ===== MAP INITIALIZATION =====
const map = L.map("map").setView([3.7026, 102.5455], 14);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "© OpenStreetMap"
}).addTo(map);

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
});
map.addControl(drawControl););

// ===== COST SETTINGS =====
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

// ===== UPDATE LAYER =====
async function updateLayer(layer) {
  const center = layer.getBounds ? layer.getBounds().getCenter() : layer.getLatLng();
  const raining = await isRaining(center.lat, center.lng, datePicker.value);
  layer.raining = raining;

  if (raining) {
    layer.setStyle?.({ color: "blue" });
    layer.waterOn = false;
    layer.bindPopup("🌧️ Raining – Watering disabled");
    if (layer._waterLabel) map.removeLayer(layer._waterLabel);
  } else {
    if (layer instanceof L.Polygon) {
      layer.setStyle?.({ color: "green" });
      const area = calculateArea(layer).toFixed(2);
      const cost = (area * COST_PER_AREA).toFixed(2);
      layer.area = area;
      layer.cost = cost;
      layer.bindPopup(`☀️ No rain<br>Area: ${area} m²<br>Cost: RM ${cost}`);
    } else if (layer instanceof L.Circle) {
      layer.setStyle?.({ color: layer.waterOn ? "darkgreen" : "green" });
      if (layer.waterOn) showWaterLabel(layer);
      else if (layer._waterLabel) { map.removeLayer(layer._waterLabel); layer._waterLabel = null; }
    }
  }
  updateTotal();
}

// ===== WATER LABEL =====
function showWaterLabel(circle) {
  if (circle._waterLabel) map.removeLayer(circle._waterLabel);
  const icon = L.divIcon({
    className: "water-label",
    html: "💧 Water ON",
    iconSize: [80, 24],
    iconAnchor: [40, -10]
  });
  circle._waterLabel = L.marker(circle.getLatLng(), { icon, interactive: false }).addTo(map);
}

// ===== TOGGLE WATER (Circle Only) =====
function toggleWater(layer) {
  if (!(layer instanceof L.Circle) || layer.raining) return;
  layer.waterOn = !layer.waterOn;
  updateLayer(layer);
}

// ===== DRAW CREATED =====
map.on(L.Draw.Event.CREATED, async e => {
  const layer = e.layer;
  layer.waterOn = false;
  drawnItems.addLayer(layer);

  if (layer instanceof L.Circle) layer.on("click", () => toggleWater(layer));
  if (layer instanceof L.Polygon) layer.on("click", () => updateTotal(false));

  await updateLayer(layer);
});

// ===== DATE CHANGE =====
datePicker.addEventListener("change", () => {
  loadDateData();
});

// ===== TOTAL COST =====
function updateTotal(show = true) {
  totalCost = 0;
  drawnItems.eachLayer(layer => {
    if (layer instanceof L.Polygon && layer.cost) totalCost += parseFloat(layer.cost);
  });
  document.getElementById("totalCost").textContent = totalCost.toFixed(2);
  document.getElementById("totalWrapper").style.display = show ? "block" : "none";
}

// ===== SAVE CURRENT DATE DATA =====
document.getElementById("saveBtn").onclick = () => {
  const dateKey = datePicker.value;
  const data = [];

  drawnItems.eachLayer(layer => {
    data.push({
      type: layer instanceof L.Circle ? "circle" : "polygon",
      latlngs: layer instanceof L.Circle ? [layer.getLatLng().lat, layer.getLatLng().lng] : layer.getLatLngs()[0].map(p => [p.lat, p.lng]),
      radius: layer instanceof L.Circle ? layer.getRadius() : null,
      waterOn: layer.waterOn
    });
  });

  localStorage.setItem("palmOilData_" + dateKey, JSON.stringify(data));
  alert("Data saved for " + dateKey);
};

// ===== LOAD DATA =====
function loadDateData() {
  // Remove old layers and water labels
  drawnItems.eachLayer(layer => {
    if (layer._waterLabel) map.removeLayer(layer._waterLabel);
  });
  drawnItems.clearLayers();

  const dateKey = datePicker.value;
  const savedData = JSON.parse(localStorage.getItem("palmOilData_" + dateKey) || "[]");

  savedData.forEach(async d => {
    let layer;
    if (d.type === "circle") {
      layer = L.circle([d.latlngs[0], d.latlngs[1]], { radius: d.radius });
    } else if (d.type === "polygon") {
      layer = L.polygon(d.latlngs.map(p => ({ lat: p[0], lng: p[1] })));
    }
    layer.waterOn = d.waterOn;
    drawnItems.addLayer(layer);

    if (layer instanceof L.Circle) layer.on("click", () => toggleWater(layer));
    if (layer instanceof L.Polygon) layer.on("click", () => updateTotal(false));

    await updateLayer(layer);
  });
}

// ===== CLEAR ALL =====
document.getElementById("clearBtn").onclick = () => {
  drawnItems.eachLayer(layer => { if (layer._waterLabel) map.removeLayer(layer._waterLabel); });
  drawnItems.clearLayers();
  updateTotal(false);
};

// ===== GENERATE PDF & WHATSAPP =====
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

// ===== INITIAL LOAD =====
loadDateData();

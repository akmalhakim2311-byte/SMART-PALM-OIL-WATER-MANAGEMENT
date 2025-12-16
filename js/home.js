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

// ===== MAP =====
const map = L.map("map").setView([3.7026, 102.5455], 14);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

// ===== DRAW =====
const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

map.addControl(new L.Control.Draw({
  draw: {
    polygon: true,
    circle: true,
    marker: false,
    polyline: false,
    rectangle: false
  },
  edit: { featureGroup: drawnItems }
}));

// ===== COST =====
const COST_PER_AREA = 0.05;
let totalCost = 0;
let waterConfirmed = false;

// ===== AREA =====
function calcArea(layer) {
  return layer instanceof L.Polygon
    ? L.GeometryUtil.geodesicArea(layer.getLatLngs()[0])
    : 0;
}

// ===== UPDATE TOTAL =====
function updateTotal(show = false) {
  totalCost = 0;

  drawnItems.eachLayer(l => {
    if (l instanceof L.Polygon && l.cost) {
      totalCost += parseFloat(l.cost);
    }
  });

  document.getElementById("totalCost").textContent =
    show ? totalCost.toFixed(2) : "0.00";
}

// ===== WATER LABEL =====
function showWaterLabel(circle) {
  if (circle._waterLabel) map.removeLayer(circle._waterLabel);

  const icon = L.divIcon({
    className: "water-label",
    html: "💧 Water ON",
    iconSize: [70, 20],
    iconAnchor: [35, -10]
  });

  circle._waterLabel = L.marker(circle.getLatLng(), {
    icon,
    interactive: false
  }).addTo(map);
}

// ===== DRAW CREATED =====
map.on(L.Draw.Event.CREATED, e => {
  const layer = e.layer;
  drawnItems.addLayer(layer);

  if (layer instanceof L.Polygon) {
    const area = calcArea(layer);
    layer.cost = (area * COST_PER_AREA).toFixed(2);

    // Toggle cost preview on click
    layer.on("click", () => {
      if (!waterConfirmed) {
        const visible = document.getElementById("totalCost").textContent === "0.00";
        updateTotal(visible);
      }
    });
  }

  if (layer instanceof L.Circle) {
    waterConfirmed = true;
    showWaterLabel(layer);
    updateTotal(true);
  }
});

// ===== CLEAR ALL =====
document.getElementById("clearBtn").onclick = () => {
  drawnItems.clearLayers();
  totalCost = 0;
  waterConfirmed = false;
  document.getElementById("totalCost").textContent = "0.00";
};

// ===== SAVE =====
document.getElementById("saveBtn").onclick = () => {
  const dateKey = datePicker.value;
  const data = [];

  drawnItems.eachLayer(l => {
    data.push({
      type: l instanceof L.Circle ? "circle" : "polygon",
      latlngs: l instanceof L.Circle
        ? [l.getLatLng().lat, l.getLatLng().lng]
        : l.getLatLngs()[0].map(p => [p.lat, p.lng]),
      radius: l instanceof L.Circle ? l.getRadius() : null
    });
  });

  localStorage.setItem("palmOilData_" + dateKey, JSON.stringify(data));
  alert("Saved for " + dateKey);
};

// ===== LOAD DATE =====
function loadDateData() {
  drawnItems.clearLayers();
  waterConfirmed = false;
  updateTotal(false);

  const saved = JSON.parse(
    localStorage.getItem("palmOilData_" + datePicker.value) || "[]"
  );

  saved.forEach(d => {
    let layer;

    if (d.type === "circle") {
      layer = L.circle(d.latlngs, { radius: d.radius });
      waterConfirmed = true;
      showWaterLabel(layer);
    } else {
      layer = L.polygon(d.latlngs.map(p => ({ lat: p[0], lng: p[1] })));
      layer.cost = (calcArea(layer) * COST_PER_AREA).toFixed(2);

      layer.on("click", () => {
        if (!waterConfirmed) {
          const visible =
            document.getElementById("totalCost").textContent === "0.00";
          updateTotal(visible);
        }
      });
    }

    drawnItems.addLayer(layer);
  });

  if (waterConfirmed) updateTotal(true);
}

datePicker.addEventListener("change", loadDateData);

// ===== PDF + WHATSAPP =====
document.getElementById("generatePDF").onclick = () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.text("Palm Oil Irrigation Receipt", 10, 20);
  doc.text(`Admin: ${user.firstname}`, 10, 30);
  doc.text(`Date: ${datePicker.value}`, 10, 40);
  doc.text(`Total Cost: RM ${totalCost.toFixed(2)}`, 10, 60);

  doc.save("PalmOil_Receipt.pdf");

  const msg = `Palm Oil Irrigation\nDate: ${datePicker.value}\nTotal: RM ${totalCost.toFixed(2)}`;
  window.open(`https://wa.me/60174909836?text=${encodeURIComponent(msg)}`);
};

// ===== INIT =====
loadDateData();

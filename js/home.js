document.addEventListener("DOMContentLoaded", function() {

  // ===== Admin greeting =====
  let user = JSON.parse(localStorage.getItem("currentUser"));

  // For testing: if no user, create a dummy user
  if (!user) {
    user = { firstname: "Admin" };
    localStorage.setItem("currentUser", JSON.stringify(user));
  }

  document.getElementById("adminName").textContent = user.firstname;

  // ===== Logout =====
  document.getElementById("logoutBtn").onclick = () => {
    localStorage.removeItem("currentUser");
    window.location.href = "login.html";
  };

  // ===== Map setup =====
  const map = L.map("map").setView([3.8127, 102.3140], 15); // FELDA Jengka
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap"
  }).addTo(map);

  // ===== Polygon layer =====
  const drawnItems = new L.FeatureGroup();
  map.addLayer(drawnItems);

  const drawControl = new L.Control.Draw({
    draw: { polygon: true, marker: false, polyline: false, rectangle: false, circle: false },
    edit: { featureGroup: drawnItems }
  });
  map.addControl(drawControl);

  const COST_PER_AREA = 0.05;
  let totalCost = 0;

  function updateTotal() {
    totalCost = 0;
    drawnItems.eachLayer(layer => {
      if(layer.waterOn && layer.cost) totalCost += parseFloat(layer.cost);
    });
    document.getElementById("totalCost").textContent = totalCost.toFixed(2);
  }

  function calculateArea(layer) {
    return L.GeometryUtil.geodesicArea(layer.getLatLngs()[0]);
  }

  function updatePolygon(layer) {
    layer.waterOn = layer.waterOn || false;
    const area = calculateArea(layer);
    const cost = (area * COST_PER_AREA).toFixed(2);
    layer.area = area;
    layer.cost = cost;
    layer.setStyle({ color: "green", fillColor: "green", fillOpacity: 0.4 });
    layer.bindPopup(`Area: ${area.toFixed(2)} m²<br>Cost: RM ${cost}<br>Watering ${layer.waterOn ? "ON":"OFF"} (Click polygon)`);
    updateTotal();
  }

  function toggleWater(layer) {
    layer.waterOn = !layer.waterOn;
    updatePolygon(layer);
  }

  map.on(L.Draw.Event.CREATED, function(e) {
    const layer = e.layer;
    layer.waterOn = false;
    drawnItems.addLayer(layer);
    updatePolygon(layer);
    layer.on("click", () => toggleWater(layer));
  });

  const datePicker = document.getElementById("datePicker");
  datePicker.valueAsDate = new Date();
  datePicker.addEventListener("change", () => {
    drawnItems.eachLayer(layer => updatePolygon(layer));
  });

  const viewModeSelect = document.getElementById("viewMode");
  let viewMode = viewModeSelect.value;
  viewModeSelect.addEventListener("change", () => {
    viewMode = viewModeSelect.value;
    drawnItems.eachLayer(layer => updatePolygon(layer));
  });

});

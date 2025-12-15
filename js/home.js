// ===== LOGIN CHECK =====
const user = JSON.parse(localStorage.getItem("currentUser"));
if (!user) window.location.href = "login.html";
document.getElementById("adminName").textContent = user.firstname;

// ===== LOGOUT =====
document.getElementById("logoutBtn").onclick = () => {
  localStorage.removeItem("currentUser");
  window.location.href = "login.html";
};

// ===== DATE PICKER =====
const datePicker = document.getElementById("datePicker");
datePicker.valueAsDate = new Date();

// ===== VIEW MODE =====
const viewModeSelect = document.getElementById("viewMode");
let viewMode = viewModeSelect.value;
viewModeSelect.addEventListener("change", () => {
  viewMode = viewModeSelect.value;
  drawnItems.eachLayer(layer => updatePolygon(layer));
  updateLegend();
});

// ===== MAP INITIALIZATION =====
const map = L.map("map").setView([3.8133, // FELDA Jengka, Pahang
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
const COST_PER_AREA = 0.05;
let totalCost = 0;

// ===== WEATHER API =====
const WEATHER_API_KEY = "adb0eb54d909230353f3589a97c08521";

async function getRainProbability(lat, lng, date) {
  const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&appid=${WEATHER_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  const selectedDate = new Date(date).toDateString();
  let rainHours = 0, totalHours = 0;
  data.list.forEach(item => {
    if (new Date(item.dt_txt).toDateString() === selectedDate) {
      totalHours++;
      if (item.pop) rainHours += item.pop;
    }
  });
  return totalHours ? (rainHours/totalHours)*100 : 0;
}

// ===== AREA CALCULATION =====
function calculateArea(layer) {
  return L.GeometryUtil.geodesicArea(layer.getLatLngs()[0]);
}

// ===== UPDATE POLYGON =====
async function updatePolygon(layer) {
  const center = layer.getBounds().getCenter();
  const rainProb = await getRainProbability(center.lat, center.lng, datePicker.value);
  layer.rainProb = rainProb;

  // Determine color based on viewMode
  let color = "green";
  if(viewMode === "rain") {
    const green = [0,200,0], blue = [0,0,200];
    const r = Math.round(green[0]+(blue[0]-green[0])*(rainProb/100));
    const g = Math.round(green[1]+(blue[1]-green[1])*(rainProb/100));
    const b = Math.round(green[2]+(blue[2]-green[2])*(rainProb/100));
    color = `rgb(${r},${g},${b})`;
  } else if(viewMode === "water") {
    if(layer.waterOn) color="darkgreen";
    else if(rainProb>=50) color="blue";
    else color="lightgray";
  }

  layer.setStyle({ color: color, fillColor: color, fillOpacity:0.4 });

  const area = calculateArea(layer);
  const cost = (area*COST_PER_AREA).toFixed(2);
  layer.area = area; layer.cost = cost;
  if(layer.waterOn && rainProb>=50) layer.waterOn=false;

  layer.bindPopup(`🌦 Rain: ${rainProb.toFixed(0)}%<br>Area: ${area.toFixed(2)} m²<br>Cost: RM ${cost}<br>Watering ${layer.waterOn ? "ON":"OFF"} (Click polygon)`);

  updateTotal();
}

// ===== TOGGLE WATER =====
function toggleWater(layer) {
  if(layer.rainProb>=50) return alert("🌧 Too rainy today. Watering disabled.");
  layer.waterOn=!layer.waterOn;
  updatePolygon(layer);
}

// ===== DRAW EVENTS =====
map.on(L.Draw.Event.CREATED, async e => {
  const layer = e.layer;
  layer.waterOn=false;
  drawnItems.addLayer(layer);
  await updatePolygon(layer);
  layer.on("click",()=>toggleWater(layer));
});

datePicker.addEventListener("change", () => {
  drawnItems.eachLayer(layer => updatePolygon(layer));
});

// ===== TOTAL COST =====
function updateTotal() {
  totalCost=0;
  drawnItems.eachLayer(layer=>{
    if(layer.waterOn && layer.cost) totalCost+=parseFloat(layer.cost);
  });
  document.getElementById("totalCost").textContent = totalCost.toFixed(2);
}

// ===== PDF + WHATSAPP =====
document.getElementById("generatePDF").onclick = ()=>{
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(16); doc.text("Palm Oil Irrigation Receipt",10,20);
  doc.setFontSize(12); doc.text(`Admin: ${user.firstname}`,10,30);
  doc.text(`Date: ${datePicker.value}`,10,40);
  let y=50;
  drawnItems.eachLayer(layer=>{
    if(layer.waterOn) {
      doc.text(`Polygon: Area ${layer.area.toFixed(2)} m² | Cost RM ${layer.cost} | Rain ${layer.rainProb.toFixed(0)}%`,10,y);
      y+=10;
    }
  });
  doc.text(`Total Cost: RM ${totalCost.toFixed(2)}`,10,y+10);
  doc.save("receipt.pdf");
  const msg = encodeURIComponent(`Palm Oil Irrigation Receipt\nAdmin: ${user.firstname}\nDate: ${datePicker.value}\nTotal Cost: RM ${totalCost.toFixed(2)}`);
  window.open(`https://wa.me/60174909836?text=${msg}`,"_blank");
};

// ===== LEGEND =====
const legend = L.control({position:"bottomright"});
legend.onAdd = map=>L.DomUtil.create("div","info legend");
legend.addTo(map);

function updateLegend(){
  const div = legend.getContainer();
  if(viewMode==="rain"){
    div.innerHTML = `<h4>Rain Probability (%)</h4><div class="gradient-bar"></div>
                     <div class="legend-labels"><span>0%</span><span>50%</span><span>100%</span></div>`;
  } else if(viewMode==="water"){
    div.innerHTML = `<h4>Watering Status</h4><div class="gradient-bar-water"></div>
                     <div class="legend-labels"><span>OFF</span><span>ON</span><span>Blocked</span></div>`;
  }
}
updateLegend();

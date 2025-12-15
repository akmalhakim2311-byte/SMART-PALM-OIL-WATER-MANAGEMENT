// -------------------------
// User session
// -------------------------
const user = JSON.parse(localStorage.getItem("loggedInUser"));
if(!user) window.location.href="index.html";
else document.getElementById("welcome").textContent = `Welcome, ${user.firstname} ${user.lastname}`;

// -------------------------
// Variables
// -------------------------
const apiKey = "adb0eb54d909230353f3589a97c08521"; // Replace with your key
const costPerLiter = 0.005;
let weatherDataMap = {}; // polygonName -> weather array (7 days)
let waterPlan = {}; // polygonName -> { YYYY-MM-DD: volume }

const forecastEl = document.getElementById("forecast");
const calendarEl = document.getElementById("calendar");
const waterCostEl = document.getElementById("water-cost");
const datePicker = document.getElementById("datePicker");

// -------------------------
// Map setup centered on plantation
// -------------------------
const defaultLat = 3.5835;
const defaultLon = 101.6140;
const map = L.map('map').setView([defaultLat, defaultLon], 16);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution:'&copy; OpenStreetMap contributors'
}).addTo(map);

const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

// -------------------------
// Define plantation bounds
// -------------------------
const bounds = L.latLngBounds(
    L.latLng(3.5800, 101.6100), // SW corner
    L.latLng(3.5870, 101.6180)  // NE corner
);
L.rectangle(bounds, {color: "#ff7800", weight: 1, dashArray:'4', fill:false}).addTo(map);
map.setMaxBounds(bounds);

// -------------------------
// Leaflet Draw Control
// -------------------------
const drawControl = new L.Control.Draw({
    edit: { featureGroup: drawnItems },
    draw: { polygon:true, polyline:false, rectangle:false, circle:false, marker:false, circlemarker:false }
});
map.addControl(drawControl);

// -------------------------
// Polygon events
// -------------------------
map.on(L.Draw.Event.CREATED, function(event){
    const layer = event.layer;
    const layerBounds = layer.getBounds();

    if(!bounds.contains(layerBounds)){
        alert("Please draw polygon within the designated plantation area!");
        return;
    }

    drawnItems.addLayer(layer);
    const areaName = `Plantation Area ${drawnItems.getLayers().indexOf(layer)+1}`;
    layer.options.name = areaName;
    updatePolygonWeather(layer);
    bindPolygonClick(layer);
    savePolygons();
});

map.on(L.Draw.Event.EDITED, ()=>{
    drawnItems.eachLayer(updatePolygonWeather);
    savePolygons();
});
map.on(L.Draw.Event.DELETED, savePolygons);

// -------------------------
// Polygon weather (per polygon, auto fetch)
// -------------------------
async function updatePolygonWeather(layer){
    const coords = layer.getBounds().getCenter();
    try{
        const res = await fetch(`https://api.openweathermap.org/data/2.5/onecall?lat=${coords.lat}&lon=${coords.lng}&exclude=minutely,hourly,alerts&units=metric&appid=${apiKey}`);
        const data = await res.json();
        const startDate = new Date(datePicker.value);

        weatherDataMap[layer.options.name] = [];

        for(let i=0;i<7;i++){
            const dt = new Date(startDate);
            dt.setDate(startDate.getDate()+i);

            let nearest = data.daily.reduce((prev,curr)=>{
                return Math.abs(new Date(curr.dt*1000)-dt) < Math.abs(new Date(prev.dt*1000)-dt) ? curr : prev;
            });

            weatherDataMap[layer.options.name].push(nearest.weather[0].main);
        }

        const todayWeather = weatherDataMap[layer.options.name][0];
        if(todayWeather.toLowerCase().includes("rain")) layer.setStyle({color:'blue'});
        else layer.setStyle({color:'green'});

        layer.bindPopup(`${layer.options.name}<br>Today: ${todayWeather}`);
        buildCalendar();
    } catch(err){
        console.error("Weather fetch failed", err);
    }
}

// -------------------------
// Load polygons from localStorage
// -------------------------
function loadPolygons(){
    const data = JSON.parse(localStorage.getItem("plantationPolygons")||"[]");
    data.forEach(async (coords, index)=>{
        const poly = L.polygon(coords,{color:'green'}).addTo(drawnItems);
        const areaName = `Plantation Area ${index+1}`;
        poly.options.name = areaName;
        await updatePolygonWeather(poly);
        bindPolygonClick(poly, areaName);
    });
}
loadPolygons();

// -------------------------
// Bind polygon click
// -------------------------
function bindPolygonClick(layer, defaultName=null){
    const areaName = defaultName || layer.options.name;
    layer.options.name = areaName;

    layer.on('click', ()=>{
        const todayWeather = weatherDataMap[areaName] ? weatherDataMap[areaName][0] : "Unknown";
        if(todayWeather.toLowerCase().includes("rain")){
            alert(`${areaName} will rain today. No watering needed.`);
            return;
        }
        planWater(areaName);
    });
}

// -------------------------
// Plan water per polygon
// -------------------------
function planWater(areaName){
    const startDate = new Date(datePicker.value);
    if(!waterPlan[areaName]) waterPlan[areaName]={};

    for(let i=0;i<7;i++){
        const dt = new Date(startDate);
        dt.setDate(startDate.getDate()+i);
        const dayKey = dt.toISOString().split('T')[0];
        const forecast = weatherDataMap[areaName][i];
        if(forecast.toLowerCase().includes("rain")){ waterPlan[areaName][dayKey]=0; continue; }

        const input = prompt(`Enter water volume in liters for ${areaName} on ${dayKey}:`, waterPlan[areaName][dayKey]||500);
        waterPlan[areaName][dayKey] = parseFloat(input)||0;
    }

    buildCalendar();
    updateCost();
    alert(`7-day water plan saved for ${areaName} starting ${datePicker.value}`);
}

// -------------------------
// Build calendar
// -------------------------
function buildCalendar(){
    calendarEl.innerHTML="";
    const header = document.createElement("tr");
    header.innerHTML="<th>Plantation Area</th>";

    const startDate = new Date(datePicker.value);
    for(let i=0;i<7;i++){
        const dt = new Date(startDate);
        dt.setDate(startDate.getDate()+i);
        const dayName = dt.toLocaleDateString('en-US',{weekday:'short', day:'numeric'});
        header.innerHTML += `<th>${dayName}</th>`;
    }
    calendarEl.appendChild(header);

    drawnItems.eachLayer(layer=>{
        const areaName = layer.options.name;
        const row = document.createElement("tr");
        row.innerHTML = `<td>${areaName}</td>`;
        for(let i=0;i<7;i++){
            const dt = new Date(startDate);
            dt.setDate(startDate.getDate()+i);
            const dayKey = dt.toISOString().split('T')[0];
            const vol = waterPlan[areaName] ? waterPlan[areaName][dayKey]||0 : 0;
            const disabled = (weatherDataMap[areaName][i].toLowerCase().includes("rain")) ? "disabled" : "";
            const cell = document.createElement("td");
            cell.innerHTML = `<input type="number" min="0" class="day-volume" data-area="${areaName}" data-day="${dayKey}" value="${vol}" ${disabled}>`;
            row.appendChild(cell);
        }
        calendarEl.appendChild(row);
    });

    document.querySelectorAll("input.day-volume").forEach(input=>{
        input.addEventListener("input", e=>{
            const area = e.target.dataset.area;
            const dayKey = e.target.dataset.day;
            if(!waterPlan[area]) waterPlan[area]={};
            waterPlan[area][dayKey] = parseFloat(e.target.value)||0;
            updateCost();
        });
    });

    updateCost();
}

// -------------------------
// Update total cost
// -------------------------
function updateCost(){
    let totalWater = 0;
    for(const area in waterPlan){
        for(const day in waterPlan[area]){
            totalWater += waterPlan[area][day];
        }
    }
    waterCostEl.textContent = `Total Cost: RM${(totalWater*costPerLiter).toFixed(2)}`;
}

// -------------------------
// WhatsApp & PDF report
// -------------------------
document.getElementById("whatsappBtn").addEventListener("click", ()=>{
    let totalWater = 0;
    let report = `Hello Admin,%0AUser: ${user.firstname} ${user.lastname}%0A`;

    for(const area in waterPlan){
        report += `${area}:\n`;
        for(const day in waterPlan[area]){
            const water = waterPlan[area][day];
            if(water>0) report += `Day ${day}: ${water} L%0A`;
            totalWater += water;
        }
    }

    const totalCost = totalWater*costPerLiter;
    report += `Total Cost: RM${totalCost.toFixed(2)}`;
    const phone = "60174909836"; // Replace with admin WhatsApp
    window.open(`https://wa.me/${phone}?text=${report}`,"_blank");

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("Palm Oil Water Supply 7-Day Plan",10,10);
    doc.text(`User: ${user.firstname} ${user.lastname}`,10,20);
    let y=30;
    for(const area in waterPlan){
        doc.text(area,10,y); y+=10;
        for(const day in waterPlan[area]){
            if(waterPlan[area][day]>0) doc.text(`${day}: ${waterPlan[area][day]} L`,10,y), y+=10;
        }
    }
    doc.text(`Total Cost: RM${totalCost.toFixed(2)}`,10,y+10);
    doc.save("WaterSupply7DayPlan.pdf");
});

// -------------------------
// Logout
// -------------------------
document.getElementById("logoutBtn").addEventListener("click", ()=>{
    localStorage.removeItem("loggedInUser");
    window.location.href="index.html";
});

// -------------------------
// Save polygons
// -------------------------
function savePolygons(){
    const data = [];
    drawnItems.eachLayer(l=>data.push(l.getLatLngs()[0].map(p=>[p.lat,p.lng])));
    localStorage.setItem("plantationPolygons", JSON.stringify(data));
}

// -------------------------
// Map Legend
// -------------------------
const legend = L.control({position:'bottomright'});
legend.onAdd = function(){
    const div = L.DomUtil.create('div','info legend');
    div.innerHTML = `<i style="background:green;width:18px;height:18px;display:inline-block;"></i> No Rain Today<br>
                     <i style="background:blue;width:18px;height:18px;display:inline-block;"></i> Rain Today`;
    return div;
};
legend.addTo(map);

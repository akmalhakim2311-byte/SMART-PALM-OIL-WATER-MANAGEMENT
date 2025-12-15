// -------------------------
// User session
// -------------------------
const user = JSON.parse(localStorage.getItem("loggedInUser"));
if(!user) window.location.href="index.html";
else document.getElementById("welcome").textContent = `Welcome, ${user.firstname} ${user.lastname}`;

// -------------------------
// Variables
// -------------------------
const apiKey = "YOUR_OPENWEATHERMAP_API_KEY"; // Replace with your API key
const lat = 3.5609;
const lon = 101.6585;
const costPerLiter = 0.005;

let weatherData = null;
let waterPlan = {}; // {areaName:{day0:volume, day1:volume,...}}

// DOM
const forecastEl = document.getElementById("forecast");
const calendarEl = document.getElementById("calendar");
const waterCostEl = document.getElementById("water-cost");

// -------------------------
// Initialize map
// -------------------------
const map = L.map('map').setView([lat, lon], 14);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution:'&copy; OpenStreetMap contributors'
}).addTo(map);

const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

// Leaflet Draw Control
const drawControl = new L.Control.Draw({
    edit: { featureGroup: drawnItems },
    draw: { polygon:true, polyline:false, rectangle:false, circle:false, marker:false, circlemarker:false }
});
map.addControl(drawControl);

// -------------------------
// Polygon Events
// -------------------------
map.on(L.Draw.Event.CREATED, function(event){
    const layer = event.layer;
    drawnItems.addLayer(layer);
    updatePolygonStyle(layer);
    bindPolygonClick(layer);
    savePolygons();
});
map.on(L.Draw.Event.EDITED, savePolygons);
map.on(L.Draw.Event.DELETED, savePolygons);

// -------------------------
// Load saved polygons
// -------------------------
function loadPolygons(){
    const data = JSON.parse(localStorage.getItem("plantationPolygons")||"[]");
    data.forEach((coords, index)=>{
        const poly = L.polygon(coords, {color:'green'}).addTo(drawnItems);
        updatePolygonStyle(poly);
        bindPolygonClick(poly, `Plantation Area ${index+1}`);
    });
}

// -------------------------
// Update polygon style based on today's weather
// -------------------------
function updatePolygonStyle(layer){
    if(!weatherData) return;
    const todayWeather = weatherData.daily[0].weather[0].main;
    if(todayWeather === "Rain"){
        layer.setStyle({color:'blue'});
        layer.bindPopup(`${getPolygonName(layer)} (Rain Today)`);
    } else {
        layer.setStyle({color:'green'});
        layer.bindPopup(`${getPolygonName(layer)} (No Rain Today)`);
    }
}

// Helper to get polygon name
function getPolygonName(layer){
    return layer.options.name || `Plantation Area ${drawnItems.getLayers().indexOf(layer)+1}`;
}

// -------------------------
// Polygon click → Water Planning
// -------------------------
function bindPolygonClick(layer, defaultName=null){
    const areaName = defaultName || getPolygonName(layer);
    layer.options.name = areaName;
    layer.on('click', ()=>{
        const todayWeather = weatherData.daily[0].weather[0].main;
        if(todayWeather === "Rain"){
            alert(`${areaName} will rain today. No watering needed.`);
            return;
        }
        planWater(areaName);
    });
}

// -------------------------
// Save polygons to LocalStorage
// -------------------------
function savePolygons(){
    const data = [];
    drawnItems.eachLayer(l => data.push(l.getLatLngs()[0].map(p=>[p.lat,p.lng])));
    localStorage.setItem("plantationPolygons", JSON.stringify(data));
}

// Initial load
loadPolygons();

// -------------------------
// Fetch 7-day forecast
// -------------------------
fetch(`https://api.openweathermap.org/data/2.5/onecall?lat=${lat}&lon=${lon}&exclude=minutely,hourly,alerts&units=metric&appid=${apiKey}`)
.then(res=>res.json())
.then(data=>{
    weatherData = data;
    displayForecast(data.daily);
    buildCalendar(); // build calendar after forecast
});

// Display forecast
function displayForecast(daily){
    forecastEl.innerHTML="";
    daily.slice(0,7).forEach((day,i)=>{
        const dt = new Date(day.dt*1000);
        const dayName = dt.toLocaleDateString('en-US',{weekday:'short'});
        const weather = day.weather[0].main;
        const div = document.createElement("div");
        div.innerHTML=`<strong>${dayName}</strong><br>${weather}`;
        forecastEl.appendChild(div);
    });
}

// -------------------------
// Plan water supply for 7 days
// -------------------------
function planWater(areaName){
    if(!weatherData) { alert("Weather not loaded yet."); return; }

    if(!waterPlan[areaName]) waterPlan[areaName]={};

    for(let i=0; i<7; i++){
        const dayWeather = weatherData.daily[i].weather[0].main;
        let waterVolume = 0;
        if(dayWeather !== "Rain"){
            let input = prompt(`Day ${i+1} (${dayWeather}): Enter water volume in liters for ${areaName}:`, waterPlan[areaName][`day${i}`] || "500");
            waterVolume = parseFloat(input) || 0;
        }
        waterPlan[areaName][`day${i}`] = waterVolume;
    }

    buildCalendar(); // refresh calendar
    updateCost();
    alert(`7-day water plan saved for ${areaName}`);
}

// -------------------------
// Build interactive calendar
// -------------------------
function buildCalendar(){
    calendarEl.innerHTML="";
    const header = document.createElement("tr");
    header.innerHTML="<th>Plantation Area</th>";
    for(let i=0;i<7;i++){
        const dt = new Date(weatherData.daily[i].dt*1000);
        const dayName = dt.toLocaleDateString('en-US',{weekday:'short'});
        header.innerHTML += `<th>${dayName}</th>`;
    }
    calendarEl.appendChild(header);

    drawnItems.eachLayer((layer, idx)=>{
        const areaName = getPolygonName(layer);
        if(!waterPlan[areaName]) waterPlan[areaName]={};

        const row = document.createElement("tr");
        row.innerHTML = `<td>${areaName}</td>`;
        for(let d=0; d<7; d++){
            const dayWeather = weatherData.daily[d].weather[0].main;
            const vol = waterPlan[areaName][`day${d}`] || 0;
            const disabled = (dayWeather==="Rain") ? "disabled" : "";
            const cell = document.createElement("td");
            cell.innerHTML = `<input type="number" min="0" class="day-volume" data-area="${areaName}" data-day="${d}" value="${vol}" ${disabled}>`;
            row.appendChild(cell);
        }
        calendarEl.appendChild(row);
    });

    // Listen to input changes
    document.querySelectorAll("input.day-volume").forEach(input=>{
        input.addEventListener("input", e=>{
            const area = e.target.dataset.area;
            const day = e.target.dataset.day;
            if(!waterPlan[area]) waterPlan[area]={};
            waterPlan[area][day] = parseFloat(e.target.value)||0;
            updateCost();
        });
    });

    updateCost();
}

// -------------------------
// Update total water cost
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
// WhatsApp & PDF
// -------------------------
document.getElementById("whatsappBtn").addEventListener("click", ()=>{
    let totalWater = 0;
    let report = `Hello Admin,%0AUser: ${user.firstname} ${user.lastname}%0A`;

    for(const area in waterPlan){
        report += `${area}:\n`;
        for(const day in waterPlan[area]){
            const water = waterPlan[area][day];
            if(water>0) report += `Day ${parseInt(day)+1}: ${water} L%0A`;
            totalWater += water;
        }
    }

    const totalCost = totalWater*costPerLiter;
    report += `Total Cost: RM${totalCost.toFixed(2)}`;
    const phone = "60123456789"; // Replace with admin WhatsApp
    window.open(`https://wa.me/${phone}?text=${report}`,"_blank");

    // PDF
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("Palm Oil Water Supply 7-Day Plan",10,10);
    doc.text(`User: ${user.firstname} ${user.lastname}`,10,20);
    let y=30;
    for(const area in waterPlan){
        doc.text(area,10,y); y+=10;
        for(const day in waterPlan[area]){
            if(waterPlan[area][day]>0) doc.text(`Day ${parseInt(day)+1}: ${waterPlan[area][day]} L`,10,y), y+=10;
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

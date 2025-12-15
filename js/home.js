// -------------------------
// User check
// -------------------------
const user = JSON.parse(localStorage.getItem("loggedInUser"));
if(!user) window.location.href="index.html";
else document.getElementById("welcome").textContent = `Welcome, ${user.firstname} ${user.lastname}`;

// -------------------------
// Variables
// -------------------------
const apiKey = "YOUR_OPENWEATHERMAP_API_KEY"; // Replace
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

// Leaflet Draw
const drawControl = new L.Control.Draw({
    edit: { featureGroup: drawnItems },
    draw: { polygon:true, polyline:false, rectangle:false, circle:false, marker:false, circlemarker:false }
});
map.addControl(drawControl);

// Event: Create
map.on(L.Draw.Event.CREATED, function(event){
    const layer = event.layer;
    drawnItems.addLayer(layer);
    bindPolygonClick(layer);
    savePolygons();
});

// Event: Edit/Delete
map.on(L.Draw.Event.EDITED, savePolygons);
map.on(L.Draw.Event.DELETED, savePolygons);

// -------------------------
// Load saved polygons
// -------------------------
function loadPolygons(){
    const data = JSON.parse(localStorage.getItem("plantationPolygons")||"[]");
    data.forEach((coords, index)=>{
        const poly = L.polygon(coords, {color:'green'}).addTo(drawnItems);
        bindPolygonClick(poly, `Plantation Area ${index+1}`);
    });
}

// Bind polygon click for planning
function bindPolygonClick(layer, defaultName=null){
    const name = defaultName || `Plantation Area ${drawnItems.getLayers().indexOf(layer)+1}`;
    layer.bindPopup(name);
    layer.on('click', ()=>planWater(name));
}

// Save polygons
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
    buildCalendar(); // build calendar table after forecast
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
        const areaName = `Plantation Area ${idx+1}`;
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
// Update total cost
// -------------------------
function updateCost(){
    let totalWater=0;
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
    let totalWater=0;
    let report = `Hello Admin,%0AUser: ${user.firstname} ${user.lastname}%0A`;
    for(const area in waterPlan){
        report += `${area}:\n`;
        for(const day in waterPlan[area]){
            const water = waterPlan[area][day];
            report += `Day ${parseInt(day)+1}: ${water} L%0A`;
            totalWater += water;
        }
    }
    const totalCost = totalWater*costPerLiter;
    report += `Total Cost: RM${totalCost.toFixed(2)}`;
    const phone="60123456789"; // Replace with admin WhatsApp
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
            doc.text(`Day ${parseInt(day)+1}: ${waterPlan[area][day]} L`,10,y); y+=10;
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

// User check
const user = JSON.parse(localStorage.getItem("loggedInUser"));
if(!user) window.location.href = "index.html";
else document.getElementById("welcome").textContent = `Welcome, ${user.firstname} ${user.lastname}`;

// Weather API
const apiKey = "YOUR_OPENWEATHERMAP_API_KEY"; 
const lat = 2.7175;
const lon = 101.7210;

let weatherStatus = "Unknown";
let waterOn = false;
let waterUsed = 0;

const weatherEl = document.getElementById("weather-status");
const waterStatusEl = document.getElementById("water-status");
const waterCostEl = document.getElementById("water-cost");

// Fetch current weather
fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`)
.then(res => res.json())
.then(data => {
    weatherStatus = data.weather[0].main;
    weatherEl.textContent = `Today: ${weatherStatus}`;

    if(weatherStatus === "Rain") {
        waterStatusEl.textContent = "Water Supply: OFF (Rain detected)";
        waterOn = false;
    } else {
        waterStatusEl.textContent = "Water Supply: ON (Click on the plantation to water)";
        waterOn = true;
    }
});

// Initialize map
const map = L.map('map').setView([2.7175, 101.7210], 16);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Palm oil area polygon
const palmAreaCoords = [
    [2.7185, 101.7200],
    [2.7185, 101.7220],
    [2.7165, 101.7220],
    [2.7165, 101.7200]
];

const palmArea = L.polygon(palmAreaCoords, {color:'green'}).addTo(map).bindPopup("Palm Oil Area");

// Water supply selection
palmArea.on('click', function(){
    if(weatherStatus === "Rain") {
        alert("Cannot use water supply today, rain detected");
    } else if(waterOn) {
        const confirmWater = confirm("Switch ON water supply for this area?");
        if(confirmWater){
            waterUsed = 500; // example liters
            const costPerLiter = 0.005;
            const totalCost = waterUsed * costPerLiter;
            waterCostEl.textContent = `Total Cost: RM${totalCost.toFixed(2)}`;
            alert("Water supply turned ON for selected area.");
        }
    }
});

// WhatsApp Report
document.getElementById("whatsappBtn").addEventListener("click", () => {
    const totalCost = waterUsed * 0.005;
    const message = `Hello Admin,%0AWeather Today: ${weatherStatus}%0AWater Supply Used: ${waterUsed} L%0ATotal Cost: RM${totalCost.toFixed(2)}`;
    const phone = "60123456789";
    window.open(`https://wa.me/${phone}?text=${message}`, "_blank");

    // Optional: Generate PDF
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text(`Palm Oil Plantation Water Supply Report`, 10, 10);
    doc.text(`User: ${user.firstname} ${user.lastname}`, 10, 20);
    doc.text(`Weather: ${weatherStatus}`, 10, 30);
    doc.text(`Water Used: ${waterUsed} L`, 10, 40);
    doc.text(`Total Cost: RM${totalCost.toFixed(2)}`, 10, 50);
    doc.save("WaterSupplyReport.pdf");
});

// Logout
document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("loggedInUser");
    window.location.href = "index.html";
});

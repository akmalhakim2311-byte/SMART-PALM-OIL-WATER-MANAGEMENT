// Check logged-in user
const user = JSON.parse(localStorage.getItem("loggedInUser"));
if (!user) {
    window.location.href = "index.html"; // redirect if not logged in
} else {
    document.getElementById("welcome").textContent = `Welcome, ${user.firstname} ${user.lastname}`;
}

// Weather API Setup
const apiKey = "YOUR_OPENWEATHERMAP_API_KEY"; // replace with your key
const lat = 2.9185;
const lon = 101.6511;
let weatherStatus = "Unknown";
let waterOn = false;
let waterUsed = 0;

// Elements
const weatherEl = document.getElementById("weather-status");
const waterStatusEl = document.getElementById("water-status");
const waterCostEl = document.getElementById("water-cost");

// Fetch weather
fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`)
.then(res => res.json())
.then(data => {
    weatherStatus = data.weather[0].main; // e.g., "Rain" or "Clear"
    weatherEl.textContent = `Today: ${weatherStatus}`;

    if(weatherStatus === "Rain") {
        waterStatusEl.textContent = "Water Supply: OFF (Rain detected)";
        waterOn = false;
    } else {
        waterStatusEl.textContent = "Water Supply: ON (You can select area)";
        waterOn = true;
    }
});

// Initialize Leaflet Map
const map = L.map('map').setView([2.9185, 101.6511], 16);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Define palm oil polygon
const palmArea = L.polygon([
    [2.9190, 101.6500],
    [2.9190, 101.6520],
    [2.9180, 101.6520],
    [2.9180, 101.6500]
], {color: 'green'}).addTo(map).bindPopup("Palm Oil Area");

// Water supply selection
palmArea.on('click', function(){
    if(weatherStatus === "Rain") {
        alert("Cannot use water supply today, rain detected");
    } else if(waterOn) {
        const confirmWater = confirm("Switch ON water supply for this area?");
        if(confirmWater) {
            waterUsed = 500; // liters (example)
            const costPerLiter = 0.005;
            const totalCost = waterUsed * costPerLiter;
            waterCostEl.textContent = `Total Cost: RM${totalCost.toFixed(2)}`;
            alert("Water supply turned ON for selected area.");
        }
    }
});

// WhatsApp report
document.getElementById("whatsappBtn").addEventListener("click", () => {
    const costPerLiter = 0.005;
    const totalCost = waterUsed * costPerLiter;
    const message = `Hello Admin,%0AWeather Today: ${weatherStatus}%0AWater Supply Used: ${waterUsed} L%0ATotal Cost: RM${totalCost.toFixed(2)}`;
    const phone = "60123456789"; // replace with admin number
    window.open(`https://wa.me/${phone}?text=${message}`, "_blank");
});

// Logout
document.getElementById("logoutBtn").addEventListener("click", () => {
    localStorage.removeItem("loggedInUser");
    window.location.href = "index.html";
});

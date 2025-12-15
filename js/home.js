// home.js with OpenWeatherMap

const OPENWEATHER_KEY = "adb0eb54d909230353f3589a97c08521"; // <-- replace with your key

document.addEventListener("DOMContentLoaded", () => {
    const username = localStorage.getItem("currentUser");
    if (!username) window.location.href = "index.html";
    else document.getElementById("welcome").innerText = `Hello, ${username}`;

    document.getElementById("logoutBtn").addEventListener("click", () => {
        localStorage.removeItem("currentUser");
        window.location.href = "index.html";
    });

    const map = L.map("map").setView([3.5630, 101.6030], 16); // B44 KM41
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap"
    }).addTo(map);

    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    const drawControl = new L.Control.Draw({
        edit: { featureGroup: drawnItems },
        draw: { polyline: false, circle: false, rectangle: false, marker: false, circlemarker: false, polygon: { allowIntersection: false, showArea: true } }
    });
    map.addControl(drawControl);

    const polygons = [];

    async function fetchWeather(lat, lon) {
        const url = `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&exclude=minutely,hourly,alerts&units=metric&appid=${OPENWEATHER_KEY}`;
        const response = await fetch(url);
        const data = await response.json();
        const daily = data.daily.slice(0,7);
        return daily.map(day => day.rain && day.rain>0 ? "Rain" : "No Rain");
    }

    async function updateCalendar() {
        const calendar = document.getElementById("calendar");
        calendar.innerHTML = "<tr><th>Day</th><th>Polygon</th><th>Weather</th><th>Watering</th></tr>";

        for (let index = 0; index < polygons.length; index++) {
            const poly = polygons[index];
            if (!poly.weather) {
                const latlngs = poly.layer.getBounds().getCenter();
                poly.weather = await fetchWeather(latlngs.lat, latlngs.lng);
            }

            poly.weather.forEach((dayWeather, dayIndex) => {
                const row = document.createElement("tr");
                row.innerHTML = `
                    <td>Day ${dayIndex+1}</td>
                    <td>Polygon ${index+1}</td>
                    <td>${dayWeather}</td>
                    <td><input type="checkbox" class="water-check" data-poly="${index}" data-day="${dayIndex}" ${dayWeather==="Rain" ? "disabled" : ""}></td>
                `;
                calendar.appendChild(row);
            });
        }

        calculateCost();
        document.querySelectorAll(".water-check").forEach(cb => cb.addEventListener("change", calculateCost));
    }

    function calculateCost() {
        let total = 0;
        document.querySelectorAll(".water-check").forEach(cb => {
            if(cb.checked) total += 10;
        });
        document.getElementById("water-cost").innerText = `Total Cost: RM${total.toFixed(2)}`;
    }

    map.on(L.Draw.Event.CREATED, async function (e) {
        const layer = e.layer;
        drawnItems.addLayer(layer);
        polygons.push({ layer: layer, weather: null });
        await updateCalendar();
    });

    map.on("draw:edited", updateCalendar);
    map.on("draw:deleted", updateCalendar);
    document.getElementById("datePicker").addEventListener("change", updateCalendar);

    document.getElementById("whatsappBtn").addEventListener("click", ()=>{
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        let y = 10;
        doc.text("Palm Oil Watering Report", 10, y);
        y+=10;
        polygons.forEach((poly,index)=>{
            doc.text(`Polygon ${index+1}:`,10,y); y+=10;
            poly.weather.forEach((dayWeather, dayIndex)=>{
                const checkbox = document.querySelector(`.water-check[data-poly="${index}"][data-day="${dayIndex}"]`);
                const watering = checkbox && checkbox.checked ? "Yes" : "No";
                doc.text(`Day ${dayIndex+1}: ${dayWeather}, Watering: ${watering}`,10,y);
                y+=10;
            });
            y+=5;
        });
        const totalCost = document.getElementById("water-cost").innerText;
        doc.text(totalCost,10,y);
        doc.save("Watering_Report.pdf");

        const message = `Palm Oil Watering Report\n${totalCost}\nPlease see attached PDF.`;
        const waUrl = `https://wa.me/60123456789?text=${encodeURIComponent(message)}`;
        window.open(waUrl,"_blank");
    });
});

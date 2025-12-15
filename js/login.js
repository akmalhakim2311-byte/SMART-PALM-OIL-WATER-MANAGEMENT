// login.js

const loginBtn = document.getElementById("loginBtn");
const username = document.getElementById("username");
const password = document.getElementById("password");

loginBtn.addEventListener("click", () => {
    let accounts = JSON.parse(localStorage.getItem("accounts")) || [];
    let user = accounts.find(acc => acc.username === username.value && acc.password === password.value);

    if (user) {
        // Save current user for dashboard
        localStorage.setItem("currentUser", JSON.stringify(user));
        window.location.href = "home.html";
    } else {
        alert("Invalid username or password!");
    }
});

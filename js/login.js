document.addEventListener("DOMContentLoaded", () => {
    const loginBtn = document.getElementById("loginBtn");
    const username = document.getElementById("username");
    const password = document.getElementById("password");

    loginBtn.addEventListener("click", () => {
        const user = username.value.trim();
        const pass = password.value.trim();

        if (!user || !pass) { alert("Please enter username and password!"); return; }

        const accounts = JSON.parse(localStorage.getItem("accounts")) || [];
        const account = accounts.find(acc => acc.username === user && acc.password === pass);

        if (account) {
            localStorage.setItem("currentUser", account.username);
            window.location.href = "home.html";
        } else {
            alert("Invalid username or password!");
        }
    });
});

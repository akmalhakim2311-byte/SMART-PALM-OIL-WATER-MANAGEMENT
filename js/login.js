const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const message = document.getElementById("message");

// Remove spaces
[usernameInput, passwordInput].forEach(input => {
    input.addEventListener("input", () => {
        input.value = input.value.replace(/\s/g, "");
    });
});

loginBtn.addEventListener("click", () => {

    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    if (!username || !password) {
        message.textContent = "Invalid username or password!";
        return;
    }

    const accounts = JSON.parse(localStorage.getItem("accounts")) || [];

    const user = accounts.find(acc =>
        acc.username === username && acc.password === password
    );

    if (user) {
        // Save logged-in user session
        localStorage.setItem("loggedInUser", JSON.stringify(user));

        // Go to home page
        window.location.href = "home.html";
    } else {
        message.textContent = "No account found. Please sign up first.";
        usernameInput.value = "";
        passwordInput.value = "";
        usernameInput.focus();
    }
});

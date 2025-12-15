// signup.js

// Elements
const firstname = document.getElementById("firstname");
const lastname = document.getElementById("lastname");
const username = document.getElementById("su-username");
const password = document.getElementById("su-password");
const cpassword = document.getElementById("su-cpassword");
const tnc = document.getElementById("tnc");
const signupBtn = document.getElementById("signupBtn");

// Enable signup button only if terms checked
tnc.addEventListener("change", () => {
    signupBtn.disabled = !tnc.checked;
});

signupBtn.addEventListener("click", () => {
    if (!firstname.value || !lastname.value || !username.value || !password.value || !cpassword.value) {
        alert("Please fill in all fields!");
        return;
    }
    if (password.value !== cpassword.value) {
        alert("Passwords do not match!");
        return;
    }

    // Get accounts from localStorage
    let accounts = JSON.parse(localStorage.getItem("accounts")) || [];

    // Check if username exists
    if (accounts.some(acc => acc.username === username.value)) {
        alert("Username already exists! Please choose another.");
        return;
    }

    // Add new account
    accounts.push({
        firstname: firstname.value,
        lastname: lastname.value,
        username: username.value,
        password: password.value
    });

    // Save back to localStorage
    localStorage.setItem("accounts", JSON.stringify(accounts));

    alert("Account created successfully!");

    // Redirect to login page
    window.location.href = "index.html";
});

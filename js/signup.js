// signup.js

const firstname = document.getElementById("firstname");
const lastname = document.getElementById("lastname");
const username = document.getElementById("su-username");
const password = document.getElementById("su-password");
const cpassword = document.getElementById("su-cpassword");
const tnc = document.getElementById("tnc");
const signupBtn = document.getElementById("signupBtn");

// Enable signup button only when checkbox is checked
tnc.addEventListener("change", () => {
    signupBtn.disabled = !tnc.checked;
});

signupBtn.addEventListener("click", () => {
    if (!firstname.value || !lastname.value || !username.value || !password.value || !cpassword.value) {
        alert("Please fill in all fields.");
        return;
    }

    if (password.value !== cpassword.value) {
        alert("Passwords do not match.");
        return;
    }

    let accounts = JSON.parse(localStorage.getItem("accounts")) || [];

    if (accounts.some(acc => acc.username === username.value)) {
        alert("Username already exists.");
        return;
    }

    accounts.push({
        firstname: firstname.value,
        lastname: lastname.value,
        username: username.value,
        password: password.value
    });

    localStorage.setItem("accounts", JSON.stringify(accounts));

    alert("Account created successfully!");
    window.location.href = "index.html";
});

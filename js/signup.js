console.log("signup.js loaded");
const firstname = document.getElementById("firstname");
const lastname = document.getElementById("lastname");
const username = document.getElementById("username");
const password = document.getElementById("password");
const confirmPassword = document.getElementById("confirmPassword");
const tnc = document.getElementById("tnc");
const signupBtn = document.getElementById("signupBtn");
const message = document.getElementById("message");

// Remove spaces
[username, password, confirmPassword].forEach(input => {
    input.addEventListener("input", () => {
        input.value = input.value.replace(/\s/g, "");
        validateForm();
    });
});

// Validate form
[firstname, lastname, tnc].forEach(el => {
    el.addEventListener("input", validateForm);
    el.addEventListener("change", validateForm);
});

function validateForm() {
    signupBtn.disabled = !(
        firstname.value &&
        lastname.value &&
        username.value &&
        password.value &&
        confirmPassword.value &&
        tnc.checked
    );
}

// Sign up logic
signupBtn.addEventListener("click", () => {

    if (password.value !== confirmPassword.value) {
        message.textContent = "Passwords do not match!";
        return;
    }

    let accounts = JSON.parse(localStorage.getItem("accounts")) || [];

    if (accounts.some(acc => acc.username === username.value)) {
        message.textContent = "Username already exists!";
        return;
    }

    accounts.push({
        username: username.value,
        password: password.value,
        firstname: firstname.value,
        lastname: lastname.value
    });

    localStorage.setItem("accounts", JSON.stringify(accounts));

    alert("Account created successfully!");
    window.location.href = "index.html";
});

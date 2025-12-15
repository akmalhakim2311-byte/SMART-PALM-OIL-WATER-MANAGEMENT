console.log("signup.js loaded");

const firstname = document.getElementById("firstname");
const lastname = document.getElementById("lastname");
const username = document.getElementById("username");
const password = document.getElementById("password");
const confirmPassword = document.getElementById("confirmPassword");
const tnc = document.getElementById("tnc");
const signupBtn = document.getElementById("signupBtn");
const message = document.getElementById("message");

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

document.querySelectorAll("input").forEach(el => {
    el.addEventListener("input", validateForm);
    el.addEventListener("change", validateForm);
});

signupBtn.addEventListener("click", () => {
    if (password.value !== confirmPassword.value) {
        message.textContent = "Passwords do not match!";
        return;
    }

    let accounts = JSON.parse(localStorage.getItem("accounts")) || [];

    accounts.push({
        username: username.value,
        password: password.value,
        firstname: firstname.value,
        lastname: lastname.value
    });

    localStorage.setItem("accounts", JSON.stringify(accounts));
    console.log("Account saved:", accounts);

    window.location.href = "index.html";
});

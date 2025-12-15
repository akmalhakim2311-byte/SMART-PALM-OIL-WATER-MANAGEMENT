function removeSpaces(input) {
    input.value = input.value.replace(/\s/g, "");
}

function validateForm() {
    const firstname = document.getElementById("firstname").value;
    const lastname = document.getElementById("lastname").value;
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    const tnc = document.getElementById("tnc").checked;

    document.getElementById("signupBtn").disabled =
        !(firstname && lastname && username && password && confirmPassword && tnc);
}

function signup() {
    const firstname = document.getElementById("firstname").value;
    const lastname = document.getElementById("lastname").value;
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;
    const message = document.getElementById("message");

    if (password !== confirmPassword) {
        message.textContent = "Passwords do not match!";
        return;
    }

    let accounts = JSON.parse(localStorage.getItem("accounts")) || [];

    if (accounts.some(acc => acc.username === username)) {
        message.textContent = "Username already exists!";
        return;
    }

    accounts.push({ username, password, firstname, lastname });
    localStorage.setItem("accounts", JSON.stringify(accounts));

    alert("Account created successfully!");
    window.location.href = "index.html";
}

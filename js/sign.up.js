// Remove spaces (same as C# logic)
function removeSpaces(input) {
    input.value = input.value.replace(/\s/g, '');
}

// Enable / Disable signup button (Terms & Conditions)
function toggleSignup() {
    document.getElementById("signupBtn").disabled =
        !document.getElementById("tnc").checked;
}

// Signup logic (Accounts.txt → localStorage)
function signup() {
    let firstname = document.getElementById("firstname").value.trim();
    let lastname = document.getElementById("lastname").value.trim();
    let username = document.getElementById("username").value.trim();
    let password = document.getElementById("password").value.trim();
    let confirmPassword = document.getElementById("confirmPassword").value.trim();
    let message = document.getElementById("message");

    // Check empty fields
    if (!firstname || !lastname || !username || !password || !confirmPassword) {
        message.innerText = "Please fill in the form!";
        return;
    }

    // Password match check
    if (password !== confirmPassword) {
        message.innerText = "Password do not match!";
        return;
    }

    let accounts = JSON.parse(localStorage.getItem("accounts")) || [];

    // Check existing username
    for (let acc of accounts) {
        if (acc.username === username) {
            message.innerText = "Username already exists!";
            return;
        }
    }

    // Save account
    accounts.push({
        username,
        password,
        firstname,
        lastname
    });

    localStorage.setItem("accounts", JSON.stringify(accounts));

    alert("Account is Created!");
    window.location.href = "index.html";
}

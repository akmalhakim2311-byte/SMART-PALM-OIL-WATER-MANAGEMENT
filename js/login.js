// Remove spaces (LUtextBox_TextChanged / LPtextBox_TextChanged)
function removeSpaces(input) {
    input.value = input.value.replace(/\s/g, '');
}

// Close button logic (BtnClose_Click)
function closeApp() {
    if (confirm("Do you want to close this window?")) {
        window.close();
    }
}

// Login logic (BtnLogin_Click)
function login() {
    let username = document.getElementById("username").value.trim();
    let password = document.getElementById("password").value.trim();
    let message = document.getElementById("message");

    // Check empty username or password
    if (username === "" || password === "") {
        message.innerText = "Invalid username or password!";
        document.getElementById("username").value = "";
        document.getElementById("password").value = "";
        document.getElementById("username").focus();
        return;
    }

    // Read Accounts.txt replacement
    let accounts = JSON.parse(localStorage.getItem("accounts")) || [];

    let loginSuccess = false;
    let firstname = "";
    let lastname = "";

    for (let i = 0; i < accounts.length; i++) {
        if (accounts[i].username === username &&
            accounts[i].password === password) {

            loginSuccess = true;
            firstname = accounts[i].firstname;
            lastname = accounts[i].lastname;
            break;
        }
    }

    if (loginSuccess) {
        // Save session (HomeForm replacement)
        sessionStorage.setItem("currentUser", JSON.stringify({
            username: username,
            firstname: firstname,
            lastname: lastname
        }));

        // Redirect to home page
        window.location.href = "home.html";

    } else {
        message.innerText = "No accounts found! Please sign up first.";
        document.getElementById("username").value = "";
        document.getElementById("password").value = "";
        document.getElementById("username").focus();
    }
}

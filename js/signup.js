document.addEventListener("DOMContentLoaded", () => {
    const signupBtn = document.getElementById("signupBtn");
    const tnc = document.getElementById("tnc");

    const firstname = document.getElementById("firstname");
    const lastname = document.getElementById("lastname");
    const username = document.getElementById("su-username");
    const password = document.getElementById("su-password");
    const cpassword = document.getElementById("su-cpassword");

    tnc.addEventListener("change", () => {
        signupBtn.disabled = !tnc.checked;
    });

    signupBtn.addEventListener("click", () => {
        const fn = firstname.value.trim();
        const ln = lastname.value.trim();
        const user = username.value.trim();
        const pass = password.value.trim();
        const cpass = cpassword.value.trim();

        if (!fn || !ln || !user || !pass || !cpass) {
            alert("Please fill in all fields!");
            return;
        }
        if (pass !== cpass) { alert("Password does not match!"); return; }

        let accounts = JSON.parse(localStorage.getItem("accounts")) || [];
        if (accounts.find(acc => acc.username === user)) { alert("Username already exists!"); return; }

        accounts.push({ firstname: fn, lastname: ln, username: user, password: pass });
        localStorage.setItem("accounts", JSON.stringify(accounts));

        alert("Account created successfully!");
        window.location.href = "index.html";
    });
});

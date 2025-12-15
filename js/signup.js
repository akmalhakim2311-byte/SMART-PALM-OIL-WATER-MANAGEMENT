console.log("signup.js loaded");

document.getElementById("signupBtn").addEventListener("click", () => {
    localStorage.setItem("accounts", "TEST");
    console.log("Saved TEST to localStorage");
});

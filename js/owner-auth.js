const OWNER_USERNAME = "admin";
const OWNER_PASSWORD = "admin123";

function ownerLogin() {
  const u = document.getElementById("username").value;
  const p = document.getElementById("password").value;

  if (u === OWNER_USERNAME && p === OWNER_PASSWORD) {
    sessionStorage.setItem("role", "owner");
    window.location.href = "home.html";
  } else {
    document.getElementById("error").innerText =
      "Invalid owner credentials";
  }
}

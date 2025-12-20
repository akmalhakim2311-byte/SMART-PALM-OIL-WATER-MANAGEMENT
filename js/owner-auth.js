function ownerLogin() {
  const u = document.getElementById("username").value;
  const p = document.getElementById("password").value;

  if (u === "admin" && p === "admin123") {
    sessionStorage.setItem("role", "owner");
    window.location.href = "home.html";
  } else {
    document.getElementById("error").innerText =
      "Invalid owner credentials";
  }
}

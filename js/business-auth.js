function signup() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  localStorage.setItem("biz_" + email, password);
  alert("Signup successful. Please login.");
  window.location.href = "business-login.html";
}

function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  if (localStorage.getItem("biz_" + email) === password) {
    sessionStorage.setItem("role", "business");
    window.location.href = "home.html";
  } else {
    alert("Invalid login credentials");
  }
}

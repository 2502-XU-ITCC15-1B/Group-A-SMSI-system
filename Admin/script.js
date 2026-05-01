// Dummy account (you can change this)
const USER = "admin";
const PASS = "1234";

// Login function
function login() {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    const errorMsg = document.getElementById("error-msg");

    if (username === USER && password === PASS) {
        localStorage.setItem("loggedIn", "true");
        window.location.href = "index.html";
    } else {
        errorMsg.textContent = "Invalid username or password";
    }
}

// Protect index page
function checkAuth() {
    if (localStorage.getItem("loggedIn") !== "true") {
        window.location.href = "login.html";
    }
}

// Logout (optional)
function logout() {
    localStorage.removeItem("loggedIn");
    window.location.href = "login.html";
}

// Run auth check if on index page
if (window.location.pathname.includes("index.html")) {
    checkAuth();
}
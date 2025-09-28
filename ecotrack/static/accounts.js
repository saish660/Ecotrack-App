document.getElementById("login-form").addEventListener("submit", function (e) {
  e.preventDefault();

  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;

  fetch("login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": getCsrfToken(),
    },
    body: JSON.stringify({
      email: email,
      password: password,
    }),
  })
    .then((response) => {
      if (response.ok) {
        window.location.href = "/"; // Redirect to home page on success
      } else {
        return response.json().then((data) => {
          throw new Error(data.message || "Login failed");
        });
      }
    })
    .catch((error) => {
      const box = document.getElementById("custom-message-box");
      const text = document.getElementById("message-box-text");
      const ok = document.getElementById("message-box-ok");
      if (box && text) {
        text.textContent = error.message;
        box.classList.remove("hidden");
        ok?.addEventListener("click", () => box.classList.add("hidden"));
      }
    });
});

document.getElementById("signup-form").addEventListener("submit", function (e) {
  e.preventDefault();

  const email = document.getElementById("signup-email").value;
  const password = document.getElementById("signup-password").value;
  const confirmPassword = document.getElementById("signup-confirm").value;

  if (password !== confirmPassword) {
    const box = document.getElementById("custom-message-box");
    const text = document.getElementById("message-box-text");
    const ok = document.getElementById("message-box-ok");
    if (box && text) {
      text.textContent = "Passwords don't match!";
      box.classList.remove("hidden");
      ok?.addEventListener("click", () => box.classList.add("hidden"));
    }
    return;
  }

  fetch("signup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": getCsrfToken(), // Important for Django's security
    },
    body: JSON.stringify({
      email: email,
      password: password,
    }),
  })
    .then((response) => response.json())
    .then((data) => {
      if (data.status === "success") {
        // Redirect to the survey page on success
        window.location.href = "/survey";
      } else {
        // Show an alert with the error message from the backend
        const box = document.getElementById("custom-message-box");
        const text = document.getElementById("message-box-text");
        const ok = document.getElementById("message-box-ok");
        if (box && text) {
          text.textContent = data.message || "An unknown error occurred.";
          box.classList.remove("hidden");
          ok?.addEventListener("click", () => box.classList.add("hidden"));
        }
      }
    })
    .catch((error) => {
      console.error("Signup Request Failed:", error);
      const box = document.getElementById("custom-message-box");
      const text = document.getElementById("message-box-text");
      const ok = document.getElementById("message-box-ok");
      if (box && text) {
        text.textContent =
          "An error occurred while trying to sign up. Please try again.";
        box.classList.remove("hidden");
        ok?.addEventListener("click", () => box.classList.add("hidden"));
      }
    });
});

// Function to get CSRF token from cookies
function getCsrfToken() {
  const name = "csrftoken";
  let cookieValue = null;
  if (document.cookie && document.cookie !== "") {
    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === name + "=") {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
}

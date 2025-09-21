// Push Notifications JavaScript
// Handles service worker registration, subscription management, and UI interactions

class NotificationManager {
  constructor() {
    this.isSupported = "serviceWorker" in navigator && "PushManager" in window;
    this.registration = null;
    this.subscription = null;
    this.vapidPublicKey = null;

    // UI elements
    this.toggle = null;
    this.timeInput = null;
    this.testBtn = null;
    this.saveBtn = null;
    this.statusDiv = null;
    this.timeSettingDiv = null;
    this.permissionBtn = null;

    this.init();
  }

  async init() {
    console.log("NotificationManager initializing...");
    console.log("Push notifications supported:", this.isSupported);
    console.log("Current notification permission:", Notification.permission);

    if (!this.isSupported) {
      this.showStatus(
        "Push notifications are not supported in this browser.",
        "error"
      );
      return;
    }

    this.initializeElements();
    await this.registerServiceWorker();
    await this.loadNotificationSettings();
    this.setupEventListeners();
  }

  initializeElements() {
    this.toggle = document.getElementById("notification-toggle");
    this.timeInput = document.getElementById("notification-time");
    this.testBtn = document.getElementById("test-notification-btn");
    this.saveBtn = document.getElementById("save-notification-settings");
    this.statusDiv = document.getElementById("notification-status");
    this.timeSettingDiv = document.getElementById("time-setting");
    this.permissionBtn = document.getElementById("request-permission-btn");
  }

  async registerServiceWorker() {
    try {
      this.registration = await navigator.serviceWorker.register(
        "/static/sw.js"
      );
      console.log("Service Worker registered successfully:", this.registration);
      // Do not await navigator.serviceWorker.ready here.
      // Since the service worker is served from /static/sw.js, its scope is /static/ and
      // it will not immediately control the current page at /. Awaiting ready can hang
      // and block the UI from progressing past the loading state. We proceed without waiting.
    } catch (error) {
      console.error("Service Worker registration failed:", error);
      this.showStatus(
        "Failed to register service worker. Please try refreshing the page.",
        "error"
      );
    }
  }

  async loadNotificationSettings() {
    try {
      const response = await fetch("/api/notifications/settings");
      const data = await response.json();

      if (data.status === "success") {
        this.vapidPublicKey = data.data.vapidPublicKey;

        if (this.toggle) {
          this.toggle.checked = data.data.isSubscribed;
        }

        if (this.timeInput) {
          this.timeInput.value = data.data.notificationTime;
        }

        // Update UI visibility based on subscription status
        this.updateUIVisibility(data.data.isSubscribed);

        if (data.data.isSubscribed) {
          this.showStatus("Push notifications are enabled.", "success");
        } else {
          // Check browser notification permission status
          const browserPermission = Notification.permission;
          console.log("Browser notification permission:", browserPermission);

          if (browserPermission === "denied") {
            this.showStatus(
              "Push notifications are blocked by your browser. Please enable notifications in your browser settings to receive daily reminders.",
              "error"
            );
          } else if (browserPermission === "default") {
            this.showStatus(
              "Push notifications are disabled. Click the toggle to enable daily reminders.",
              "warning"
            );
          } else {
            this.showStatus(
              "Push notifications are disabled. Enable them to receive daily reminders.",
              "warning"
            );
          }
        }
      } else {
        this.showStatus("Failed to load notification settings.", "error");
      }
    } catch (error) {
      console.error("Error loading notification settings:", error);
      this.showStatus("Error loading notification settings.", "error");
    }
  }

  setupEventListeners() {
    if (this.toggle) {
      this.toggle.addEventListener("change", async (e) => {
        if (e.target.checked) {
          // Immediately request permission when toggled on
          console.log("Toggle switched on, requesting permission...");
          await this.subscribeToNotifications();
        } else {
          await this.unsubscribeFromNotifications();
        }
      });
    }

    if (this.testBtn) {
      this.testBtn.addEventListener("click", () => {
        this.sendTestNotification();
      });
    }

    if (this.saveBtn) {
      this.saveBtn.addEventListener("click", () => {
        this.updateNotificationTime();
      });
    }

    if (this.timeInput) {
      this.timeInput.addEventListener("change", () => {
        if (this.toggle && this.toggle.checked) {
          this.saveBtn.style.display = "block";
        }
      });
    }

    if (this.permissionBtn) {
      this.permissionBtn.addEventListener("click", async () => {
        console.log("Permission button clicked");
        await this.requestPermissionAndSubscribe();
      });
    }
  }

  async requestPermissionAndSubscribe() {
    console.log("Requesting permission and subscribing...");
    try {
      // First request permission
      const permission = await Notification.requestPermission();
      console.log("Permission result:", permission);

      if (permission === "granted") {
        // Then subscribe
        this.toggle.checked = true;
        await this.subscribeToNotifications();
      } else {
        this.showStatus(
          "Notification permission was denied. Please enable notifications in your browser settings.",
          "error"
        );
      }
    } catch (error) {
      console.error("Error requesting permission:", error);
      this.showStatus("Error requesting notification permission.", "error");
    }
  }

  async subscribeToNotifications() {
    try {
      this.showStatus("Setting up notifications...", "warning");

      // Check current notification permission
      console.log("Current notification permission:", Notification.permission);

      // Request notification permission if not already granted
      let permission = Notification.permission;
      if (permission === "default") {
        console.log("Requesting notification permission...");
        permission = await Notification.requestPermission();
        console.log("Permission result:", permission);
      }

      if (permission !== "granted") {
        this.toggle.checked = false;
        const message =
          permission === "denied"
            ? "Notification permission was denied. Please enable notifications in your browser settings and refresh the page."
            : "Notification permission is required for daily reminders.";
        this.showStatus(message, "error");
        this.updateUIVisibility(false);
        return;
      }

      // Get push subscription
      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.vapidPublicKey),
      });

      this.subscription = subscription;

      // Send subscription to server
      const response = await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": this.getCSRFToken(),
        },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          notificationTime: this.timeInput ? this.timeInput.value : "09:00",
        }),
      });

      const data = await response.json();

      if (data.status === "success") {
        this.updateUIVisibility(true);
        this.showStatus("Push notifications enabled successfully!", "success");
      } else {
        this.toggle.checked = false;
        this.showStatus(
          `Failed to enable notifications: ${data.message}`,
          "error"
        );
      }
    } catch (error) {
      console.error("Error subscribing to notifications:", error);
      this.toggle.checked = false;
      this.showStatus(
        "Error setting up notifications. Please try again.",
        "error"
      );
    }
  }

  async unsubscribeFromNotifications() {
    try {
      this.showStatus("Disabling notifications...", "warning");

      const response = await fetch("/api/notifications/unsubscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": this.getCSRFToken(),
        },
      });

      const data = await response.json();

      if (data.status === "success") {
        this.updateUIVisibility(false);
        this.showStatus("Push notifications disabled.", "warning");
      } else {
        this.toggle.checked = true;
        this.showStatus(
          `Failed to disable notifications: ${data.message}`,
          "error"
        );
      }
    } catch (error) {
      console.error("Error unsubscribing from notifications:", error);
      this.toggle.checked = true;
      this.showStatus(
        "Error disabling notifications. Please try again.",
        "error"
      );
    }
  }

  async updateNotificationTime() {
    try {
      this.showStatus("Updating notification time...", "warning");

      const response = await fetch("/api/notifications/update-time", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": this.getCSRFToken(),
        },
        body: JSON.stringify({
          notificationTime: this.timeInput.value,
        }),
      });

      const data = await response.json();

      if (data.status === "success") {
        this.saveBtn.style.display = "none";
        this.showStatus("Notification time updated successfully!", "success");
      } else {
        this.showStatus(`Failed to update time: ${data.message}`, "error");
      }
    } catch (error) {
      console.error("Error updating notification time:", error);
      this.showStatus(
        "Error updating notification time. Please try again.",
        "error"
      );
    }
  }

  async sendTestNotification() {
    try {
      this.testBtn.disabled = true;
      this.testBtn.textContent = "Sending...";

      const response = await fetch("/api/notifications/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": this.getCSRFToken(),
        },
      });

      const data = await response.json();

      if (data.status === "success") {
        this.showStatus(
          "Test notification sent! Check your notifications.",
          "success"
        );
      } else {
        this.showStatus(
          `Failed to send test notification: ${data.message}`,
          "error"
        );
      }
    } catch (error) {
      console.error("Error sending test notification:", error);
      this.showStatus(
        "Error sending test notification. Please try again.",
        "error"
      );
    } finally {
      setTimeout(() => {
        this.testBtn.disabled = false;
        this.testBtn.textContent = "Send Test Notification";
      }, 2000);
    }
  }

  updateUIVisibility(isSubscribed) {
    const browserPermission = Notification.permission;

    if (this.timeSettingDiv) {
      this.timeSettingDiv.style.display = isSubscribed ? "flex" : "none";
    }
    if (this.testBtn) {
      this.testBtn.style.display = isSubscribed ? "block" : "none";
    }
    if (this.saveBtn) {
      this.saveBtn.style.display = "none"; // Initially hidden, shown when time changes
    }

    // Show permission button if not subscribed and permission is not granted
    if (this.permissionBtn) {
      this.permissionBtn.style.display =
        !isSubscribed && browserPermission !== "granted" ? "block" : "none";
    }

    // Hide toggle if permission is denied
    if (this.toggle && browserPermission === "denied") {
      this.toggle.style.display = "none";
    }
  }

  showStatus(message, type = "success") {
    if (!this.statusDiv) return;

    const statusText = this.statusDiv.querySelector(".status-text");
    if (statusText) {
      statusText.textContent = message;
    }

    // Remove existing status classes
    this.statusDiv.classList.remove("error", "success", "warning");

    // Add new status class
    if (type) {
      this.statusDiv.classList.add(type);
    }
  }

  urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, "+")
      .replace(/_/g, "/");

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  getCSRFToken() {
    const cookies = document.cookie.split(";");
    for (let cookie of cookies) {
      const [name, value] = cookie.trim().split("=");
      if (name === "csrftoken") {
        return value;
      }
    }

    // Fallback: try to get from meta tag or hidden input
    const csrfMeta = document.querySelector('meta[name="csrf-token"]');
    if (csrfMeta) {
      return csrfMeta.getAttribute("content");
    }

    const csrfInput = document.querySelector(
      'input[name="csrfmiddlewaretoken"]'
    );
    if (csrfInput) {
      return csrfInput.value;
    }

    return "";
  }

  // Debug method for manual testing
  async testPermissionRequest() {
    console.log("Testing permission request...");
    console.log("Current permission:", Notification.permission);

    if (Notification.permission === "default") {
      const result = await Notification.requestPermission();
      console.log("Permission request result:", result);
      return result;
    } else {
      console.log("Permission already set to:", Notification.permission);
      return Notification.permission;
    }
  }
}

// Initialize notification manager when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  // Only initialize if we're on a page with notification settings
  if (document.getElementById("notification-toggle")) {
    console.log("Initializing NotificationManager...");
    window.notificationManager = new NotificationManager();

    // Also make the class available globally for debugging
    window.NotificationManager = NotificationManager;
  } else {
    console.log(
      "Notification toggle not found, skipping NotificationManager initialization"
    );
  }
});

// Helper function for testing permission from console
window.testNotificationPermission = async function () {
  console.log("Testing notification permission...");
  console.log("Current permission:", Notification.permission);

  if (Notification.permission === "default") {
    const result = await Notification.requestPermission();
    console.log("Permission request result:", result);
    return result;
  } else {
    console.log("Permission already set to:", Notification.permission);
    return Notification.permission;
  }
};

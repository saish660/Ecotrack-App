// Firebase Cloud Messaging (FCM) JavaScript
// Handles Firebase SDK initialization, FCM token registration, and UI interactions

// Import Firebase SDK modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.0.0/firebase-app.js";
import {
  getMessaging,
  getToken,
  onMessage,
} from "https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging.js";

class FCMNotificationManager {
  constructor() {
    this.isSupported = "serviceWorker" in navigator && "PushManager" in window;
    this.firebaseApp = null;
    this.messaging = null;
    this.fcmToken = null;
    this.firebaseConfig = null;

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
    console.log("FCM NotificationManager initializing...");
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
    await this.loadNotificationSettings();
    await this.initializeFirebase();
    await this.registerServiceWorker();
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

  async loadNotificationSettings() {
    try {
      const response = await fetch("/api/notifications/settings");
      const data = await response.json();

      if (data.status === "success") {
        this.firebaseConfig = data.data.firebaseConfig;

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

  async initializeFirebase() {
    try {
      if (!this.firebaseConfig || !this.firebaseConfig.apiKey) {
        throw new Error("Firebase configuration is missing");
      }

      // Initialize Firebase
      this.firebaseApp = initializeApp(this.firebaseConfig);
      this.messaging = getMessaging(this.firebaseApp);

      console.log("Firebase initialized successfully");

      // Handle foreground messages
      onMessage(this.messaging, (payload) => {
        console.log("Message received in foreground:", payload);

        // Show notification if page is in focus
        if (document.hasFocus() && payload.notification) {
          this.showForegroundNotification(payload.notification);
        }
      });
    } catch (error) {
      console.error("Error initializing Firebase:", error);
      this.showStatus("Failed to initialize Firebase messaging.", "error");
      throw error;
    }
  }

  async registerServiceWorker() {
    try {
      const registration = await navigator.serviceWorker.register(
        "/static/sw_fcm.js"
      );
      console.log("Service Worker registered successfully:", registration);
      this.swRegistration = registration;
    } catch (error) {
      console.error("Service Worker registration failed:", error);
      this.showStatus(
        "Failed to register service worker. Please try refreshing the page.",
        "error"
      );
    }
  }

  setupEventListeners() {
    if (this.toggle) {
      this.toggle.addEventListener("change", async (e) => {
        if (e.target.checked) {
          console.log("Toggle switched on, subscribing to FCM...");
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
      this.showStatus("Setting up FCM notifications...", "warning");

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

      // Get FCM token
      try {
        this.fcmToken = await getToken(this.messaging, {
          vapidKey: this.firebaseConfig.vapidKey,
          serviceWorkerRegistration: this.swRegistration,
        });
        console.log("FCM token obtained:", this.fcmToken);
      } catch (tokenError) {
        console.error("Error getting FCM token:", tokenError);
        this.toggle.checked = false;
        this.showStatus("Failed to get FCM token. Please try again.", "error");
        return;
      }

      // Send FCM token to server
      const response = await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": this.getCSRFToken(),
        },
        body: JSON.stringify({
          fcmToken: this.fcmToken,
          deviceType: "web",
          notificationTime: this.timeInput ? this.timeInput.value : "09:00",
        }),
      });

      const data = await response.json();

      if (data.status === "success") {
        this.updateUIVisibility(true);
        this.showStatus("FCM notifications enabled successfully!", "success");
      } else {
        this.toggle.checked = false;
        this.showStatus(
          `Failed to enable notifications: ${data.message}`,
          "error"
        );
      }
    } catch (error) {
      console.error("Error subscribing to FCM notifications:", error);
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

  showForegroundNotification(notification) {
    // Create and show a custom notification when app is in focus
    const notificationDiv = document.createElement("div");
    notificationDiv.className = "fcm-foreground-notification";
    notificationDiv.innerHTML = `
      <div class="fcm-notification-content">
        <h4>${notification.title}</h4>
        <p>${notification.body}</p>
        <button onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;

    document.body.appendChild(notificationDiv);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (notificationDiv.parentElement) {
        notificationDiv.remove();
      }
    }, 5000);
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

    // Auto-hide success messages after 5 seconds
    if (type === "success") {
      setTimeout(() => {
        this.statusDiv.classList.remove("success");
      }, 5000);
    }
  }

  getCSRFToken() {
    return document.querySelector("[name=csrfmiddlewaretoken]")?.value || "";
  }
}

// Initialize the notification manager when the DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.notificationManager = new FCMNotificationManager();
});

// Add CSS for foreground notifications
const style = document.createElement("style");
style.textContent = `
  .fcm-foreground-notification {
    position: fixed;
    top: 20px;
    right: 20px;
    background: #333;
    color: white;
    padding: 15px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 10000;
    max-width: 300px;
  }
  
  .fcm-notification-content h4 {
    margin: 0 0 8px 0;
    font-size: 16px;
  }
  
  .fcm-notification-content p {
    margin: 0;
    font-size: 14px;
    opacity: 0.9;
  }
  
  .fcm-notification-content button {
    position: absolute;
    top: 5px;
    right: 10px;
    background: none;
    border: none;
    color: white;
    font-size: 20px;
    cursor: pointer;
    padding: 0;
    width: 20px;
    height: 20px;
  }
`;
document.head.appendChild(style);

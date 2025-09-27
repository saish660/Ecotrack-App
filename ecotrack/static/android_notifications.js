// Android-focused notification management for EcoTrack
// This script handles Android device registration and notification settings via server API only
// No browser-based subscription loading or service worker interactions

class AndroidNotificationManager {
  constructor() {
    this.deviceId = null;
    this.isAndroidApp = this.detectAndroidApp();

    // UI elements
    this.deviceList = null;
    this.statusDiv = null;
    this.refreshBtn = null;
    this.addDeviceBtn = null;

    this.init();
  }

  detectAndroidApp() {
    // Check if running in Android WebView or has Android app interface
    return (
      navigator.userAgent.toLowerCase().includes("android") ||
      window.Android !== undefined ||
      window.ReactNativeWebView !== undefined
    );
  }

  async init() {
    console.log("Android NotificationManager initializing...");
    console.log("Detected Android environment:", this.isAndroidApp);
    this.initializeElements();
    await this.loadDevicesFromServer();
    this.setupEventListeners();
    this.updateUIForAndroid();
  }

  initializeElements() {
    // Initialize UI elements for Android device management
    this.deviceList = document.getElementById("android-devices-list");
    this.statusDiv = document.getElementById("notification-status");
    this.refreshBtn = document.getElementById("refresh-devices-btn");
    this.addDeviceBtn = document.getElementById("add-device-btn");

    // Create device list container if it doesn't exist
    if (!this.deviceList) {
      this.createDeviceListContainer();
    }
  }

  attachDeviceEventListeners() {
    // Test notification buttons
    document.querySelectorAll(".test-device-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const deviceId = e.target.getAttribute("data-device");
        this.testNotification(deviceId);
      });
    });

    // Remove device buttons
    document.querySelectorAll(".remove-device-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const deviceId = e.target.getAttribute("data-device");
        this.removeDevice(deviceId);
      });
    });

    // Preference checkboxes
    document.querySelectorAll("input[data-pref]").forEach((checkbox) => {
      checkbox.addEventListener("change", (e) => {
        const deviceId = e.target.getAttribute("data-device");
        const preference = e.target.getAttribute("data-pref");
        const enabled = e.target.checked;
        this.updateDevicePreference(deviceId, preference, enabled);
      });
    });

    // Settings buttons
    document.querySelectorAll(".settings-device-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const deviceId = e.target.getAttribute("data-device");
        this.showDeviceSettingsModal(deviceId);
      });
    });
  }

  setupEventListeners() {
    if (this.refreshBtn) {
      this.refreshBtn.addEventListener("click", () => {
        this.loadDevicesFromServer();
      });
    }

    if (this.addDeviceBtn) {
      this.addDeviceBtn.addEventListener("click", () => {
        this.showAddDeviceModal();
      });
    }
  }

  async updateDevicePreference(deviceId, preference, enabled) {
    const preferenceMap = {
      dailyReminders: "dailyReminders",
      communityNotifications: "communityNotifications",
      achievementNotifications: "achievementNotifications",
    };

    const updateData = {
      deviceId: deviceId,
      [preferenceMap[preference]]: enabled,
    };

    try {
      const response = await fetch("/api/android/update-settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": this.getCSRFToken(),
        },
        body: JSON.stringify(updateData),
      });

      const data = await response.json();

      if (data.status === "success") {
        this.showStatus(`✅ ${preference} preference updated`, "success");
      } else {
        this.showStatus(
          `❌ Failed to update preference: ${data.message}`,
          "error"
        );
      }
    } catch (error) {
      console.error("Error updating preference:", error);
      this.showStatus("❌ Error updating preference", "error");
    }
  }

  async updateDeviceSettings(deviceId, formData) {
    const updateData = {
      deviceId: deviceId,
      notificationTime: formData.get("notificationTime"),
      timezone: formData.get("timezone"),
    };

    try {
      const response = await fetch("/api/android/update-settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": this.getCSRFToken(),
        },
        body: JSON.stringify(updateData),
      });

      const data = await response.json();

      if (data.status === "success") {
        this.showStatus(`✅ Device settings updated successfully`, "success");
        await this.loadDevicesFromServer();
      } else {
        this.showStatus(
          `❌ Failed to update settings: ${data.message}`,
          "error"
        );
      }
    } catch (error) {
      console.error("Error updating device settings:", error);
      this.showStatus("❌ Error updating device settings", "error");
    }
  }

  updateUIForAndroid() {
    // Update the UI to reflect Android-only functionality
    const notificationSection = document.querySelector(".notification-section");
    if (notificationSection) {
      // Hide web-specific elements
      const webElements = notificationSection.querySelectorAll(
        "#notification-toggle, #request-permission-btn, .web-only"
      );
      webElements.forEach((el) => (el.style.display = "none"));
    }
  }

  showStatus(message, type = "info") {
    if (!this.statusDiv) return;

    const typeIcons = {
      success: "✅",
      error: "❌",
      warning: "⚠️",
      info: "ℹ️",
    };

    this.statusDiv.className = `status-message ${type}`;
    this.statusDiv.innerHTML = `${typeIcons[type] || ""} ${message}`;

    // Auto-hide success messages after 5 seconds
    if (type === "success") {
      setTimeout(() => {
        if (this.statusDiv && this.statusDiv.classList.contains("success")) {
          this.statusDiv.innerHTML = "";
          this.statusDiv.className = "status-message";
        }
      }, 5000);
    }
  }

  formatDate(dateString) {
    if (!dateString) return "Never";

    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return "Invalid date";
    }
  }

  getCSRFToken() {
    const cookieValue = document.cookie
      .split("; ")
      .find((row) => row.startsWith("csrftoken="))
      ?.split("=")[1];

    return (
      cookieValue ||
      document.querySelector("[name=csrfmiddlewaretoken]")?.value ||
      ""
    );
  }
}

// Initialize the Android notification manager when the page loads
document.addEventListener("DOMContentLoaded", () => {
  window.androidNotificationManager = new AndroidNotificationManager();
});

// Export for potential use by Android WebView
if (typeof window !== "undefined") {
  window.AndroidNotificationManager = AndroidNotificationManager;
}

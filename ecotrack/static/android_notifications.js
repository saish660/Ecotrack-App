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

  createDeviceListContainer() {
    const container = document.createElement("div");
    container.id = "android-devices-container";
    container.className = "notification-section";

    container.innerHTML = `
      <h3>📱 Registered Android Devices</h3>
      <div id="notification-status" class="status-message"></div>
      <div id="android-devices-list" class="devices-list"></div>
      <div class="device-actions">
        <button id="refresh-devices-btn" class="btn btn-secondary">🔄 Refresh Devices</button>
        <button id="add-device-btn" class="btn btn-primary">➕ Register New Device</button>
      </div>
    `;

    // Insert into existing notification settings area or create new section
    const settingsArea =
      document.querySelector(".notification-settings") ||
      document.querySelector(".settings-section") ||
      document.body;

    settingsArea.appendChild(container);

    // Re-initialize elements
    this.deviceList = document.getElementById("android-devices-list");
    this.statusDiv = document.getElementById("notification-status");
    this.refreshBtn = document.getElementById("refresh-devices-btn");
    this.addDeviceBtn = document.getElementById("add-device-btn");
  }

  async loadDevicesFromServer() {
    this.showStatus("Loading registered devices...", "info");

    try {
      const response = await fetch("/api/android/devices", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": this.getCSRFToken(),
        },
      });

      const data = await response.json();

      if (data.status === "success") {
        this.displayDevices(data.data.devices);
        this.showStatus(
          `✅ Loaded ${data.data.totalDevices} device(s), ${data.data.activeDevices} active`,
          "success"
        );
      } else {
        this.showStatus(`❌ Failed to load devices: ${data.message}`, "error");
      }
    } catch (error) {
      console.error("Error loading devices:", error);
      this.showStatus("❌ Error loading devices from server", "error");
    }
  }

  displayDevices(devices) {
    if (!this.deviceList) return;

    if (devices.length === 0) {
      this.deviceList.innerHTML = `
        <div class="no-devices">
          <p>📱 No Android devices registered yet.</p>
          <p>Register your Android device to receive push notifications.</p>
        </div>
      `;
      return;
    }

    const devicesHTML = devices
      .map((device) => this.createDeviceCard(device))
      .join("");
    this.deviceList.innerHTML = devicesHTML;

    // Add event listeners to device cards
    this.attachDeviceEventListeners();
  }

  createDeviceCard(device) {
    const statusIcon = device.isActive ? "🟢" : "🔴";
    const statusText = device.isActive ? "Active" : "Inactive";

    return `
      <div class="device-card" data-device-id="${device.deviceId}">
        <div class="device-header">
          <h4>${statusIcon} ${device.deviceName || "Unnamed Device"}</h4>
          <span class="device-status ${
            device.isActive ? "active" : "inactive"
          }">${statusText}</span>
        </div>
        
        <div class="device-info">
          <p><strong>Model:</strong> ${device.deviceModel || "Unknown"}</p>
          <p><strong>App Version:</strong> ${device.appVersion || "Unknown"}</p>
          <p><strong>Notification Time:</strong> ${device.notificationTime}</p>
          <p><strong>Timezone:</strong> ${device.timezone}</p>
          <p><strong>Last Seen:</strong> ${this.formatDate(device.lastSeen)}</p>
        </div>
        
        <div class="notification-preferences">
          <h5>Notification Preferences:</h5>
          <div class="preferences-grid">
            <label class="pref-item">
              <input type="checkbox" ${
                device.dailyRemindersEnabled ? "checked" : ""
              } 
                     data-pref="dailyReminders" data-device="${
                       device.deviceId
                     }">
              📅 Daily Reminders
            </label>
            <label class="pref-item">
              <input type="checkbox" ${
                device.communityNotificationsEnabled ? "checked" : ""
              } 
                     data-pref="communityNotifications" data-device="${
                       device.deviceId
                     }">
              🏘️ Community Messages
            </label>
            <label class="pref-item">
              <input type="checkbox" ${
                device.achievementNotificationsEnabled ? "checked" : ""
              } 
                     data-pref="achievementNotifications" data-device="${
                       device.deviceId
                     }">
              🏆 Achievement Alerts
            </label>
          </div>
        </div>
        
        <div class="device-actions">
          <button class="btn btn-sm btn-primary test-device-btn" data-device="${
            device.deviceId
          }">
            🔔 Test Notification
          </button>
          <button class="btn btn-sm btn-warning settings-device-btn" data-device="${
            device.deviceId
          }">
            ⚙️ Update Settings
          </button>
          <button class="btn btn-sm btn-danger remove-device-btn" data-device="${
            device.deviceId
          }">
            🗑️ Remove Device
          </button>
        </div>
      </div>
    `;
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

  async testNotification(deviceId) {
    this.showStatus("Sending test notification...", "info");

    try {
      const response = await fetch("/api/android/test-notification", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": this.getCSRFToken(),
        },
        body: JSON.stringify({ deviceId: deviceId }),
      });

      const data = await response.json();

      if (data.status === "success") {
        this.showStatus(`✅ ${data.message}`, "success");
      } else {
        this.showStatus(`❌ ${data.message}`, "error");
      }
    } catch (error) {
      console.error("Error sending test notification:", error);
      this.showStatus("❌ Error sending test notification", "error");
    }
  }

  async removeDevice(deviceId) {
    if (
      !confirm(
        "Are you sure you want to remove this device? You will no longer receive notifications on this device."
      )
    ) {
      return;
    }

    this.showStatus("Removing device...", "info");

    try {
      const response = await fetch("/api/android/unregister", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": this.getCSRFToken(),
        },
        body: JSON.stringify({ deviceId: deviceId }),
      });

      const data = await response.json();

      if (data.status === "success") {
        this.showStatus(`✅ ${data.message}`, "success");
        // Reload devices list
        await this.loadDevicesFromServer();
      } else {
        this.showStatus(`❌ ${data.message}`, "error");
      }
    } catch (error) {
      console.error("Error removing device:", error);
      this.showStatus("❌ Error removing device", "error");
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

  showAddDeviceModal() {
    // This would typically be called from Android app with device details
    if (this.isAndroidApp) {
      this.showStatus(
        "📱 Please register this device from your Android app",
        "info"
      );
    } else {
      this.showStatus(
        "🔔 Device registration is only available in the Android app",
        "warning"
      );
    }
  }

  showDeviceSettingsModal(deviceId) {
    // Create a simple modal for updating device settings
    const modal = document.createElement("div");
    modal.className = "settings-modal";
    modal.innerHTML = `
      <div class="modal-content">
        <h3>Device Settings</h3>
        <form id="device-settings-form">
          <div class="form-group">
            <label>Notification Time:</label>
            <input type="time" id="notification-time" name="notificationTime" required>
          </div>
          <div class="form-group">
            <label>Timezone:</label>
            <select id="timezone" name="timezone">
              <option value="UTC">UTC</option>
              <option value="America/New_York">Eastern Time</option>
              <option value="America/Chicago">Central Time</option>
              <option value="America/Denver">Mountain Time</option>
              <option value="America/Los_Angeles">Pacific Time</option>
            </select>
          </div>
          <div class="form-actions">
            <button type="submit" class="btn btn-primary">💾 Save Settings</button>
            <button type="button" class="btn btn-secondary close-modal">❌ Cancel</button>
          </div>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    // Handle form submission
    modal
      .querySelector("#device-settings-form")
      .addEventListener("submit", async (e) => {
        e.preventDefault();
        await this.updateDeviceSettings(deviceId, new FormData(e.target));
        document.body.removeChild(modal);
      });

    // Handle close
    modal.querySelector(".close-modal").addEventListener("click", () => {
      document.body.removeChild(modal);
    });
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

      // Show Android-specific message
      if (!this.isAndroidApp) {
        const androidMessage = document.createElement("div");
        androidMessage.className = "android-info-message";
        androidMessage.innerHTML = `
          <div class="info-banner">
            <h4>📱 Android Native App Required</h4>
            <p>Push notifications are now only available through our native Android app.</p>
            <p>Download the EcoTrack Android app to:</p>
            <ul>
              <li>✅ Receive reliable push notifications</li>
              <li>✅ Manage multiple devices</li>
              <li>✅ Customize notification preferences</li>
              <li>✅ Get real-time community updates</li>
            </ul>
          </div>
        `;
        notificationSection.insertBefore(
          androidMessage,
          notificationSection.firstChild
        );
      }
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

// Median OneSignal notification integration for Android/iOS app
// This handles notifications when the webapp is running inside the Median-converted app

class MedianNotificationManager {
  constructor() {
    this.isMedianApp = this.detectMedianApp();
    this.oneSignalPlayerId = null;
    this.isNativeSubscribed = false; // Track native OneSignal subscription state
    this.alwaysShowControls = true;

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

  detectMedianApp() {
    // Check if we're running in a Median-wrapped app
    return (
      navigator.userAgent.toLowerCase().includes("median") ||
      window.median !== undefined ||
      window.gonative !== undefined
    );
  }

  async init() {
    console.log("Median NotificationManager initializing...");
    console.log("Detected Median app:", this.isMedianApp);

    this.initializeElements();
    await this.loadNotificationSettings();

    if (this.isMedianApp) {
      await this.setupMedianIntegration();
    } else {
      this.showStatus(
        "This app is optimized for the native mobile app. Please download it from the app store.",
        "warning"
      );
    }

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
    // Force controls visible immediately
    if (this.timeSettingDiv) this.timeSettingDiv.style.display = "block";
    if (this.testBtn) this.testBtn.style.display = "inline-block";
    if (this.saveBtn) this.saveBtn.style.display = "inline-block";
    if (this.permissionBtn) this.permissionBtn.style.display = "inline-block";
    this.showStatus(
      "Loading notification settings... (you can still interact)",
      "info"
    );
  }

  async setupMedianIntegration() {
    // Wait for Median JavaScript Bridge to be available
    await this.waitForMedianBridge();

    // Get OneSignal info
    try {
      await this.getOneSignalInfo();

      // If not ready, start polling for up to 30s
      if (!this.oneSignalPlayerId || !this.isNativeSubscribed) {
        this.showStatus(
          "Waiting for device push registration… If this persists, clear Play Services data or reinstall.",
          "warning"
        );
        await this.pollOneSignalInfoUntilReady(30000, 2000);
      }

      if (this.oneSignalPlayerId && this.isNativeSubscribed) {
        this.showStatus("Native notifications are ready!", "success");
      } else if (this.oneSignalPlayerId && !this.isNativeSubscribed) {
        this.showStatus(
          "Device push not subscribed yet. Ensure notifications are enabled in Android settings.",
          "warning"
        );
      } else {
        this.showStatus(
          "No OneSignal player ID yet. Fix device push (FCM) to receive notifications.",
          "error"
        );
      }

      this.updateUIVisibility(true);
    } catch (error) {
      console.error("Failed to setup OneSignal:", error);
      this.showStatus(
        "Failed to setup native notifications. Please ensure notifications are enabled in your device settings.",
        "error"
      );
    }
  }

  waitForMedianBridge() {
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 50; // 5 seconds max wait

      const checkBridge = () => {
        attempts++;

        if (window.median && window.median.onesignal) {
          resolve();
        } else if (attempts >= maxAttempts) {
          reject(new Error("Median bridge not available after 5 seconds"));
        } else {
          setTimeout(checkBridge, 100);
        }
      };

      checkBridge();
    });
  }

  async getOneSignalInfo() {
    return new Promise((resolve, reject) => {
      try {
        // Method 1: Try onesignalInfo() -> Promise (recommended Median bridge API)
        if (
          window.median &&
          window.median.onesignal &&
          typeof window.median.onesignal.onesignalInfo === "function"
        ) {
          console.log("Using median.onesignal.onesignalInfo()");
          window.median.onesignal
            .onesignalInfo()
            .then((oneSignalInfo) => {
              this.handleOneSignalInfo(oneSignalInfo);
              resolve();
            })
            .catch((err) => {
              console.error("median.onesignal.onesignalInfo() failed", err);
              reject(err);
            });
          return;
        }

        // Method 2: Try direct synchronous access
        if (
          window.median &&
          window.median.onesignal &&
          window.median.onesignal.onesignalUserId
        ) {
          console.log("Using direct median.onesignal properties");
          const oneSignalInfo = {
            oneSignalUserId: window.median.onesignal.onesignalUserId,
            oneSignalSubscribed:
              window.median.onesignal.onesignalSubscribed || false,
          };
          this.handleOneSignalInfo(oneSignalInfo);
          resolve();
          return;
        }

        // Method 3: Try callback-based approach
        if (
          window.median &&
          window.median.onesignal &&
          typeof window.median.onesignal.info === "function"
        ) {
          console.log("Using median.onesignal.info() with callback");

          // Set up global callback
          window.median_onesignal_info = (oneSignalInfo) => {
            this.handleOneSignalInfo(oneSignalInfo);
            resolve();
          };

          // Try promise-based first
          const result = window.median.onesignal.info();
          if (result && typeof result.then === "function") {
            result
              .then((oneSignalInfo) => {
                this.handleOneSignalInfo(oneSignalInfo);
                resolve();
              })
              .catch((err) => {
                console.error("median.onesignal.info() promise failed", err);
                // Fallback to callback approach
                window.median.onesignal.info({
                  callback: "median_onesignal_info",
                });
                setTimeout(
                  () => reject(new Error("OneSignal info callback timeout")),
                  5000
                );
              });
          } else {
            // Direct callback approach
            window.median.onesignal.info({ callback: "median_onesignal_info" });
            setTimeout(
              () => reject(new Error("OneSignal info callback timeout")),
              5000
            );
          }
          return;
        }

        // No suitable API found
        console.error("No Median OneSignal bridge methods available");
        reject(new Error("Median OneSignal bridge not available"));
      } catch (error) {
        console.error("Exception in getOneSignalInfo:", error);
        reject(error);
      }
    });
  }

  handleOneSignalInfo(oneSignalInfo) {
    console.log("OneSignal Info:", oneSignalInfo);

    // Track native subscribed flag (if provided)
    if (
      oneSignalInfo &&
      typeof oneSignalInfo.oneSignalSubscribed === "boolean"
    ) {
      this.isNativeSubscribed = oneSignalInfo.oneSignalSubscribed;
      console.log("OneSignal Subscribed:", this.isNativeSubscribed);
    }

    // Median docs: onesignalInfo() returns { oneSignalUserId, oneSignalSubscribed, ... }
    if (oneSignalInfo && oneSignalInfo.oneSignalUserId) {
      this.oneSignalPlayerId = oneSignalInfo.oneSignalUserId;
      console.log("OneSignal Player ID:", this.oneSignalPlayerId);
      return;
    }

    // Fallbacks for alternate shapes
    if (oneSignalInfo && oneSignalInfo.oneSignalId) {
      this.oneSignalPlayerId = oneSignalInfo.oneSignalId;
      console.log("OneSignal Player ID (oneSignalId):", this.oneSignalPlayerId);
      return;
    }
    if (
      oneSignalInfo &&
      oneSignalInfo.subscription &&
      oneSignalInfo.subscription.id
    ) {
      this.oneSignalPlayerId = oneSignalInfo.subscription.id;
      console.log(
        "OneSignal Player ID (subscription.id):",
        this.oneSignalPlayerId
      );
      return;
    }
  }

  async loadNotificationSettings() {
    try {
      const response = await fetch("/api/notifications/settings");
      const data = await response.json();

      if (data.status === "success") {
        if (this.toggle) {
          this.toggle.checked = data.data.isSubscribed;
        }

        if (this.timeInput) {
          this.timeInput.value = data.data.notificationTime;
        }

        this.updateUIVisibility(data.data.isSubscribed);

        if (data.data.isSubscribed) {
          this.showStatus("Native notifications are enabled.", "success");
        } else {
          this.showStatus(
            "Enable native notifications to receive daily reminders.",
            "warning"
          );
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
          console.log("Toggle switched on, subscribing to OneSignal...");
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
  }

  async subscribeToNotifications() {
    if (!this.isMedianApp) {
      this.showStatus(
        "Native notifications are only available in the mobile app.",
        "error"
      );
      if (this.toggle) this.toggle.checked = false;
      return;
    }

    if (!this.oneSignalPlayerId) {
      await this.getOneSignalInfo();
    }

    if (!this.oneSignalPlayerId) {
      this.showStatus(
        "Unable to get OneSignal player ID. Please ensure notifications are enabled in device settings.",
        "error"
      );
      if (this.toggle) this.toggle.checked = false;
      return;
    }

    try {
      const notificationTime = this.timeInput ? this.timeInput.value : "09:00";

      const response = await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": this.getCSRFToken(),
        },
        body: JSON.stringify({
          oneSignalPlayerId: this.oneSignalPlayerId,
          deviceType: "median",
          notificationTime: notificationTime,
          provider: "onesignal",
        }),
      });

      const data = await response.json();

      if (data.status === "success") {
        this.showStatus(
          "Successfully subscribed to native notifications!",
          "success"
        );
        this.updateUIVisibility(true);
      } else {
        this.showStatus(`Failed to subscribe: ${data.message}`, "error");
        if (this.toggle) this.toggle.checked = false;
      }
    } catch (error) {
      console.error("Subscription error:", error);
      this.showStatus("Failed to subscribe to notifications.", "error");
      if (this.toggle) this.toggle.checked = false;
    }
  }

  async unsubscribeFromNotifications() {
    try {
      const response = await fetch("/api/notifications/unsubscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": this.getCSRFToken(),
        },
      });

      const data = await response.json();

      if (data.status === "success") {
        this.showStatus(
          "Successfully unsubscribed from notifications.",
          "success"
        );
        this.updateUIVisibility(false);
      } else {
        this.showStatus(`Failed to unsubscribe: ${data.message}`, "error");
      }
    } catch (error) {
      console.error("Unsubscription error:", error);
      this.showStatus("Failed to unsubscribe from notifications.", "error");
    }
  }

  async pollOneSignalInfoUntilReady(timeoutMs = 30000, intervalMs = 2000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        await this.getOneSignalInfo();
        if (this.oneSignalPlayerId) {
          // Update status each loop to reflect native subscribe state
          if (this.isNativeSubscribed) {
            this.showStatus("Native notifications are ready!", "success");
          } else {
            this.showStatus(
              "Device push not subscribed yet. Waiting for OneSignal/FCM…",
              "warning"
            );
          }
          if (this.isNativeSubscribed) return;
        }
      } catch (_) {
        // ignore and retry
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }

  async sendTestNotification() {
    if (!this.oneSignalPlayerId) {
      this.showStatus(
        "No OneSignal player ID available for test notification.",
        "error"
      );
      return;
    }
    if (!this.isNativeSubscribed) {
      this.showStatus(
        "Device is not fully subscribed to push yet. Test may not arrive.",
        "warning"
      );
    }

    try {
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
          "Test notification sent! Check your device.",
          "success"
        );
      } else {
        this.showStatus(
          `Failed to send test notification: ${data.message}`,
          "error"
        );
      }
    } catch (error) {
      console.error("Test notification error:", error);
      this.showStatus("Failed to send test notification.", "error");
    }
  }

  async updateNotificationTime() {
    const newTime = this.timeInput ? this.timeInput.value : "09:00";

    try {
      const response = await fetch("/api/notifications/update-time", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": this.getCSRFToken(),
        },
        body: JSON.stringify({
          notificationTime: newTime,
        }),
      });

      const data = await response.json();

      if (data.status === "success") {
        this.showStatus(`Notification time updated to ${newTime}`, "success");
      } else {
        this.showStatus(`Failed to update time: ${data.message}`, "error");
      }
    } catch (error) {
      console.error("Update time error:", error);
      this.showStatus("Failed to update notification time.", "error");
    }
  }

  showStatus(message, type = "info") {
    if (!this.statusDiv) return;

    this.statusDiv.textContent = message;
    this.statusDiv.className = `notification-status ${type}`;

    // Auto-hide success messages after 5 seconds
    if (type === "success") {
      setTimeout(() => {
        if (this.statusDiv.textContent === message) {
          this.statusDiv.textContent = "";
          this.statusDiv.className = "notification-status";
        }
      }, 5000);
    }
  }

  updateUIVisibility(isSubscribed) {
    if (this.alwaysShowControls) {
      if (this.timeSettingDiv) this.timeSettingDiv.style.display = "block";
      if (this.testBtn) this.testBtn.style.display = "inline-block";
      if (this.saveBtn) this.saveBtn.style.display = "inline-block";
      return;
    }
    if (this.timeSettingDiv)
      this.timeSettingDiv.style.display = isSubscribed ? "block" : "none";
    if (this.testBtn)
      this.testBtn.style.display = isSubscribed ? "inline-block" : "none";
  }

  getCSRFToken() {
    const cookieValue = document.cookie
      .split("; ")
      .find((row) => row.startsWith("csrftoken="))
      ?.split("=")[1];
    return cookieValue || "";
  }
}

// Global callback function for OneSignal info (called automatically by Median)
function median_onesignal_info(oneSignalInfo) {
  if (window.medianNotificationManager) {
    window.medianNotificationManager.handleOneSignalInfo(oneSignalInfo);
  }
}

// Function called when Median JavaScript Bridge is ready
function median_library_ready() {
  console.log("Median library ready");
  if (window.medianNotificationManager) {
    window.medianNotificationManager.setupMedianIntegration();
  }
}

// Initialize when DOM is ready (also if already loaded at dynamic import time)
function __initMedianNotifications() {
  if (!window.medianNotificationManager) {
    window.medianNotificationManager = new MedianNotificationManager();
    // If median bridge already present, trigger ready hook
    if (window.median && typeof window.median_library_ready === "function") {
      try {
        window.median_library_ready();
      } catch (e) {
        console.warn("Median library ready handler error", e);
      }
    }
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", __initMedianNotifications);
} else {
  __initMedianNotifications();
}

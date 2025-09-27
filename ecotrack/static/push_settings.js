// Simplified Push Notification Settings for Android WebView
// UI: single subscribe toggle, time input, Save button
// Integration: expects Kotlin WebView to expose window.Android.getFcmToken() and window.Android.getDeviceId()

(function () {
  class PushSettingsUI {
    constructor() {
      this.root = null;
      this.toggleEl = null;
      this.timeEl = null;
      this.saveBtn = null;
      this.statusEl = null;
      this.deviceId = null;
      this.fcmToken = null;
      this.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

      // Allow Kotlin to provide token/device asynchronously
      window.EcoTrackPush = {
        provideFcmToken: (token, deviceId) => {
          this.fcmToken = token || this.fcmToken;
          this.deviceId = deviceId || this.deviceId;
          // Once deviceId is known, try applying locally saved prefs for that device
          if (this.deviceId) this.applyLocalPrefs();
        },
        // Optional: Kotlin can call this after requesting notification permission
        onNotificationPermissionResult: (granted) => {
          if (granted) {
            this.toggleEl.checked = true;
            this.saveLocalPrefs({ enabled: true, time: this.timeEl?.value || "09:00" });
            this.registerDevice();
            this.status("Notification permission granted", "success");
          } else {
            this.toggleEl.checked = false;
            this.saveLocalPrefs({ enabled: false, time: this.timeEl?.value || "09:00" });
            this.status("Notification permission denied", "warning");
          }
        },
      };

      this.init();
    }

    isAndroidWebView() {
      return (
        !!window.Android ||
        navigator.userAgent.toLowerCase().includes("android")
      );
    }

    getCSRFToken() {
      const match = document.cookie.match(/csrftoken=([^;]+)/);
      return match ? match[1] : "";
    }

    async init() {
      this.mountUI();
      // Hide legacy complex UI if present
      const legacy = document.getElementById("android-devices-container");
      if (legacy) legacy.style.display = "none";

      // Obtain identifiers
      this.tryFetchFromAndroidBridge();
      if (!this.deviceId) this.ensureLocalDeviceId();

      // Apply any locally saved preferences immediately for instant UX
      this.applyLocalPrefs();

      await this.loadInitialState();
      this.bindEvents();
    }

    mountUI() {
      const host =
        document.querySelector(".android-notification-section") ||
        document.body;
      const root = document.createElement("div");
      root.id = "push-settings-root";
      root.className = "push-settings";
      root.innerHTML = `
        <div class="push-row">
          <label class="switch">
            <input type="checkbox" id="push-subscribe-toggle" />
            <span class="slider"></span>
          </label>
          <span class="switch-label">Enable daily notifications</span>
        </div>
        <div class="push-row">
          <label class="field-label" for="push-time-input">Daily time</label>
          <input id="push-time-input" type="time" value="09:00" class="time-input" />
        </div>
        <div class="push-row">
          <button id="push-save-btn" class="btn btn-primary">Save settings</button>
        </div>
        <div id="push-status" class="push-status"></div>
      `;
      host.prepend(root);
      this.root = root;
      this.toggleEl = root.querySelector("#push-subscribe-toggle");
      this.timeEl = root.querySelector("#push-time-input");
      this.saveBtn = root.querySelector("#push-save-btn");
      this.statusEl = root.querySelector("#push-status");
    }

    tryFetchFromAndroidBridge() {
      try {
        if (
          window.Android &&
          typeof window.Android.getFcmToken === "function"
        ) {
          this.fcmToken = window.Android.getFcmToken();
        }
        if (
          window.Android &&
          typeof window.Android.getDeviceId === "function"
        ) {
          this.deviceId = window.Android.getDeviceId();
        }
      } catch (e) {
        // ignore
      }
    }

    ensureLocalDeviceId() {
      try {
        let id = localStorage.getItem("et_device_id");
        if (!id) {
          id =
            "web_" +
            (crypto?.randomUUID
              ? crypto.randomUUID()
              : Date.now().toString(36));
          localStorage.setItem("et_device_id", id);
        }
        this.deviceId = id;
      } catch (_) {
        this.deviceId = "web_" + Date.now();
      }
    }

    // ---- Local persistence helpers ----
    storageKey() {
      return this.deviceId ? `et_push_prefs_${this.deviceId}` : "et_push_prefs";
    }

    loadLocalPrefs() {
      try {
        const raw = localStorage.getItem(this.storageKey());
        return raw ? JSON.parse(raw) : null;
      } catch (_) {
        return null;
      }
    }

    saveLocalPrefs({ enabled, time }) {
      try {
        const prev = this.loadLocalPrefs() || {};
        const next = {
          ...prev,
          enabled: typeof enabled === "boolean" ? enabled : prev.enabled,
          time: time || prev.time || "09:00",
          ts: Date.now(),
        };
        localStorage.setItem(this.storageKey(), JSON.stringify(next));
      } catch (_) {
        // ignore storage errors
      }
    }

    applyLocalPrefs() {
      const prefs = this.loadLocalPrefs();
      if (!prefs) return;
      if (typeof prefs.enabled === "boolean" && this.toggleEl) {
        this.toggleEl.checked = prefs.enabled;
      }
      if (prefs.time && this.timeEl) {
        this.timeEl.value = prefs.time;
      }
    }

    async loadInitialState() {
      try {
        const res = await fetch("/api/android/devices", {
          headers: { "X-CSRFToken": this.getCSRFToken() },
        });
        const data = await res.json();
        if (data.status !== "success") return;
        const devices = (data.data && data.data.devices) || data.devices || [];
        const current = devices.find(
          (d) => (d.deviceId || d.device_id) === this.deviceId
        );
        if (current) {
          const isActive = current.isActive ?? current.is_active ?? true;
          // Only override UI if no local preference has been saved yet
          const local = this.loadLocalPrefs();
          if (!local || typeof local.enabled !== "boolean") {
            this.toggleEl.checked = !!isActive;
          }
          const prefs =
            current.notificationPreferences ||
            current.notification_preferences ||
            {};
          const time = current.notificationTime || prefs.notification_time;
          if (time) {
            if (!local || !local.time) this.timeEl.value = time;
          }
        }
      } catch (e) {
        // noop
      }
    }

    bindEvents() {
      this.toggleEl.addEventListener("change", () => this.onToggleChange());
      this.saveBtn.addEventListener("click", () => this.onSave());
    }

    async onToggleChange() {
      const enabled = !!this.toggleEl.checked;
      // Persist immediately for UX; we'll correct if API fails
      this.saveLocalPrefs({ enabled, time: this.timeEl?.value || "09:00" });
      if (enabled) {
        // Subscribe/register
        if (!this.fcmToken) {
          this.status("Waiting for Android to provide FCM token...", "info");
          this.tryFetchFromAndroidBridge();
        }

        if (!this.fcmToken) {
          this.status(
            "No FCM token yet. Kotlin should call window.EcoTrackPush.provideFcmToken(token, deviceId).",
            "warning"
          );
          return;
        }
        try {
          if (window.Android && ("requestNotificationPermission" in window.Android)) {
            window.Android.requestNotificationPermission();
            this.status("Requesting notification permission...", "info");
            return; // wait for window.EcoTrackPush.onNotificationPermissionResult(...)
          }
        } catch (e) {
          console.warn("Android bridge call failed:", e);
        }

        await this.registerDevice();
      } else {
        // Unsubscribe/unregister
        await this.unregisterDevice();
      }
    }

    async onSave() {
      const time = this.timeEl.value || "09:00";
      const enabled = !!this.toggleEl.checked;
      // Persist locally regardless of server response
      this.saveLocalPrefs({ enabled, time });
      if (!this.deviceId) {
        this.status("Missing device id", "error");
        return;
      }
      try {
        const res = await fetch("/api/android/update-settings", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": this.getCSRFToken(),
          },
          body: JSON.stringify({
            deviceId: this.deviceId,
            notificationTime: time,
            dailyReminders: enabled,
            timezone: this.timezone,
          }),
        });
        const data = await res.json();
        if (data.status === "success") this.status("Settings saved", "success");
        else this.status(data.message || "Failed to save", "error");
      } catch (e) {
        this.status("Network error saving settings", "error");
      }
    }

    async registerDevice() {
      try {
        const payload = {
          fcmToken: this.fcmToken,
          deviceId: this.deviceId,
          appVersion:
            (window.Android && window.Android.getAppVersion?.()) || "webview",
          notificationTime: this.timeEl.value || "09:00",
          timezone: this.timezone,
          dailyRemindersEnabled: true,
        };
        const res = await fetch("/api/android/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": this.getCSRFToken(),
          },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (
          data.status === "success" ||
          data.success === true ||
          data.message?.includes("registered") ||
          data.message?.includes("updated")
        ) {
          this.status("Subscribed to notifications", "success");
        } else {
          this.toggleEl.checked = false;
          this.saveLocalPrefs({ enabled: false, time: this.timeEl?.value || "09:00" });
          this.status(data.message || "Failed to subscribe", "error");
        }
      } catch (e) {
        this.toggleEl.checked = false;
        this.saveLocalPrefs({ enabled: false, time: this.timeEl?.value || "09:00" });
        this.status("Network error subscribing", "error");
      }
    }

    async unregisterDevice() {
      try {
        const res = await fetch("/api/android/unregister", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": this.getCSRFToken(),
          },
          body: JSON.stringify({ deviceId: this.deviceId }),
        });
        const data = await res.json();
        if (data.status === "success") {
          this.status("Unsubscribed from notifications", "success");
        } else {
          this.status(data.message || "Failed to unsubscribe", "error");
        }
      } catch (e) {
        this.status("Network error unsubscribing", "error");
      }
      // Ensure local state reflects disabled
      this.saveLocalPrefs({ enabled: false, time: this.timeEl?.value || "09:00" });
    }

    status(msg, type = "info") {
      if (!this.statusEl) return;
      this.statusEl.textContent = msg;
      this.statusEl.className = `push-status ${type}`;
    }
  }

  // Initialize on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => new PushSettingsUI());
  } else {
    new PushSettingsUI();
  }
})();

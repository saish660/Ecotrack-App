// Firebase Cloud Messaging (FCM) Service Worker
// This service worker handles FCM background notifications

// Import Firebase messaging for service worker
importScripts(
  "https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js"
);

// Initialize Firebase in service worker
// Configuration will be fetched dynamically or you can hardcode it here
  const firebaseConfig = {
    apiKey: "AIzaSyD8bMKJ0WZr5s4ORRbN9nRNsU-FNFQIfCY",
    authDomain: "ecotrack-fcm.firebaseapp.com",
    projectId: "ecotrack-fcm",
    storageBucket: "ecotrack-fcm.firebasestorage.app",
    messagingSenderId: "61878000283",
    appId: "1:61878000283:web:0b2097baf6b0aa3749043e"
  };

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Retrieve Firebase Messaging object
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage(function (payload) {
  console.log("Received background message:", payload);

  const notificationTitle =
    payload.notification?.title || "EcoTrack Notification";
  const notificationOptions = {
    body:
      payload.notification?.body || "You have a new notification from EcoTrack",
    icon: "/static/icons/ecotrack_logo.png",
    badge: "/static/icons/favicon-32x32.png",
    tag: payload.data?.type || "ecotrack-notification",
    data: payload.data || { url: "/" },
    actions: [
      {
        action: "open_app",
        title: "Open EcoTrack",
        icon: "/static/icons/favicon-32x32.png",
      },
    ],
    requireInteraction: false,
    silent: false,
    vibrate: [200, 100, 200],
  };

  return self.registration.showNotification(
    notificationTitle,
    notificationOptions
  );
});

// Handle service worker installation
self.addEventListener("install", function (event) {
  console.log("FCM Service Worker installing...");
  self.skipWaiting();
});

// Handle service worker activation
self.addEventListener("activate", function (event) {
  console.log("FCM Service Worker activating...");
  event.waitUntil(self.clients.claim());
});

// Handle notification clicks
self.addEventListener("notificationclick", function (event) {
  console.log("Notification clicked:", event.notification.tag);

  // Close the notification
  event.notification.close();

  // Get the URL to open (default to home page)
  const urlToOpen = event.notification.data?.url || "/";

  // Handle action clicks
  if (event.action === "open_app") {
    // Open the app
    event.waitUntil(
      self.clients.matchAll({ type: "window" }).then(function (clientList) {
        // Check if the app is already open
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url.includes(urlToOpen) && "focus" in client) {
            return client.focus();
          }
        }

        // If not open, open a new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      })
    );
  } else {
    // Default click behavior - open or focus the app
    event.waitUntil(
      self.clients.matchAll({ type: "window" }).then(function (clientList) {
        // Check if the app is already open
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if ("focus" in client) {
            return client.focus();
          }
        }

        // If not open, open a new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      })
    );
  }
});

// Handle notification close
self.addEventListener("notificationclose", function (event) {
  console.log("Notification closed:", event.notification.tag);

  // You can track notification close events here
  // For analytics or user engagement tracking
});

// Handle messages from the main thread
self.addEventListener("message", function (event) {
  console.log("Service Worker received message:", event.data);

  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  // Handle Firebase config updates
  if (event.data && event.data.type === "UPDATE_FIREBASE_CONFIG") {
    console.log("Updating Firebase config in service worker");
    // Note: Firebase config update would require reinstalling the service worker
  }
});

// Handle sync events (for offline functionality)
self.addEventListener("sync", function (event) {
  if (event.tag === "background-sync") {
    console.log("Background sync triggered");
    // Handle background sync tasks here if needed
  }
});

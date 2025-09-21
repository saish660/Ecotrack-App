// Service Worker for Push Notifications
// This file handles background push notifications

self.addEventListener("install", function (event) {
  console.log("Service Worker installing...");
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  console.log("Service Worker activating...");
  event.waitUntil(self.clients.claim());
});

// Handle push messages
self.addEventListener("push", function (event) {
  console.log("Push message received", event);

  let notificationData = {
    title: "EcoTrack Notification",
    body: "You have a new message from EcoTrack",
    icon: "/static/icons/ecotrack_logo.png",
    badge: "/static/icons/favicon-32x32.png",
    tag: "ecotrack-notification",
    data: {
      url: "/",
      timestamp: Date.now(),
    },
  };

  // If push has data, parse it
  if (event.data) {
    try {
      const pushData = event.data.json();
      notificationData = {
        ...notificationData,
        ...pushData,
      };
    } catch (e) {
      console.error("Error parsing push data:", e);
    }
  }

  const promiseChain = self.registration.showNotification(
    notificationData.title,
    {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      tag: notificationData.tag,
      data: notificationData.data,
      actions: notificationData.actions || [],
      requireInteraction: false,
      silent: false,
      vibrate: [200, 100, 200],
    }
  );

  event.waitUntil(promiseChain);
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
          if (client.url === urlToOpen && "focus" in client) {
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

// Handle background sync (optional - for offline functionality)
self.addEventListener("sync", function (event) {
  if (event.tag === "background-sync") {
    console.log("Background sync triggered");
    // Handle background sync tasks here if needed
  }
});

// Handle messages from the main thread
self.addEventListener("message", function (event) {
  console.log("Service Worker received message:", event.data);

  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

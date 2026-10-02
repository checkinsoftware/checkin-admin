/* Firebase messaging service worker.
   The page registers this with the Firebase config in the query string, so no
   keys are hard-coded here. */
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

const params = new URLSearchParams(self.location.search);
const config = {
  apiKey: params.get("apiKey"),
  authDomain: params.get("authDomain"),
  projectId: params.get("projectId"),
  messagingSenderId: params.get("messagingSenderId"),
  appId: params.get("appId"),
};

if (config.projectId) {
  firebase.initializeApp(config);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const d = payload.data || {};
    const title = d.title || (payload.notification && payload.notification.title) || "CHECKIN";
    const body = d.body || (payload.notification && payload.notification.body) || "";
    const url = d.url || (d.smsId ? "/sms?hl=" + encodeURIComponent(d.smsId) : "/sms");
    self.registration.showNotification(title, {
      body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: d.smsId ? "ck-sms-" + d.smsId : undefined,
      data: { url },
    });
  });
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/sms";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      // Focus an already-open site tab and steer it to the SMS page, else open one.
      for (const client of list) {
        if (client.url.indexOf(self.location.origin) === 0 && "focus" in client) {
          if ("navigate" in client) { try { client.navigate(url); } catch (e) {} }
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

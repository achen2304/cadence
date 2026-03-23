/**
 * Client-side push notification subscription helpers.
 */

function isIOSStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "standalone" in window.navigator &&
    (window.navigator as Navigator & { standalone?: boolean }).standalone ===
      true
  );
}

export function isNotificationSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) {
    return "denied";
  }
  return Notification.requestPermission();
}

export async function isAlreadySubscribed(): Promise<boolean> {
  if (!isNotificationSupported()) return false;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  return subscription !== null;
}

export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!isNotificationSupported()) return null;

  const permission = await requestNotificationPermission();
  if (permission !== "granted") return null;

  const registration = await navigator.serviceWorker.ready;

  // Check for existing subscription first
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    console.error("NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set");
    return null;
  }

  // Convert VAPID key from base64url to ArrayBuffer
  const urlBase64ToArrayBuffer = (base64String: string): ArrayBuffer => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    const rawData = atob(base64);
    const buffer = new ArrayBuffer(rawData.length);
    const view = new Uint8Array(buffer);
    for (let i = 0; i < rawData.length; ++i) {
      view[i] = rawData.charCodeAt(i);
    }
    return buffer;
  };

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToArrayBuffer(vapidPublicKey),
  });

  // Send subscription to server
  await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription.toJSON()),
  });

  return subscription;
}

export { isIOSStandalone };

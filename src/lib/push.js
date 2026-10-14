import { api } from './api.js';

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

let registration = null;
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    registration = await navigator.serviceWorker.register('/sw.js');
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data?.type === 'navigate') window.dispatchEvent(new CustomEvent('gochat:navigate', { detail: e.data.url }));
    });
    return registration;
  } catch {
    return null;
  }
}

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

// Subscribe this device to push notifications (safe to call repeatedly)
export async function enablePush() {
  if (!pushSupported() || Notification.permission !== 'granted') return false;
  try {
    const reg = registration || (await navigator.serviceWorker.ready);
    const { publicKey } = await api('/push/key');
    if (!publicKey) return false;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
    }
    await api('/push/subscribe', { method: 'POST', body: { subscription: sub.toJSON() } });
    return true;
  } catch (e) {
    console.warn('Push subscription failed', e);
    return false;
  }
}

export async function disablePush() {
  try {
    const reg = registration || (await navigator.serviceWorker?.getRegistration());
    const sub = await reg?.pushManager.getSubscription();
    if (sub) {
      await api('/push/unsubscribe', { method: 'POST', body: { endpoint: sub.endpoint } }).catch(() => {});
      await sub.unsubscribe();
    }
  } catch { /* ignore */ }
}

// Show a notification through the service worker when possible (required on Android)
export async function showLocalNotification(title, options) {
  try {
    const reg = registration || (await navigator.serviceWorker?.getRegistration());
    if (reg) return reg.showNotification(title, options);
  } catch { /* fall back */ }
  try {
    const n = new Notification(title, options);
    n.onclick = () => { window.focus(); if (options?.data?.url) window.dispatchEvent(new CustomEvent('gochat:navigate', { detail: options.data.url })); n.close(); };
  } catch { /* unsupported */ }
  return null;
}

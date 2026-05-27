export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');

    console.log('Service worker registered:', registration.scope);
  } catch (error) {
    console.error('Service worker registration failed:', error);
  }
}
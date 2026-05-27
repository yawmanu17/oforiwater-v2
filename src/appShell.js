export function initAppShell() {
  bindAuthSwitching();
}

function bindAuthSwitching() {
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');

  document.getElementById('show-signup')?.addEventListener('click', () => {
    if (loginForm) loginForm.hidden = true;
    if (signupForm) signupForm.hidden = false;
  });

  document.getElementById('show-login')?.addEventListener('click', () => {
    if (signupForm) signupForm.hidden = true;
    if (loginForm) loginForm.hidden = false;
  });
}

export function showAuthView() {
  const auth = document.getElementById('auth-modal');
  const app = document.getElementById('main-app');

  if (auth) auth.hidden = false;
  if (app) app.hidden = true;
}

export function showAppView() {
  const auth = document.getElementById('auth-modal');
  const app = document.getElementById('main-app');

  if (auth) auth.hidden = true;
  if (app) app.hidden = false;
}

export function setUserLabel(label) {
  const el = document.getElementById('user-name');
  if (el) el.textContent = label || 'User';
}

export function setAppLoading(isLoading) {
  document.body.classList.toggle('is-loading', Boolean(isLoading));
}

export function showFatalError(message) {
  document.body.innerHTML = `
    <main class="fatal-error">
      <h1>OFORI Water startup error</h1>
      <p>${escapeHtml(message)}</p>
      <p>Open the browser console for details.</p>
    </main>
  `;
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char]));
}
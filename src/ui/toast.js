const TOAST_ROOT_ID = 'toast-root';

export function initToastRoot() {
  if (document.getElementById(TOAST_ROOT_ID)) return;

  const root = document.createElement('div');
  root.id = TOAST_ROOT_ID;
  root.className = 'toast-root';
  document.body.appendChild(root);
}

export function showToast(message, type = 'info') {
  initToastRoot();

  const root = document.getElementById(TOAST_ROOT_ID);
  const toast = document.createElement('div');

  toast.className = `toast toast-${type}`;
  toast.textContent = message;

  root.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('show');
  }, 20);

  setTimeout(() => {
    toast.classList.remove('show');

    setTimeout(() => {
      toast.remove();
    }, 250);
  }, 3500);
}

export function showSuccess(message) {
  showToast(message, 'success');
}

export function showError(message) {
  showToast(message, 'error');
}

export function showInfo(message) {
  showToast(message, 'info');
}

export function showWarning(message) {
  showToast(message, 'warning');
}
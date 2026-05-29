const TOAST_ROOT_ID = 'toast-root';

export function initToastRoot() {
  if (document.getElementById(TOAST_ROOT_ID)) return;

  const root = document.createElement('div');

  root.id = TOAST_ROOT_ID;
  root.className = 'toast-root';

  document.body.appendChild(root);
}

export function showToast(
  message,
  type = 'info',
  options = {}
) {
  initToastRoot();

  const {
    duration = 3500,
    closable = true,
    title = ''
  } = options;

  const root = document.getElementById(TOAST_ROOT_ID);

  const toast = document.createElement('div');

  toast.className = `toast toast-${type}`;

  toast.innerHTML = `
    <div class="toast-inner">
      <div class="toast-icon">
        ${iconForType(type)}
      </div>

      <div class="toast-content">
        ${title
          ? `<div class="toast-title">${escapeHtml(title)}</div>`
          : ''
        }

        <div class="toast-message">
          ${escapeHtml(message)}
        </div>
      </div>

      ${
        closable
          ? `
          <button class="toast-close-btn" type="button">
            ×
          </button>
        `
          : ''
      }
    </div>
  `;

  root.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  const close = () => {
    toast.classList.remove('show');

    setTimeout(() => {
      toast.remove();
    }, 250);
  };

  if (closable) {
    toast
      .querySelector('.toast-close-btn')
      ?.addEventListener('click', close);
  }

  const timer = setTimeout(close, duration);

  toast.addEventListener('mouseenter', () => {
    clearTimeout(timer);
  });
}

export function showSuccess(message, options = {}) {
  showToast(message, 'success', options);
}

export function showError(message, options = {}) {
  showToast(message, 'error', options);
}

export function showInfo(message, options = {}) {
  showToast(message, 'info', options);
}

export function showWarning(message, options = {}) {
  showToast(message, 'warning', options);
}

function iconForType(type) {
  const icons = {
    success: '✓',
    error: '⚠',
    warning: '!',
    info: 'ℹ'
  };

  return icons[type] || 'ℹ';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char]));
}
import './styles/app.css';
import './styles/dashboard.css';
import './styles/field.css';
import './styles/map.css';
import './styles/modules.css';
import './styles/professional.css';
import './styles/workspace.css';

import { initToastRoot } from './ui/toast.js';
import { initAppShell, showFatalError } from './appShell.js';
import { initAuth } from './auth/auth.js';
import { initDashboard } from './dashboard/dashboard.js';

let dashboardInitialized = false;

async function safeInitDashboard() {
  if (dashboardInitialized) return;

  dashboardInitialized = true;

  try {
    await initDashboard();
  } catch (error) {
    dashboardInitialized = false;
    throw error;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    initToastRoot();
    initAppShell();

    document.addEventListener('click', (event) => {
      const button = event.target.closest('button');

      if (button) {
        window.setTimeout(() => {
          button.blur();
        }, 0);
      }
    });

    window.addEventListener('ofori:auth-ready', safeInitDashboard);

    await initAuth();
  } catch (error) {
    console.error('OFORI startup failed:', error);
    showFatalError(error?.message || 'Application failed to start.');
  }
});
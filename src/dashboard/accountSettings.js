import { authState } from '../auth/auth.js';
import { supabase } from '../supabase/client.js';
import { updateProfile } from '../supabase/profiles.js';

export async function initAccountSettingsUi(rootId = 'dashboard-module-root') {
  const root = document.getElementById(rootId);

  if (!root || !authState.profile || !authState.utility) return;

  const profile = authState.profile;
  const utility = authState.utility;

  root.innerHTML = `
    <section class="module-page">
      <div class="module-toolbar">
        <div class="module-title-block">
          <div class="module-eyebrow">User Account</div>
          <h2>My Account</h2>
          <p>Review your profile, utility access, role, and password options.</p>
        </div>
      </div>

      <div class="module-workspace">
        <section class="module-panel">
          <div class="module-panel-header">
            <div>
              <h3 class="module-panel-title">Profile Details</h3>
              <p class="module-panel-subtitle">
                This information identifies you inside your utility workspace.
              </p>
            </div>
          </div>

          <div class="form-grid">
            <label>Full Name
              <input id="account-full-name" value="${safe(profile.full_name || '')}" />
            </label>

            <label>Email
              <input value="${safe(profile.email || '')}" disabled />
            </label>

            <label>Role
              <input value="${safe(roleLabel(profile.role))}" disabled />
            </label>

            <label>Utility
              <input value="${safe(utility.name || '')}" disabled />
            </label>

            <label>Status
              <input value="${profile.active ? 'Active' : 'Inactive'}" disabled />
            </label>
          </div>

          <div class="button-row">
            <button id="save-account-profile-btn" class="btn-primary" type="button">
              Save Profile
            </button>

            <button id="send-password-reset-btn" class="btn-secondary" type="button">
              Send Password Reset
            </button>
          </div>
        </section>

        <section class="module-panel inspector-panel">
          <div class="module-panel-header">
            <div>
              <h3 class="module-panel-title">Access Summary</h3>
              <p class="module-panel-subtitle">
                Your visible tabs are controlled by your assigned role.
              </p>
            </div>
          </div>

          <div class="mini-card">
            <strong>${safe(roleLabel(profile.role))}</strong>
            <p>${safe(roleDescription(profile.role))}</p>
          </div>
        </section>
      </div>
    </section>
  `;

  wireEvents(rootId);
}

function wireEvents(rootId) {
  document.getElementById('save-account-profile-btn')?.addEventListener('click', async () => {
    const fullName = val('account-full-name');

    if (!fullName) {
      alert('Full name is required.');
      return;
    }

    const updated = await updateProfile(authState.profile.id, {
      full_name: fullName
    });

    authState.profile = updated;

    alert('Profile updated.');

    await initAccountSettingsUi(rootId);
  });

  document.getElementById('send-password-reset-btn')?.addEventListener('click', async () => {
    const { error } = await supabase.auth.resetPasswordForEmail(authState.profile.email, {
      redirectTo: window.location.origin
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert('Password reset email sent.');
  });
}

function roleLabel(role = '') {
  const labels = {
    admin: 'Admin',
    supervisor: 'Supervisor',
    meter_reader: 'Meter Reader',
    billing: 'Billing',
    nrw_analyst: 'NRW Analyst'
  };

  return labels[role] || role || 'User';
}

function roleDescription(role = '') {
  const descriptions = {
    admin: 'Full platform access including utility setup, team management, billing, GIS, reports, and audit tools.',
    supervisor: 'Operational access for customers, routes, field reads, GIS, assets, NRW, and reports.',
    meter_reader: 'Field access for customers, meter reads, routes, map, calibration, and offline queue.',
    billing: 'Billing and revenue access for customers, adjustments, receipts, and reports.',
    nrw_analyst: 'NRW and GIS-focused access for analyzing water loss, DMAs, assets, and reports.'
  };

  return descriptions[role] || 'Standard utility user access.';
}

function val(id) {
  return document.getElementById(id)?.value?.trim() || '';
}

function safe(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char]));
}
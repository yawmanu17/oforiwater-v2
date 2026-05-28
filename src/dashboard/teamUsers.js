import { authState } from '../auth/auth.js';
import {
  getProfilesByUtility,
  getStaffInvitesByUtility,
  createStaffInvite,
  updateProfile
} from '../supabase/profiles.js';
import { sendStaffInviteEmail } from '../supabase/email.js';

let profiles = [];
let invites = [];

export async function initTeamUsersUi(rootId = 'dashboard-module-root') {
  const root = document.getElementById(rootId);
  const utility = authState.utility;

  if (!root || !utility?.id) return;

  await loadTeamData();

  root.innerHTML = `
    <section class="module-page">
      <div class="module-toolbar">
        <div class="module-title-block">
          <h2>Team / Users</h2>
          <p>
            Invite staff using company email addresses and assign access roles for utility operations.
          </p>
        </div>
      </div>

      <div class="module-kpis">
        <div class="kpi-card">
          <div class="kpi-label">Active Users</div>
          <div class="kpi-value">${profiles.filter((p) => p.active).length}</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-label">Pending Invites</div>
          <div class="kpi-value">${invites.filter((i) => i.status === 'pending').length}</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-label">Admins</div>
          <div class="kpi-value">${profiles.filter((p) => p.role === 'admin').length}</div>
        </div>
      </div>

      <div class="module-workspace">
        <section class="module-panel">
          <div class="module-panel-header">
            <div>
              <h3 class="module-panel-title">Invite Staff</h3>
              <p class="module-panel-subtitle">
                Staff will sign up using their own company email and password.
              </p>
            </div>
          </div>

          <div class="form-grid">
            <label>Full Name
              <input id="invite-full-name" placeholder="Jane Doe" />
            </label>

            <label>Company Email
              <input id="invite-email" type="email" placeholder="jane@utility.com" />
            </label>

            <label>Role
              <select id="invite-role">
                <option value="meter_reader">Meter Reader</option>
                <option value="supervisor">Supervisor</option>
                <option value="billing">Billing</option>
                <option value="nrw_analyst">NRW Analyst</option>
                <option value="admin">Admin</option>
              </select>
            </label>
          </div>

          <div class="button-row">
            <button id="create-invite-btn" class="btn-primary" type="button">
              Create Invite
            </button>
          </div>

          <div style="margin-top:1rem;">
            <h3 class="module-panel-title">Pending Invites</h3>
            <div id="invite-list">${inviteListHtml()}</div>
          </div>
        </section>

        <section class="module-panel inspector-panel">
          <div class="module-panel-header">
            <div>
              <h3 class="module-panel-title">Utility Staff</h3>
              <p class="module-panel-subtitle">
                Active users linked to this utility.
              </p>
            </div>
          </div>

          <div id="staff-list">${staffListHtml()}</div>
        </section>
      </div>
    </section>
  `;

  wireEvents(rootId);
}

async function loadTeamData() {
  const utilityId = authState.utility.id;

  [profiles, invites] = await Promise.all([
    getProfilesByUtility(utilityId),
    getStaffInvitesByUtility(utilityId)
  ]);
}

function inviteListHtml() {
  const pending = invites.filter((invite) => invite.status === 'pending');

  if (!pending.length) {
    return `<div class="module-empty">No pending invites.</div>`;
  }

  return `
    <div class="compact-list">
      ${pending.map((invite) => `
        <div class="mini-card">
          <strong>${safe(invite.full_name || invite.email)}</strong><br />
          <small>
            ${safe(invite.email)} • ${roleLabel(invite.role)}
          </small>
        </div>
      `).join('')}
    </div>
  `;
}

function staffListHtml() {
  if (!profiles.length) {
    return `<div class="module-empty">No staff users yet.</div>`;
  }

  return `
    <div class="compact-list">
      ${profiles.map((profile) => `
        <div class="mini-card">
          <strong>${safe(profile.full_name || profile.email)}</strong><br />
          <small>
            ${safe(profile.email)}
            • ${roleLabel(profile.role)}
          </small>

          <div style="margin-top:.55rem;">
            <span class="status-badge ${profile.active ? 'status-ok' : 'status-bad'}">
              ${profile.active ? 'Active' : 'Inactive'}
            </span>
          </div>

          <div class="button-row">
            <button
              class="btn-secondary toggle-user-btn"
              type="button"
              data-profile-id="${safe(profile.id)}"
              data-active="${profile.active ? 'true' : 'false'}"
            >
              ${profile.active ? 'Deactivate' : 'Activate'}
            </button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function wireEvents(rootId) {
  document.getElementById('create-invite-btn')?.addEventListener('click', async () => {
    const email = val('invite-email').toLowerCase();
    const fullName = val('invite-full-name');
    const role = val('invite-role');

    if (!email || !role) {
      alert('Email and role are required.');
      return;
    }

      const duplicateInvite = invites.find((invite) =>
      invite.status === 'pending' &&
      invite.email.toLowerCase() === email.toLowerCase()
    );

    if (duplicateInvite) {
      alert('A pending invite already exists for this email.');
      return;
    }
    
    await createStaffInvite({
    utility_id: authState.utility.id,
    email,
    full_name: fullName,
    role,
    status: 'pending',
    invited_by: authState.profile.id
    });

    try {
  await createStaffInvite({
    utility_id: authState.utility.id,
    email,
    full_name: fullName,
    role,
    status: 'pending',
    invited_by: authState.profile.id
  });

  await sendStaffInviteEmail({
    email,
    fullName,
    role,
    utilityName: authState.utility.name
  });

  alert('Staff invite created and email sent.');

  await initTeamUsersUi(rootId);
} catch (error) {

  console.error('Invite failed:', error);
  alert(error.message || 'Staff invite failed.');
}
  });

  document.querySelectorAll('.toggle-user-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      const isActive = button.dataset.active === 'true';

      await updateProfile(button.dataset.profileId, {
        active: !isActive
      });

      await initTeamUsersUi(rootId);
    });
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
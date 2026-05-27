import { supabase } from '../supabase/client.js';

import {
  showAuthView,
  showAppView,
  setUserLabel
} from '../appShell.js';
import {
  getPendingInviteByEmail,
  markInviteAccepted
} from '../supabase/profiles.js';

export const authState = {
  user: null,
  profile: null,
  utility: null,
  loading: false
};

const DEFAULT_ROLE = 'meter_reader';

export async function initAuth() {
  wireAuthForms();

  const { data, error } = await supabase.auth.getSession();

  if (error || !data?.session?.user) {
    resetAuthState();
    showAuthView();
    return;
  }

  await handleAuthenticatedUser(data.session.user);

  supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT' || !session?.user) {
    resetAuthState();
    showAuthView();
    return;
  }

  if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
    setTimeout(() => {
      handleAuthenticatedUser(session.user);
    }, 0);
  }
});
}

function wireAuthForms() {
  const loginForm = document.getElementById('login-form-element');
  const signupForm = document.getElementById('signup-form-element');
  const logoutBtn = document.getElementById('logout-btn');

  loginForm?.addEventListener('submit', handleLogin);
  signupForm?.addEventListener('submit', handleSignup);
  logoutBtn?.addEventListener('click', handleLogout);
}

async function handleLogin(event) {
  event.preventDefault();

  const email = getInputValue('login-email');
  const password = getInputValue('login-password');

  if (!email || !password) {
    alert('Please enter your email and password.');
    return;
  }

  setAuthLoading(true);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  setAuthLoading(false);

  if (error) {
    alert(error.message);
    return;
  }

  if (data?.user) {
    await handleAuthenticatedUser(data.user);
  }
}

async function handleSignup(event) {
  event.preventDefault();

  const fullName = getInputValue('signup-name');
  const email = getInputValue('signup-email');
  const password = getInputValue('signup-password');
  const role = getInputValue('signup-role') || DEFAULT_ROLE;

  const utilityName = getInputValue('signup-utility-name');
  const legalName = getInputValue('signup-utility-legal-name');
  const utilityState = getInputValue('signup-utility-state');
  const utilityPhone = getInputValue('signup-utility-phone');
  const utilityBillingEmail = getInputValue('signup-utility-billing-email');
  const utilityAddress = getInputValue('signup-utility-address');
  const utilityWebsite = getInputValue('signup-utility-website');
    const utilitySupportEmail = getInputValue('signup-utility-support-email');
    const utilityPrimaryColor = getInputValue('signup-utility-primary-color');
    const utilitySecondaryColor = getInputValue('signup-utility-secondary-color');
    const utilityLogoUrl = getInputValue('signup-utility-logo-url');

  if (!fullName || !email || !password || !utilityName) {
  alert('Please complete all required fields.');
  return;
}

  if (password.length < 8) {
    alert('Password must be at least 8 characters.');
    return;
  }

  setAuthLoading(true);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role
      }
    }
  });

  setAuthLoading(false);

  if (error) {
    alert(error.message);
    return;
  }

  if (!data?.user || !data?.session) {
    alert('Account created. Please confirm your email, then sign in.');
    showAuthView();
    return;
  }

  await handleAuthenticatedUser(data.user, {
  full_name: fullName,
  role: 'admin',
  utility_signup: true,
  utility_name: utilityName,
  utility_legal_name: legalName,
  utility_state: utilityState,
  utility_phone: utilityPhone,
  utility_billing_email: utilityBillingEmail,
  utility_support_email: utilitySupportEmail,
  utility_website: utilityWebsite,
  utility_address: utilityAddress,
  utility_primary_color: utilityPrimaryColor,
  utility_secondary_color: utilitySecondaryColor,
  utility_logo_url: utilityLogoUrl
});
}

async function handleLogout() {
  setAuthLoading(true);
  await supabase.auth.signOut();
  setAuthLoading(false);

  resetAuthState();
  showAuthView();
}

async function handleAuthenticatedUser(user, extraProfileData = {}) {
  try {
    authState.user = user;

    const profile = await getOrCreateProfile(user, extraProfileData);
    authState.profile = profile;

    const utility = await getUtilityById(profile.utility_id);
    authState.utility = utility;

    setUserLabel(profile.full_name || user.email);
    showAppView();
    window.dispatchEvent(new CustomEvent('ofori:auth-ready'));
  } catch (error) {
    console.error('Authenticated user setup failed:', error);

    await supabase.auth.signOut();
    resetAuthState();

    alert(
      'Login worked, but the application profile could not be loaded. ' +
      error.message
    );

    showAuthView();
  }
}

async function getOrCreateProfile(user, extra = {}) {
  const { data: existingProfile, error: selectError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  if (existingProfile) {
    return existingProfile;
  }

  const pendingInvite = await getPendingInviteByEmail(user.email);

  const utilityId = pendingInvite
    ? pendingInvite.utility_id
    : extra.utility_signup
      ? (await createUtilityForSignup(extra)).id
      : await getDefaultUtilityId();

  const role = pendingInvite
    ? pendingInvite.role
    : extra.role || user.user_metadata?.role || DEFAULT_ROLE;

  const payload = {
    id: user.id,
    utility_id: utilityId,
    full_name:
      pendingInvite?.full_name ||
      extra.full_name ||
      user.user_metadata?.full_name ||
      user.email,
    email: user.email,
    role,
    active: true
  };

  const { data, error } = await supabase
    .from('profiles')
    .insert(payload)
    .select('*')
    .single();

  if (error) {
    throw error;
  }

  if (pendingInvite) {
    await markInviteAccepted(pendingInvite.id);
  }

  return data;
}

async function createUtilityForSignup(extra = {}) {
  const utilityName = extra.utility_name;

  if (!utilityName) {
    throw new Error('Utility name is required.');
  }

  const slugBase = utilityName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const { data, error } = await supabase
  .from('utilities')
  .insert({
    name: utilityName,
    legal_name: extra.utility_legal_name || utilityName,
    slug: `${slugBase}-${Date.now()}`,

    state: extra.utility_state || '',
    phone: extra.utility_phone || '',

    billing_email: extra.utility_billing_email || '',
    support_email: extra.utility_support_email || '',

    website: extra.utility_website || '',

    address: extra.utility_address || '',

    primary_color:
      extra.utility_primary_color || '#06b6d4',

    secondary_color:
      extra.utility_secondary_color || '#1a4b66',

    logo_url:
      extra.utility_logo_url || ''
  })
  .select('*')
  .single();

  if (error) throw error;

  return data;
}

async function getDefaultUtilityId() {
  const { data, error } = await supabase
    .from('utilities')
    .select('id')
    .eq('slug', 'ofori-demo')
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data?.id) {
    throw new Error(
      'Default utility not found. Please insert the OFORI demo utility in Supabase first.'
    );
  }

  return data.id;
}

async function getUtilityById(utilityId) {
  if (!utilityId) {
    throw new Error('Profile is missing utility_id.');
  }

  const { data, error } = await supabase
    .from('utilities')
    .select('*')
    .eq('id', utilityId)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

function resetAuthState() {
  authState.user = null;
  authState.profile = null;
  authState.utility = null;
}

function setAuthLoading(isLoading) {
  authState.loading = isLoading;

  const buttons = document.querySelectorAll(
    '#login-form-element button, #signup-form-element button, #logout-btn'
  );

  buttons.forEach((button) => {
    button.disabled = isLoading;
  });
}

function getInputValue(id) {
  const element = document.getElementById(id);
  return element?.value?.trim() || '';
}
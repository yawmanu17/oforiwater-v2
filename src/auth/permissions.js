export const ROLE_PERMISSIONS = {
admin: [
  'dashboard',
  'utility',
  'customers',
  'field',
  'map',
  'assets',
  'billing',
  'adjustments',
  'billing_reports',
  'meter_calibration',
  'routes',
  'analytics',
  'nrw',
  'audit',
  'data',
  'offline_queue',
  'team',
  'account'
],

supervisor: [
  'dashboard',
  'utility',
  'customers',
  'field',
  'map',
  'assets',
  'billing',
  'adjustments',
  'billing_reports',
  'meter_calibration',
  'routes',
  'analytics',
  'nrw',
  'audit',
  'data',
  'offline_queue',
  'team'
],

meter_reader: [
  'customers',
  'field',
  'meter_calibration',
  'routes',
  'map',
  'offline_queue'
],

  billing: [
    'customers',
    'billing',
    'adjustments',
    'billing_reports',
    'analytics'
  ],

  nrw_analyst: [
    'customers',
    'field',
    'map',
    'assets',
    'nrw'
  ]
};

export function canAccessTab(role, tab) {
  const permissions = ROLE_PERMISSIONS[role] || [];
  return permissions.includes(tab);
}

export function getAllowedTabs(role) {
  return ROLE_PERMISSIONS[role] || [];
}
export function canAccessTab(role, tabId) {
  return getAllowedTabs(role).includes(tabId);
}

export function requireTabAccess(tabId) {
  const role = window.OFORI_AUTH_ROLE;

  if (!role || !canAccessTab(role, tabId)) {
    throw new Error('You do not have permission to access this module.');
  }

  return true;
}
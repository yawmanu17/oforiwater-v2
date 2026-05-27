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
  'team'
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
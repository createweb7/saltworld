// Salt World BOS — Roles & Permissions
// Single source of truth. Every write endpoint & <Can /> guard reads from here.

export const PERMISSIONS = {
  DASHBOARD_VIEW:        'dashboard:view',

  CUSTOMERS_VIEW:        'customers:view',
  CUSTOMERS_EDIT:        'customers:edit',
  CUSTOMERS_MEDICAL:     'customers:medical',

  BOOKINGS_VIEW:         'bookings:view',
  BOOKINGS_EDIT:         'bookings:edit',
  BOOKINGS_CALENDAR:     'bookings:calendar',

  RECEPTION_USE:         'reception:use',

  SERVICES_VIEW:         'services:view',
  SERVICES_EDIT:         'services:edit',

  MEMBERSHIPS_VIEW:      'memberships:view',
  MEMBERSHIPS_EDIT:      'memberships:edit',

  GIFTCARDS_VIEW:        'giftcards:view',
  GIFTCARDS_ISSUE:       'giftcards:issue',
  GIFTCARDS_REDEEM:      'giftcards:redeem',

  PRODUCTS_VIEW:         'products:view',
  PRODUCTS_EDIT:         'products:edit',

  PAYMENTS_VIEW:         'payments:view',
  PAYMENTS_COLLECT:      'payments:collect',
  PAYMENTS_REFUND:       'payments:refund',

  INVOICES_VIEW:         'invoices:view',

  REPORTS_VIEW:          'reports:view',
  REPORTS_MARKETING:     'reports:marketing',
  REPORTS_ALL:           'reports:all',

  MARKETING_EDIT:        'marketing:edit',
  CMS_EDIT:              'cms:edit',
  NOTIFICATIONS_EDIT:    'notifications:edit',

  SETTINGS_VIEW:         'settings:view',
  SETTINGS_EDIT_BRAND:   'settings:edit_brand',
  SETTINGS_EDIT_USERS:   'settings:edit_users',

  ACTIVITY_VIEW:         'activity:view',
};

export const ROLES = {
  super_admin: {
    key: 'super_admin',
    label: 'Super Admin',
    description: 'Full access. Only role that can manage users, roles and API keys.',
    permissions: '*', // wildcard
  },
  manager: {
    key: 'manager',
    label: 'Manager',
    description: 'Runs the day-to-day. Everything except user/role management.',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.CUSTOMERS_VIEW, PERMISSIONS.CUSTOMERS_EDIT, PERMISSIONS.CUSTOMERS_MEDICAL,
      PERMISSIONS.BOOKINGS_VIEW, PERMISSIONS.BOOKINGS_EDIT, PERMISSIONS.BOOKINGS_CALENDAR,
      PERMISSIONS.RECEPTION_USE,
      PERMISSIONS.SERVICES_VIEW, PERMISSIONS.SERVICES_EDIT,
      PERMISSIONS.MEMBERSHIPS_VIEW, PERMISSIONS.MEMBERSHIPS_EDIT,
      PERMISSIONS.GIFTCARDS_VIEW, PERMISSIONS.GIFTCARDS_ISSUE, PERMISSIONS.GIFTCARDS_REDEEM,
      PERMISSIONS.PRODUCTS_VIEW, PERMISSIONS.PRODUCTS_EDIT,
      PERMISSIONS.PAYMENTS_VIEW, PERMISSIONS.PAYMENTS_COLLECT, PERMISSIONS.PAYMENTS_REFUND,
      PERMISSIONS.INVOICES_VIEW,
      PERMISSIONS.REPORTS_VIEW, PERMISSIONS.REPORTS_ALL, PERMISSIONS.REPORTS_MARKETING,
      PERMISSIONS.MARKETING_EDIT, PERMISSIONS.CMS_EDIT, PERMISSIONS.NOTIFICATIONS_EDIT,
      PERMISSIONS.SETTINGS_VIEW, PERMISSIONS.SETTINGS_EDIT_BRAND,
      PERMISSIONS.ACTIVITY_VIEW,
    ],
  },
  reception: {
    key: 'reception',
    label: 'Reception',
    description: 'Check-ins, walk-ins, POS. No reports.',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.CUSTOMERS_VIEW, PERMISSIONS.CUSTOMERS_EDIT,
      PERMISSIONS.BOOKINGS_VIEW, PERMISSIONS.BOOKINGS_EDIT, PERMISSIONS.BOOKINGS_CALENDAR,
      PERMISSIONS.RECEPTION_USE,
      PERMISSIONS.GIFTCARDS_ISSUE, PERMISSIONS.GIFTCARDS_REDEEM,
      PERMISSIONS.PAYMENTS_COLLECT, PERMISSIONS.INVOICES_VIEW,
    ],
  },
  marketing: {
    key: 'marketing',
    label: 'Marketing',
    description: 'Campaigns, CMS, reviews, popups, marketing analytics.',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.CUSTOMERS_VIEW,
      PERMISSIONS.MARKETING_EDIT, PERMISSIONS.CMS_EDIT, PERMISSIONS.NOTIFICATIONS_EDIT,
      PERMISSIONS.REPORTS_MARKETING,
    ],
  },
};

export const ROLE_LIST = Object.values(ROLES);

export function hasPermission(user, needed) {
  if (!user) return false;
  const list = expandPermissions(user);
  if (list === '*') return true;
  if (Array.isArray(needed)) return needed.every((p) => list.includes(p));
  return list.includes(needed);
}

export function hasAny(user, list) {
  if (!user) return false;
  const perms = expandPermissions(user);
  if (perms === '*') return true;
  return list.some((p) => perms.includes(p));
}

export function expandPermissions(user) {
  const overrides = Array.isArray(user?.permissions) ? user.permissions : [];
  const role = ROLES[user?.role];
  if (!role) return overrides;
  if (role.permissions === '*') return '*';
  return Array.from(new Set([...role.permissions, ...overrides]));
}

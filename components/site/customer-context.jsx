'use client';

// Customer identity, sourced once server-side (root layout reads the
// session cookie) and handed down via context — so the header avatar
// renders correct on first paint instead of flashing a loading skeleton
// after a client-side /api/customer/me fetch. Sign-in/out both do a full
// page navigation (see auth-widget.jsx + account/login), so this value is
// always re-derived fresh from the server on the very next paint; no
// client-side refetch is needed.

import { createContext, useContext } from 'react';

const CustomerContext = createContext(null);

export function CustomerProvider({ initialCustomer, children }) {
  return (
    <CustomerContext.Provider value={initialCustomer || null}>
      {children}
    </CustomerContext.Provider>
  );
}

export function useCustomer() {
  return useContext(CustomerContext);
}

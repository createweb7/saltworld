// Admin layout is intentionally minimal. Individual pages compose <AdminShell />.
// We keep the customer-site fonts + providers via the root layout.

export const metadata = {
  title: 'Salt World · BOS',
  description: 'Salt World Business Operating System',
};

export default function AdminLayout({ children }) {
  return children;
}

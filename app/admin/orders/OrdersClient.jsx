'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import AdminShell, { PageHeader, AdminSection } from '@/components/admin/shell';
import {
  SimpleTable, Drawer, Field, Input, Select,
  PrimaryBtn, GhostBtn, inr,
} from '@/components/admin/primitives';

const STATUSES = ['payment_pending', 'paid', 'packed', 'shipped', 'delivered', 'cancelled'];
const STATUS_LABEL = {
  payment_pending: 'Awaiting payment', paid: 'Paid', packed: 'Preparing for dispatch',
  shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled',
};

async function fetchOrders() {
  const res = await fetch('/api/admin/orders');
  if (!res.ok) throw new Error('failed');
  return res.json();
}
async function fetchOrder(id) {
  const res = await fetch(`/api/admin/orders/${id}`);
  if (!res.ok) throw new Error('failed');
  return res.json();
}

export default function OrdersClient({ user }) {
  const [selectedId, setSelectedId] = useState(null);
  const qc = useQueryClient();
  const orders = useQuery({ queryKey: ['orders'], queryFn: fetchOrders });

  const columns = [
    { key: 'ref', label: 'Order', render: (r) => <span className="font-mono text-[12.5px]">{r.ref}</span> },
    { key: 'contact', label: 'Customer', render: (r) => <div><div className="font-medium">{r.contact?.name}</div><div className="text-[11px] text-muted-foreground">{r.contact?.phone}</div></div> },
    { key: 'total', label: 'Total', render: (r) => inr(r.total) },
    { key: 'paymentId', label: 'Payment ID', render: (r) => r.payment?.paymentId ? <span className="font-mono text-[11.5px] text-muted-foreground">{r.payment.paymentId}</span> : <span className="text-muted-foreground">—</span> },
    { key: 'status', label: 'Status', render: (r) => <StatusPill status={r.status} /> },
    { key: 'createdAt', label: 'Placed', render: (r) => r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—' },
  ];

  return (
    <AdminShell user={user} title="Orders">
      <PageHeader eyebrow="Retail" title="Orders" subtitle="Product purchases, shipping status and tracking." />
      <AdminSection>
        <SimpleTable
          columns={columns}
          rows={orders.data || []}
          isLoading={orders.isLoading}
          empty="No orders yet."
          onRowClick={(r) => setSelectedId(r.id)}
        />
      </AdminSection>

      {selectedId && (
        <OrderDrawer
          id={selectedId}
          onClose={() => setSelectedId(null)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['orders'] }); }}
        />
      )}
    </AdminShell>
  );
}

function StatusPill({ status }) {
  const cls = {
    payment_pending: 'bg-orange-500/10 text-orange-700',
    paid: 'bg-emerald-500/10 text-emerald-700',
    packed: 'bg-blue-500/10 text-blue-700',
    shipped: 'bg-blue-500/10 text-blue-700',
    delivered: 'bg-emerald-500/10 text-emerald-700',
    cancelled: 'bg-muted text-muted-foreground',
  }[status] || 'bg-muted text-muted-foreground';
  return <span className={`inline-flex items-center h-6 px-2.5 rounded-full text-[10.5px] font-semibold uppercase tracking-[0.1em] ${cls}`}>{STATUS_LABEL[status] || status}</span>;
}

function OrderDrawer({ id, onClose, onSaved }) {
  const { data: order, isLoading, refetch } = useQuery({ queryKey: ['order', id], queryFn: () => fetchOrder(id) });
  const [status, setStatus] = useState('');
  const [trackingNo, setTrackingNo] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const body = {};
      if (status) body.status = status;
      if (trackingNo) body.trackingNo = trackingNo;
      if (trackingUrl) body.trackingUrl = trackingUrl;
      const res = await fetch(`/api/admin/orders/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error('failed');
      toast.success('Order updated');
      setStatus(''); setTrackingNo(''); setTrackingUrl('');
      refetch();
      onSaved();
    } catch { toast.error('Could not update'); }
    finally { setSaving(false); }
  };

  return (
    <Drawer open onClose={onClose} eyebrow="Order" title={order ? order.ref : 'Order'}
      footer={<div className="flex justify-end gap-2"><GhostBtn onClick={onClose}>Close</GhostBtn><PrimaryBtn onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Update'}</PrimaryBtn></div>}
    >
      {isLoading || !order ? (
        <div className="text-[13px] text-muted-foreground">Loading…</div>
      ) : (
        <div className="space-y-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-semibold mb-2">Customer</div>
            <div className="text-[13.5px]">{order.contact?.name}</div>
            <div className="text-[12px] text-muted-foreground">{order.contact?.phone} · {order.contact?.email}</div>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-semibold mb-2">Ship to</div>
            <div className="text-[13px] leading-relaxed">
              {order.shippingAddress?.line1}{order.shippingAddress?.line2 ? `, ${order.shippingAddress.line2}` : ''}<br />
              {order.shippingAddress?.city}, {order.shippingAddress?.state} {order.shippingAddress?.pincode}
            </div>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-semibold mb-2">Items</div>
            <div className="space-y-1.5">
              {(order.items || []).map((it, i) => (
                <div key={i} className="flex items-center justify-between text-[13px]">
                  <span>{it.name} × {it.qty}</span>
                  <span className="font-medium">{inr(it.price * it.qty)}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-border flex items-center justify-between text-[13.5px] font-semibold">
              <span>Total</span><span>{inr(order.total)}</span>
            </div>
          </div>

          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-semibold mb-2">Payment</div>
            {order.payment?.paymentId ? (
              <div className="space-y-1 text-[13px]">
                <div className="flex items-center justify-between"><span className="text-muted-foreground">Method</span><span className="capitalize">{order.payment.method || 'razorpay'}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground shrink-0">Payment ID</span><span className="font-mono text-[12px] text-right break-all">{order.payment.paymentId}</span></div>
                {order.payment.verifiedAt && (
                  <div className="flex items-center justify-between"><span className="text-muted-foreground">Paid on</span><span>{new Date(order.payment.verifiedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span></div>
                )}
              </div>
            ) : (
              <div className="text-[13px] text-muted-foreground">No payment recorded yet.</div>
            )}
          </div>

          <div className="pt-2 border-t border-border space-y-3">
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">Update status</div>
            <Field label="Status">
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">— Keep as {STATUS_LABEL[order.status] || order.status} —</option>
                {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </Select>
            </Field>
            <Field label="Tracking number" hint="Optional"><Input value={trackingNo} onChange={(e) => setTrackingNo(e.target.value)} /></Field>
            <Field label="Tracking URL" hint="Optional"><Input value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} /></Field>
          </div>
        </div>
      )}
    </Drawer>
  );
}

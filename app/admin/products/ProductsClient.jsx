'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Edit3, AlertTriangle } from 'lucide-react';
import AdminShell, { PageHeader, AdminSection } from '@/components/admin/shell';
import {
  SimpleTable, Tabs, Drawer, Field, Input, Textarea, Select,
  PrimaryBtn, GhostBtn, inr,
} from '@/components/admin/primitives';

async function fetchProducts() {
  const res = await fetch('/api/admin/products');
  if (!res.ok) throw new Error('failed');
  return res.json();
}
async function fetchCategories() {
  const res = await fetch('/api/admin/product-categories');
  if (!res.ok) throw new Error('failed');
  return res.json();
}

export default function ProductsClient({ user }) {
  const [tab, setTab] = useState('products');
  const [editing, setEditing] = useState(null);
  const [newOpen, setNewOpen] = useState(false);
  const [newCatOpen, setNewCatOpen] = useState(false);
  const qc = useQueryClient();
  const products = useQuery({ queryKey: ['products'], queryFn: fetchProducts });
  const cats     = useQuery({ queryKey: ['productCategories'], queryFn: fetchCategories });

  const remove = async (id) => {
    if (!confirm('Delete this product?')) return;
    const res = await fetch(`/api/admin/products/${id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('Deleted'); qc.invalidateQueries({ queryKey: ['products'] }); }
  };

  const adjustStock = async (id, delta) => {
    const res = await fetch(`/api/admin/products/${id}/stock`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ delta }),
    });
    if (res.ok) { toast.success('Stock updated'); qc.invalidateQueries({ queryKey: ['products'] }); }
  };

  const catMap = Object.fromEntries((cats.data || []).map((c) => [c.id, c.name]));

  const productColumns = [
    { key: 'name', label: 'Product', render: (r) => <div><div className="font-medium">{r.name}</div><div className="text-[11px] text-muted-foreground font-mono">{r.sku}</div></div> },
    { key: 'categoryId', label: 'Category', render: (r) => <span className="text-[12px]">{catMap[r.categoryId] || '—'}</span> },
    { key: 'price', label: 'Price', render: (r) => inr(r.price) },
    { key: 'stock', label: 'Stock', render: (r) => (
      <div className="flex items-center gap-2">
        <span className={r.stock <= (r.lowStockAt || 3) ? 'text-amber-600 font-medium' : ''}>{r.stock}</span>
        {r.stock <= (r.lowStockAt || 3) && <AlertTriangle className="h-3 w-3 text-amber-600" />}
        <button onClick={(e) => { e.stopPropagation(); adjustStock(r.id, 1); }} className="h-6 w-6 rounded border border-border text-[11px] hover:bg-muted">+</button>
        <button onClick={(e) => { e.stopPropagation(); adjustStock(r.id, -1); }} className="h-6 w-6 rounded border border-border text-[11px] hover:bg-muted">−</button>
      </div>
    )},
    { key: 'active', label: 'Status', render: (r) => r.active ? <span className="text-emerald-600 text-[11.5px]">Active</span> : <span className="text-muted-foreground text-[11.5px]">Inactive</span> },
    { key: 'actions', label: '', render: (r) => (
      <div className="flex items-center gap-1 justify-end">
        <button onClick={(e) => { e.stopPropagation(); setEditing(r); }} className="h-7 w-7 rounded-md hover:bg-muted text-muted-foreground inline-flex items-center justify-center"><Edit3 className="h-3.5 w-3.5" /></button>
        <button onClick={(e) => { e.stopPropagation(); remove(r.id); }} className="h-7 w-7 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-600 inline-flex items-center justify-center"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
    )},
  ];

  const catColumns = [
    { key: 'name', label: 'Name', render: (r) => <span className="font-medium">{r.name}</span> },
    { key: 'sort', label: 'Sort' },
    { key: 'actions', label: '', render: (r) => (
      <button onClick={async (e) => { e.stopPropagation();
        if (confirm('Delete category?')) {
          await fetch(`/api/admin/product-categories/${r.id}`, { method: 'DELETE' });
          qc.invalidateQueries({ queryKey: ['productCategories'] });
        }
      }} className="h-7 w-7 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-600 inline-flex items-center justify-center"><Trash2 className="h-3.5 w-3.5" /></button>
    )},
  ];

  return (
    <AdminShell user={user} title="Products" actions={
      tab === 'products'
        ? <PrimaryBtn onClick={() => setNewOpen(true)} className="h-8 px-3"><Plus className="h-3.5 w-3.5" /> New product</PrimaryBtn>
        : <PrimaryBtn onClick={() => setNewCatOpen(true)} className="h-8 px-3"><Plus className="h-3.5 w-3.5" /> New category</PrimaryBtn>
    }>
      <PageHeader eyebrow="Retail" title="Products" subtitle="Manage retail catalog, categories and stock levels." />
      <AdminSection>
        <div className="mb-4">
          <Tabs items={[
            { key: 'products',   label: 'Products',   count: products.data?.length },
            { key: 'categories', label: 'Categories', count: cats.data?.length },
          ]} active={tab} onChange={setTab} />
        </div>
        {tab === 'products'   && <SimpleTable columns={productColumns} rows={products.data || []} isLoading={products.isLoading} empty="No products yet." />}
        {tab === 'categories' && <SimpleTable columns={catColumns} rows={cats.data || []} isLoading={cats.isLoading} empty="No categories yet." />}
      </AdminSection>

      {(newOpen || editing) && <ProductEditor initial={editing} categories={cats.data || []}
        onClose={() => { setEditing(null); setNewOpen(false); }}
        onSaved={() => { qc.invalidateQueries({ queryKey: ['products'] }); setEditing(null); setNewOpen(false); }} />}

      {newCatOpen && <CategoryEditor onClose={() => setNewCatOpen(false)}
        onSaved={() => { qc.invalidateQueries({ queryKey: ['productCategories'] }); setNewCatOpen(false); }} />}
    </AdminShell>
  );
}

function ProductEditor({ initial, categories, onClose, onSaved }) {
  const isEdit = Boolean(initial);
  const [form, setForm] = useState({
    name: initial?.name || '',
    sku: initial?.sku || '',
    categoryId: initial?.categoryId || '',
    price: initial?.price || 0,
    tax: initial?.tax || 18,
    stock: initial?.stock || 0,
    lowStockAt: initial?.lowStockAt || 3,
    active: initial?.active !== false,
  });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const body = {
        ...form, price: Number(form.price), tax: Number(form.tax),
        stock: Number(form.stock), lowStockAt: Number(form.lowStockAt),
        categoryId: form.categoryId || null,
      };
      const url = isEdit ? `/api/admin/products/${initial.id}` : '/api/admin/products';
      const res = await fetch(url, { method: isEdit ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error('failed');
      toast.success(isEdit ? 'Updated' : 'Created');
      onSaved();
    } catch { toast.error('Could not save'); }
    finally { setSaving(false); }
  };
  return (
    <Drawer open onClose={onClose} eyebrow="Product" title={isEdit ? `Edit ${initial.name}` : 'New product'}
      footer={<div className="flex justify-end gap-2"><GhostBtn onClick={onClose}>Cancel</GhostBtn><PrimaryBtn onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</PrimaryBtn></div>}
    >
      <div className="space-y-3">
        <Field label="Name" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="SKU" hint="Auto-generated if blank"><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></Field>
          <Field label="Category">
            <Select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>
              <option value="">— Uncategorised —</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Price (₹)"><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></Field>
          <Field label="Tax %"><Input type="number" value={form.tax} onChange={(e) => setForm({ ...form, tax: e.target.value })} /></Field>
          <Field label="Stock"><Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} /></Field>
        </div>
        <Field label="Low-stock alert at"><Input type="number" value={form.lowStockAt} onChange={(e) => setForm({ ...form, lowStockAt: e.target.value })} /></Field>
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="h-4 w-4" /> Active
        </label>
      </div>
    </Drawer>
  );
}

function CategoryEditor({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', sort: 0 });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/product-categories', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, sort: Number(form.sort) }),
      });
      if (!res.ok) throw new Error('failed');
      toast.success('Category created');
      onSaved();
    } catch { toast.error('Could not save'); }
    finally { setSaving(false); }
  };
  return (
    <Drawer open onClose={onClose} eyebrow="Category" title="New category"
      footer={<div className="flex justify-end gap-2"><GhostBtn onClick={onClose}>Cancel</GhostBtn><PrimaryBtn onClick={save} disabled={saving || !form.name}>{saving ? 'Saving…' : 'Save'}</PrimaryBtn></div>}
    >
      <div className="space-y-3">
        <Field label="Name" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Salt lamps" /></Field>
        <Field label="Sort order"><Input type="number" value={form.sort} onChange={(e) => setForm({ ...form, sort: e.target.value })} /></Field>
      </div>
    </Drawer>
  );
}

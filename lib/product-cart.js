// Client-side product cart — localStorage-backed, since retail items (unlike
// bookings) have no server-side "pending" row until checkout actually starts.
// Fires a 'sw-cart-change' window event so the nav badge and cart page stay
// in sync across tabs/components without a shared store dependency.

const KEY = 'sw-product-cart-v1';

function read() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const items = raw ? JSON.parse(raw) : [];
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

function write(items) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('sw-cart-change', { detail: items }));
  } catch { /* noop */ }
}

export function getCart() {
  return read();
}

export function cartCount(items = read()) {
  return items.reduce((sum, it) => sum + it.qty, 0);
}

export function addToCart(product, qty = 1) {
  const items = read();
  const existing = items.find((it) => it.productId === product.id);
  if (existing) {
    existing.qty = Math.min(existing.qty + qty, Math.max(1, product.stock ?? 99));
  } else {
    items.push({
      productId: product.id, name: product.name, price: product.price,
      image: product.images?.[0] || null, qty: Math.max(1, qty),
    });
  }
  write(items);
  return items;
}

export function setQty(productId, qty) {
  const items = read();
  const it = items.find((i) => i.productId === productId);
  if (!it) return items;
  if (qty <= 0) return removeFromCart(productId);
  it.qty = qty;
  write(items);
  return items;
}

export function removeFromCart(productId) {
  const items = read().filter((it) => it.productId !== productId);
  write(items);
  return items;
}

export function clearCart() {
  write([]);
}

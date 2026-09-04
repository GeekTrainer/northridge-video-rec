// Browser-side shopping cart, persisted in localStorage.
//
// Framework-agnostic so both the jQuery Video app and the React Music/Books
// apps can share it. Because every page is served through the gateway origin,
// the cart persists across all three verticals and the gateway's own pages.
//
// NOTE: browser-only module (uses localStorage) — never import from Node code.

const STORAGE_KEY = 'nrv-cart';
const CHANGED_EVENT = 'nrv-cart-changed';

function read() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function write(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  // Let any listening UI (cart badge, cart page) refresh.
  document.dispatchEvent(new CustomEvent(CHANGED_EVENT));
}

/** @returns {Array<{sku:string,title:string,price_cents:number,qty:number}>} */
export function getCart() {
  return read();
}

/** Add one unit of an item (increments qty if already present). */
export function addToCart(item) {
  const items = read();
  const existing = items.find((i) => i.sku === item.sku);
  if (existing) {
    existing.qty += 1;
  } else {
    items.push({
      sku: item.sku,
      title: item.title,
      price_cents: item.price_cents,
      qty: 1,
    });
  }
  write(items);
}

/** Remove an item entirely, regardless of quantity. */
export function removeFromCart(sku) {
  write(read().filter((i) => i.sku !== sku));
}

/** Total number of units in the cart. */
export function cartCount() {
  return read().reduce((n, i) => n + i.qty, 0);
}

/** Total price of the cart in cents. */
export function cartTotalCents() {
  return read().reduce((sum, i) => sum + i.price_cents * i.qty, 0);
}

/** Empty the cart (used after a successful fake checkout). */
export function clearCart() {
  write([]);
}

/** Subscribe to cart changes; returns an unsubscribe function. */
export function onCartChanged(handler) {
  document.addEventListener(CHANGED_EVENT, handler);
  return () => document.removeEventListener(CHANGED_EVENT, handler);
}

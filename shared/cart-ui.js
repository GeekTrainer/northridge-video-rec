// Keeps the header cart badge (#nrv-cart-count) in sync with the cart.
// Browser-only. Touches a single element by id, so it never conflicts with
// jQuery or React managing their own containers.
import { cartCount, onCartChanged } from './cart.js';

export function mountCartBadge() {
  const update = () => {
    const el = document.getElementById('nrv-cart-count');
    if (el) el.textContent = String(cartCount());
  };
  update();
  onCartChanged(update);
  // Reflect changes made in other tabs.
  window.addEventListener('storage', update);
}

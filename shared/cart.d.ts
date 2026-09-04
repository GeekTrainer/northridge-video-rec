export interface CartItem {
  sku: string;
  title: string;
  price_cents: number;
  qty: number;
}

export interface CartLineInput {
  sku: string;
  title: string;
  price_cents: number;
}

export declare function getCart(): CartItem[];
export declare function addToCart(item: CartLineInput): void;
export declare function removeFromCart(sku: string): void;
export declare function cartCount(): number;
export declare function cartTotalCents(): number;
export declare function clearCart(): void;
export declare function onCartChanged(handler: () => void): () => void;

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Product } from "@/data/menu";

export type CartItem = {
  product: Product;
  quantity: number;
};

type CartState = {
  items: CartItem[];
  addItem: (product: Product) => void;
  decrement: (productId: string) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
};

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (product) =>
        set((state) => {
          const existing = state.items.find((i) => i.product.id === product.id);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i,
              ),
            };
          }
          return { items: [...state.items, { product, quantity: 1 }] };
        }),
      decrement: (productId) =>
        set((state) => ({
          items: state.items
            .map((i) =>
              i.product.id === productId ? { ...i, quantity: i.quantity - 1 } : i,
            )
            .filter((i) => i.quantity > 0),
        })),
      removeItem: (productId) =>
        set((state) => ({ items: state.items.filter((i) => i.product.id !== productId) })),
      clear: () => set({ items: [] }),
    }),
    { name: "nymbus-cart" },
  ),
);

export const selectTotal = (items: CartItem[]) =>
  items.reduce((sum, i) => sum + i.product.price * i.quantity, 0);

export const selectCount = (items: CartItem[]) =>
  items.reduce((sum, i) => sum + i.quantity, 0);

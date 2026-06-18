import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { CartSheet } from "@/components/cart-sheet";
import { Button } from "@/components/ui/button";
import { categories, products } from "@/data/menu";
import { useCart } from "@/store/cart";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cardápio — Nymbus Pedidos" },
      {
        name: "description",
        content:
          "Cardápio digital para bares e restaurantes. Monte seu pedido e finalize pelo WhatsApp.",
      },
      { property: "og:title", content: "Cardápio — Nymbus Pedidos" },
      {
        property: "og:description",
        content: "Peça do seu jeito: cardápio digital direto pelo WhatsApp.",
      },
    ],
  }),
  component: MenuPage,
});

function MenuPage() {
  const [active, setActive] = useState(categories[0].id);
  const [cartOpen, setCartOpen] = useState(false);
  const addItem = useCart((s) => s.addItem);

  const visible = useMemo(
    () => products.filter((p) => p.category === active),
    [active],
  );

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader onCartClick={() => setCartOpen(true)} />

      <main className="mx-auto max-w-5xl px-4 pb-24 pt-6">
        <section className="mb-6">
          <h1 className="text-[20px] font-bold tracking-tight">Cardápio</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Escolha seus itens favoritos e finalize pelo WhatsApp.
          </p>
        </section>

        <nav className="-mx-4 mb-6 overflow-x-auto px-4">
          <ul className="flex gap-2">
            {categories.map((c) => {
              const isActive = c.id === active;
              return (
                <li key={c.id}>
                  <button
                    onClick={() => setActive(c.id)}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm font-semibold transition-colors whitespace-nowrap",
                      isActive
                        ? "border-transparent bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {c.name}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <ul className="grid gap-3 sm:grid-cols-2">
          {visible.map((p) => (
            <li
              key={p.id}
              className="flex gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-[var(--accent)]"
            >
              <img
                src={p.image}
                alt={p.name}
                loading="lazy"
                className="h-24 w-24 flex-none rounded-lg object-cover"
              />
              <div className="flex min-w-0 flex-1 flex-col">
                <h3 className="text-[15px] font-bold leading-tight">{p.name}</h3>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {p.description}
                </p>
                <div className="mt-auto flex items-center justify-between pt-2">
                  <span className="text-base font-bold text-primary-fg">
                    {formatBRL(p.price)}
                  </span>
                  <Button
                    size="sm"
                    onClick={() => addItem(p)}
                    className="h-8 bg-primary text-primary-foreground hover:bg-[var(--accent-hover)]"
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    Adicionar
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </main>

      <CartSheet open={cartOpen} onOpenChange={setCartOpen} />
    </div>
  );
}

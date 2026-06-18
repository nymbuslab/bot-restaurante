import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { CheckCircle2 } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { useCart } from "@/store/cart";

export const Route = createFileRoute("/pedido-enviado")({
  head: () => ({
    meta: [
      { title: "Pedido enviado — Nymbus Pedidos" },
      { name: "description", content: "Seu pedido foi enviado para o restaurante." },
    ],
  }),
  component: PedidoEnviado,
});

function PedidoEnviado() {
  const clear = useCart((s) => s.clear);
  useEffect(() => {
    clear();
  }, [clear]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader showCart={false} />
      <main className="mx-auto flex max-w-md flex-col items-center px-4 py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--secondary-subtle)]">
          <CheckCircle2 className="h-8 w-8 text-secondary" />
        </div>
        <h1 className="mt-6 text-[20px] font-bold tracking-tight">
          Pedido enviado!
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Continue a conversa no WhatsApp para confirmar os detalhes da entrega.
        </p>
        <Button
          asChild
          size="lg"
          className="mt-8 bg-primary text-primary-foreground hover:bg-[var(--accent-hover)]"
        >
          <Link to="/">Voltar ao cardápio</Link>
        </Button>
      </main>
    </div>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useCart, selectTotal } from "@/store/cart";
import { formatBRL, maskPhoneBR } from "@/lib/format";
import { WHATSAPP_NUMBER, RESTAURANT_NAME } from "@/lib/config";
import { toast } from "sonner";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — Nymbus Pedidos" },
      {
        name: "description",
        content: "Confirme seus dados e envie seu pedido pelo WhatsApp.",
      },
    ],
  }),
  component: CheckoutPage,
});

const schema = z
  .object({
    nome: z.string().trim().min(2, "Informe seu nome"),
    telefone: z.string().trim().min(14, "Telefone inválido"),
    endereco: z.string().trim().min(8, "Informe o endereço completo"),
    pagamento: z.enum(["dinheiro", "pix", "cartao"]),
    troco: z.string().optional(),
    observacoes: z.string().max(300).optional(),
  })
  .refine(
    (d) => d.pagamento !== "dinheiro" || !d.troco || /\d/.test(d.troco),
    { message: "Valor de troco inválido", path: ["troco"] },
  );

type FormData = z.infer<typeof schema>;

function CheckoutPage() {
  const navigate = useNavigate();
  const items = useCart((s) => s.items);
  const total = selectTotal(items);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: "",
      telefone: "",
      endereco: "",
      pagamento: "pix",
      troco: "",
      observacoes: "",
    },
  });

  const pagamento = form.watch("pagamento");

  const onSubmit = (data: FormData) => {
    if (items.length === 0) {
      toast.error("Seu carrinho está vazio");
      return;
    }

    const linhas = items
      .map(
        (i) =>
          `• ${i.quantity}x ${i.product.name} — ${formatBRL(i.product.price * i.quantity)}`,
      )
      .join("\n");

    const pagamentoLabel =
      data.pagamento === "dinheiro"
        ? `Dinheiro${data.troco ? ` (troco p/ ${data.troco})` : ""}`
        : data.pagamento === "pix"
          ? "Pix"
          : "Cartão na entrega";

    const msg = [
      `*Novo Pedido — ${RESTAURANT_NAME}*`,
      "",
      `👤 Cliente: ${data.nome}`,
      `📞 Telefone: ${data.telefone}`,
      `📍 Endereço: ${data.endereco}`,
      "",
      "🍽 Itens:",
      linhas,
      "",
      `💰 Total: ${formatBRL(total)}`,
      `💳 Pagamento: ${pagamentoLabel}`,
      data.observacoes ? `📝 Obs: ${data.observacoes}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    navigate({ to: "/pedido-enviado" });
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader showCart={false} />
        <main className="mx-auto max-w-md px-4 py-16 text-center">
          <h1 className="text-[20px] font-bold tracking-tight">
            Seu carrinho está vazio
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Volte ao cardápio para adicionar itens.
          </p>
          <Button
            asChild
            className="mt-6 bg-primary text-primary-foreground hover:bg-[var(--accent-hover)]"
          >
            <Link to="/">Ver cardápio</Link>
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader showCart={false} />

      <main className="mx-auto max-w-2xl px-4 pb-16 pt-6">
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao cardápio
        </Link>

        <h1 className="text-[20px] font-bold tracking-tight">Finalizar pedido</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Confirme seus dados — o pedido será enviado pelo WhatsApp.
        </p>

        <section className="mt-6 rounded-xl border border-border bg-card p-4">
          <h2 className="text-[15px] font-bold">Resumo</h2>
          <ul className="mt-3 space-y-2">
            {items.map(({ product, quantity }) => (
              <li
                key={product.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-foreground">
                  <span className="text-primary-fg">{quantity}x</span> {product.name}
                </span>
                <span className="font-semibold">
                  {formatBRL(product.price * quantity)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center justify-between border-t border-border-subtle pt-3">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-lg font-bold">{formatBRL(total)}</span>
          </div>
        </section>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="mt-6 space-y-5 rounded-xl border border-border bg-card p-4"
        >
          <Field
            id="nome"
            label="Nome"
            error={form.formState.errors.nome?.message}
          >
            <Input
              id="nome"
              placeholder="Seu nome completo"
              {...form.register("nome")}
            />
          </Field>

          <Field
            id="telefone"
            label="Telefone"
            error={form.formState.errors.telefone?.message}
          >
            <Input
              id="telefone"
              placeholder="(11) 99999-9999"
              inputMode="tel"
              {...form.register("telefone", {
                onChange: (e) => {
                  e.target.value = maskPhoneBR(e.target.value);
                },
              })}
            />
          </Field>

          <Field
            id="endereco"
            label="Endereço de entrega"
            error={form.formState.errors.endereco?.message}
          >
            <Textarea
              id="endereco"
              placeholder="Rua, número, complemento, bairro"
              rows={3}
              {...form.register("endereco")}
            />
          </Field>

          <Field id="pagamento" label="Forma de pagamento">
            <RadioGroup
              value={pagamento}
              onValueChange={(v) => form.setValue("pagamento", v as FormData["pagamento"])}
              className="grid grid-cols-3 gap-2"
            >
              {[
                { v: "pix", l: "Pix" },
                { v: "dinheiro", l: "Dinheiro" },
                { v: "cartao", l: "Cartão" },
              ].map((opt) => (
                <label
                  key={opt.v}
                  className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${
                    pagamento === opt.v
                      ? "border-[var(--accent)] bg-[var(--accent-subtle)] text-primary-fg"
                      : "border-border bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <RadioGroupItem value={opt.v} className="sr-only" />
                  {opt.l}
                </label>
              ))}
            </RadioGroup>
          </Field>

          {pagamento === "dinheiro" && (
            <Field
              id="troco"
              label="Troco para"
              error={form.formState.errors.troco?.message}
            >
              <Input
                id="troco"
                placeholder="Ex.: R$ 100"
                {...form.register("troco")}
              />
            </Field>
          )}

          <Field id="observacoes" label="Observações (opcional)">
            <Textarea
              id="observacoes"
              placeholder="Ex.: sem cebola, ponto da carne..."
              rows={2}
              {...form.register("observacoes")}
            />
          </Field>

          <Button
            type="submit"
            size="lg"
            className="w-full bg-primary text-primary-foreground hover:bg-[var(--accent-hover)]"
          >
            Enviar pedido pelo WhatsApp
          </Button>
        </form>
      </main>
    </div>
  );
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label
        htmlFor={id}
        className="text-[11px] font-bold uppercase tracking-[0.5px] text-muted-foreground"
      >
        {label}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

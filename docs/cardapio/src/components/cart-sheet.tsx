import { Link } from "@tanstack/react-router";
import { Minus, Plus, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useCart, selectTotal } from "@/store/cart";
import { formatBRL } from "@/lib/format";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

export function CartSheet({ open, onOpenChange }: Props) {
  const items = useCart((s) => s.items);
  const addItem = useCart((s) => s.addItem);
  const decrement = useCart((s) => s.decrement);
  const removeItem = useCart((s) => s.removeItem);
  const total = selectTotal(items);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col bg-card sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-[20px] font-bold tracking-tight">
            Seu pedido
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-4">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <p className="text-muted-foreground">Seu carrinho está vazio</p>
              <p className="text-xs text-muted-foreground">
                Adicione itens do cardápio para começar
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {items.map(({ product, quantity }) => (
                <li
                  key={product.id}
                  className="flex gap-3 rounded-lg border border-border-subtle bg-muted/40 p-3"
                >
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{product.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatBRL(product.price)}
                    </p>
                    <div className="mt-2 inline-flex items-center gap-1 rounded-md border border-border bg-background">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-primary-fg"
                        onClick={() => decrement(product.id)}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <span className="min-w-6 text-center text-sm font-medium">
                        {quantity}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-primary-fg"
                        onClick={() => addItem(product)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-col items-end justify-between">
                    <p className="text-sm font-semibold">
                      {formatBRL(product.price * quantity)}
                    </p>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => removeItem(product.id)}
                      aria-label="Remover"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <SheetFooter className="border-t border-border pt-4">
            <div className="w-full space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="text-lg font-bold">{formatBRL(total)}</span>
              </div>
              <Button
                asChild
                size="lg"
                className="w-full bg-primary text-primary-foreground hover:bg-[var(--accent-hover)]"
                onClick={() => onOpenChange(false)}
              >
                <Link to="/checkout">Ir para checkout</Link>
              </Button>
            </div>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}

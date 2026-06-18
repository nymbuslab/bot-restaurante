import { Link } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";
import { useCart, selectCount } from "@/store/cart";
import { RESTAURANT_NAME } from "@/lib/config";
import { Button } from "@/components/ui/button";

type Props = {
  onCartClick?: () => void;
  showCart?: boolean;
};

export function SiteHeader({ onCartClick, showCart = true }: Props) {
  const count = useCart((s) => selectCount(s.items));

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-secondary">
            <span className="text-base font-bold text-white">N</span>
          </div>
          <span className="text-[15px] font-bold tracking-tight">{RESTAURANT_NAME}</span>
        </Link>
        {showCart && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onCartClick}
            className="relative h-10 w-10 text-primary-fg hover:bg-muted"
            aria-label="Abrir carrinho"
          >
            <ShoppingBag className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-secondary px-1 text-[11px] font-bold text-secondary-foreground">
                {count}
              </span>
            )}
          </Button>
        )}
      </div>
    </header>
  );
}

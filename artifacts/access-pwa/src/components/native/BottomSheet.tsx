import { type ReactNode } from "react";
import { Drawer } from "vaul";
import { cn } from "@/lib/utils";

interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Native-style bottom sheet (swipe-to-dismiss) built on vaul. */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: BottomSheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Drawer.Content
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92vh] max-w-lg flex-col rounded-t-3xl border border-border bg-background outline-none",
            className,
          )}
        >
          <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-muted-foreground/30" />
          <div className="overflow-y-auto px-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-4">
            <Drawer.Title
              className={cn(
                "text-lg font-bold tracking-tight",
                !title && "sr-only",
              )}
            >
              {title ?? "Sheet"}
            </Drawer.Title>
            {description && (
              <Drawer.Description className="mt-1 text-sm text-muted-foreground">
                {description}
              </Drawer.Description>
            )}
            <div className={cn(title || description ? "mt-4" : "")}>
              {children}
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

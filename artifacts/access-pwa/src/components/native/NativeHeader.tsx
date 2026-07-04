import { type ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Pressable } from "./Pressable";

interface NativeHeaderProps {
  title: string;
  subtitle?: ReactNode;
  /** Show a back chevron that navigates here. */
  backHref?: string;
  /** Custom back handler (takes precedence over backHref). */
  onBack?: () => void;
  /** Trailing action, e.g. an add button. */
  action?: ReactNode;
  className?: string;
}

/** Large-title page header with an optional back button and trailing action. */
export function NativeHeader({
  title,
  subtitle,
  backHref,
  onBack,
  action,
  className,
}: NativeHeaderProps) {
  const [, navigate] = useLocation();
  const showBack = !!backHref || !!onBack;

  return (
    <div className={cn("mb-5 flex items-start gap-3", className)}>
      {showBack && (
        <Pressable
          aria-label="Back"
          onClick={() => (onBack ? onBack() : backHref && navigate(backHref))}
          className="-ml-1 mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground hover-elevate active-elevate-2"
          data-testid="button-back"
        >
          <ChevronLeft className="h-5 w-5" />
        </Pressable>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && (
          <p className="mt-0.5 truncate text-sm text-muted-foreground">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export function useCheckout() {
  const [isCheckoutLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Returns true when a redirect to the payment provider was initiated, false
  // when checkout could not start (not configured / error) so callers can
  // recover instead of stranding the user.
  const startCheckout = async (planKey: string, interval: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const baseUrl = window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch("/api/v1/billing/checkout", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          planKey,
          interval,
          successUrl: `${baseUrl}/dashboard?checkout=success`,
          cancelUrl: `${baseUrl}/pricing?checkout=cancelled`,
        }),
      });

      if (res.status === 503) {
        toast({
          title: "Setup in progress",
          description: "Card checkout is being set up — please try again shortly",
        });
        return false;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Checkout failed");
      }

      const { url } = await res.json();
      window.location.href = url;
      return true;
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Checkout failed",
        description: err.message || "An unexpected error occurred",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return { startCheckout, isCheckoutLoading };
}

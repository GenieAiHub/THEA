import { Link } from "wouter";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
        <Compass className="h-7 w-7 text-muted-foreground" />
      </div>
      <h1 className="text-xl font-bold">Page not found</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        That page doesn't exist or has moved.
      </p>
      <Link href="/">
        <Button className="mt-6" data-testid="button-home">
          Back to home
        </Button>
      </Link>
    </div>
  );
}

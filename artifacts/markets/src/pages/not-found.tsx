import { Link } from "wouter";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Compass } from "lucide-react";

export default function NotFound() {
  return (
    <Layout>
      <div className="container mx-auto px-4 py-24 max-w-2xl">
        <div className="text-center glass-panel rounded-2xl p-10 md:p-16">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center">
            <Compass className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-5xl md:text-7xl font-display font-bold text-white mb-3">404</h1>
          <p className="text-lg text-muted-foreground mb-8">
            This market doesn't exist — or the trend already resolved.
          </p>
          <Link href="/">
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Markets
            </Button>
          </Link>
        </div>
      </div>
    </Layout>
  );
}

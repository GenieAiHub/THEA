import { Route, Router as WouterRouter, Switch } from "wouter";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Loader2, ScanFace } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { AppShell } from "@/components/AppShell";
import { AnimatedRoutes } from "@/components/AnimatedRoutes";
import Login from "@/pages/Login";
import Lock from "@/pages/Lock";
import GetApp from "@/pages/GetApp";
import { queryClient, persister, APP_CACHE_VERSION } from "@/lib/queryClient";

const WEEK_MS = 1000 * 60 * 60 * 24 * 7;

function AuthedApp() {
  return (
    <AppShell>
      <AnimatedRoutes />
    </AppShell>
  );
}

function Splash() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 ring-1 ring-primary/25">
        <ScanFace className="h-8 w-8 text-primary" />
      </div>
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}

function Gate() {
  const { status } = useAuth();
  if (status === "loading") return <Splash />;
  if (status === "unauthed") return <Login />;
  if (status === "locked") return <Lock />;
  return <AuthedApp />;
}

function App() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: WEEK_MS,
        buster: APP_CACHE_VERSION,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => query.state.status === "success",
        },
      }}
    >
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Switch>
              <Route path="/get" component={GetApp} />
              <Route>
                <Gate />
              </Route>
            </Switch>
          </WouterRouter>
          <Toaster position="top-center" richColors />
        </AuthProvider>
      </TooltipProvider>
    </PersistQueryClientProvider>
  );
}

export default App;

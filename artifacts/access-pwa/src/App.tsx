import { Route, Router as WouterRouter, Switch } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Loader2, ScanFace } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { AppShell } from "@/components/AppShell";
import Login from "@/pages/Login";
import Lock from "@/pages/Lock";
import Home from "@/pages/Home";
import Scan from "@/pages/Scan";
import Members from "@/pages/Members";
import MemberDetail from "@/pages/MemberDetail";
import AccessPoints from "@/pages/AccessPoints";
import Events from "@/pages/Events";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/not-found";
import { ApiError } from "@/lib/api";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, error) => {
        if (error instanceof ApiError && error.status === 401) return false;
        return count < 1;
      },
      refetchOnWindowFocus: false,
      staleTime: 15_000,
    },
  },
});

function AuthedApp() {
  return (
    <AppShell>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/scan" component={Scan} />
        <Route path="/members" component={Members} />
        <Route path="/members/:id" component={MemberDetail} />
        <Route path="/access-points" component={AccessPoints} />
        <Route path="/events" component={Events} />
        <Route path="/settings" component={Settings} />
        <Route component={NotFound} />
      </Switch>
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
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Gate />
          </WouterRouter>
          <Toaster position="top-center" richColors />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

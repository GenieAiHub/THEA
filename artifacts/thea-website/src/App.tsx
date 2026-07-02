import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from 'wouter';
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/Home";
import NotFound from "@/pages/not-found";

import DashboardPage from "@/pages/DashboardPage";
import TrendsPage from "@/pages/TrendsPage";
import TrendDetailPage from "@/pages/TrendDetailPage";
import WatchlistPage from "@/pages/WatchlistPage";
import AlertsPage from "@/pages/AlertsPage";
import AiToolsPage from "@/pages/AiToolsPage";
import DataExplorerPage from "@/pages/DataExplorerPage";
import CampaignsPage from "@/pages/CampaignsPage";
import CompetitorIntelligencePage from "@/pages/CompetitorIntelligencePage";
import CategoryDeepDivePage from "@/pages/CategoryDeepDivePage";
import AlertDetailPage from "@/pages/AlertDetailPage";
import SettingsPage from "@/pages/SettingsPage";
import OnboardingPage from "@/pages/OnboardingPage";

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } });

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "#3b82f6",
    colorForeground: "#f8fafc",
    colorMutedForeground: "#94a3b8",
    colorDanger: "#ef4444",
    colorBackground: "#020617",
    colorInput: "#1e293b",
    colorInputForeground: "#f8fafc",
    colorNeutral: "#334155",
    fontFamily: "Inter, sans-serif",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-slate-950 border border-slate-800 rounded-2xl w-[440px] max-w-full overflow-hidden shadow-2xl",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-slate-50 font-semibold font-display text-2xl tracking-tight",
    headerSubtitle: "text-slate-400",
    socialButtonsBlockButtonText: "text-slate-200",
    formFieldLabel: "text-slate-300 font-medium",
    footerActionLink: "text-blue-400 hover:text-blue-300 font-medium",
    footerActionText: "text-slate-400",
    dividerText: "text-slate-500 font-medium",
    identityPreviewEditButton: "text-blue-400 hover:text-blue-300",
    formFieldSuccessText: "text-emerald-400",
    alertText: "text-slate-200",
    logoBox: "flex justify-center mb-4",
    logoImage: "h-12 w-auto",
    socialButtonsBlockButton: "border-slate-700 hover:border-slate-500 bg-slate-900",
    formButtonPrimary: "bg-blue-600 hover:bg-blue-500 text-white font-medium",
    formFieldInput: "bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:ring-blue-500/20",
    footerAction: "bg-transparent",
    dividerLine: "bg-slate-800",
    alert: "bg-slate-900 border-slate-800",
    otpCodeFieldInput: "bg-slate-900 border-slate-700 text-slate-100 focus:border-blue-500 focus:ring-blue-500/20",
    formFieldRow: "",
    main: "",
  },
};

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in"><Redirect to="/dashboard" /></Show>
      <Show when="signed-out"><Home /></Show>
    </>
  );
}

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-background to-background pointer-events-none"></div>
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-background to-background pointer-events-none"></div>
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);
  return null;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: "Sign in to THEA", subtitle: "Your narrative intelligence platform" } },
        signUp: { start: { title: "Get started with THEA", subtitle: "Intelligence at the speed of narrative" } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Switch>
            <Route path="/" component={HomeRedirect} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            <Route path="/dashboard" component={DashboardPage} />
            <Route path="/trends" component={TrendsPage} />
            <Route path="/trends/:topic" component={TrendDetailPage} />
            <Route path="/watchlist" component={WatchlistPage} />
            <Route path="/alerts" component={AlertsPage} />
            <Route path="/ai-tools" component={AiToolsPage} />
            <Route path="/intelligence" component={AiToolsPage} />
            <Route path="/data-explorer" component={DataExplorerPage} />
            <Route path="/campaigns" component={CampaignsPage} />
            <Route path="/competitors" component={CompetitorIntelligencePage} />
            <Route path="/category/:slug" component={CategoryDeepDivePage} />
            <Route path="/alerts/:id" component={AlertDetailPage} />
            <Route path="/settings" component={SettingsPage} />
            <Route path="/onboarding">
              <Show when="signed-in"><OnboardingPage /></Show>
              <Show when="signed-out"><Redirect to="/sign-in" /></Show>
            </Route>
            <Route component={NotFound} />
          </Switch>
        </TooltipProvider>
        <Toaster />
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
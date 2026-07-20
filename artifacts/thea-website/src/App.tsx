import { lazy, Suspense, type ReactNode } from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Home from "@/pages/Home";
import NotFound from "@/pages/not-found";

import DashboardPage from "@/pages/DashboardPage";
import TrendsPage from "@/pages/TrendsPage";
import TrendDetailPage from "@/pages/TrendDetailPage";
import WatchlistPage from "@/pages/WatchlistPage";
import AlertsPage from "@/pages/AlertsPage";
import AiToolsPage from "@/pages/AiToolsPage";
import SimulationDashboardPage from "@/pages/SimulationDashboardPage";
import DataExplorerPage from "@/pages/DataExplorerPage";
import CampaignsPage from "@/pages/CampaignsPage";
import CompetitorIntelligencePage from "@/pages/CompetitorIntelligencePage";
import CategoryDeepDivePage from "@/pages/CategoryDeepDivePage";
import AlertDetailPage from "@/pages/AlertDetailPage";
import SettingsPage from "@/pages/SettingsPage";
import OnboardingPage from "@/pages/OnboardingPage";
import SignInPage from "@/pages/SignInPage";
import SignUpPage from "@/pages/SignUpPage";

import PricingPage from "@/pages/PricingPage";
import CheckoutPage from "@/pages/CheckoutPage";

import PlatformPage from "@/pages/PlatformPage";
import HowItWorksPage from "@/pages/HowItWorksPage";
import TechnologyPage from "@/pages/TechnologyPage";
import AboutPage from "@/pages/AboutPage";
import SolutionsPage from "@/pages/SolutionsPage";
import FaqPage from "@/pages/FaqPage";
import KnowledgeBasePage from "@/pages/KnowledgeBasePage";
import KnowledgeBaseArticlePage from "@/pages/KnowledgeBaseArticlePage";
import PrivacyPage from "@/pages/legal/PrivacyPage";
const MmpReportPage = lazy(() => import("@/pages/MmpReportPage"));
import TermsPage from "@/pages/legal/TermsPage";
import DisclaimerPage from "@/pages/legal/DisclaimerPage";

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } });

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function AuthLoading() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#020617]">
      <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
    </div>
  );
}

function Protected({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <AuthLoading />;
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  return <>{children}</>;
}

function HomeRedirect() {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <AuthLoading />;
  return isSignedIn ? <Redirect to="/dashboard" /> : <Home />;
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/pricing" component={PricingPage} />
      <Route path="/platform" component={PlatformPage} />
      <Route path="/how-it-works" component={HowItWorksPage} />
      <Route path="/technology" component={TechnologyPage} />
      <Route path="/about" component={AboutPage} />
      <Route path="/solutions" component={SolutionsPage} />
      <Route path="/faq" component={FaqPage} />
      <Route path="/knowledge-base" component={KnowledgeBasePage} />
      <Route path="/knowledge-base/:slug" component={KnowledgeBaseArticlePage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/disclaimer" component={DisclaimerPage} />
      {/* Hidden internal reference report — intentionally absent from nav, PUBLIC_ROUTES, and the sitemap. */}
      <Route path="/mmp-report">
        {() => (
          <Suspense fallback={<AuthLoading />}>
            <MmpReportPage />
          </Suspense>
        )}
      </Route>
      <Route path="/sign-in" component={SignInPage} />
      <Route path="/sign-up" component={SignUpPage} />
      <Route path="/checkout">{() => <Protected><CheckoutPage /></Protected>}</Route>
      <Route path="/dashboard">{() => <Protected><DashboardPage /></Protected>}</Route>
      <Route path="/trends">{() => <Protected><TrendsPage /></Protected>}</Route>
      <Route path="/trends/:topic">{() => <Protected><TrendDetailPage /></Protected>}</Route>
      <Route path="/watchlist">{() => <Protected><WatchlistPage /></Protected>}</Route>
      <Route path="/alerts">{() => <Protected><AlertsPage /></Protected>}</Route>
      <Route path="/ai-tools">{() => <Protected><AiToolsPage /></Protected>}</Route>
      <Route path="/intelligence">{() => <Protected><AiToolsPage /></Protected>}</Route>
      <Route path="/simulation">{() => <Protected><SimulationDashboardPage /></Protected>}</Route>
      <Route path="/data-explorer">{() => <Protected><DataExplorerPage /></Protected>}</Route>
      <Route path="/campaigns">{() => <Protected><CampaignsPage /></Protected>}</Route>
      <Route path="/competitors">{() => <Protected><CompetitorIntelligencePage /></Protected>}</Route>
      <Route path="/category/:slug">{() => <Protected><CategoryDeepDivePage /></Protected>}</Route>
      <Route path="/alerts/:id">{() => <Protected><AlertDetailPage /></Protected>}</Route>
      <Route path="/settings">{() => <Protected><SettingsPage /></Protected>}</Route>
      <Route path="/onboarding">{() => <Protected><OnboardingPage /></Protected>}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <AppRoutes />
          </TooltipProvider>
          <Toaster />
        </AuthProvider>
      </QueryClientProvider>
    </WouterRouter>
  );
}

export default App;

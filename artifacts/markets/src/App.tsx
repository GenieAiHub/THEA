import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { Web3Provider } from "@/context/Web3Context";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import MarketDetail from "@/pages/MarketDetail";
import Category from "@/pages/Category";
import Leaderboard from "@/pages/Leaderboard";
import Activity from "@/pages/Activity";
import HowItWorks from "@/pages/HowItWorks";
import SignIn from "@/pages/SignIn";
import SignUp from "@/pages/SignUp";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60, // 1 minute
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/leaderboard" component={Leaderboard} />
      <Route path="/activity" component={Activity} />
      <Route path="/how-it-works" component={HowItWorks} />
      <Route path="/category/:category" component={Category} />
      <Route path="/market/:id" component={MarketDetail} />
      <Route path="/sign-in" component={SignIn} />
      <Route path="/sign-up" component={SignUp} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Web3Provider>
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </Web3Provider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;

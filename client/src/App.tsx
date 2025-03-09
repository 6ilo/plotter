import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import LocalDownload from "@/pages/LocalDownload";
import { PlotterProvider } from "@/hooks/usePlotter";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/local-download" component={LocalDownload} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PlotterProvider>
        <Router />
        <Toaster />
      </PlotterProvider>
    </QueryClientProvider>
  );
}

export default App;

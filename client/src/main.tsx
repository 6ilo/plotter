import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { PlotterProvider } from "./hooks/usePlotter";

createRoot(document.getElementById("root")!).render(
  <PlotterProvider>
    <App />
  </PlotterProvider>
);

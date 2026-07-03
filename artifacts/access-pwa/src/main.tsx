import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initPWA } from "./lib/pwa";

createRoot(document.getElementById("root")!).render(<App />);

// Register the service worker + wire up install/update state after the app
// mounts so the first paint isn't blocked.
initPWA();

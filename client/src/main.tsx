import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setupDateLocale } from "./lib/date-locale";

// Initialize consistent DD/MM/YYYY format for all date inputs
setupDateLocale();

createRoot(document.getElementById("root")!).render(<App />);

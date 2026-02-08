import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { checkSupabaseConnection } from "./lib/supabase-health";

// Verify Supabase connectivity on startup
checkSupabaseConnection();

createRoot(document.getElementById("root")!).render(<App />);

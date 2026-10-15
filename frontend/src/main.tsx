import React, { Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./style.css";
import "./redesign.css";
import "./profiles.css";
import "./superapp.css";
import "./emblems.css";
import "./directive.css";
import "./motion.css";
import "./beginner.css";
import "./ultra.css";
import "./corporate-identity.css";
import { SiteAssistant } from "./components/site-assistant";
import { EntryCheck } from "./components/entry-check";
const CommandCenter = lazy(() => import("./command-center"));
const Landing = lazy(() =>
  import("./components/landing").then((module) => ({
    default: module.Landing,
  })),
);
const client = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});
try {
  document.documentElement.dataset.theme =
    localStorage.getItem("aegis-theme") === "light" ? "light" : "dark";
} catch {
  document.documentElement.dataset.theme = "dark";
}
function SiteEntry() {
  const location = useLocation();
  return (
    <Suspense
      fallback={
        <div className="login">
          <p role="status">Загрузка AegisBorder Supper…</p>
        </div>
      }
    >
      {location.pathname === "/" ? <Landing /> : <CommandCenter />}
      <SiteAssistant />
    </Suspense>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <EntryCheck><SiteEntry /></EntryCheck>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);

import React, { Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./style.css";
import "./redesign.css";
import "./profiles.css";
import "./superapp.css";
import "./emblems.css";
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
          <p role="status">Загрузка AegisBorder…</p>
        </div>
      }
    >
      {location.pathname === "/" ? <Landing /> : <CommandCenter />}
    </Suspense>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <SiteEntry />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);

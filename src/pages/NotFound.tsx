import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    if (import.meta.env.MODE !== "test") {
      console.error("404 Error: User attempted to access non-existent route:", location.pathname);
    }
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="panel-strong max-w-xl rounded-[36px] p-10 text-center">
        <p className="section-eyebrow">404</p>
        <h1 className="page-hero-title mt-4 font-semibold text-foreground">Page not found</h1>
        <p className="mt-4 text-[15px] leading-7 text-muted-foreground">
          The route you opened does not exist in this workspace. Head back to the landing page or return to the dashboard.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a href="/">
            <Button>Return home</Button>
          </a>
          <a href="/dashboard">
            <Button variant="outline">Open dashboard</Button>
          </a>
        </div>
      </div>
    </div>
  );
};

export default NotFound;

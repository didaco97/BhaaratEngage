import { Outlet } from "react-router-dom";

import AppHeader from "./AppHeader";
import AppSidebar from "./AppSidebar";

export default function AppLayout() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-12%] top-[-12%] h-80 w-80 rounded-full bg-primary/[0.18] blur-[120px]" />
        <div className="absolute right-[-8%] top-[18%] h-72 w-72 rounded-full bg-accent/[0.16] blur-[120px]" />
        <div className="absolute bottom-[-12%] left-[26%] h-72 w-72 rounded-full bg-chart-3/[0.12] blur-[140px]" />
      </div>

      <div className="relative mx-auto max-w-[1600px] px-4 py-4 sm:px-6 sm:py-6 lg:px-7">
        <AppSidebar />

        <div className="space-y-4 lg:ml-[314px]">
          <AppHeader />
          <main className="pb-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

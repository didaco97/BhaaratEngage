import { Outlet } from 'react-router-dom';
import AppSidebar from './AppSidebar';
import AppHeader from './AppHeader';

export default function AppLayout() {
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <div className="flex-1 ml-[240px] transition-all duration-300">
        <AppHeader />
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

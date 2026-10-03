import { useState, useEffect, useCallback } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import SearchModal from "./components/SearchModal";
import DoubleBounce from "./components/DoubleBounce";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Sales from "./pages/Sales";
import Expenses from "./pages/Expenses";
import Inventory from "./pages/Inventory";
import Import from "./pages/Import";
import Packaging from "./pages/Packaging";
import Users from "./pages/Users";
import Contacts from "./pages/Contacts";

const PAGES = {
  dashboard: Dashboard,
  sales: Sales,
  expenses: Expenses,
  inventory: Inventory,
  contacts: Contacts,
  import: Import,
  packaging: Packaging,
  users: Users,
};

// "users" is admin-only — enforced here (falls back to dashboard for
// anyone else) as well as on the backend (every /api/auth/users request
// requires the adminOnly middleware), so this is a UX guard, not the
// actual security boundary.
const ADMIN_ONLY_VIEWS = new Set(["users"]);

function AppShell() {
  const { user, isAdmin, logout } = useAuth();
  const [view, setView] = useState("dashboard");
  const [intent, setIntent] = useState({ term: null, opts: {} });
  const [navCounter, setNavCounter] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleNavigate = useCallback(
    (nextView, term = null, opts = {}) => {
      if (ADMIN_ONLY_VIEWS.has(nextView) && !isAdmin) {
        nextView = "dashboard";
      }
      setView(nextView);
      setIntent({ term, opts });
      setNavCounter((c) => c + 1);
    },
    [isAdmin],
  );

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const ActivePage = PAGES[view];

  return (
    <div className="flex min-h-screen">
      <Sidebar
        active={view}
        onNavigate={handleNavigate}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isAdmin={isAdmin}
        username={user?.username}
        onLogout={logout}
      />

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-ink/40 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className="flex-1 min-w-0 px-4 sm:px-6 md:px-8 py-5 md:py-8 max-w-[1400px]">
        <Header
          view={view}
          onNavigate={handleNavigate}
          onOpenSearch={() => setSearchOpen(true)}
          onOpenMenu={() => setSidebarOpen(true)}
          isAdmin={isAdmin}
        />
        <ActivePage
          key={navCounter}
          onNavigate={handleNavigate}
          initialSearch={intent.term}
          openFormOnLoad={intent.opts?.openForm}
        />
      </main>
      <SearchModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onNavigate={handleNavigate}
      />
    </div>
  );
}

function Gate() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="flex flex-col items-center gap-4">
          <DoubleBounce size="xl" />
        </div>
      </div>
    );
  }

  return user ? <AppShell /> : <Login />;
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}

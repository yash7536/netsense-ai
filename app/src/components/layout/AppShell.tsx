import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

const NAV_ITEMS = [
  { path: "/", label: "Overview" },
  { path: "/links", label: "Network Links" },
  { path: "/predictions", label: "Predictions" },
  { path: "/incidents", label: "Incidents" },
  { path: "/engineers", label: "Engineers" },
];

export default function AppShell() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-surface-container-low flex flex-col justify-between transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="pt-8 px-8">
          <div className="type-headline-md tracking-tight text-primary font-medium select-none">NetSense AI</div>
          <nav className="mt-12 flex flex-col space-y-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === "/"}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  `group relative px-3 py-2 type-body-md transition-colors duration-150 ${
                    isActive ? "text-primary font-medium bg-surface-container" : "text-on-surface-variant hover:text-primary"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </aside>
      {open && (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 bg-primary/20 z-40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      <div className="lg:pl-64 flex flex-col min-h-screen">
        <header className="fixed top-0 left-0 lg:left-64 right-0 h-16 bg-surface/80 backdrop-blur-xl z-30 flex items-center justify-between px-6 lg:px-12">
          <button
            className="lg:hidden p-1.5 text-on-surface-variant hover:text-primary transition-colors"
            onClick={() => setOpen((v) => !v)}
            type="button"
            aria-label="Toggle navigation"
          >
            <span className="material-symbols-outlined text-[22px]">menu</span>
          </button>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-4" />
        </header>
        <main className="flex-1 pt-16 w-full max-w-[1680px] mx-auto px-6 md:px-12 py-10">
          <div className="flex flex-col w-full route-transition" key={location.pathname}>
            <Outlet />
          </div>
        </main>
      </div>
    </>
  );
}

import { NavLink, Outlet } from "react-router";
import mascot from "../assets/mascot.png";
import { UpdateBanner } from "./UpdateBanner";

const menu = [
  { to: "/welcome", label: "홈" },
  { to: "/catalog", label: "하네스" },
  { to: "/plugins", label: "플러그인 · 오픈소스" },
  { to: "/tools", label: "내 도구" },
  { to: "/settings", label: "설정" },
];

export function AppShell() {
  return (
    <div className="flex min-h-screen bg-surface-bg dark:bg-surface-bg-dark">
      <aside className="w-56 shrink-0 border-r border-line dark:border-line-dark bg-surface-card dark:bg-surface-card-dark px-3 py-5">
        <div className="mb-6 flex items-center gap-2 px-2">
          <img src={mascot} alt="" className="h-8 w-8 object-contain" />
          <span className="font-extrabold tracking-tight">이지 하네스</span>
        </div>
        <nav className="flex flex-col gap-1">
          {menu.map((m) => (
            <NavLink
              key={m.to}
              to={m.to}
              className={({ isActive }) =>
                `rounded-button px-3 py-2 text-body ${
                  isActive
                    ? "bg-surface-gold-tint font-bold text-txt-primary"
                    : "text-txt-secondary hover:bg-surface-card-hover dark:hover:bg-surface-card-hover-dark"
                }`
              }
            >
              {m.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="min-w-0 flex-1 px-10 py-8">
        <UpdateBanner />
        <Outlet />
      </main>
    </div>
  );
}

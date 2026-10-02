import { cookies } from "next/headers";
import PortalHeader from "@/components/PortalHeader";
import ThemeToggle from "@/components/ThemeToggle";
import { ADMIN_THEME_COOKIE, type AdminTheme } from "@/lib/adminTheme";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const raw = cookies().get(ADMIN_THEME_COOKIE)?.value;
  const theme: AdminTheme = raw === "light" ? "light" : "dark";

  return (
    <div className="chess-bg-admin min-h-screen" data-theme={theme}>
      <div className="flex items-center justify-between gap-3 px-6 pt-1">
        <div className="flex-1">
          <PortalHeader label="Admin" />
        </div>
        <ThemeToggle current={theme} />
      </div>
      {children}
    </div>
  );
}

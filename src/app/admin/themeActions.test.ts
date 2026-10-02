import { describe, it, expect, vi } from "vitest";

const set = vi.fn();
vi.mock("next/headers", () => ({ cookies: () => ({ set }) }));

import { setAdminTheme } from "./themeActions";
import { ADMIN_THEME_COOKIE } from "@/lib/adminTheme";

describe("setAdminTheme", () => {
  it("αποθηκεύει την επιλογή σε cookie, για ένα χρόνο", async () => {
    await setAdminTheme("light");
    expect(set).toHaveBeenCalledWith(ADMIN_THEME_COOKIE, "light", { maxAge: 60 * 60 * 24 * 365, path: "/" });
  });

  it("δουλεύει και για τις δύο τιμές", async () => {
    await setAdminTheme("dark");
    expect(set).toHaveBeenCalledWith(ADMIN_THEME_COOKIE, "dark", expect.anything());
  });
});

"use server";

import { cookies } from "next/headers";
import { ADMIN_THEME_COOKIE, type AdminTheme } from "@/lib/adminTheme";

/** Αποθηκεύει την επιλογή του χρήστη (επιβεβαιωμένο: ο ίδιος αλλάζει τον διακόπτη) — ένα χρόνο, ίδιο μοτίβο με το cookie πρόσβασης. */
export async function setAdminTheme(theme: AdminTheme): Promise<void> {
  cookies().set(ADMIN_THEME_COOKIE, theme, { maxAge: 60 * 60 * 24 * 365, path: "/" });
}

/** Όνομα του μόνιμου cookie που κρατά το προσωπικό token πρόσβασης. */
export const ACCESS_COOKIE = "teamchamp_access";

export type AccessRole = "super_admin" | "tournament_admin" | "referee";

export interface Access {
  role: AccessRole;
  label: string;
  competition_ids: string[] | null;
}

const UUID_PATH = /^\/admin\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(\/|$)/i;

/**
 * Καθαρή συνάρτηση: επιτρέπεται ο ρόλος αυτός να ανοίξει αυτό το path;
 *
 * - super_admin: όλο το /admin και το /referee
 * - tournament_admin: /admin (αρχική) και /admin/<δική του διοργάνωση>/...
 *   (ΟΧΙ /admin/clubs και ΟΧΙ άλλες διοργανώσεις — να αποφασιστεί αργότερα
 *   αν χρειάζεται πρόσβαση στους Συλλόγους)
 * - referee: μόνο /referee
 */
export function isPathAllowed(access: Access, path: string): boolean {
  const inAdmin = path === "/admin" || path.startsWith("/admin/");
  const inReferee = path === "/referee" || path.startsWith("/referee/");

  switch (access.role) {
    case "super_admin":
      return inAdmin || inReferee;
    case "referee":
      return inReferee;
    case "tournament_admin": {
      if (!inAdmin) return false;
      if (path === "/admin") return true;
      const match = path.match(UUID_PATH);
      if (!match) return false;
      return (access.competition_ids ?? []).includes(match[1]);
    }
    default:
      return false;
  }
}

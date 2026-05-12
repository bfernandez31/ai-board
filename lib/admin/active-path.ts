export function isAdminItemActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  // FR-009 / D-3 root carve-out: `/admin` matches only itself, never its
  // nested admin sections (so the "Accueil" item never claims `/admin/insights`).
  if (href === '/admin') return false;
  if (pathname.startsWith(href + '/')) return true;
  return false;
}

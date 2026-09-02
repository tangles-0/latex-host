const NODE_DISABLED_API_PREFIXES = [
  "/api/admin",
  "/api/messages",
  "/api/pgp",
  "/api/device",
  "/api/account/devices",
  "/api/account/pgp-key",
  "/api/account/nodes",
  "/api/nodes",
  "/api/image-generations",
  "/api/abuse-reports",
  "/api/auth/signup",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
] as const;

const NODE_DISABLED_PAGE_PREFIXES = [
  "/admin",
  "/messages",
  "/account/nodes",
  "/report-abuse",
  "/promote-admin",
  "/reset-password",
] as const;

const matchesPrefix = (pathname: string, prefix: string): boolean =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

export const isNodeDisabledApiPath = (pathname: string): boolean =>
  NODE_DISABLED_API_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));

export const isNodeDisabledPagePath = (pathname: string): boolean =>
  NODE_DISABLED_PAGE_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));

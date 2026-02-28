export type RouteRule = { prefix: string; roles: string[] };

export const ROUTE_RULES: RouteRule[] = [
  { prefix: '/tasks', roles: ['MANAGER', 'WORKER'] },
  { prefix: '/finance', roles: ['OWNER', 'MANAGER'] },
  { prefix: '/inventory', roles: ['OWNER', 'MANAGER'] },
  { prefix: '/procurement', roles: ['OWNER', 'MANAGER'] },
  { prefix: '/payroll', roles: ['OWNER', 'MANAGER'] },
  { prefix: '/digest', roles: ['OWNER', 'MANAGER'] },
  { prefix: '/monitoring', roles: ['OWNER', 'MANAGER'] },
  { prefix: '/audits', roles: ['OWNER', 'MANAGER'] },
  { prefix: '/vendor', roles: ['OWNER', 'MANAGER'] },
  { prefix: '/updates/daily', roles: ['OWNER', 'MANAGER'] },
  { prefix: '/updates', roles: ['OWNER', 'MANAGER', 'WORKER'] },
  { prefix: '/incidents', roles: ['OWNER', 'MANAGER', 'WORKER'] },
  { prefix: '/offline', roles: ['OWNER', 'MANAGER', 'WORKER'] },
];

export function hasRouteAccess(pathname: string, role: string | null | undefined, rules: RouteRule[] = ROUTE_RULES) {
  const matchedRule = rules.find((rule) => pathname.startsWith(rule.prefix));
  return !matchedRule || matchedRule.roles.includes(role || '');
}

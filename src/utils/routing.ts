import type { RouteName } from '../types/app';

export function parseRoute(pathname: string): RouteName {
  if (pathname === '/remplir') return 'remplir';
  return 'design';
}

export function routePath(route: RouteName) {
  return `/${route}`;
}

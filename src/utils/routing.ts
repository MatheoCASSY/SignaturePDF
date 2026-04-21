import type { RouteName } from '../types/app';

export function parseRoute(pathname: string): RouteName {
  if (pathname === '/' || pathname === '/login') return 'login';
  if (pathname === '/admin' || pathname === '/design') return 'admin';
  if (pathname === '/access') return 'access';
  if (pathname === '/user' || pathname === '/remplir') return 'user';
  return 'login';
}

export function routePath(route: RouteName) {
  if (route === 'login') return '/login';
  if (route === 'admin') return '/admin';
  if (route === 'access') return '/access';
  return '/user';
}

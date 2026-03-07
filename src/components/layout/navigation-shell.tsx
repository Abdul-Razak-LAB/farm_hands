'use client';

import { useEffect, useState } from 'react';
import { useAuth } from './auth-provider';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { db } from '@/lib/db';
import { hasRouteAccess, ROUTE_RULES } from './route-access';
import { 
  HomeIcon, 
  CheckCircleIcon, 
  ChatBubbleLeftRightIcon,
  Squares2X2Icon,
  BanknotesIcon, 
  ClipboardDocumentCheckIcon,
  SignalIcon,
  ShoppingCartIcon,
  CreditCardIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  BellAlertIcon,
  BuildingStorefrontIcon,
  Cog6ToothIcon,
  EllipsisHorizontalCircleIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';
import { useOutboxStore } from '@/lib/store/outbox';
import { useIntegrationStatus } from '@/hooks/use-integration-status';

export function NavigationShell({ children }: { children: React.ReactNode }) {
  const { role, isLoading, isAuthenticated, isRegistered, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const integrationStatus = useIntegrationStatus();
  const pendingCount = useOutboxStore((state) => state.pendingCount);
  const setPendingCount = useOutboxStore((state) => state.setPendingCount);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const isStandaloneRoute = pathname === '/register' || pathname === '/login';

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      if (isStandaloneRoute) {
        return;
      }

      const target = isRegistered ? '/login' : '/register';
      if (pathname !== target) {
        router.replace(target);
      }
      return;
    }

  }, [isAuthenticated, isLoading, isRegistered, isStandaloneRoute, pathname, router]);

  useEffect(() => {
    let cancelled = false;

    const refreshPendingCount = async () => {
      const count = await db.outbox.where('status').equals('PENDING').count();
      if (!cancelled) {
        setPendingCount(count);
      }
    };

    void refreshPendingCount();
    const interval = window.setInterval(() => {
      void refreshPendingCount();
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [setPendingCount]);

  useEffect(() => {
    setIsMoreOpen(false);
  }, [pathname]);

  const navItems = [
    { name: 'Home', href: '/', icon: HomeIcon, roles: ['OWNER', 'MANAGER', 'WORKER'] },
    { name: 'Setup', href: '/setup', icon: Cog6ToothIcon, roles: ['OWNER', 'MANAGER', 'WORKER'] },
    { name: 'Market', href: '/marketplace', icon: Squares2X2Icon, roles: ['OWNER', 'MANAGER', 'WORKER'] },
    { name: 'Tasks', href: '/tasks', icon: CheckCircleIcon, roles: ['MANAGER', 'WORKER'] },
    { name: 'Finance', href: '/finance', icon: BanknotesIcon, roles: ['OWNER', 'MANAGER'] },
    { name: 'Reports', href: '/reports', icon: ChartBarIcon, roles: ['OWNER', 'MANAGER'] },
    { name: 'Updates', href: '/updates', icon: CalendarDaysIcon, roles: ['OWNER', 'MANAGER', 'WORKER'] },
    { name: 'Digest', href: '/digest', icon: ChartBarIcon, roles: ['OWNER', 'MANAGER'] },
    { name: 'Procure', href: '/procurement', icon: ShoppingCartIcon, roles: ['OWNER', 'MANAGER'] },
    { name: 'Payroll', href: '/payroll', icon: CreditCardIcon, roles: ['OWNER', 'MANAGER'] },
    { name: 'Monitor', href: '/monitoring', icon: BellAlertIcon, roles: ['OWNER', 'MANAGER'] },
    { name: 'Incident', href: '/incidents', icon: BellAlertIcon, roles: ['OWNER', 'MANAGER', 'WORKER'] },
    { name: 'Messages', href: '/messages', icon: ChatBubbleLeftRightIcon, roles: ['OWNER', 'MANAGER', 'WORKER'] },
    { name: 'Consultation', href: '/consultation', icon: ChatBubbleLeftRightIcon, roles: ['OWNER', 'MANAGER', 'WORKER'] },
    { name: 'Vendor', href: '/vendor', icon: BuildingStorefrontIcon, roles: ['OWNER', 'MANAGER'] },
    { name: 'Audits', href: '/audits', icon: ClipboardDocumentCheckIcon, roles: ['OWNER', 'MANAGER'] },
    { name: 'Offline', href: '/offline', icon: SignalIcon, roles: ['OWNER', 'MANAGER', 'WORKER'], badge: pendingCount },
  ];

  const filteredNav = navItems.filter((item) => item.roles.includes(role!));
  const mobilePrimaryHrefs = ['/setup', '/reports', '/finance', '/incidents'];
  const mobilePrimaryNav = mobilePrimaryHrefs
    .map((href) => filteredNav.find((item) => item.href === href))
    .filter((item): item is (typeof filteredNav)[number] => Boolean(item));
  const mobileMoreNav = filteredNav.filter((item) => !mobilePrimaryHrefs.includes(item.href));
  const hasRouteAccessForPath = hasRouteAccess(pathname, role, ROUTE_RULES);
  const blockingIntegrations = integrationStatus.data?.upload === false
    ? ['upload']
    : [];
  const isMediaRoute = pathname.startsWith('/tasks')
    || pathname.startsWith('/vendor')
    || pathname.startsWith('/updates')
    || pathname.startsWith('/incidents');
  const shouldShowUploadBanner = blockingIntegrations.length > 0 && isMediaRoute;

  const handleLogout = () => {
    setIsMoreOpen(false);
    logout();
    router.replace(isRegistered ? '/login' : '/register');
  };

  if (isLoading) {
    return <div className="min-h-screen bg-background text-foreground" />;
  }

  if (!isAuthenticated && !isStandaloneRoute) {
    return <div className="min-h-screen bg-background text-foreground" />;
  }

  if (isStandaloneRoute) {
    return <div className="min-h-screen bg-background text-foreground">{children}</div>;
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:bg-background/60 md:backdrop-blur-sm">
        <div className="p-4 border-b">
          <h1 className="text-lg font-bold">FarmOps</h1>
          <p className="text-xs text-muted-foreground uppercase">{role} workspace</p>
        </div>
        <nav className="p-3 space-y-1 overflow-y-auto">
          {filteredNav.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                pathname === item.href ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/60'
              )}
            >
              <div className="relative">
                <item.icon className="h-5 w-5" />
                {item.badge && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground">
                    {item.badge}
                  </span>
                )}
              </div>
              <span>{item.name}</span>
            </Link>
          ))}
        </nav>
        <div className="border-t p-3">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
          >
            <ArrowRightOnRectangleIcon className="h-4 w-4" />
            Log out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
      <main className="flex-1 pt-16 md:pt-0 pb-[calc(6.75rem+env(safe-area-inset-bottom))] md:pb-8">
        {shouldShowUploadBanner ? (
          <div className="mx-auto w-full max-w-6xl px-4 pt-4 md:px-6">
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              Upload integration is unavailable. Media upload controls are disabled until storage is configured.
            </div>
          </div>
        ) : null}
        {hasRouteAccessForPath ? (
          children
        ) : (
          <div className="p-8 max-w-3xl mx-auto w-full space-y-3">
            <h1 className="text-xl font-bold">Access Restricted</h1>
            <p className="text-sm text-muted-foreground">
              Current role does not have access to this module. Switch role from the selector in the top-right to preview authorized surfaces.
            </p>
          </div>
        )}
      </main>
      
      {/* Mobile More Drawer */}
      {isMoreOpen ? (
        <div className="fixed inset-x-0 bottom-[calc(5.8rem+env(safe-area-inset-bottom))] z-40 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] md:hidden">
          <div className="mx-auto max-w-sm sm:max-w-xl rounded-2xl border border-border/80 bg-background/95 p-3 shadow-[0_-10px_30px_rgba(2,8,23,0.18)] backdrop-blur-2xl">
            {mobileMoreNav.length > 0 ? (
              <>
                <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">More</p>
                <ul className="grid grid-cols-3 gap-2">
                  {mobileMoreNav.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

                    return (
                      <li key={item.name}>
                        <Link
                          href={item.href}
                          onClick={() => setIsMoreOpen(false)}
                          className={cn(
                            'group flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] font-semibold transition-colors',
                            isActive ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground'
                          )}
                        >
                          <div className="relative grid h-7 w-7 place-items-center rounded-lg">
                            <item.icon className="h-5 w-5" />
                            {item.badge && item.badge > 0 ? (
                              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground">
                                {item.badge}
                              </span>
                            ) : null}
                          </div>
                          <span className="max-w-[4.6rem] truncate text-center">{item.name}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : null}
            <button
              type="button"
              onClick={handleLogout}
              className={cn(
                'flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-border bg-background text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground',
                mobileMoreNav.length > 0 ? 'mt-3' : ''
              )}
            >
              <ArrowRightOnRectangleIcon className="h-4 w-4" />
              Log out
            </button>
          </div>
        </div>
      ) : null}

      {/* Mobile Bottom Navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-40 pl-[max(0.75rem,env(safe-area-inset-left))] pr-[max(0.75rem,env(safe-area-inset-right))] pb-[calc(0.6rem+env(safe-area-inset-bottom))] md:hidden">
        <div className="mx-auto max-w-sm sm:max-w-xl rounded-[1.6rem] border border-border/80 bg-background/95 p-1.5 shadow-[0_-14px_32px_rgba(2,8,23,0.2)] backdrop-blur-2xl">
        <ul
          className="grid items-center gap-1 px-0.5"
          style={{ gridTemplateColumns: `repeat(${mobilePrimaryNav.length + 1}, minmax(0, 1fr))` }}
        >
          {mobilePrimaryNav.map((item) => (
            <li key={item.name} className="min-w-0">
              {(() => {
                const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
              <Link
                href={item.href}
                className={cn(
                  'group relative flex w-full flex-col items-center gap-1 rounded-[1.1rem] px-2 py-1.5 text-[11px] font-semibold leading-none transition-all duration-200',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-[0_6px_14px_hsl(var(--primary)/0.32)]'
                    : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground'
                )}
              >
                <div
                  className={cn(
                    'relative grid h-8 w-8 place-items-center rounded-lg transition-all duration-200',
                    isActive ? 'bg-primary-foreground/18' : 'group-hover:bg-accent'
                  )}
                >
                  <item.icon className={cn('h-5 w-5 transition-transform duration-200', isActive ? 'stroke-[2.5] scale-105' : 'stroke-2')} />
                  {item.badge && item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className="max-w-[4.6rem] truncate text-center">{item.name}</span>
                {isActive ? <span className="h-1 w-1 rounded-full bg-primary-foreground" /> : null}
              </Link>
                );
              })()}
            </li>
          ))}
          <li className="min-w-0">
            <button
              type="button"
              aria-label="More options"
              aria-expanded={isMoreOpen}
              onClick={() => setIsMoreOpen((prev) => !prev)}
              className={cn(
                'group relative flex w-full flex-col items-center gap-1 rounded-[1.1rem] px-2 py-1.5 text-[11px] font-semibold leading-none transition-all duration-200',
                isMoreOpen
                  ? 'bg-primary text-primary-foreground shadow-[0_6px_14px_hsl(var(--primary)/0.32)]'
                  : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground'
              )}
            >
              <div
                className={cn(
                  'relative grid h-8 w-8 place-items-center rounded-lg transition-all duration-200',
                  isMoreOpen ? 'bg-primary-foreground/18' : 'group-hover:bg-accent'
                )}
              >
                <EllipsisHorizontalCircleIcon className={cn('h-5 w-5 transition-transform duration-200', isMoreOpen ? 'stroke-[2.5] scale-105' : 'stroke-2')} />
              </div>
              <span className="max-w-[4.6rem] truncate text-center">More</span>
              {isMoreOpen ? <span className="h-1 w-1 rounded-full bg-primary-foreground" /> : null}
            </button>
          </li>
        </ul>
        </div>
      </nav>
      </div>
    </div>
  );
}

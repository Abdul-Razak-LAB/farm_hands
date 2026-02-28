'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from './auth-provider';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useTheme } from '@/app/providers';
import { db } from '@/lib/db';
import { hasRouteAccess, ROUTE_RULES } from './route-access';
import { 
  HomeIcon, 
  CheckCircleIcon, 
  BanknotesIcon, 
  ClipboardDocumentCheckIcon,
  SignalIcon,
  ShoppingCartIcon,
  CreditCardIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  BellAlertIcon,
  BuildingStorefrontIcon
} from '@heroicons/react/24/outline';
import { useOutboxStore } from '@/lib/store/outbox';
import { useIntegrationStatus } from '@/hooks/use-integration-status';

export function NavigationShell({ children }: { children: React.ReactNode }) {
  const { role, setRole, isLoading, isAuthenticated, isRegistered, logout } = useAuth();
  const { mode, setThemeMode } = useTheme();
  const [controlsOpen, setControlsOpen] = useState(false);
  const [quickAction, setQuickAction] = useState('');
  const controlsMenuRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const integrationStatus = useIntegrationStatus();
  const pendingCount = useOutboxStore((state) => state.pendingCount);
  const setPendingCount = useOutboxStore((state) => state.setPendingCount);
  const isStandaloneRoute = pathname === '/register' || pathname === '/login';

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
    }

    logout();
    setControlsOpen(false);
    router.replace('/login');
  };

  const handleQuickAction = async (action: string) => {
    if (!action) return;

    if (action === 'theme:light') {
      setThemeMode('light');
      setControlsOpen(false);
      return;
    }

    if (action === 'theme:dark') {
      setThemeMode('dark');
      setControlsOpen(false);
      return;
    }

    if (action === 'role:OWNER' || action === 'role:MANAGER' || action === 'role:WORKER') {
      const nextRole = action.replace('role:', '') as 'OWNER' | 'MANAGER' | 'WORKER';
      setRole(nextRole);
      setControlsOpen(false);
      return;
    }

    if (action === 'logout') {
      await handleLogout();
    }
  };

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

    if (isAuthenticated && isStandaloneRoute) {
      router.replace('/');
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
    if (!controlsOpen) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (controlsMenuRef.current?.contains(target)) return;
      setControlsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setControlsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, { passive: true });
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [controlsOpen]);

  const navItems = [
    { name: 'Home', href: '/', icon: HomeIcon, roles: ['OWNER', 'MANAGER', 'WORKER'] },
    { name: 'Tasks', href: '/tasks', icon: CheckCircleIcon, roles: ['MANAGER', 'WORKER'] },
    { name: 'Finance', href: '/finance', icon: BanknotesIcon, roles: ['OWNER', 'MANAGER'] },
    { name: 'Updates', href: '/updates', icon: CalendarDaysIcon, roles: ['OWNER', 'MANAGER', 'WORKER'] },
    { name: 'Digest', href: '/digest', icon: ChartBarIcon, roles: ['OWNER', 'MANAGER'] },
    { name: 'Procure', href: '/procurement', icon: ShoppingCartIcon, roles: ['OWNER', 'MANAGER'] },
    { name: 'Payroll', href: '/payroll', icon: CreditCardIcon, roles: ['OWNER', 'MANAGER'] },
    { name: 'Monitor', href: '/monitoring', icon: BellAlertIcon, roles: ['OWNER', 'MANAGER'] },
    { name: 'Incident', href: '/incidents', icon: BellAlertIcon, roles: ['OWNER', 'MANAGER', 'WORKER'] },
    { name: 'Vendor', href: '/vendor', icon: BuildingStorefrontIcon, roles: ['OWNER', 'MANAGER'] },
    { name: 'Audits', href: '/audits', icon: ClipboardDocumentCheckIcon, roles: ['OWNER', 'MANAGER'] },
    { name: 'Offline', href: '/offline', icon: SignalIcon, roles: ['OWNER', 'MANAGER', 'WORKER'], badge: pendingCount },
  ];

  const filteredNav = navItems.filter((item) => item.roles.includes(role!));

  const hasRouteAccessForPath = hasRouteAccess(pathname, role, ROUTE_RULES);
  const unavailableIntegrations = integrationStatus.data
    ? (Object.entries(integrationStatus.data).filter(([, available]) => !available).map(([name]) => name))
    : [];

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
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
      <div ref={controlsMenuRef} className="fixed top-3 right-3 z-50">
        <button
          onClick={() => setControlsOpen((current) => !current)}
          className="h-10 rounded-full border bg-background/90 backdrop-blur px-3 text-[10px] font-semibold uppercase"
          aria-expanded={controlsOpen}
        >
          ☰ Controls
        </button>

      {controlsOpen ? (
        <div className="mt-1 w-[min(92vw,320px)] rounded-xl border bg-background/95 backdrop-blur p-3 space-y-3">
          <div className="space-y-1">
            <p className="text-[10px] uppercase text-muted-foreground font-semibold">Select Control</p>
            <select
              value={quickAction}
              onChange={(event) => {
                const nextAction = event.target.value;
                setQuickAction('');
                void handleQuickAction(nextAction);
              }}
              className="w-full h-10 rounded-md bg-accent/40 px-3 text-sm"
            >
              <option value="">Choose action...</option>
              <option value="theme:light">Light</option>
              <option value="theme:dark">Dark</option>
              <option value="role:OWNER">Owner</option>
              <option value="role:MANAGER">Manager</option>
              <option value="role:WORKER">Worker</option>
              <option value="logout">Logout</option>
            </select>
            <p className="text-[10px] text-muted-foreground">
              Current: theme {mode}, role {role}
            </p>
          </div>
        </div>
      ) : null}
      </div>
      <main className="flex-1 pt-16 md:pt-0 pb-20 md:pb-8">
        {unavailableIntegrations.length > 0 ? (
          <div className="mx-auto w-full max-w-6xl px-4 pt-4 md:px-6">
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
              Limited integrations: {unavailableIntegrations.join(', ')}. Related controls are disabled until service is restored.
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
      
      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 border-t bg-background/80 backdrop-blur-md px-2 py-2 md:hidden">
        <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-background/95 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-background/95 to-transparent" />
        <ul className="flex items-center gap-1 overflow-x-auto whitespace-nowrap no-scrollbar px-1">
          {filteredNav.map((item) => (
            <li key={item.name} className="shrink-0">
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 p-2 min-w-16 text-xs font-medium transition-colors",
                  pathname === item.href ? "text-primary" : "text-muted-foreground"
                )}
              >
                <div className="relative">
                  <item.icon className="h-6 w-6" />
                  {item.badge && item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground">
                      {item.badge}
                    </span>
                  )}
                </div>
                {item.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      </div>
    </div>
  );
}

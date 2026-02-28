'use client';

import { useAuth } from './auth-provider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

type Role = 'OWNER' | 'MANAGER' | 'WORKER';

interface RoleGuardProps {
    children: React.ReactNode;
    allowedRoles: Role[];
}

export function RoleGuard({ children, allowedRoles }: RoleGuardProps) {
    const { role, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && role && !allowedRoles.includes(role)) {
            router.push('/');
        }
    }, [role, isLoading, allowedRoles, router]);

    if (isLoading || !role || !allowedRoles.includes(role)) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-background">
                <div className="animate-pulse flex flex-col items-center gap-4">
                    <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                    <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Verifying Access...</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}

'use client';

import React, { createContext, useContext, ReactNode, useEffect, useMemo, useState } from 'react';

type Role = 'OWNER' | 'MANAGER' | 'WORKER';

interface AuthContextType {
  role: Role | null;
  farmId: string | null;
  isLoading: boolean;
  isRegistered: boolean;
  isAuthenticated: boolean;
  setRole: (role: Role) => void;
  setFarmId: (farmId: string) => void;
  setRegistered: (registered: boolean) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role | null>(null);
  const [farmId, setFarmIdState] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const registered = localStorage.getItem('farmops.registered') === 'true';
      const storedRole = localStorage.getItem('farmops.role');
      const storedFarmId = localStorage.getItem('farmops.farmId');

      setIsRegistered(registered);

      if (!registered) {
        localStorage.removeItem('farmops.role');
        localStorage.removeItem('farmops.farmId');
        return;
      }

      if (storedRole === 'OWNER' || storedRole === 'MANAGER' || storedRole === 'WORKER') {
        setRoleState(storedRole);
      }

      if (storedFarmId && storedFarmId.trim().length > 0) {
        setFarmIdState(storedFarmId);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setRole = (nextRole: Role) => {
    setRoleState(nextRole);
    localStorage.setItem('farmops.role', nextRole);
  };

  const setFarmId = (nextFarmId: string) => {
    setFarmIdState(nextFarmId);
    localStorage.setItem('farmops.farmId', nextFarmId);
  };

  const setRegistered = (registered: boolean) => {
    setIsRegistered(registered);
    localStorage.setItem('farmops.registered', registered ? 'true' : 'false');

    if (!registered) {
      setRoleState(null);
      setFarmIdState(null);
      localStorage.removeItem('farmops.role');
      localStorage.removeItem('farmops.farmId');
    }
  };

  const logout = () => {
    setRoleState(null);
    setFarmIdState(null);
    localStorage.removeItem('farmops.role');
    localStorage.removeItem('farmops.farmId');
  };

  const auth = useMemo(() => ({
    role,
    farmId,
    isLoading,
    isRegistered,
    isAuthenticated: Boolean(role && farmId),
    setRole,
    setFarmId,
    setRegistered,
    logout,
  }), [role, farmId, isLoading, isRegistered]);

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

'use client';

import { useQuery } from '@tanstack/react-query';

type IntegrationStatus = {
  upload: boolean;
  push: boolean;
  email: boolean;
};

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
};

async function fetchIntegrationStatus() {
  const response = await fetch('/api/integrations/status', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });
  const json = (await response.json()) as ApiEnvelope<IntegrationStatus>;
  if (!json.success || !json.data) {
    throw new Error(json.error?.message || 'Unable to load integration status');
  }
  return json.data;
}

export function useIntegrationStatus() {
  return useQuery({
    queryKey: ['integration-status'],
    queryFn: fetchIntegrationStatus,
    staleTime: 1000 * 60,
  });
}

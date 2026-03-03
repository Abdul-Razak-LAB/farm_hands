type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
};

function getFinanceRequestHeaders(options?: RequestInit): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (typeof window !== 'undefined') {
    const role = window.localStorage.getItem('farmops.role');
    const farmId = window.localStorage.getItem('farmops.farmId');

    if (role === 'OWNER' || role === 'MANAGER' || role === 'WORKER') {
      headers['x-farm-role'] = role;
    }

    if (farmId && farmId.trim().length > 0) {
      headers['x-user-id'] = `farm-user-${farmId.slice(0, 8)}`;
    }
  }

  return {
    ...headers,
    ...(options?.headers || {}),
  };
}

export async function financeApiCall<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: getFinanceRequestHeaders(options),
  });

  const json = (await response.json()) as ApiEnvelope<T>;
  if (!json.success) {
    throw new Error(json.error?.message || 'Request failed');
  }

  return json.data as T;
}

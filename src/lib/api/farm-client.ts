import type { ApiEnvelope } from '@/lib/api/contracts';

async function parseEnvelope<T>(response: Response): Promise<T> {
  const json = (await response.json()) as ApiEnvelope<T>;
  if (!json.success) {
    throw new Error(json.error?.message || 'Request failed');
  }

  return json.data as T;
}

export async function getFarmData<T>(farmId: string, path: string): Promise<T> {
  const response = await fetch(`/api/farms/${farmId}${path}`, {
    method: 'GET',
  });

  return parseEnvelope<T>(response);
}

export async function postFarmData<T>(farmId: string, path: string, body: unknown): Promise<T> {
  const response = await fetch(`/api/farms/${farmId}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  return parseEnvelope<T>(response);
}

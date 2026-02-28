import { z } from 'zod';

export const API_BASE = '/api/v1';

export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.any().optional(),
  }).optional(),
});

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
};

class ApiClient {
  private async request<T>(path: string, options?: RequestInit): Promise<ApiResponse<T>> {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    const json = await response.json();
    const result = ApiResponseSchema.safeParse(json);

    if (!result.success) {
      throw new Error('Invalid API response format');
    }

    return json as ApiResponse<T>;
  }

  async get<T>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>(path, { method: 'GET' });
  }

  async post<T>(path: string, body: any): Promise<ApiResponse<T>> {
    return this.request<T>(path, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  // Idempotent write helper
  async idempotentPost<T>(path: string, body: any, idempotencyKey: string): Promise<ApiResponse<T>> {
    return this.request<T>(path, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'X-Idempotency-Key': idempotencyKey,
      },
    });
  }
}

export const apiClient = new ApiClient();

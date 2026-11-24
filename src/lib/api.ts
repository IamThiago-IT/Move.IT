export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

interface ApiErrorBody {
  error?: string;
  code?: string;
}

export async function apiFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });

  const body = (await response.json().catch(() => null)) as T | ApiErrorBody | null;

  if (!response.ok) {
    const error = body as ApiErrorBody | null;

    throw new ApiClientError(
      error?.error ?? "Não foi possível concluir a solicitação.",
      response.status,
      error?.code,
    );
  }

  return body as T;
}

import type { ApiErrorBody, ApiSuccessBody, ErrorCode } from "@/lib/api/errors";

/** Error thrown by `apiFetch`; carries the API's error code for the UI. */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/** Fetches an API route and unwraps `{ data }`, or throws a typed ApiError. */
export async function apiFetch<T>(input: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input, {
      ...init,
      headers: { "content-type": "application/json", ...init?.headers },
    });
  } catch {
    throw new ApiError("UPSTREAM_ERROR", "Network error. Check your connection.", 0);
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(body?.error?.code ?? "INTERNAL_ERROR", body?.error?.message ?? "Something went wrong.", response.status, body?.error?.details);
  }
  const body = (await response.json().catch(() => null)) as ApiSuccessBody<T> | null;
  if (!body || !("data" in body)) throw new ApiError("INTERNAL_ERROR", "Something went wrong.", response.status);
  return body.data;
}

/** One place that turns error codes into what the user reads. */
export function friendlyErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return "Something went wrong. Please try again.";
  switch (error.code) {
    case "RATE_LIMITED":
    case "BUDGET_EXCEEDED":
    case "VALIDATION_ERROR":
      return error.message;
    case "NOT_FOUND":
      return "That item doesn't exist (anymore).";
    case "UNAUTHORIZED":
      return "Enter the access code to use the app.";
    case "UPSTREAM_ERROR":
      return error.message || "A data source is unavailable right now.";
    default:
      return "Something went wrong. Please try again.";
  }
}

/**
 * The only error codes the API ever returns. Shared by server and client,
 * so the UI can map each code to a friendly message in one place.
 */
export const ERROR_CODES = {
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  BUDGET_EXCEEDED: 429,
  UPSTREAM_ERROR: 502,
  INTERNAL_ERROR: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export interface ApiErrorBody {
  error: { code: ErrorCode; message: string; details?: unknown; requestId?: string };
}

export interface ApiSuccessBody<T> {
  data: T;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = ERROR_CODES[code];
    this.details = details;
  }
}

export const notFound = (what: string) => new AppError("NOT_FOUND", `${what} not found.`);

import "server-only";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { AppError, type ApiErrorBody, type ApiSuccessBody } from "./errors";

type Handler<Ctx> = (request: NextRequest, context: Ctx & { requestId: string }) => Promise<Response>;

/**
 * Wraps every Route Handler: adds a request id, turns AppErrors into their
 * status + body, and turns anything unexpected into a 500 without leaking internals.
 */
export function route<Ctx = object>(handler: Handler<Ctx>) {
  return async (request: NextRequest, context: Ctx): Promise<Response> => {
    const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
    try {
      const response = await handler(request, { ...context, requestId });
      response.headers.set("x-request-id", requestId);
      return response;
    } catch (error) {
      if (error instanceof AppError) {
        if (error.status >= 500) logger.error("api error", { requestId, code: error.code, message: error.message });
        return fail(error, requestId);
      }
      logger.error("unhandled api error", { requestId, error: String(error), stack: (error as Error)?.stack });
      return fail(new AppError("INTERNAL_ERROR", "Something went wrong. Please try again."), requestId);
    }
  };
}

export function ok<T>(data: T, init?: ResponseInit): Response {
  return Response.json({ data } satisfies ApiSuccessBody<T>, init);
}

function fail(error: AppError, requestId: string): Response {
  const body: ApiErrorBody = {
    error: { code: error.code, message: error.message, details: error.details, requestId },
  };
  const headers = new Headers({ "x-request-id": requestId });
  const retryAfter = (error.details as { retryAfterSeconds?: number } | undefined)?.retryAfterSeconds;
  if (retryAfter) headers.set("retry-after", String(retryAfter));
  return Response.json(body, { status: error.status, headers });
}

function validationError(error: z.ZodError): AppError {
  const fields = error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
  return new AppError("VALIDATION_ERROR", "Some inputs are invalid.", { fields });
}

export async function parseJson<S extends z.ZodType>(request: Request, schema: S): Promise<z.infer<S>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new AppError("VALIDATION_ERROR", "Request body must be valid JSON.");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw validationError(parsed.error);
  return parsed.data;
}

export function parseQuery<S extends z.ZodType>(request: NextRequest, schema: S): z.infer<S> {
  const parsed = schema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) throw validationError(parsed.error);
  return parsed.data;
}

export function parseParams<S extends z.ZodType>(params: unknown, schema: S): z.infer<S> {
  const parsed = schema.safeParse(params);
  if (!parsed.success) throw new AppError("NOT_FOUND", "Not found.");
  return parsed.data;
}

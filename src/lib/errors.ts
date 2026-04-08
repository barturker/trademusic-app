import type { ErrorKind } from "@/types/api";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly kind: ErrorKind,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function mapErrorKind(error: unknown): ErrorKind {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "abort";
  }

  if (error instanceof TypeError && error.message.includes("fetch")) {
    return "network";
  }

  if (error instanceof Response) {
    if (error.status === 401) return "auth";
    if (error.status === 403) return "forbidden";
    if (error.status === 404) return "not_found";
    if (error.status === 410) return "gone";
  }

  return "unknown";
}

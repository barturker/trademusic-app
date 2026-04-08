export type ErrorKind = "network" | "auth" | "forbidden" | "not_found" | "gone" | "abort" | "unknown";

export type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; kind: ErrorKind };

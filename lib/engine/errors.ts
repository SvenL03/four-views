// Errors the engine layer throws. Messages are safe to log; they never contain keys.

export type EngineErrorCode =
  | "refused" // the model declined (stop_reason "refusal")
  | "truncated" // hit max_tokens before finishing
  | "invalid-output" // could not get schema-valid JSON, even after a repair call
  | "unsourced" // no citable source survived the URL check
  | "rate-limited"
  | "auth"
  | "bad-request"
  | "upstream" // 5xx, overload, network
  | "aborted"
  | "invalid-topic"; // validate() could not repair the topic

export class EngineError extends Error {
  code: EngineErrorCode;
  retryable: boolean;
  constructor(code: EngineErrorCode, message: string, retryable = false) {
    super(message);
    this.name = "EngineError";
    this.code = code;
    this.retryable = retryable;
  }
}

export function isAbort(e: unknown): boolean {
  return (
    (e instanceof EngineError && e.code === "aborted") ||
    (e instanceof Error && (e.name === "AbortError" || e.name === "APIUserAbortError"))
  );
}

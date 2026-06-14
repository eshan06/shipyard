/**
 * A tiny, dependency-free `Result` type for modelling fallible operations
 * without throwing. Inspired by Rust's `Result<T, E>`.
 *
 * Use `Result` at module/service boundaries where a caller is expected to
 * branch on success/failure (e.g. parsing, decryption, domain validation),
 * and reserve thrown {@link AppError}s for genuinely exceptional control flow.
 *
 * @example
 * ```ts
 * function parsePort(raw: string): Result<number, string> {
 *   const n = Number(raw);
 *   return Number.isInteger(n) ? ok(n) : err(`not an integer: ${raw}`);
 * }
 *
 * const r = parsePort("8080");
 * if (isOk(r)) {
 *   console.log(r.value); // 8080
 * }
 * ```
 *
 * @module
 */

/**
 * The successful variant of a {@link Result}. Carries the produced `value`.
 *
 * @typeParam T - Type of the success value.
 */
export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

/**
 * The failure variant of a {@link Result}. Carries the `error`.
 *
 * @typeParam E - Type of the error value (defaults to {@link Error}).
 */
export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

/**
 * A discriminated union representing either success ({@link Ok}) or failure
 * ({@link Err}). Discriminate on the readonly `ok` boolean tag.
 *
 * @typeParam T - Type of the success value.
 * @typeParam E - Type of the error value (defaults to {@link Error}).
 */
export type Result<T, E = Error> = Ok<T> | Err<E>;

/**
 * Construct a successful {@link Result}.
 *
 * @typeParam T - Type of the success value.
 * @param value - The success payload.
 * @returns An {@link Ok} wrapping `value`.
 */
export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

/**
 * Construct a failed {@link Result}.
 *
 * @typeParam E - Type of the error value.
 * @param error - The error payload.
 * @returns An {@link Err} wrapping `error`.
 */
export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

/**
 * Type guard narrowing a {@link Result} to its {@link Ok} variant.
 *
 * @param result - The result to inspect.
 * @returns `true` (and narrows the type) when the result is successful.
 */
export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok;
}

/**
 * Type guard narrowing a {@link Result} to its {@link Err} variant.
 *
 * @param result - The result to inspect.
 * @returns `true` (and narrows the type) when the result is a failure.
 */
export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return !result.ok;
}

/**
 * Map the success value of a {@link Result}, leaving failures untouched.
 *
 * @typeParam T - Input success type.
 * @typeParam U - Output success type.
 * @typeParam E - Error type (preserved).
 * @param result - The result to transform.
 * @param fn - Mapping applied to the success value.
 * @returns A new result with the mapped value, or the original error.
 */
export function mapResult<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U,
): Result<U, E> {
  return result.ok ? ok(fn(result.value)) : result;
}

/**
 * Unwrap a {@link Result}, returning the success value or a fallback default
 * when the result is a failure.
 *
 * @typeParam T - Success type.
 * @typeParam E - Error type.
 * @param result - The result to unwrap.
 * @param fallback - Value returned when the result is a failure.
 * @returns The success value or `fallback`.
 */
export function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
  return result.ok ? result.value : fallback;
}

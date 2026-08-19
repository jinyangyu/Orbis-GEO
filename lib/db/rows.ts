/** Unwrap drizzle `execute` results from mysql2 (rows, [rows, fields], or { rows }). */
export function rowsOf(result: unknown): Array<Record<string, unknown>> {
  if (result == null) return [];

  if (Array.isArray(result) && result.length === 2 && Array.isArray(result[0])) {
    return result[0] as Array<Record<string, unknown>>;
  }

  if (Array.isArray(result)) {
    if (result.length === 0) return [];
    if (typeof result[0] === "object" && result[0] !== null && !Array.isArray(result[0])) {
      return result as Array<Record<string, unknown>>;
    }
    if (Array.isArray(result[0])) {
      return result[0] as Array<Record<string, unknown>>;
    }
    return [];
  }

  if (typeof result === "object") {
    const withRows = result as {
      rows?: Array<Record<string, unknown>>;
      [key: string]: unknown;
    };
    if (Array.isArray(withRows.rows)) return withRows.rows;
  }

  return [];
}

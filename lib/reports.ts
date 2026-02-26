/** Escape a value for CSV (quote if contains comma, newline, or double quote). */
export function csvEscape(value: string | number): string {
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Build CSV string from headers and rows. */
export function buildCsv(headers: string[], rows: (string | number)[][]): string {
  return [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => row.map(csvEscape).join(",")),
  ].join("\n");
}

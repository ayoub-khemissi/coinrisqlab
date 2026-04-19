const BOM = "\ufeff";

function formatCsvValue(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "number") return String(val).replace(".", ",");
  if (val instanceof Date) return val.toISOString().split("T")[0];
  const s = String(val);

  if (s.includes(";") || s.includes("\n") || s.includes('"')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }

  return s;
}

export function toCsv(
  rows: Record<string, unknown>[],
  columns: string[],
): string {
  let csv = BOM + columns.join(";") + "\n";

  for (const row of rows) {
    csv += columns.map((col) => formatCsvValue(row[col])).join(";") + "\n";
  }

  return csv;
}

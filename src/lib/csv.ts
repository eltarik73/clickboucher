// The one writer of a cell in the CSV files we export (orders, finances). Every cell is quoted.
// A cell that a spreadsheet would run as a formula (it starts with =, +, -, @, a tab or a carriage
// return: "CSV injection", OWASP) gets a leading apostrophe and stays text; a plain number such as
// -5,00 is left as it is.

export type CsvValue = string | number | null | undefined;

const FORMULA_START = /^[=+\-@\t\r]/;
const PLAIN_NUMBER = /^[+-]?\d+(?:[.,]\d+)?$/;

export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return '""';
  const text = String(value);
  const inert = FORMULA_START.test(text) && !PLAIN_NUMBER.test(text) ? `'${text}` : text;
  return `"${inert.replace(/"/g, '""')}"`;
}

export function csvLine(cells: readonly CsvValue[], separator = ";"): string {
  return cells.map(csvCell).join(separator);
}

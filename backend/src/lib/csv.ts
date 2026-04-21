export type CsvCell = string | number | boolean | null | undefined;

export interface CsvColumn<TRow> {
  readonly header: string;
  readonly value: (row: TRow) => CsvCell;
}

function normalizeLineEndings(value: string) {
  return value.replace(/^\uFEFF/u, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function escapeCell(value: CsvCell) {
  if (value === null || typeof value === "undefined") {
    return "";
  }

  const normalized = String(value).replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  if (!/[",\n]/u.test(normalized)) {
    return normalized;
  }

  return `"${normalized.replace(/"/g, "\"\"")}"`;
}

export function serializeCsv<TRow>(rows: readonly TRow[], columns: readonly CsvColumn<TRow>[]) {
  const headerRow = columns.map((column) => escapeCell(column.header)).join(",");
  const dataRows = rows.map((row) => columns.map((column) => escapeCell(column.value(row))).join(","));

  return [headerRow, ...dataRows].join("\r\n");
}

export function parseCsv(text: string) {
  const normalized = normalizeLineEndings(text);
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let insideQuotes = false;

  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];
    const nextCharacter = normalized[index + 1];

    if (insideQuotes) {
      if (character === '"' && nextCharacter === '"') {
        currentCell += '"';
        index += 1;
        continue;
      }

      if (character === '"') {
        insideQuotes = false;
        continue;
      }

      currentCell += character;
      continue;
    }

    if (character === '"') {
      insideQuotes = true;
      continue;
    }

    if (character === ",") {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if (character === "\n") {
      currentRow.push(currentCell);
      currentCell = "";

      if (currentRow.some((cell) => cell.trim().length > 0)) {
        rows.push(currentRow);
      }

      currentRow = [];
      continue;
    }

    currentCell += character;
  }

  currentRow.push(currentCell);

  if (currentRow.some((cell) => cell.trim().length > 0)) {
    rows.push(currentRow);
  }

  return rows;
}

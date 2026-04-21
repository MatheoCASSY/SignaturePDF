import type { Schema, Template } from '@pdfme/common';

function getTodayDateParts(reference = new Date()) {
  const pad = (value: number) => String(value).padStart(2, '0');
  return {
    isoDate: `${reference.getFullYear()}-${pad(reference.getMonth() + 1)}-${pad(reference.getDate())}`,
    displayDate: `${pad(reference.getDate())}/${pad(reference.getMonth() + 1)}/${reference.getFullYear()}`,
    displayTime: `${pad(reference.getHours())}:${pad(reference.getMinutes())}`,
  };
}

export function fillTemplateDefaults(template: Template, inputs: Record<string, string>[]) {
  const normalizedInputs = inputs.map((row) => ({ ...row }));
  const today = getTodayDateParts();

  template.schemas.forEach((page, pageIndex) => {
    const row = normalizedInputs[pageIndex] ?? (normalizedInputs[pageIndex] = {});

    page.forEach((schema) => {
      const schemaName = String(schema.name ?? '').trim().toLowerCase();
      const isDateLikeName = schemaName.includes('date');

      if (schema.type === 'date' && !row[schema.name]) {
        row[schema.name] = today.isoDate;
        return;
      }

      if ((schema.type === 'dateTime' || (schema.type === 'text' && isDateLikeName)) && !row[schema.name]) {
        row[schema.name] = today.displayDate;
        return;
      }

      if (schema.type === 'time' && !row[schema.name]) {
        row[schema.name] = today.displayTime;
      }
    });
  });

  return normalizedInputs;
}

export function computeNextPosition(page: Schema[]) {
  const index = page.length;
  return {
    x: 18,
    y: 20 + (index % 8) * 18,
  };
}

export function summarizeTemplate(template: Template) {
  const fieldCount = template.schemas.reduce((total, page) => total + page.length, 0);
  const pageCount = template.schemas.length;
  const types = Array.from(new Set(template.schemas.flat().map((schema) => schema.type))).slice(0, 6);
  return { fieldCount, pageCount, types };
}

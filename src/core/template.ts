import type { Schema, Template } from '@pdfme/common';

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

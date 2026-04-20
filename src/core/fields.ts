import type { Schema, Template } from '@pdfme/common';
import type { Designer } from '@pdfme/ui';
import type { FieldKind } from '../types/app';
import { computeNextPosition } from './template';

export function appendFieldToTemplate(template: Template, kind: FieldKind, pageIndex: number) {
  const nextTemplate = structuredClone(template);
  const page = nextTemplate.schemas[pageIndex] ?? [];
  const position = computeNextPosition(page);
  const baseName = `${kind}_${page.length + 1}`;

  if (kind === 'radio') {
    page.push(
      {
        name: `${baseName}_yes`,
        type: 'radioGroup',
        content: 'false',
        position,
        width: 8,
        height: 8,
        group: `${baseName}_group`,
        color: '#000000',
      } as Schema,
      {
        name: `${baseName}_no`,
        type: 'radioGroup',
        content: 'false',
        position: { x: position.x + 20, y: position.y },
        width: 8,
        height: 8,
        group: `${baseName}_group`,
        color: '#000000',
      } as Schema,
    );
  } else if (kind === 'checkbox') {
    page.push({ name: baseName, type: 'checkbox', content: 'false', position, width: 8, height: 8, color: '#000000' } as Schema);
  } else if (kind === 'signature') {
    page.push({ name: baseName, type: 'signature', content: '', position, width: 62.5, height: 37.5 } as Schema);
  } else if (kind === 'date') {
    page.push({ name: baseName, type: 'date', content: '', position, width: 42, height: 10 } as Schema);
  } else if (kind === 'time') {
    page.push({ name: baseName, type: 'time', content: '', position, width: 42, height: 10 } as Schema);
  } else if (kind === 'dateTime') {
    page.push({ name: baseName, type: 'dateTime', content: '', position, width: 58, height: 10 } as Schema);
  } else if (kind === 'image') {
    page.push({ name: baseName, type: 'image', content: '', position, width: 45, height: 30 } as Schema);
  } else if (kind === 'qrcode') {
    page.push({ name: baseName, type: 'qrcode', content: 'https://pdfme.com/', position, width: 32, height: 32 } as Schema);
  } else if (kind === 'table') {
    page.push({
      name: baseName,
      type: 'table',
      content: '',
      position,
      width: 100,
      height: 40,
      head: [['Item', 'Quantite']],
      body: [[{ content: 'Produit', colspan: 1 }, { content: '2' }]],
      showHead: true,
    } as Schema);
  } else if (kind === 'line') {
    page.push({ name: baseName, type: 'line', content: '', position, width: 80, height: 1 } as Schema);
  } else if (kind === 'rectangle') {
    page.push({ name: baseName, type: 'rectangle', content: '', position, width: 45, height: 20 } as Schema);
  } else if (kind === 'ellipse') {
    page.push({ name: baseName, type: 'ellipse', content: '', position, width: 35, height: 22 } as Schema);
  } else if (kind === 'svg') {
    page.push({
      name: baseName,
      type: 'svg',
      content: '<svg viewBox="0 0 24 24"><path d="M4 12h16"/></svg>',
      position,
      width: 24,
      height: 24,
    } as Schema);
  } else if (kind === 'textarea') {
    page.push({ name: baseName, type: 'text', content: '', position, width: 120, height: 28, fontSize: 11, multiline: true } as Schema);
  } else {
    page.push({ name: baseName, type: 'text', content: '', position, width: 70, height: 10, fontSize: 12 } as Schema);
  }

  nextTemplate.schemas[pageIndex] = page;
  return nextTemplate;
}

export function appendFieldFromDesigner(designer: Designer, kind: FieldKind) {
  const template = structuredClone(designer.getTemplate());
  const pageIndex = designer.getPageCursor?.() ?? 0;
  const updated = appendFieldToTemplate(template, kind, pageIndex);
  designer.updateTemplate(updated);
  return updated;
}

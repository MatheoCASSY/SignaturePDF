import type { FieldKind } from '../types/app';
import {
  barcodes,
  checkbox,
  date,
  dateTime,
  ellipse,
  image,
  line,
  multiVariableText,
  radioGroup,
  rectangle,
  select,
  signature,
  svg,
  table,
  text,
  time,
} from '@pdfme/schemas';

export const DESIGNER_OPTIONS = {
  theme: {
    token: {
      colorPrimary: '#7c5cff',
    },
  },
};

export const FORM_OPTIONS = {
  theme: {
    token: {
      colorPrimary: '#27d7c4',
    },
  },
};

export const uiPlugins = {
  Text: text,
  'Multi-Variable Text': multiVariableText,
  Image: image,
  SVG: svg,
  Signature: signature,
  Table: table,
  Line: line,
  Rectangle: rectangle,
  Ellipse: ellipse,
  DateTime: dateTime,
  Date: date,
  Time: time,
  Select: select,
  Checkbox: checkbox,
  RadioGroup: radioGroup,
  QR: barcodes.qrcode,
  EAN13: barcodes.ean13,
  Code128: barcodes.code128,
};

export const quickFieldLibrary: Array<{ kind: FieldKind; label: string; hint: string }> = [
  { kind: 'text', label: 'Texte', hint: 'Champ simple' },
  { kind: 'textarea', label: 'Memo', hint: 'Zone multilignes' },
  { kind: 'signature', label: 'Signature', hint: 'Zone de signature' },
  { kind: 'checkbox', label: 'Case', hint: 'Oui / non' },
  { kind: 'radio', label: 'Radio', hint: 'Choix multiple' },
  { kind: 'date', label: 'Date', hint: 'Selecteur de date' },
  { kind: 'time', label: 'Heure', hint: 'Selecteur horaire' },
  { kind: 'dateTime', label: 'Date+Heure', hint: 'Date et heure' },
  { kind: 'image', label: 'Image', hint: 'Logo ou photo' },
  { kind: 'qrcode', label: 'QR Code', hint: 'URL ou texte' },
  { kind: 'table', label: 'Tableau', hint: 'Bloc tabulaire' },
  { kind: 'line', label: 'Ligne', hint: 'Separateur' },
  { kind: 'rectangle', label: 'Rectangle', hint: 'Bloc visuel' },
  { kind: 'ellipse', label: 'Ellipse', hint: 'Forme' },
  { kind: 'svg', label: 'SVG', hint: 'Icone vectorielle' },
];

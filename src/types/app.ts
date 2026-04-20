import type { Template } from '@pdfme/common';

export type RouteName = 'design' | 'remplir';

export type NoticeTone = 'info' | 'success' | 'warning' | 'danger';

export type NoticeItem = {
  id: number;
  message: string;
  tone: NoticeTone;
};

export type TodoItem = {
  id: number;
  title: string;
  details: string;
  done: boolean;
};

export type FieldKind =
  | 'text'
  | 'textarea'
  | 'signature'
  | 'checkbox'
  | 'radio'
  | 'date'
  | 'time'
  | 'dateTime'
  | 'image'
  | 'qrcode'
  | 'table'
  | 'line'
  | 'rectangle'
  | 'ellipse'
  | 'svg';

export type AppState = {
  route: RouteName;
  template: Template;
  inputs: Record<string, string>[];
  lang: string;
  notices: NoticeItem[];
  todos: TodoItem[];
  templateDraft: string;
  inputsDraft: string;
};

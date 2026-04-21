import type { Template } from '@pdfme/common';

export type RouteName = 'login' | 'admin' | 'user';

export type NoticeTone = 'info' | 'success' | 'warning' | 'danger';

export type NoticeItem = {
  id: number;
  message: string;
  tone: NoticeTone;
};

export type RemoteTemplateSummary = {
  id: string;
  name: string;
  status: 'draft' | 'published';
  updatedAt: string;
  publishedAt: string | null;
};

export type RemoteAccessStatus = {
  allowed: boolean;
  reason: string;
  principal?: string | null;
  isAdmin?: boolean;
  access?: {
    templateId: string;
    principal: string;
    grantedAt: string;
    consumedAt: string | null;
    expiresAt: string | null;
    grantedBy?: string | null;
    maxUses: number;
    usedCount: number;
  } | null;
  template?: RemoteTemplateSummary;
};

export type RemoteInboxDocument = {
  template: RemoteTemplateSummary;
  access: {
    templateId: string;
    principal: string;
    grantedAt: string;
    consumedAt: string | null;
    expiresAt: string | null;
    grantedBy?: string | null;
    maxUses: number;
    usedCount: number;
  };
  allowed: boolean;
  isAdmin: boolean;
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
  authToken: string;
  remoteTemplateId: string;
  templateName: string;
  remoteTemplates: RemoteTemplateSummary[];
  remoteAccess: RemoteAccessStatus | null;
  remoteInbox: RemoteInboxDocument[];
  selectedInboxTemplateId: string;
  adminAccessMaxUses: number;
};

export type AuthViewState = {
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  email: string;
  expiresAt: number | null;
};

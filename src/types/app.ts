import type { Template } from '@pdfme/common';

export type RouteName = 'login' | 'admin' | 'access' | 'user';

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

export type RemoteUserDirectoryEntry = {
  principal: string;
  label: string;
  email: string | null;
  username: string | null;
  sub: string | null;
  enabled: boolean;
  userStatus: string | null;
  grantedCount: number;
  lastGrantedAt: string | null;
  hasTemplateAccess: boolean;
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

export type SubmissionRecord = {
  id: string;
  templateId: string;
  templateName: string;
  principal: string;
  submittedAt: string;
  filename: string;
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
  remoteUsers: RemoteUserDirectoryEntry[];
  selectedAccessPrincipals: string[];
  userDirectoryQuery: string;
  selectedInboxTemplateId: string;
  adminAccessMaxUses: number;
  submissions: SubmissionRecord[];
};

export type AuthViewState = {
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  email: string;
  expiresAt: number | null;
};

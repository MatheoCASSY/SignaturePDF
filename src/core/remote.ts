import type { Template } from '@pdfme/common';
import type { SubmissionRecord } from '../types/app';

export type RemoteTemplateRecord = {
  id: string;
  name: string;
  status: 'draft' | 'published';
  template: Template;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  ownerSub: string | null;
  ownerEmail: string | null;
};

export type RemoteTemplateSummary = {
  id: string;
  name: string;
  status: 'draft' | 'published';
  updatedAt: string;
  publishedAt: string | null;
};

export type RemoteAccessRecord = {
  templateId: string;
  principal: string;
  grantedAt: string;
  consumedAt: string | null;
  expiresAt: string | null;
  grantedBy?: string | null;
  maxUses: number;
  usedCount: number;
};

export type RemoteInboxDocument = {
  template: RemoteTemplateSummary;
  access: RemoteAccessRecord;
  allowed: boolean;
  isAdmin: boolean;
};

export type RemoteAccessCheck = {
  allowed: boolean;
  reason: string;
  template?: RemoteTemplateSummary;
  access?: RemoteAccessRecord | null;
  principal?: string | null;
  isAdmin?: boolean;
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

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
  });

  const raw = await response.text();
  const body = raw ? (JSON.parse(raw) as T) : (undefined as T);

  if (!response.ok) {
    const message = typeof body === 'object' && body && 'error' in (body as Record<string, unknown>)
      ? String((body as Record<string, unknown>).error)
      : response.statusText;
    throw new Error(message || 'Erreur réseau');
  }

  return body;
}

export function loadRemoteTemplates(token?: string) {
  return requestJson<{ templates: RemoteTemplateSummary[] }>('/api/templates', {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

export function loadRemoteTemplate(templateId: string, token?: string) {
  return requestJson<{ template: RemoteTemplateRecord }>('/api/templates?id=' + encodeURIComponent(templateId), {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

export function saveRemoteTemplate(payload: {
  id?: string;
  name: string;
  template: Template;
  status?: 'draft' | 'published';
}, token: string) {
  return requestJson<{ template: RemoteTemplateRecord; accessUrl: string }>('/api/templates', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export function grantRemoteAccess(payload: {
  templateId: string;
  principal: string;
  label?: string;
  expiresAt?: string | null;
  maxUses?: number;
}, token: string) {
  return requestJson<{ access: RemoteAccessRecord }>('/api/access', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export function checkRemoteAccess(templateId: string, token?: string) {
  return requestJson<RemoteAccessCheck>('/api/access?templateId=' + encodeURIComponent(templateId), {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

export function consumeRemoteAccess(templateId: string, token: string) {
  return requestJson<{ access: RemoteAccessRecord }>('/api/access', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ templateId }),
  });
}

export function loadRemoteInbox(token?: string) {
  return requestJson<{ documents: RemoteInboxDocument[]; principal: string | null; isAdmin: boolean }>('/api/access', {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

export function loadRemoteUserDirectory(token: string, templateId?: string) {
  const query = new URLSearchParams({ mode: 'pool-users' });
  if (templateId) {
    query.set('templateId', templateId);
  }

  return requestJson<{ users: RemoteUserDirectoryEntry[] }>(`/api/access?${query.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function submitSignedPdf(payload: { templateId: string; templateName: string; pdf: string }, token: string) {
  return requestJson<{ submission: SubmissionRecord }>('/api/submissions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export function loadAdminSubmissions(token: string) {
  return requestJson<{ submissions: SubmissionRecord[] }>('/api/submissions', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function downloadAdminSubmission(id: string, token: string) {
  return requestJson<{ submission: SubmissionRecord; filename: string; pdf: string }>(`/api/submissions?id=${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function deleteAdminSubmission(id: string, token: string) {
  return requestJson<{ ok: boolean }>('/api/submissions', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ id }),
  });
}

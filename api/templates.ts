import { randomUUID } from 'crypto';
import {
  ensureStorageReady,
  getPrincipal,
  isAccessActive,
  json,
  normalizeTemplateSummary,
  principalCandidates,
  readJsonBody,
  readJsonObject,
  templateIndexKey,
  templateObjectKey,
  writeJsonObject,
  type RemoteAccessRecord,
  type RemoteTemplateRecord,
  type RemoteTemplateSummary,
} from './_shared';

type TemplateIndex = {
  templates: RemoteTemplateSummary[];
};

function normalizeTemplate(value: unknown) {
  if (!value || typeof value !== 'object') {
    throw new Error('Template invalide');
  }

  return value as unknown;
}

function toRecord(value: RemoteTemplateRecord) {
  return {
    id: value.id,
    name: value.name,
    status: value.status,
    template: value.template as unknown,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    publishedAt: value.publishedAt,
    ownerSub: value.ownerSub,
    ownerEmail: value.ownerEmail,
  };
}

async function loadIndex() {
  return readJsonObject<TemplateIndex>(templateIndexKey(), { templates: [] });
}

async function saveIndex(templates: RemoteTemplateSummary[]) {
  const sorted = templates.slice().sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  await writeJsonObject(templateIndexKey(), { templates: sorted });
}

async function loadTemplate(templateId: string) {
  return readJsonObject<RemoteTemplateRecord | null>(templateObjectKey(templateId), null);
}

async function loadAccess(templateId: string, principal: string) {
  return readJsonObject<RemoteAccessRecord | null>(`access/${encodeURIComponent(templateId)}/${encodeURIComponent(principal)}.json`, null);
}

async function loadFirstAccess(templateId: string, principal: { sub: string; email: string }) {
  const candidates = principalCandidates(principal);
  for (const candidate of candidates) {
    const access = await loadAccess(templateId, candidate);
    if (access) return access;
  }
  return null;
}

export default async function handler(req: any, res: any) {
  try {
    ensureStorageReady();
    const url = new URL(req.url, 'http://localhost');
    const principal = await getPrincipal(req);

    if (req.method === 'GET') {
      const templateId = url.searchParams.get('id');

      if (templateId) {
        if (!principal) {
          json(res, 401, { error: 'Authentification requise' });
          return;
        }

        const record = await loadTemplate(templateId);
        if (!record) {
          json(res, 404, { error: 'Template introuvable' });
          return;
        }

        const access = principal.isAdmin ? null : await loadFirstAccess(templateId, principal);
        const hasAccess = principal.isAdmin || isAccessActive(access);

        if (record.status !== 'published' && !principal.isAdmin) {
          json(res, 403, { error: 'Template non publié' });
          return;
        }

        if (record.status === 'published' && !hasAccess) {
          json(res, 403, { error: 'Accès au template refusé' });
          return;
        }

        json(res, 200, { template: toRecord(record) });
        return;
      }

      if (!principal?.isAdmin) {
        json(res, 401, { error: 'Accès admin requis' });
        return;
      }

      const index = await loadIndex();
      json(res, 200, {
        templates: index.templates,
      });
      return;
    }

    if (req.method === 'POST') {
      if (!principal?.isAdmin) {
        json(res, 401, { error: 'Accès admin requis' });
        return;
      }

      const body = await readJsonBody(req);
      const templateId = String(body.id || randomUUID());
      const name = String(body.name || 'Template sans nom').trim();
      const template = normalizeTemplate(body.template);
      const status = body.status === 'draft' ? 'draft' : 'published';
      const existing = await loadTemplate(templateId);
      const now = new Date().toISOString();
      const record: RemoteTemplateRecord = {
        id: templateId,
        name,
        status,
        template,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
        publishedAt: status === 'published' ? existing?.publishedAt || now : existing?.publishedAt || null,
        ownerSub: principal.sub,
        ownerEmail: principal.email || null,
      };

      await writeJsonObject(templateObjectKey(templateId), record);

      const index = await loadIndex();
      const summary = normalizeTemplateSummary(record);
      const nextTemplates = index.templates.filter((item) => item.id !== templateId).concat(summary);
      await saveIndex(nextTemplates);

      json(res, 200, {
        template: toRecord(record),
        accessUrl: `/user?templateId=${record.id}`,
      });
      return;
    }

    json(res, 405, { error: 'Méthode non autorisée' });
  } catch (error) {
    json(res, 500, { error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
}

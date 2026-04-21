import {
  accessObjectKey,
  ensureStorageReady,
  getPrincipal,
  isAccessActive,
  json,
  normalizeTemplateSummary,
  normalizeAccessRecord,
  principalCandidates,
  principalKey,
  readJsonBody,
  readJsonObject,
  templateIndexKey,
  templateObjectKey,
  writeJsonObject,
  type RemoteAccessRecord,
  type RemoteTemplateRecord,
} from './_shared';

function toAccessRecord(row: RemoteAccessRecord) {
  return {
    templateId: row.templateId,
    principal: row.principal,
    grantedAt: row.grantedAt,
    consumedAt: row.consumedAt,
    expiresAt: row.expiresAt,
    grantedBy: row.grantedBy,
    maxUses: row.maxUses,
    usedCount: row.usedCount,
  };
}

type TemplateIndex = {
  templates: Array<ReturnType<typeof normalizeTemplateSummary>>;
};

async function loadTemplate(templateId: string) {
  return readJsonObject<RemoteTemplateRecord | null>(templateObjectKey(templateId), null);
}

async function loadAccess(templateId: string, principal: string) {
  return readJsonObject<RemoteAccessRecord | null>(accessObjectKey(templateId, principal), null);
}

async function loadIndex() {
  return readJsonObject<TemplateIndex>(templateIndexKey(), { templates: [] });
}

async function loadFirstAccess(templateId: string, principal: { sub: string; email: string }) {
  const candidates = principalCandidates(principal);
  for (const candidate of candidates) {
    const access = await loadAccess(templateId, candidate);
    if (access) {
      return {
        key: candidate,
        access,
      };
    }
  }

  return null;
}

export default async function handler(req: any, res: any) {
  try {
    ensureStorageReady();
    const url = new URL(req.url, 'http://localhost');
    const principal = await getPrincipal(req);

    if (req.method === 'GET') {
      const templateId = url.searchParams.get('templateId');
      if (!templateId) {
        if (!principal) {
          json(res, 200, { documents: [], principal: null, isAdmin: false });
          return;
        }

        const index = await loadIndex();
        const documents = await Promise.all(
          index.templates.map(async (template) => {
            const foundAccess = principal.isAdmin ? null : await loadFirstAccess(template.id, principal);
            const accessRow = foundAccess?.access || null;
            const access = accessRow ? toAccessRecord(normalizeAccessRecord(accessRow)) : null;
            const allowed = principal.isAdmin || isAccessActive(access);

            if (!access || !allowed) {
              return null;
            }

            return {
              template,
              access,
              allowed,
              isAdmin: principal.isAdmin,
            };
          }),
        );

        json(res, 200, {
          documents: documents.filter(Boolean),
          principal: principalKey(principal),
          isAdmin: principal.isAdmin,
        });
        return;
      }

      if (!principal) {
        json(res, 200, {
          allowed: false,
          reason: 'auth-required',
          principal: null,
          access: null,
        });
        return;
      }

      const key = principalKey(principal);
      const templateRow = await loadTemplate(templateId);
      if (!templateRow) {
        json(res, 404, { allowed: false, reason: 'template-not-found', principal: key, access: null });
        return;
      }

      const foundAccess = principal.isAdmin ? null : await loadFirstAccess(templateId, principal);
      const accessRow = foundAccess?.access || null;
      const access = accessRow ? toAccessRecord(accessRow) : null;
      const isAllowed = principal.isAdmin || Boolean(access && !access.consumedAt && (!access.expiresAt || new Date(access.expiresAt).getTime() > Date.now()));

      if (templateRow.status !== 'published' && !principal.isAdmin) {
        json(res, 403, { allowed: false, reason: 'template-not-published', principal: key, access: null });
        return;
      }

      json(res, 200, {
        allowed: Boolean(isAllowed),
        reason: isAllowed ? 'granted' : 'denied',
        principal: key,
        isAdmin: principal.isAdmin,
        template: normalizeTemplateSummary(templateRow),
        access,
      });
      return;
    }

    if (req.method === 'POST') {
      if (!principal?.isAdmin) {
        json(res, 401, { error: 'Accès admin requis' });
        return;
      }

      const body = await readJsonBody(req);
      const templateId = String(body.templateId || '').trim();
      const targetPrincipal = String(body.principal || '').trim();
      if (!templateId || !targetPrincipal) {
        json(res, 400, { error: 'templateId et principal requis' });
        return;
      }

      const maxUses = Number.isFinite(Number(body.maxUses)) ? Math.max(1, Math.floor(Number(body.maxUses))) : 1;

      const expiresAt = body.expiresAt ? new Date(String(body.expiresAt)) : null;
      const template = await loadTemplate(templateId);
      if (!template) {
        json(res, 404, { error: 'Template introuvable' });
        return;
      }

      const now = new Date().toISOString();
      const record: RemoteAccessRecord = {
        templateId,
        principal: targetPrincipal,
        grantedAt: now,
        consumedAt: null,
        expiresAt: expiresAt ? expiresAt.toISOString() : null,
        grantedBy: principal.sub || null,
        maxUses,
        usedCount: 0,
      };

      await writeJsonObject(accessObjectKey(templateId, targetPrincipal), record);

      json(res, 200, { access: toAccessRecord(record) });
      return;
    }

    if (req.method === 'PATCH') {
      if (!principal) {
        json(res, 401, { error: 'Authentification requise' });
        return;
      }

      const body = await readJsonBody(req);
      const templateId = String(body.templateId || '').trim();
      if (!templateId) {
        json(res, 400, { error: 'templateId requis' });
        return;
      }

      const key = principalKey(principal);
      const foundAccess = await loadFirstAccess(templateId, principal);
      const existing = foundAccess?.access ? normalizeAccessRecord(foundAccess.access) : null;
      const accessKey = foundAccess?.key || key;
      if (!existing) {
        json(res, 403, { error: 'Aucun accès trouvé' });
        return;
      }

      if (existing.consumedAt) {
        json(res, 409, { error: 'Accès déjà consommé' });
        return;
      }

      const consumed: RemoteAccessRecord = {
        ...existing,
        usedCount: Math.min(existing.usedCount + 1, existing.maxUses),
        consumedAt: existing.usedCount + 1 >= existing.maxUses ? new Date().toISOString() : existing.consumedAt,
      };

      await writeJsonObject(accessObjectKey(templateId, accessKey), consumed);

      json(res, 200, { access: toAccessRecord(consumed) });
      return;
    }

    json(res, 405, { error: 'Méthode non autorisée' });
  } catch (error) {
    json(res, 500, { error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
}

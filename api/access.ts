import {
  accessDirectoryKey,
  accessObjectKey,
  ensureStorageReady,
  getPrincipal,
  isAccessActive,
  json,
  listObjectKeys,
  normalizeTemplateSummary,
  normalizeAccessRecord,
  normalizeUserDirectoryRecord,
  principalCandidates,
  principalKey,
  readJsonBody,
  readJsonObject,
  templateIndexKey,
  templateObjectKey,
  writeJsonObject,
  type RemoteAccessRecord,
  type RemoteTemplateRecord,
  type RemoteUserDirectoryRecord,
} from './_shared';
import { CognitoIdentityProviderClient, ListUsersCommand, type UserType } from '@aws-sdk/client-cognito-identity-provider';

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

type UserDirectoryIndex = {
  users: RemoteUserDirectoryRecord[];
};

let cognitoClient: CognitoIdentityProviderClient | null = null;

function getCognitoRegion() {
  return process.env.COGNITO_REGION || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || '';
}

function getCognitoUserPoolId() {
  return process.env.COGNITO_USER_POOL_ID || '';
}

function getCognitoClient() {
  if (!cognitoClient) {
    const region = getCognitoRegion();
    if (!region) {
      throw new Error('Cognito non configuré: COGNITO_REGION ou AWS_REGION requis');
    }
    cognitoClient = new CognitoIdentityProviderClient({ region });
  }
  return cognitoClient;
}

function userAttribute(user: UserType, name: string) {
  return user.Attributes?.find((attribute) => attribute.Name === name)?.Value || '';
}

async function loadPoolUsers(limit = 80) {
  const userPoolId = getCognitoUserPoolId();
  if (!userPoolId) {
    throw new Error('Cognito non configuré: COGNITO_USER_POOL_ID requis');
  }

  const users: UserType[] = [];
  let paginationToken: string | undefined;

  while (users.length < limit) {
    const pageSize = Math.min(60, limit - users.length);
    const response = await getCognitoClient().send(
      new ListUsersCommand({
        UserPoolId: userPoolId,
        Limit: pageSize,
        PaginationToken: paginationToken,
      }),
    );

    users.push(...(response.Users || []));
    paginationToken = response.PaginationToken;
    if (!paginationToken) break;
  }

  return users;
}

async function loadTemplate(templateId: string) {
  return readJsonObject<RemoteTemplateRecord | null>(templateObjectKey(templateId), null);
}

async function loadAccess(templateId: string, principal: string) {
  return readJsonObject<RemoteAccessRecord | null>(accessObjectKey(templateId, principal), null);
}

async function loadIndex() {
  return readJsonObject<TemplateIndex>(templateIndexKey(), { templates: [] });
}

async function loadUserDirectory() {
  return readJsonObject<UserDirectoryIndex>(accessDirectoryKey(), { users: [] });
}

async function saveUserDirectory(users: RemoteUserDirectoryRecord[]) {
  const normalized = users
    .map((user) => normalizeUserDirectoryRecord(user))
    .filter((user) => user.principal)
    .sort((left, right) => {
      const leftValue = (left.label || left.principal).toLowerCase();
      const rightValue = (right.label || right.principal).toLowerCase();
      return leftValue.localeCompare(rightValue);
    });

  await writeJsonObject(accessDirectoryKey(), { users: normalized });
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
      const mode = url.searchParams.get('mode');

      if (mode === 'directory') {
        if (!principal?.isAdmin) {
          json(res, 401, { error: 'Accès admin requis' });
          return;
        }

        const directory = await loadUserDirectory();
        const users = await Promise.all(
          directory.users.map(async (entry) => {
            const normalized = normalizeUserDirectoryRecord(entry);
            const templateAccess = templateId ? await loadAccess(templateId, normalized.principal) : null;
            const hasTemplateAccess = Boolean(templateAccess && isAccessActive(normalizeAccessRecord(templateAccess)));

            return {
              principal: normalized.principal,
              label: normalized.label,
              grantedCount: normalized.grantedCount,
              lastGrantedAt: normalized.lastGrantedAt,
              hasTemplateAccess,
            };
          }),
        );

        json(res, 200, { users });
        return;
      }

      if (mode === 'template-grants') {
        if (!principal?.isAdmin) {
          json(res, 401, { error: 'Accès admin requis' });
          return;
        }

        if (!templateId) {
          json(res, 400, { error: 'templateId requis' });
          return;
        }

        const keys = await listObjectKeys(`access/${encodeURIComponent(templateId)}/`);
        const grants = (
          await Promise.all(
            keys.map(async (key) => {
              const record = await readJsonObject<RemoteAccessRecord | null>(key, null);
              if (!record) return null;
              const normalized = normalizeAccessRecord(record);
              return {
                ...toAccessRecord(normalized),
                active: isAccessActive(normalized),
              };
            }),
          )
        ).filter(Boolean);

        json(res, 200, { grants });
        return;
      }

      if (mode === 'pool-users') {
        if (!principal?.isAdmin) {
          json(res, 401, { error: 'Accès admin requis' });
          return;
        }

        const [poolUsers, directory] = await Promise.all([loadPoolUsers(), loadUserDirectory()]);
        const directoryMap = new Map(directory.users.map((entry) => [entry.principal, normalizeUserDirectoryRecord(entry)]));

        const users = await Promise.all(
          poolUsers.map(async (user) => {
            const sub = userAttribute(user, 'sub').trim();
            const email = userAttribute(user, 'email').trim();
            const username = String(user.Username || '').trim();
            const principalValue = sub || email || username;
            if (!principalValue) return null;

            const lookupCandidates = Array.from(new Set([principalValue, sub, email, username].filter(Boolean)));
            const directoryEntry = lookupCandidates.map((candidate) => directoryMap.get(candidate)).find(Boolean) || null;

            let hasTemplateAccess = false;
            if (templateId) {
              for (const candidate of lookupCandidates) {
                const candidateAccess = await loadAccess(templateId, candidate);
                if (candidateAccess && isAccessActive(normalizeAccessRecord(candidateAccess))) {
                  hasTemplateAccess = true;
                  break;
                }
              }
            }

            const label = email || username || principalValue;
            return {
              principal: principalValue,
              label,
              email: email || null,
              username: username || null,
              sub: sub || null,
              enabled: user.Enabled !== false,
              userStatus: user.UserStatus ? String(user.UserStatus) : null,
              grantedCount: directoryEntry?.grantedCount || 0,
              lastGrantedAt: directoryEntry?.lastGrantedAt || null,
              hasTemplateAccess,
            };
          }),
        );

        const merged = users.filter(Boolean) as Array<{
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
        }>;

        for (const entry of directory.users) {
          const normalized = normalizeUserDirectoryRecord(entry);
          if (!normalized.principal) continue;
          if (merged.some((user) => user.principal === normalized.principal)) continue;

          const templateAccess = templateId ? await loadAccess(templateId, normalized.principal) : null;
          const hasTemplateAccess = Boolean(templateAccess && isAccessActive(normalizeAccessRecord(templateAccess)));
          merged.push({
            principal: normalized.principal,
            label: normalized.label,
            email: null,
            username: null,
            sub: null,
            enabled: true,
            userStatus: null,
            grantedCount: normalized.grantedCount,
            lastGrantedAt: normalized.lastGrantedAt,
            hasTemplateAccess,
          });
        }

        merged.sort((left, right) => left.label.toLowerCase().localeCompare(right.label.toLowerCase()));

        json(res, 200, { users: merged });
        return;
      }

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
      const targetLabel = String(body.label || targetPrincipal).trim() || targetPrincipal;
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

      const directory = await loadUserDirectory();
      const existing = directory.users.find((entry) => entry.principal === targetPrincipal);
      const next: RemoteUserDirectoryRecord = normalizeUserDirectoryRecord({
        principal: targetPrincipal,
        label: targetLabel || existing?.label || targetPrincipal,
        grantedCount: (existing?.grantedCount || 0) + 1,
        lastGrantedAt: now,
      });
      const nextUsers = directory.users.filter((entry) => entry.principal !== targetPrincipal).concat(next);
      await saveUserDirectory(nextUsers);

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

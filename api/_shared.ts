import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const DEFAULT_ADMIN_GROUP = 'pdfme-admins';
const AUTHORIZED_ROLES = new Set(['admin', 'administrator']);

type AnyRecord = Record<string, unknown>;

export type RemoteTemplateRecord = {
  id: string;
  name: string;
  status: 'draft' | 'published';
  template: unknown;
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
  grantedBy: string | null;
  maxUses: number;
  usedCount: number;
};

export type RemoteUserDirectoryRecord = {
  principal: string;
  label: string;
  grantedCount: number;
  lastGrantedAt: string | null;
};

let jwksCache: ReturnType<typeof createRemoteJWKSet> | null = null;
let s3Client: S3Client | null = null;

export function getBucketName() {
  const configured = process.env.S3_BUCKET_ARN || process.env.S3_BUCKET_NAME;
  if (!configured) {
    throw new Error('S3 non configure: definir S3_BUCKET_ARN ou S3_BUCKET_NAME');
  }

  if (configured.startsWith('arn:aws:s3:::')) {
    return configured.slice('arn:aws:s3:::'.length);
  }

  return configured;
}

export function getS3Region() {
  return process.env.AWS_REGION || process.env.S3_REGION || process.env.AWS_DEFAULT_REGION || '';
}

export function getS3Client() {
  if (!s3Client) {
    const region = getS3Region();
    if (!region) {
      throw new Error('S3 non configure: definir AWS_REGION ou S3_REGION');
    }

    s3Client = new S3Client({ region });
  }

  return s3Client;
}

export function ensureStorageReady() {
  getBucketName();
  getS3Client();
}

export function templateObjectKey(templateId: string) {
  return `templates/${encodeURIComponent(templateId)}.json`;
}

export function templateIndexKey() {
  return 'templates/index.json';
}

export function accessObjectKey(templateId: string, principal: string) {
  return `access/${encodeURIComponent(templateId)}/${encodeURIComponent(principal)}.json`;
}

export function accessDirectoryKey() {
  return 'access/users-index.json';
}

export function normalizeTemplateSummary(record: RemoteTemplateRecord): RemoteTemplateSummary {
  return {
    id: record.id,
    name: record.name,
    status: record.status,
    updatedAt: record.updatedAt,
    publishedAt: record.publishedAt,
  };
}

export function normalizeAccessRecord(record: Partial<RemoteAccessRecord> & { templateId: string; principal: string; grantedAt: string }) {
  const maxUses = Number.isFinite(Number(record.maxUses)) && Number(record.maxUses) > 0 ? Math.floor(Number(record.maxUses)) : 1;
  const usedCount = Number.isFinite(Number(record.usedCount)) && Number(record.usedCount) >= 0 ? Math.min(Math.floor(Number(record.usedCount)), maxUses) : record.consumedAt ? maxUses : 0;

  return {
    templateId: record.templateId,
    principal: record.principal,
    grantedAt: record.grantedAt,
    consumedAt: record.consumedAt ?? null,
    expiresAt: record.expiresAt ?? null,
    grantedBy: record.grantedBy ?? null,
    maxUses,
    usedCount,
  } satisfies RemoteAccessRecord;
}

export function normalizeUserDirectoryRecord(record: Partial<RemoteUserDirectoryRecord> & { principal: string }) {
  const principal = String(record.principal || '').trim();
  const label = String(record.label || principal).trim() || principal;
  const grantedCount = Number.isFinite(Number(record.grantedCount)) && Number(record.grantedCount) > 0 ? Math.floor(Number(record.grantedCount)) : 0;
  const lastGrantedAt = record.lastGrantedAt ? String(record.lastGrantedAt) : null;

  return {
    principal,
    label,
    grantedCount,
    lastGrantedAt,
  } satisfies RemoteUserDirectoryRecord;
}

export function isAccessActive(record: RemoteAccessRecord | null | undefined) {
  if (!record) return false;
  if (record.expiresAt && new Date(record.expiresAt).getTime() <= Date.now()) return false;
  const maxUses = Number.isFinite(Number(record.maxUses)) && Number(record.maxUses) > 0 ? Math.floor(Number(record.maxUses)) : 1;
  const usedCount = Number.isFinite(Number(record.usedCount)) && Number(record.usedCount) >= 0 ? Math.floor(Number(record.usedCount)) : record.consumedAt ? maxUses : 0;

  if (record.consumedAt && usedCount <= 0) return false;
  return usedCount < maxUses;
}

function isMissingObjectError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const typedError = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return typedError.name === 'NoSuchKey' || typedError.name === 'NotFound' || typedError.$metadata?.httpStatusCode === 404;
}

async function bodyToString(body: unknown) {
  if (!body || typeof body !== 'object') return '';
  const stream = body as { transformToString?: () => Promise<string> };
  if (typeof stream.transformToString === 'function') {
    return stream.transformToString();
  }

  return String(body);
}

export async function readJsonObject<T>(key: string, fallback?: T): Promise<T> {
  try {
    const response = await getS3Client().send(
      new GetObjectCommand({
        Bucket: getBucketName(),
        Key: key,
      }),
    );

    const raw = await bodyToString(response.Body);
    return JSON.parse(raw) as T;
  } catch (error) {
    if (fallback !== undefined && isMissingObjectError(error)) {
      return fallback;
    }

    if (fallback !== undefined && error instanceof SyntaxError) {
      return fallback;
    }

    throw error;
  }
}

export async function writeJsonObject(key: string, value: unknown) {
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: getBucketName(),
      Key: key,
      ContentType: 'application/json; charset=utf-8',
      Body: JSON.stringify(value, null, 2),
    }),
  );
}

export function json(res: any, statusCode: number, payload: AnyRecord) {
  res.status(statusCode).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

export function readJsonBody(req: any): Promise<AnyRecord> {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === 'object') {
      resolve(req.body as AnyRecord);
      return;
    }

    let raw = '';
    req.on('data', (chunk: Buffer) => {
      raw += chunk.toString('utf8');
    });
    req.on('end', () => {
      if (!raw.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw) as AnyRecord);
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

export function readAuthToken(req: any) {
  const header = String(req.headers?.authorization || req.headers?.Authorization || '');
  if (!header.toLowerCase().startsWith('bearer ')) return '';
  return header.slice(7).trim();
}

function getIssuer() {
  const region = process.env.COGNITO_REGION || process.env.AWS_REGION;
  const poolId = process.env.COGNITO_USER_POOL_ID;
  if (!region || !poolId) return '';
  return `https://cognito-idp.${region}.amazonaws.com/${poolId}`;
}

function getJwks() {
  if (!jwksCache) {
    const issuer = getIssuer();
    if (!issuer) return null;
    jwksCache = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  }

  return jwksCache;
}

export async function verifyCognitoToken(token: string) {
  const issuer = getIssuer();
  const jwks = getJwks();
  if (!issuer || !jwks) {
    throw new Error('Cognito non configuré');
  }

  const { payload } = await jwtVerify(token, jwks, { issuer });
  const clientId = process.env.COGNITO_CLIENT_ID;
  const audience = payload.aud || payload.client_id;

  if (clientId && audience && audience !== clientId) {
    throw new Error('Token Cognito invalide');
  }

  const tokenUse = String(payload.token_use || '');
  if (tokenUse && tokenUse !== 'access' && tokenUse !== 'id') {
    throw new Error('Type de token Cognito non supporté');
  }

  return payload;
}

export async function getPrincipal(req: any) {
  const token = readAuthToken(req);
  if (!token) return null;

  const payload = await verifyCognitoToken(token);
  const sub = String(payload.sub || '');
  const email = String(payload.email || payload['cognito:username'] || '');
  const groups = Array.isArray(payload['cognito:groups']) ? payload['cognito:groups'] : [];
  const customRole = String(payload['custom:role'] || '').toLowerCase();
  const isAdmin = groups.includes(process.env.COGNITO_ADMIN_GROUP || DEFAULT_ADMIN_GROUP) || AUTHORIZED_ROLES.has(customRole);

  return {
    token,
    sub,
    email,
    isAdmin,
    payload,
  };
}

export function principalKey(principal: { sub: string; email: string }) {
  return principal.sub || principal.email;
}

export function principalCandidates(principal: { sub: string; email: string }) {
  const values = [principal.sub, principal.email].map((value) => String(value || '').trim()).filter(Boolean);
  return Array.from(new Set(values));
}

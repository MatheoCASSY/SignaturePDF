import { randomUUID } from 'crypto';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import {
  createPresignedPutUrl,
  ensureStorageReady,
  getBucketName,
  getS3Client,
  getPrincipal,
  json,
  principalKey,
  readJsonBody,
  readJsonObject,
  writeJsonObject,
} from './_shared';

export type SubmissionRecord = {
  id: string;
  templateId: string;
  templateName: string;
  principal: string;
  submittedAt: string;
  filename: string;
};

type SubmissionIndex = {
  submissions: SubmissionRecord[];
};

function submissionIndexKey() {
  return 'submissions/index.json';
}

function submissionObjectKey(id: string) {
  return `submissions/${id}.pdf`;
}

async function loadIndex() {
  return readJsonObject<SubmissionIndex>(submissionIndexKey(), { submissions: [] });
}

async function saveIndex(submissions: SubmissionRecord[]) {
  const sorted = submissions.slice().sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  await writeJsonObject(submissionIndexKey(), { submissions: sorted });
}

const S3_KEY_RE = /^submissions\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/;

export default async function handler(req: any, res: any) {
  try {
    ensureStorageReady();
    const url = new URL(req.url, 'http://localhost');
    const principal = await getPrincipal(req);

    if (req.method === 'POST') {
      if (!principal) {
        json(res, 401, { error: 'Authentification requise' });
        return;
      }

      const body = await readJsonBody(req);
      const templateId = String(body.templateId || '').trim();
      const templateName = String(body.templateName || 'Document').trim();
      const pdfBase64 = String(body.pdf || '').trim();
      const s3Key = String(body.s3Key || '').trim();

      if (!templateId || (!pdfBase64 && !s3Key)) {
        json(res, 400, { error: 'templateId et (pdf ou s3Key) requis' });
        return;
      }

      let id: string;

      if (s3Key) {
        if (!S3_KEY_RE.test(s3Key)) {
          json(res, 400, { error: 's3Key invalide' });
          return;
        }
        id = s3Key.slice('submissions/'.length, -'.pdf'.length);
      } else {
        if (pdfBase64.length > 6_000_000) {
          json(res, 413, { error: 'PDF trop volumineux (max ~4 Mo)' });
          return;
        }
        id = randomUUID();
        await getS3Client().send(
          new PutObjectCommand({
            Bucket: getBucketName(),
            Key: submissionObjectKey(id),
            Body: Buffer.from(pdfBase64, 'base64'),
            ContentType: 'application/pdf',
          }),
        );
      }

      const now = new Date().toISOString();
      const safeName = templateName.replace(/[^a-zA-Z0-9À-ɏ\-_ ]/g, '_').slice(0, 60).trim();
      const filename = `${safeName || 'document'}_${now.slice(0, 10)}.pdf`;

      const record: SubmissionRecord = {
        id,
        templateId,
        templateName,
        principal: principalKey(principal),
        submittedAt: now,
        filename,
      };

      const index = await loadIndex();
      await saveIndex([...index.submissions, record]);

      json(res, 200, { submission: record });
      return;
    }

    if (req.method === 'GET') {
      const presign = url.searchParams.get('presign');

      if (presign === '1') {
        if (!principal) {
          json(res, 401, { error: 'Authentification requise' });
          return;
        }
        const id = randomUUID();
        const s3Key = submissionObjectKey(id);
        const uploadUrl = await createPresignedPutUrl(s3Key);
        json(res, 200, { uploadUrl, s3Key });
        return;
      }

      if (!principal?.isAdmin) {
        json(res, 401, { error: 'Accès admin requis' });
        return;
      }

      const id = url.searchParams.get('id');

      if (id) {
        const index = await loadIndex();
        const record = index.submissions.find((s) => s.id === id);
        if (!record) {
          json(res, 404, { error: 'Soumission introuvable' });
          return;
        }

        const response = await getS3Client().send(
          new GetObjectCommand({
            Bucket: getBucketName(),
            Key: submissionObjectKey(id),
          }),
        );

        const bytes = await response.Body?.transformToByteArray();
        if (!bytes) {
          json(res, 500, { error: 'Fichier PDF introuvable dans S3' });
          return;
        }

        json(res, 200, {
          submission: record,
          filename: record.filename,
          pdf: Buffer.from(bytes).toString('base64'),
        });
        return;
      }

      const index = await loadIndex();
      json(res, 200, { submissions: index.submissions });
      return;
    }

    if (req.method === 'DELETE') {
      if (!principal?.isAdmin) {
        json(res, 401, { error: 'Accès admin requis' });
        return;
      }

      const body = await readJsonBody(req);
      const id = String(body.id || '').trim();
      if (!id) {
        json(res, 400, { error: 'id requis' });
        return;
      }

      const index = await loadIndex();
      await saveIndex(index.submissions.filter((s) => s.id !== id));

      json(res, 200, { ok: true });
      return;
    }

    json(res, 405, { error: 'Méthode non autorisée' });
  } catch (error) {
    json(res, 500, { error: error instanceof Error ? error.message : 'Erreur serveur' });
  }
}

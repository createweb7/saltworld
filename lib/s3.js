// S3 abstraction. Wired now, gated by env. When AWS_* env vars are set the
// admin media library uploads through here. Until then, uploads gracefully
// fall back to local disk under /app/public/uploads.

import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

const BUCKET  = process.env.S3_BUCKET;
const REGION  = process.env.S3_REGION || process.env.AWS_REGION;
const KEY     = process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
const SECRET  = process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
const PREFIX  = process.env.S3_PREFIX || 'salt-world';
const CDN     = process.env.S3_CDN_URL; // optional CloudFront/base

export const s3IsConfigured = () => Boolean(BUCKET && REGION && KEY && SECRET);

let _client = null;
async function getClient() {
  if (_client) return _client;
  // Lazy import so builds don't fail when AWS SDK isn't installed yet.
  const mod = await import('@aws-sdk/client-s3').catch(() => null);
  if (!mod) return null;
  _client = new mod.S3Client({
    region: REGION,
    credentials: { accessKeyId: KEY, secretAccessKey: SECRET },
  });
  return _client;
}

export async function uploadBuffer({ buffer, mime, filename }) {
  const safeName = (filename || 'file').replace(/[^a-zA-Z0-9._-]+/g, '_');
  const key = `${PREFIX}/${new Date().toISOString().slice(0, 7)}/${randomUUID()}-${safeName}`;

  if (s3IsConfigured()) {
    const client = await getClient();
    if (client) {
      const mod = await import('@aws-sdk/client-s3');
      await client.send(new mod.PutObjectCommand({
        Bucket: BUCKET, Key: key, Body: buffer, ContentType: mime, ACL: 'public-read',
      }));
      const url = CDN
        ? `${CDN.replace(/\/$/, '')}/${key}`
        : `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
      return { key, url, storage: 's3' };
    }
  }

  // ---- Fallback: local disk under /app/public/uploads ----
  const dir = path.join(process.cwd(), 'public', 'uploads');
  await fs.mkdir(dir, { recursive: true });
  const localName = key.replace(/[^a-zA-Z0-9._/-]+/g, '_').replace(/^\//, '');
  const localPath = path.join(dir, localName);
  await fs.mkdir(path.dirname(localPath), { recursive: true });
  await fs.writeFile(localPath, buffer);
  const publicUrl = `/uploads/${localName}`;
  return { key: localName, url: publicUrl, storage: 'local' };
}

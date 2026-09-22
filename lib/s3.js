// S3-compatible object storage. Wired now, gated by env. Works against real
// AWS S3 *or* Cloudflare R2 (or anything else that speaks the S3 API) — R2
// implements the same API, so the same @aws-sdk/client-s3 client works
// against it, it just needs a custom `endpoint` instead of AWS's default and
// path-style addressing. When configured the admin media library and every
// migration script upload through here; until then, uploads gracefully fall
// back to local disk under /app/public/uploads.
//
// For Cloudflare R2, set:
//   S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
//   S3_REGION=auto
//   S3_BUCKET=<bucket name>
//   S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY = R2 API token
//   S3_CDN_URL=<bucket's public r2.dev URL or a custom domain>
// (R2 buckets aren't public by default — connect a custom domain or enable
// the r2.dev subdomain in the Cloudflare dashboard, then point S3_CDN_URL
// at it. Without it, uploaded files won't be publicly reachable.)

import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

const BUCKET   = process.env.S3_BUCKET;
const REGION   = process.env.S3_REGION || process.env.AWS_REGION;
const KEY      = process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
const SECRET   = process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
const PREFIX   = process.env.S3_PREFIX || 'salt-world';
const CDN      = process.env.S3_CDN_URL; // optional CloudFront/R2 public URL
const ENDPOINT = process.env.S3_ENDPOINT || null; // set for R2 / any non-AWS S3-compatible host

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
    ...(ENDPOINT ? { endpoint: ENDPOINT, forcePathStyle: true } : {}),
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
      // R2 rejects an explicit ACL (it has no bucket ACL concept — public
      // access is controlled at the bucket/domain level instead).
      await client.send(new mod.PutObjectCommand({
        Bucket: BUCKET, Key: key, Body: buffer, ContentType: mime,
        ...(ENDPOINT ? {} : { ACL: 'public-read' }),
      }));
      const url = CDN
        ? `${CDN.replace(/\/$/, '')}/${key}`
        : `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
      return { key, url, storage: ENDPOINT ? 'r2' : 's3' };
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

// Resolves the app's "@/..." import alias (jsconfig.json) and Next's
// extensionless "next/headers"-style imports, so lib/ modules can be
// imported directly by node:test.
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

export async function resolve(spec, ctx, next) {
  if (spec.startsWith('@/')) {
    let p = path.join(ROOT, spec.slice(2));
    if (!path.extname(p)) p += '.js';
    return next(pathToFileURL(p).href, ctx);
  }
  if (spec.startsWith('next/') && !path.extname(spec)) return next(spec + '.js', ctx);
  return next(spec, ctx);
}

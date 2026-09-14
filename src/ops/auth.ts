const TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/;

export function authorizeSecret(provided: string | null, expected: string | undefined): boolean {
  if (!expected || !provided) return false;
  if (!TOKEN_RE.test(provided) || !TOKEN_RE.test(expected)) return false;
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < provided.length; i += 1) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

export function extractBearer(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+([A-Za-z0-9_-]{16,128})$/);
  return match?.[1] ?? null;
}

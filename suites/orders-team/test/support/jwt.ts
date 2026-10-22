function splitToken(token: string): [string, string, string] {
  const parts = token.split('.');
  const [header, payload, signature] = parts;
  if (parts.length !== 3 || header === undefined || payload === undefined || signature === undefined) {
    throw new Error('Not a JWT: expected three dot-separated parts');
  }
  return [header, payload, signature];
}

function encode(value: object): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

export function decodePayload(token: string): Record<string, unknown> {
  const [, payload] = splitToken(token);
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
}

export function withForgedClaims(token: string, claims: Record<string, unknown>): string {
  const [header, , signature] = splitToken(token);
  return `${header}.${encode({ ...decodePayload(token), ...claims })}.${signature}`;
}

export function unsignedToken(claims: Record<string, unknown>): string {
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(claims)}.`;
}
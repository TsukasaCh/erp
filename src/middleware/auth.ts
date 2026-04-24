import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { verifyJWT, type JwtPayload } from '../services/auth';
import { prisma } from '../db/client';

// Augment Express Request so every handler sees `req.auth` without losing the
// generic params/query/body typing that comes from `Request<P, ResBody, ...>`.
declare module 'express-serve-static-core' {
  interface Request {
    auth?: {
      userId: string;
      username: string;
      isSuperAdmin: boolean;
      permissions: string[];
    };
  }
}

// Kept as a convenience alias — existing code paths referencing the symbol still work.
export type AuthedRequest = Request;

export const requireAuth: RequestHandler = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'missing_token' });
  }
  const token = header.slice('Bearer '.length);
  let payload: JwtPayload;
  try {
    payload = verifyJWT(token);
  } catch {
    return res.status(401).json({ error: 'invalid_token' });
  }

  // Re-hydrate permissions from role on each request (so role changes apply immediately)
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: { role: true },
  });
  if (!user || !user.active) {
    return res.status(401).json({ error: 'user_inactive_or_missing' });
  }

  let permissions: string[] = [];
  if (user.role) {
    try { permissions = JSON.parse(user.role.permissions) as string[]; }
    catch { permissions = []; }
  }

  req.auth = {
    userId: user.id,
    username: user.username,
    isSuperAdmin: user.isSuperAdmin,
    permissions,
  };
  next();
};

export function requirePermission(perm: string): RequestHandler {
  return (req, res, next) => {
    if (!req.auth) return res.status(401).json({ error: 'unauthenticated' });
    if (req.auth.isSuperAdmin) return next();
    if (req.auth.permissions.includes(perm)) return next();
    return res.status(403).json({ error: 'forbidden', required: perm });
  };
}

export const requireSuperAdmin: RequestHandler = (req, res, next) => {
  if (!req.auth) return res.status(401).json({ error: 'unauthenticated' });
  if (!req.auth.isSuperAdmin) return res.status(403).json({ error: 'superadmin_required' });
  next();
};

// Re-export Response & NextFunction for callers that used them via this module
export type { Request, Response, NextFunction };

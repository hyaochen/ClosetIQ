import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';

async function auth(app: FastifyInstance) {
  await app.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || (() => { throw new Error('JWT_SECRET environment variable is required'); })(),
    sign: { expiresIn: '15m' },
  });

  // Decorator to protect routes
  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.status(401).send({ error: '請先登入' });
    }
  });
}

// fp() breaks encapsulation so decorators are visible to sibling plugins
export const authPlugin = fp(auth);

// Refresh token helper (longer expiry, separate secret)
export function signRefreshToken(app: FastifyInstance, payload: { id: string; email: string }) {
  return app.jwt.sign(payload, {
    expiresIn: '7d',
  });
}

// Type augmentation for Fastify
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { id: string; email: string };
    user: { id: string; email: string };
  }
}

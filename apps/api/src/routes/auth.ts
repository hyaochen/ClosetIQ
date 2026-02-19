import type { FastifyInstance } from 'fastify';
import * as argon2 from 'argon2';
import { registerSchema, loginSchema } from '@closet/shared';
import { prisma } from '../lib/prisma.js';
import { signRefreshToken } from '../plugins/auth.js';

export async function authRoutes(app: FastifyInstance) {
  // POST /api/auth/register
  app.post('/api/auth/register', async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      const msgs = Object.entries(flat.fieldErrors)
        .map(([_, errors]) => (errors as string[])[0])
        .filter(Boolean);
      return reply.status(400).send({ error: msgs.join('；') || '輸入格式錯誤', details: flat });
    }

    const { email, password, displayName } = parsed.data;

    // Check if email already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return reply.status(409).send({ error: '此帳號已被註冊' });
    }

    const passwordHash = await argon2.hash(password);
    const user = await prisma.user.create({
      data: { email, displayName, passwordHash },
      select: { id: true, email: true, displayName: true, createdAt: true },
    });

    const tokenPayload = { id: user.id, email: user.email };
    const accessToken = app.jwt.sign(tokenPayload);
    const refreshToken = signRefreshToken(app, tokenPayload);

    return reply.status(201).send({
      user,
      accessToken,
      refreshToken,
    });
  });

  // POST /api/auth/login
  app.post('/api/auth/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      const msgs = Object.entries(flat.fieldErrors)
        .map(([_, errors]) => (errors as string[])[0])
        .filter(Boolean);
      return reply.status(400).send({ error: msgs.join('；') || '輸入格式錯誤', details: flat });
    }

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return reply.status(401).send({ error: '帳號或密碼錯誤' });
    }

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      return reply.status(401).send({ error: '帳號或密碼錯誤' });
    }

    const tokenPayload = { id: user.id, email: user.email };
    const accessToken = app.jwt.sign(tokenPayload);
    const refreshToken = signRefreshToken(app, tokenPayload);

    return reply.send({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        createdAt: user.createdAt,
      },
      accessToken,
      refreshToken,
    });
  });

  // POST /api/auth/refresh
  app.post('/api/auth/refresh', async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken?: string };
    if (!refreshToken) {
      return reply.status(400).send({ error: '請提供 refresh token' });
    }

    try {
      const payload = app.jwt.verify<{ id: string; email: string }>(refreshToken);
      const user = await prisma.user.findUnique({ where: { id: payload.id } });
      if (!user) {
        return reply.status(401).send({ error: '使用者不存在' });
      }

      const tokenPayload = { id: user.id, email: user.email };
      const newAccessToken = app.jwt.sign(tokenPayload);
      const newRefreshToken = signRefreshToken(app, tokenPayload);

      return reply.send({
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      });
    } catch {
      return reply.status(401).send({ error: 'Refresh token 已過期，請重新登入' });
    }
  });

  // GET /api/auth/me
  app.get('/api/auth/me', { onRequest: [app.authenticate] }, async (request, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user.id },
      select: { id: true, email: true, displayName: true, createdAt: true },
    });

    if (!user) {
      return reply.status(404).send({ error: '使用者不存在' });
    }

    return reply.send({ user });
  });
}

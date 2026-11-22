import 'reflect-metadata';
import 'dotenv/config';
import express from 'express';
import { toNodeHandler } from 'better-auth/node';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from './module.js';
import { auth } from './auth/auth.js';
import { prisma } from './lib/prisma.js';

async function bootstrap(): Promise<void> {
  const server = express();
  // Must be registered before Nest's JSON body parser; preserves OAuth raw body.
  server.all('/api/auth/*splat', toNodeHandler(auth));
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server));
  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: process.env.WEB_ORIGIN || 'http://localhost:5173', credentials: true });
  app.enableShutdownHooks();
  const port = Number(process.env.PORT || 3001);
  await app.listen(port);
  console.info(`AcademyOS API available at http://localhost:${port}/api/v1`);
}

bootstrap().catch(async (error: unknown) => {
  console.error('Could not boot AcademyOS API', error);
  await prisma.$disconnect();
  process.exitCode = 1;
});

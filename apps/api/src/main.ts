import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.enableCors({ origin: process.env.WEB_ORIGIN || 'http://localhost:5173' });
  const port = Number(process.env.PORT || 3001);
  await app.listen(port);
  console.info(`AcademyOS demo API listening on http://localhost:${port}/api/v1`);
}

bootstrap().catch((error: unknown) => {
  console.error('Could not boot AcademyOS API', error);
  process.exitCode = 1;
});

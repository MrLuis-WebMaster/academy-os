import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL must be configured before starting AcademyOS');

// One pool per API process. Never expose DB credentials to the browser.
export const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

import { PrismaClient } from '@prisma/client';
declare global { var prisma: PrismaClient | undefined }
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.STORAGE_URL || process.env.STORAGE_DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || '';
}
export const prisma = global.prisma ?? new PrismaClient({log: process.env.NODE_ENV==='development'?['error','warn']:['error']});
if(process.env.NODE_ENV!=='production') global.prisma=prisma;

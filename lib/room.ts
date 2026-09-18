import { prisma } from './prisma';
export async function roomByCode(code:string){
 return prisma.room.findUnique({where:{code:code.toUpperCase()},include:{participants:{orderBy:{joinedAt:'asc'}},submissions:{include:{song:true,participant:true},orderBy:{createdAt:'asc'}}}})
}
export function makeCode(){return Math.random().toString(36).slice(2,8).toUpperCase()}

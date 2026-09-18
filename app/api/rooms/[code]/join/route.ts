import {NextResponse} from 'next/server';
import {z} from 'zod';
import {prisma} from '@/lib/prisma';
const schema=z.object({name:z.string().trim().min(1).max(40)});
export async function POST(req:Request,{params}:{params:{code:string}}){try{const {name}=schema.parse(await req.json());const room=await prisma.room.findUnique({where:{code:params.code.toUpperCase()},include:{participants:true}});if(!room)return NextResponse.json({error:'Room not found.'},{status:404});if(room.status==='CLOSED')return NextResponse.json({error:'This room is closed.'},{status:400});let participant=room.participants.find(p=>p.name.toLowerCase()===name.toLowerCase());if(!participant)participant=await prisma.participant.create({data:{roomId:room.id,name}});return NextResponse.json({ok:true,participantId:participant.id})}catch(e){return NextResponse.json({error:'Could not join room.'},{status:400})}}

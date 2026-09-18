import {NextResponse} from 'next/server';
import {z} from 'zod';
import {prisma} from '@/lib/prisma';
import {similarity} from '@/lib/similarity';

const bodySchema=z.object({participantName:z.string().trim().min(1).max(40),title:z.string().trim().min(1).max(100),artist:z.string().trim().min(1).max(80),durationMs:z.number().int().nonnegative().nullable().optional(),trackUrl:z.string().url(),previewUrl:z.string().url(),providerId:z.string().regex(/^[a-f0-9]{64}$/i)});

export async function POST(req:Request,{params}:{params:{code:string}}){
 try{
  const body=bodySchema.parse(await req.json());
  const room=await prisma.room.findUnique({where:{code:params.code.toUpperCase()},include:{participants:true,submissions:{include:{song:true,participant:true}}}});
  if(!room)return NextResponse.json({error:'Room not found.'},{status:404});
  if(room.status==='CLOSED')return NextResponse.json({error:'This room is closed.'},{status:400});
  const blobUrl=new URL(body.trackUrl);if(!blobUrl.hostname.endsWith('.public.blob.vercel-storage.com'))return NextResponse.json({error:'Invalid upload URL.'},{status:400});
  let participant=room.participants.find(p=>p.name.toLowerCase()===body.participantName.toLowerCase());
  if(!participant)participant=await prisma.participant.create({data:{roomId:room.id,name:body.participantName}});
  const mine=room.submissions.filter(s=>s.participantId===participant.id);if(mine.length>=room.maxSongs)return NextResponse.json({error:`You already selected ${room.maxSongs} songs.`},{status:400});
  const existing=await prisma.song.findUnique({where:{provider_providerId:{provider:'upload',providerId:body.providerId}}});
  if(existing&&room.submissions.some(s=>s.songId===existing.id))return NextResponse.json({error:'DUPLICATE',message:'Someone already uploaded this exact MP3. Pick another track.'},{status:409});
  const song=existing||await prisma.song.create({data:{provider:'upload',providerId:body.providerId,title:body.title,artist:body.artist,album:'MP3 upload',durationMs:body.durationMs??null,trackUrl:body.trackUrl,previewUrl:body.previewUrl,metadata:{source:'user-upload'}}});
  const similar=room.submissions.map(s=>({s,score:similarity(song,s.song)})).filter(x=>x.score>=.55).sort((a,b)=>b.score-a.score).slice(0,3).map(x=>({title:x.s.song.title,artist:x.s.song.artist,artworkUrl:x.s.song.artworkUrl,score:x.score}));
  try{await prisma.submission.create({data:{roomId:room.id,participantId:participant.id,songId:song.id}})}catch(e:any){if(e?.code==='P2002')return NextResponse.json({error:'DUPLICATE',message:'Someone just selected this track. Pick another one.'},{status:409});throw e}
  return NextResponse.json({ok:true,similar});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Could not add MP3.'},{status:400})}
}

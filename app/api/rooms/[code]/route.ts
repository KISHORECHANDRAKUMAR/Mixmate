import {NextResponse} from 'next/server';import {z} from 'zod';import {prisma} from '@/lib/prisma';import {roomByCode} from '@/lib/room';import {similarity, findDuplicateSubmission} from '@/lib/similarity';
const add=z.object({participantName:z.string().trim().min(1).max(40),song:z.object({provider:z.string().min(1),providerId:z.string().min(1),title:z.string().min(1),artist:z.string().min(1),album:z.string().nullable().optional(),artworkUrl:z.string().url().nullable().optional(),durationMs:z.number().int().nullable().optional(),trackUrl:z.string().url().nullable().optional(),previewUrl:z.string().url().nullable().optional()})});
export async function GET(_:Request,{params}:{params:{code:string}}){const r=await roomByCode(params.code);if(!r)return NextResponse.json({error:'Room not found'},{status:404});return NextResponse.json(r)}
export async function POST(req:Request,{params}:{params:{code:string}}){
 try{
  const body=add.parse(await req.json()); const r=await roomByCode(params.code); if(!r)return NextResponse.json({error:'Room not found'},{status:404});
  if(r.status==='CLOSED')return NextResponse.json({error:'This room is closed.'},{status:400});
  const preExisting = findDuplicateSubmission(body.song, r.submissions);
  if (preExisting) return NextResponse.json({error:'DUPLICATE',message:`"${preExisting.song.title}" is already in this room's playlist. Duplicate songs are not allowed.`},{status:409});
  let p=r.participants.find(x=>x.name.toLowerCase()===body.participantName.toLowerCase());
  if(!p)p=await prisma.participant.create({data:{roomId:r.id,name:body.participantName}});
  const mine=r.submissions.filter(s=>s.participantId===p.id); if(mine.length>=r.maxSongs)return NextResponse.json({error:`You already selected ${r.maxSongs} songs.`},{status:400});
  const song=await prisma.song.upsert({where:{provider_providerId:{provider:body.song.provider,providerId:body.song.providerId}},update:body.song,create:body.song});
  if(r.submissions.some(s=>s.songId===song.id))return NextResponse.json({error:'DUPLICATE',message:`"${song.title}" is already in this room's playlist. Duplicate songs are not allowed.`},{status:409});
  const similar=r.submissions.map(s=>({s,score:similarity(song,s.song)})).filter(x=>x.score>=.62).sort((a,b)=>b.score-a.score).slice(0,3).map(x=>({title:x.s.song.title,artist:x.s.song.artist,artworkUrl:x.s.song.artworkUrl,score:x.score}));
  try{await prisma.submission.create({data:{roomId:r.id,participantId:p.id,songId:song.id}})}catch(e:any){if(e?.code==='P2002')return NextResponse.json({error:'DUPLICATE',message:'Someone just selected this song. Pick another one.'},{status:409});throw e}
  return NextResponse.json({ok:true,similar});
 }catch(e:any){console.error('Error adding song:',e);return NextResponse.json({error:e?.message||'Could not add that song.'},{status:400})}
}

export async function DELETE(req:Request,{params}:{params:{code:string}}){
 try{
  const {searchParams}=new URL(req.url);
  let submissionId=searchParams.get('submissionId');
  let participantName=searchParams.get('participantName')?.trim();
  if(!submissionId||!participantName){
   try{const b=await req.json();submissionId=submissionId||b?.submissionId;participantName=participantName||b?.participantName?.trim();}catch{}
  }
  if(!submissionId||!participantName)return NextResponse.json({error:'Missing submissionId or participantName'},{status:400});
  const submission=await prisma.submission.findUnique({where:{id:submissionId},include:{room:true,participant:true,song:true}});
  if(!submission||submission.room.code!==params.code.toUpperCase())return NextResponse.json({error:'Song submission not found in this room.'},{status:404});
  const isOwner=submission.participant.name.toLowerCase()===participantName.toLowerCase();
  const isCreator=submission.room.creatorName.toLowerCase()===participantName.toLowerCase();
  if(!isOwner&&!isCreator)return NextResponse.json({error:'You can only remove songs you added, or if you are the room creator.'},{status:403});
  await prisma.submission.delete({where:{id:submissionId}});
  return NextResponse.json({ok:true,removedTitle:submission.song.title});
 }catch(err:any){console.error('Error removing song:',err);return NextResponse.json({error:err?.message||'Could not remove song.'},{status:500})}
}

export async function PATCH(req:Request,{params}:{params:{code:string}}){
 try{
  const body=await req.json();
  const participantName=String(body.participantName||'').trim();
  const room=await prisma.room.findUnique({where:{code:params.code.toUpperCase()}});
  if(!room)return NextResponse.json({error:'Room not found.'},{status:404});
  if(room.creatorName.trim().toLowerCase()!==participantName.toLowerCase()){
   return NextResponse.json({error:`Only the room creator ("${room.creatorName}") can modify room settings.`},{status:403});
  }
  const data:any={};
  if(body.maxSongs!==undefined){
   const maxSongs=Number(body.maxSongs);
   if(isNaN(maxSongs)||maxSongs<1||maxSongs>50){
    return NextResponse.json({error:'Song limit must be between 1 and 50.'},{status:400});
   }
   data.maxSongs=maxSongs;
  }
  if(body.allowDownloads!==undefined){
   data.allowDownloads=Boolean(body.allowDownloads);
  }
  if(Object.keys(data).length===0){
   return NextResponse.json({error:'No valid fields to update.'},{status:400});
  }
  const updated=await prisma.room.update({where:{id:room.id},data});
  return NextResponse.json({ok:true,maxSongs:updated.maxSongs,allowDownloads:updated.allowDownloads,room:updated});
 }catch(err:any){console.error('Error updating room settings:',err);return NextResponse.json({error:err?.message||'Could not update room settings.'},{status:500})}
}

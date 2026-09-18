import {NextResponse} from 'next/server';
import {prisma} from '@/lib/prisma';
import {similarity, findDuplicateSubmission} from '@/lib/similarity';
import {writeFile, mkdir} from 'node:fs/promises';
import path from 'node:path';

export const runtime='nodejs';

export async function POST(request:Request,{params}:{params:{code:string}}){
  const contentType = request.headers.get('content-type') || '';

  // 1. Direct Multipart Form Upload (Local storage)
  if (contentType.includes('multipart/form-data')) {
    try {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const participantName = String(formData.get('participantName') || '').trim();
      const permission = formData.get('permission') === 'true';
      const title = String(formData.get('title') || '').trim();
      const artist = String(formData.get('artist') || '').trim() || 'Uploaded MP3';
      const durationMs = formData.get('durationMs') ? Number(formData.get('durationMs')) : null;
      const providerId = String(formData.get('providerId') || '').trim();

      if (!file) return NextResponse.json({ error: 'No audio file provided.' }, { status: 400 });
      if (!permission) return NextResponse.json({ error: 'Confirm that you own the MP3 or have permission to share it.' }, { status: 400 });
      if (!participantName) return NextResponse.json({ error: 'Your name is required.' }, { status: 400 });
      if (file.size > 30 * 1024 * 1024) return NextResponse.json({ error: 'File size exceeds 30 MB limit.' }, { status: 400 });

      const room = await prisma.room.findUnique({
        where: { code: params.code.toUpperCase() },
        include: { participants: true, submissions: { include: { song: true, participant: true } } }
      });
      if (!room) return NextResponse.json({ error: 'Room not found.' }, { status: 404 });
      if (room.status === 'CLOSED') return NextResponse.json({ error: 'This room is closed.' }, { status: 400 });

      const songTitle = title || file.name.replace(/\.mp3$/i, '');
      const duplicate = findDuplicateSubmission({ title: songTitle, artist, album: 'MP3 upload' }, room.submissions);
      if (duplicate) {
        return NextResponse.json({
          error: 'DUPLICATE',
          message: `"${duplicate.song.title}" is already in this room's playlist. Duplicate songs are not allowed.`
        }, { status: 409 });
      }

      let participant = room.participants.find(p => p.name.toLowerCase() === participantName.toLowerCase());
      if (!participant) {
        participant = await prisma.participant.create({
          data: { roomId: room.id, name: participantName }
        });
      }

      const count = room.submissions.filter(s => s.participantId === participant!.id).length;
      if (count >= room.maxSongs) {
        return NextResponse.json({ error: `You already selected ${room.maxSongs} songs.` }, { status: 400 });
      }

      const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
      await mkdir(uploadsDir, { recursive: true });

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filename = `${params.code.toUpperCase()}_${Date.now()}_${safeName}`;
      const filePath = path.join(uploadsDir, filename);

      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(filePath, buffer);

      const fileUrl = `/uploads/${filename}`;
      const effectiveProviderId = providerId || filename;

      const existing = await prisma.song.findUnique({
        where: { provider_providerId: { provider: 'upload', providerId: effectiveProviderId } }
      });

      if (existing && room.submissions.some(s => s.songId === existing.id)) {
        return NextResponse.json({ error: 'DUPLICATE', message: `"${songTitle}" is already in this room's playlist. Duplicate songs are not allowed.` }, { status: 409 });
      }

      const song = existing || await prisma.song.create({
        data: {
          provider: 'upload',
          providerId: effectiveProviderId,
          title: songTitle,
          artist,
          album: 'MP3 upload',
          durationMs: durationMs ?? null,
          trackUrl: fileUrl,
          previewUrl: fileUrl,
          metadata: JSON.stringify({ source: 'user-upload' })
        }
      });

      const similar = room.submissions
        .map(s => ({ s, score: similarity(song, s.song) }))
        .filter(x => x.score >= 0.55)
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(x => ({
          title: x.s.song.title,
          artist: x.s.song.artist,
          artworkUrl: x.s.song.artworkUrl,
          score: x.score
        }));

      try {
        await prisma.submission.create({
          data: { roomId: room.id, participantId: participant!.id, songId: song.id }
        });
      } catch (e: any) {
        if (e?.code === 'P2002') {
          return NextResponse.json({ error: 'DUPLICATE', message: 'Someone just selected this track. Pick another one.' }, { status: 409 });
        }
        throw e;
      }

      return NextResponse.json({ ok: true, similar, url: fileUrl });
    } catch (err: any) {
      console.error('Local MP3 upload error:', err);
      return NextResponse.json({ error: err?.message || 'Failed to upload MP3.' }, { status: 500 });
    }
  }

  // 2. Vercel Blob fallback
  try{
    const {handleUpload} = await import('@vercel/blob/client');
    const body=(await request.json()) as any;
    const response=await handleUpload({
      body,request,
      onBeforeGenerateToken:async(_pathname,clientPayload)=>{
        const payload=JSON.parse(clientPayload||'{}');
        const participantName=String(payload.participantName||'').trim();
        const permission=payload.permission===true;
        const room=await prisma.room.findUnique({where:{code:params.code.toUpperCase()},include:{participants:true,submissions:true}});
        if(!room)throw new Error('Room not found.');
        if(room.status==='CLOSED')throw new Error('This room is closed.');
        if(!participantName)throw new Error('Your name is required.');
        if(!permission)throw new Error('Confirm that you own the MP3 or have permission to share it.');
        let participant=room.participants.find(p=>p.name.toLowerCase()===participantName.toLowerCase());
        if(!participant)participant=await prisma.participant.create({data:{roomId:room.id,name:participantName}});
        const count=room.submissions.filter(s=>s.participantId===participant!.id).length;
        if(count>=room.maxSongs)throw new Error(`You already selected ${room.maxSongs} songs.`);
        return {allowedContentTypes:['audio/mpeg'],maximumSizeInBytes:30*1024*1024,addRandomSuffix:true,multipart:true,tokenPayload:JSON.stringify(payload)};
      },
      onUploadCompleted:async({blob})=>{console.log('MixMate MP3 uploaded',blob.url)}
    });
    return NextResponse.json(response);
  }catch(error){return NextResponse.json({error:error instanceof Error?error.message:String(error)},{status:400})}
}

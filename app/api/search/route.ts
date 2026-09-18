import {NextResponse} from 'next/server';
export const dynamic='force-dynamic';
export async function GET(req:Request){
 const q=new URL(req.url).searchParams.get('q')?.trim();
 if(!q||q.length<2)return NextResponse.json([]);
 const r=await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=15`,{next:{revalidate:30}});
 if(!r.ok)return NextResponse.json({error:'Music search unavailable'},{status:502});
 const d=await r.json();
 return NextResponse.json(d.results.map((x:any)=>({provider:'itunes',providerId:String(x.trackId),title:x.trackName,artist:x.artistName,album:x.collectionName||'',artworkUrl:x.artworkUrl100?.replace('100x100','600x600'),durationMs:x.trackTimeMillis??null,trackUrl:x.trackViewUrl??null,previewUrl:x.previewUrl??null})));
}

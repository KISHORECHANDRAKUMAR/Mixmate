export type SongLike={title:string;artist:string;album?:string|null;durationMs?:number|null}
const stop=new Set(['the','a','an','official','video','audio','music','song','from','remix','version','original','lyrics']);
export function norm(s:string){return s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(x=>x&&!stop.has(x)).join(' ')}
function tokens(s:string){return new Set(norm(s).split(' ').filter(Boolean))}
function jaccard(a:Set<string>,b:Set<string>){let i=0;for(const x of a)if(b.has(x))i++;const u=new Set([...a,...b]).size;return u?i/u:0}
export function similarity(a:SongLike,b:SongLike){
 const title=jaccard(tokens(a.title),tokens(b.title));
 const artist=jaccard(tokens(a.artist),tokens(b.artist));
 const album=jaccard(tokens(a.album||''),tokens(b.album||''));
 const dur=a.durationMs&&b.durationMs?Math.max(0,1-Math.abs(a.durationMs-b.durationMs)/90000):0;
 return .55*title+.30*artist+.10*album+.05*dur;
}
export function isSimilar(a:SongLike,b:SongLike){return similarity(a,b)>=.62}

export function isDuplicateSong(a: SongLike & {provider?: string; providerId?: string; id?: string}, b: SongLike & {provider?: string; providerId?: string; id?: string}): boolean {
 if(!a || !b) return false;
 if(a.id && b.id && a.id === b.id) return true;
 if(a.provider && b.provider && a.providerId && b.providerId && a.provider === b.provider && String(a.providerId) === String(b.providerId)) return true;

 const normTitleA = norm(a.title || '');
 const normTitleB = norm(b.title || '');
 const normArtistA = norm(a.artist || '');
 const normArtistB = norm(b.artist || '');

 if(normTitleA && normTitleA === normTitleB && normArtistA && normArtistA === normArtistB) return true;
 if(similarity(a, b) >= 0.75) return true;

 return false;
}

export function findDuplicateSubmission(song: SongLike & {provider?: string; providerId?: string; id?: string}, submissions: Array<{song: any}>) {
 if(!submissions || !Array.isArray(submissions)) return null;
 return submissions.find(s => s?.song && isDuplicateSong(song, s.song));
}

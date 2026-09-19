"use client";
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {useParams,useSearchParams} from 'next/navigation';
import {Search,Copy,Check,AlertTriangle,Users,Music2,ExternalLink,RefreshCw,Upload,Download,Play,Pause,Trash2,Sliders,SkipBack,SkipForward,Shuffle,X,User,FileDown,Repeat,ListMusic,Sparkles,Lock} from 'lucide-react';
import {findDuplicateSubmission} from '@/lib/similarity';

type Msg = {type:'error'|'success'|'similar'; text?:string; items?:any[]} | null;

export default function Room(){
 const {code} = useParams() as {code:string};
 const qs = useSearchParams();

 // Identity & Creator State
 const [name, setName] = useState<string>('');
 const [room, setRoom] = useState<any>(null);
 const [showSettings, setShowSettings] = useState(false);
 const [showNameModal, setShowNameModal] = useState(false);
 const [showSpotifyModal, setShowSpotifyModal] = useState(false);
 const [tempName, setTempName] = useState('');
 const [customAllowDownloads, setCustomAllowDownloads] = useState(true);
 const [isLoop, setIsLoop] = useState(true);
 const [showQueue, setShowQueue] = useState(false);

 // Search & Room State
 const [q, setQ] = useState('');
 const [results, setResults] = useState<any[]>([]);
 const [msg, setMsg] = useState<Msg>(null);
 const [busy, setBusy] = useState(false);
 const [tab, setTab] = useState<'add'|'playlist'|'people'>('playlist');
 const [copied, setCopied] = useState(false);
 const [searching, setSearching] = useState(false);

 // MP3 Upload State
 const [file, setFile] = useState<File|null>(null);
 const [uploadTitle, setUploadTitle] = useState('');
 const [uploadArtist, setUploadArtist] = useState('');
 const [permission, setPermission] = useState(false);
 const [uploading, setUploading] = useState(false);
 const [fileDuration, setFileDuration] = useState(0);
 const fileRef = useRef<HTMLInputElement>(null);

 // Web Audio / Continuous Player State
 const audioRef = useRef<HTMLAudioElement|null>(null);
 const [playingIndex, setPlayingIndex] = useState<number|null>(null);
 const [isPlaying, setIsPlaying] = useState(false);
 const [isShuffle, setIsShuffle] = useState(false);
 const [currentTime, setCurrentTime] = useState(0);
 const [duration, setDuration] = useState(0);

 // Initialize identity from URL query param or localStorage
 useEffect(()=>{
  if(typeof window!=='undefined'){
   const urlName=qs.get('name')?.trim();
   const storedRoomName=localStorage.getItem('mixmade_name_'+code)||localStorage.getItem('mixmate_name_'+code)||'';
   const chosenName=urlName||storedRoomName;
   if(chosenName){
    setName(chosenName);
    setTempName(chosenName);
    localStorage.setItem('mixmade_name_'+code, chosenName);
    localStorage.setItem('mixmade_user_name', chosenName);
    localStorage.setItem('mixmate_name_'+code, chosenName);
    localStorage.setItem('mixmate_user_name', chosenName);
    if(urlName && window.location.search){
     window.history.replaceState(null, '', '/room/'+code);
    }
   }else{
    // New visitor who hasn't joined this room yet
    const prevName=localStorage.getItem('mixmade_user_name')||localStorage.getItem('mixmate_user_name')||'';
    if(prevName) setTempName(prevName);
    setShowNameModal(true);
   }
  }
 },[code,qs]);

 const saveName=async (newName:string)=>{
  const clean=newName.trim();
  if(!clean)return;
  setName(clean);
  if(typeof window!=='undefined'){
   localStorage.setItem('mixmade_name_'+code, clean);
   localStorage.setItem('mixmade_user_name', clean);
   localStorage.setItem('mixmate_name_'+code, clean);
   localStorage.setItem('mixmate_user_name', clean);
  }
  setShowNameModal(false);
  try{
   await fetch('/api/rooms/'+code+'/join',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({name:clean})
   });
   setMsg({type:'success',text:`Welcome to the room, ${clean}!`});
   await load();
  }catch(e){
   console.error('Failed to join room:', e);
  }
 };

 const load = useCallback(async()=>{
  try{
   const r=await fetch('/api/rooms/'+code,{cache:'no-store'});
   if(r.ok){
    const d=await r.json();
    setRoom(d);
   }
  }catch(e){
   console.error('Failed to load room:', e);
  }
 },[code]);

 const openSettings = () => {
  setCustomAllowDownloads(room?.allowDownloads ?? true);
  setShowSettings(true);
 };

 useEffect(()=>{
  let active=true;
  (async()=>{
   if(name){
    await fetch('/api/rooms/'+code+'/join',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})}).catch(()=>{});
   }
   if(active)load();
  })();
  const t=setInterval(load, 2500);
  return ()=>{active=false; clearInterval(t);};
 },[load,code,name]);

 const isCreator = Boolean(
  room?.creatorName && name && room.creatorName.trim().toLowerCase() === name.trim().toLowerCase()
 );

 async function search(){
  if(q.trim().length<2)return;
  setSearching(true);
  try{
   const r=await fetch('/api/search?q='+encodeURIComponent(q.trim()));
   const d=await r.json();
   setResults(Array.isArray(d)?d:[]);
  }finally{
   setSearching(false);
  }
 }

 async function add(song:any){
  if(!name){
   setShowNameModal(true);
   return;
  }
  setBusy(true);
  setMsg(null);
  try{
   const r=await fetch('/api/rooms/'+code,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({participantName:name,song})
   });
   const d=await r.json();
   if(!r.ok){
    setMsg({type:'error',text:d.message||d.error||'Could not add song'});
    return;
   }
   setMsg(d.similar?.length?{type:'similar',items:d.similar}:{type:'success',text:`Added "${song.title}" to the room.`});
   await load();
  }finally{
   setBusy(false);
  }
 }

 async function removeSong(subId:string,songTitle:string){
  if(busy)return;
  setBusy(true);
  setMsg(null);
  try{
   const r=await fetch(`/api/rooms/${code}?submissionId=${encodeURIComponent(subId)}&participantName=${encodeURIComponent(name)}`,{
    method:'DELETE',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({submissionId:subId,participantName:name})
   });
   const d=await r.json();
   if(!r.ok){
    setMsg({type:'error',text:d.error||'Could not remove song.'});
    return;
   }
   setMsg({type:'success',text:`Removed "${songTitle}" from playlist.`});
   if(playingIndex!==null&&room?.submissions[playingIndex]?.id===subId){
    stopPlayback();
   }
   await load();
  }catch(e:any){
   setMsg({type:'error',text:e?.message||'Failed to remove song.'});
  }finally{
   setBusy(false);
  }
 }

 async function saveSettings(){
  setBusy(true);
  try{
   const sender = (name || room?.creatorName || '').trim();
   const r=await fetch('/api/rooms/'+code,{
    method:'PATCH',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
     participantName: sender,
     allowDownloads: customAllowDownloads
    })
   });
   const d=await r.json();
   if(!r.ok){
    setMsg({type:'error',text:d.error||'Failed to update room settings.'});
    return;
   }
   setRoom((prev:any) => prev ? ({...prev, allowDownloads: d.allowDownloads}) : prev);
   setMsg({type:'success',text:'Room settings updated successfully.'});
   setShowSettings(false);
   await load();
  }catch(e:any){
   setMsg({type:'error',text:e?.message||'Failed to update room settings.'});
  }finally{
   setBusy(false);
  }
 }

 async function chooseFile(f:File|null){
  setFile(f);
  setFileDuration(0);
  if(!f)return;
  setUploadTitle(f.name.replace(/\.mp3$/i,'').replace(/[_-]+/g,' '));
  const url=URL.createObjectURL(f);
  const audio=new Audio(url);
  audio.onloadedmetadata=()=>{
   setFileDuration(Number.isFinite(audio.duration)?Math.round(audio.duration*1000):0);
   URL.revokeObjectURL(url);
  };
 }

 async function uploadMp3(){
  if(!name){
   setShowNameModal(true);
   return;
  }
  if(!file)return;
  setUploading(true);
  setMsg(null);
  try{
   const bytes=await file.arrayBuffer();
   const digest=await crypto.subtle.digest('SHA-256',bytes);
   const providerId=Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
   const formData=new FormData();
   formData.append('file',file);
   formData.append('participantName',name);
   formData.append('permission',String(permission));
   formData.append('title',uploadTitle.trim()||file.name.replace(/\.mp3$/i,''));
   formData.append('artist',uploadArtist.trim()||'Uploaded MP3');
   formData.append('durationMs',String(fileDuration));
   formData.append('providerId',providerId);
   const r=await fetch('/api/rooms/'+code+'/upload',{method:'POST',body:formData});
   const d=await r.json();
   if(!r.ok){
    setMsg({type:'error',text:d.error||d.message||'Could not add MP3'});
    return;
   }
   setMsg(d.similar?.length?{type:'similar',items:d.similar}:{type:'success',text:'MP3 uploaded and added to the room.'});
   setFile(null);
   setUploadTitle('');
   setUploadArtist('');
   setPermission(false);
   if(fileRef.current)fileRef.current.value='';
   await load();
  }catch(e:any){
   setMsg({type:'error',text:e?.message||'Upload failed.'});
  }finally{
   setUploading(false);
  }
 }

 async function copy(){
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/room/${code}` : location.href;
  await navigator.clipboard.writeText(shareUrl);
  setCopied(true);
  setTimeout(()=>setCopied(false),1800);
 }

 const currentPlayingSong = playingIndex !== null && room?.submissions?.[playingIndex]?.song ? room.submissions[playingIndex].song : null;

 function playSong(idx:number){
  if(!room?.submissions?.[idx])return;
  const song=room.submissions[idx].song;
  const src=song.previewUrl || (song.provider==='upload' ? song.trackUrl : null);
  if(!src){
   setMsg({type:'error',text:`No audio stream available for "${song.title}". Try opening in Spotify or YouTube.`});
   return;
  }
  setPlayingIndex(idx);
  setIsPlaying(true);
  if(audioRef.current){
   audioRef.current.src=src;
   audioRef.current.play().catch(e=>console.log('Audio autoplay prevented:', e));
  }
 }

 function togglePlaySong(idx:number){
  if(playingIndex===idx){
   if(isPlaying){
    audioRef.current?.pause();
    setIsPlaying(false);
   }else{
    audioRef.current?.play();
    setIsPlaying(true);
   }
  }else{
   playSong(idx);
  }
 }

 function stopPlayback(){
  if(audioRef.current){
   audioRef.current.pause();
   audioRef.current.src='';
  }
  setPlayingIndex(null);
  setIsPlaying(false);
 }

 function playNext(){
  if(!room?.submissions?.length)return;
  if(isShuffle){
   const next=Math.floor(Math.random()*room.submissions.length);
   playSong(next);
   return;
  }
  const currentIndex = playingIndex ?? -1;
  const next = (currentIndex + 1) % room.submissions.length;
  if(next === 0 && !isLoop && currentIndex !== -1){
   stopPlayback();
   return;
  }
  playSong(next);
 }

 function playPrev(){
  if(!room?.submissions?.length)return;
  const prev=( (playingIndex ?? 0) - 1 + room.submissions.length ) % room.submissions.length;
  playSong(prev);
 }

 function formatTime(secs:number){
  if(!secs||isNaN(secs)||secs<0)return '0:00';
  const m=Math.floor(secs/60);
  const s=Math.floor(secs%60);
  return `${m}:${s<10?'0':''}${s}`;
 }

 function openSpotifyPlaylist(){
  if(!room?.submissions?.length){
   setMsg({type:'error',text:'Add songs first before launching Spotify.'});
   return;
  }
  setShowSpotifyModal(true);
 }

 async function importToSpotify(){
  if(!room?.submissions?.length)return;
  const lines=room.submissions.map((s:any)=>`${s.song.artist} - ${s.song.title}`);
  await navigator.clipboard.writeText(lines.join('\n'));
  window.open('https://www.tunemymusic.com/transfer','_blank');
  setMsg({type:'success',text:'Tracklist copied to clipboard! On TuneMyMusic, pick "From Text File", paste, and choose Spotify.'});
 }

 function openYtMusicPlaylist(){
  if(!room?.submissions?.length){
   setMsg({type:'error',text:'Add songs first before launching YouTube Music.'});
   return;
  }
  const sample = room.submissions.slice(0, 3).map((s:any) => `${s.song.artist} ${s.song.title}`).join(' ');
  const q = encodeURIComponent(`${room.name} playlist ${sample}`);
  window.open(`https://music.youtube.com/search?q=${q}`,'_blank');
 }

 function openAppleMusic(){
  if(!room?.submissions?.length){
   setMsg({type:'error',text:'Add songs first before launching Apple Music.'});
   return;
  }
  const sample = room.submissions.slice(0, 2).map((s:any) => `${s.song.artist} ${s.song.title}`).join(' ');
  const q = encodeURIComponent(`${room.name} ${sample}`);
  window.open(`https://music.apple.com/search?term=${q}`,'_blank');
 }

 function openAmazonMusic(){
  if(!room?.submissions?.length){
   setMsg({type:'error',text:'Add songs first before launching Amazon Music.'});
   return;
  }
  const sample = room.submissions.slice(0, 3).map((s:any) => `${s.song.artist} ${s.song.title}`).join(' ');
  const q = encodeURIComponent(`${room.name} ${sample}`);
  window.open(`https://music.amazon.com/search/${q}`,'_blank');
 }

 async function copyTracklist(){
  if(!room?.submissions?.length)return;
  const lines=room.submissions.map((s:any,i:number)=>`${i+1}. ${s.song.artist} - ${s.song.title}`);
  const text=`🎵 MixMade Playlist: ${room.name}\nRoom: ${code}\n\n`+lines.join('\n')+`\n\nGenerated with MixMade`;
  await navigator.clipboard.writeText(text);
  setMsg({type:'success',text:'Tracklist copied! Ready to paste into Spotify, Soundiiz, TuneMyMusic, or notes.'});
 }

 function downloadM3u(){
  if(!room?.submissions?.length)return;
  let content=`#EXTM3U\n#PLAYLIST:${room.name}\n\n`;
  room.submissions.forEach((s:any)=>{
   const dur=s.song.durationMs?Math.round(s.song.durationMs/1000):-1;
   const streamUrl=s.song.previewUrl||s.song.trackUrl||'';
   content+=`#EXTINF:${dur},${s.song.artist} - ${s.song.title}\n${streamUrl}\n\n`;
  });
  const blob=new Blob([content],{type:'audio/x-mpegurl;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=`${room.name.replace(/[^a-zA-Z0-9_-]/g,'_')}_playlist.m3u`;
  a.click();
  URL.revokeObjectURL(url);
  setMsg({type:'success',text:'Downloaded .M3U playlist file for VLC / desktop media players.'});
 }

 const mine = useMemo(()=>room?.submissions.filter((s:any)=>s.participant.name.toLowerCase()===name.toLowerCase())||[],[room,name]);

 if(!room)return <main className="center"><div className="loader">Loading MixMade room…</div></main>;

 const maxSongs = room.maxSongs || 10;
 const remaining = Math.max(0, maxSongs - mine.length);

 return <main className="room">
  <header>
   <div className="brand"><span className="dot">●</span> MIXMADE</div>
   <div className="header-actions">
    <div className="identity-pill" onClick={()=>setShowNameModal(true)} title="Click to change your name or claim creator">
     <User size={14}/>
     <span>{name || 'Guest'}</span>
     {isCreator && <span className="badge-creator-tiny">👑 Creator</span>}
    </div>
    <button className="share" onClick={copy}>{copied?<Check size={16}/>:<Copy size={16}/>} {copied?'Copied':'Share room'}</button>
   </div>
  </header>

  <audio
   ref={audioRef}
   onTimeUpdate={()=>{
    if(audioRef.current){
     setCurrentTime(audioRef.current.currentTime);
     setDuration(audioRef.current.duration||0);
    }
   }}
   onEnded={playNext}
   onError={()=>{
    if(playingIndex!==null){
     setMsg({type:'error',text:'Audio preview unavailable for this track. Advancing to next track.'});
     setTimeout(playNext, 1200);
    }
   }}
  />

  <div className="roomhead">
   <div>
    <div className="eyebrow">LIVE ROOM · <span className="code">{code}</span></div>
    <h1>{room.name}</h1>
    <div className="room-meta">
     <span>{room.participants.length} participants</span>
     <span>·</span>
     <span>{room.submissions.length} songs</span>
     <span>·</span>
     <span>Limit: <strong className="highlight-limit">{maxSongs} songs / person</strong></span>
      {isCreator ? (
       <button className="btn-settings-pill" onClick={openSettings}>
        <Sliders size={14}/> Room Settings
       </button>
      ) : (
       room.creatorName && (
        <button className="btn-claim-link" onClick={()=>{setTempName(room.creatorName);setShowNameModal(true);}}>
         Are you {room.creatorName}? (Creator)
        </button>
       )
      )}
     </div>
    </div>
    <div className="progress">
     <b>{mine.length}/{maxSongs}</b>
     <span>your picks · {remaining} left</span>
     <div><i style={{width:Math.min(100,(mine.length/maxSongs)*100)+'%'}}/></div>
    </div>
   </div>

  {showSettings && (
   <div className="modal-overlay" onClick={()=>setShowSettings(false)}>
    <div className="modal-card" onClick={e=>e.stopPropagation()}>
     <div className="modal-header">
      <div className="modal-title"><Sliders size={18}/> Room Settings (Creator)</div>
      <button className="modal-close" onClick={()=>setShowSettings(false)}><X size={18}/></button>
     </div>
     <p className="modal-desc">Configure limits and permissions for <b>{room.name}</b>. Changes apply instantly to everyone in the room.</p>
     
     <div className="setting-group">
      <label className="setting-label">
       <span>Songs Limit Per Person</span>
       <div style={{display:'flex',alignItems:'center',gap:'10px',marginTop:'8px',background:'#0d1011',padding:'12px 14px',borderRadius:'12px',border:'1px solid #23292b'}}>
        <Lock size={18} style={{color:'var(--green)',flexShrink:0}}/>
        <div>
         <div style={{fontWeight:700,fontSize:'14px',color:'#fff'}}>{maxSongs} picks / person</div>
         <div style={{fontSize:'12px',color:'#7e8587',marginTop:'2px'}}>Configured during room creation and locked for this playlist.</div>
        </div>
       </div>
      </label>
     </div>

     <div className="setting-group">
      <label className="check-row">
       <input type="checkbox" checked={customAllowDownloads} onChange={e=>setCustomAllowDownloads(e.target.checked)}/>
       <span>Allow room members to download uploaded MP3s</span>
      </label>
     </div>

     <div className="modal-actions">
      <button className="primary modal-btn" onClick={saveSettings} disabled={busy}>
       {busy?'Saving…':'Save Room Settings'}
      </button>
      <button className="secondary modal-btn" onClick={()=>setShowSettings(false)}>
       Cancel
      </button>
     </div>
    </div>
   </div>
  )}

  {showNameModal && (
   <div className="modal-overlay" onClick={()=>{ if(name) setShowNameModal(false); }}>
    <div className="modal-card" onClick={e=>e.stopPropagation()}>
     <div className="modal-header">
      <div className="modal-title"><User size={18}/> {name ? 'Your Name in Room' : 'Join Room'}</div>
      {name && <button className="modal-close" onClick={()=>setShowNameModal(false)}><X size={18}/></button>}
     </div>
     <p className="modal-desc">
      {name
        ? <>Update your name in this room. The room creator is <b>{room.creatorName}</b>.</>
        : <>Enter your name to join <b>"{room.name}"</b> as a member and start adding songs.</>}
     </p>
     <div className="form-group">
      <input
       autoFocus
       value={tempName}
       onChange={e=>setTempName(e.target.value)}
       placeholder="Enter your name to join..."
       maxLength={40}
       className="name-modal-input"
       onKeyDown={e=>e.key==='Enter'&&tempName.trim()&&saveName(tempName)}
      />
     </div>
     <div className="modal-actions">
      <button className="primary modal-btn" onClick={()=>saveName(tempName)} disabled={!tempName.trim()}>
       {name ? 'Save' : 'Join Room'}
      </button>
      {room.creatorName && (
       <button className="secondary modal-btn" onClick={()=>{setTempName(room.creatorName);saveName(room.creatorName);}}>
        👑 I am {room.creatorName} (Creator)
       </button>
      )}
     </div>
    </div>
   </div>
  )}

  {/* Spotify Whole Playlist Modal */}
  {showSpotifyModal && (
   <div className="modal-overlay" onClick={()=>setShowSpotifyModal(false)}>
    <div className="modal-card modal-large" onClick={e=>e.stopPropagation()}>
     <div className="modal-header">
      <div className="modal-title">
       <svg viewBox="0 0 24 24" width="22" height="22" fill="#1ed760">
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.5 17.3c-.2.3-.6.4-.9.2-2.5-1.5-5.6-1.9-9.3-1-.4.1-.7-.1-.8-.5-.1-.4.1-.7.5-.8 4.1-1 7.5-.6 10.3 1.1.3.2.4.6.2 1zm1.5-3.3c-.3.4-.8.5-1.2.3-2.9-1.8-7.3-2.3-10.7-1.3-.4.1-.9-.1-1-.5-.1-.4.1-.9.5-1 3.9-1.2 8.8-.6 12.1 1.4.4.2.5.7.3 1.1zm.1-3.5C15.6 8.4 9.8 8.2 6.4 9.2c-.5.2-1-.1-1.2-.6-.2-.5.1-1 .6-1.2 4-1.2 10.4-1 14.4 1.4.5.3.6.9.3 1.4-.3.5-.9.6-1.4.3z"/>
       </svg>
       Play Whole Playlist on Spotify
      </div>
      <button className="modal-close" onClick={()=>setShowSpotifyModal(false)}><X size={18}/></button>
     </div>
     <p className="modal-desc">
      Transfer and listen to all <b>{room.submissions.length} songs</b> from <b>{room.name}</b> directly on Spotify.
     </p>

     <div className="spotify-modal-content">
      <div className="spotify-tracklist-preview">
       <div className="tracklist-header">Playlist Tracks ({room.submissions.length}):</div>
       <div className="tracklist-scroll">
        {room.submissions.map((s:any, idx:number)=>(
         <div key={s.id} className="tracklist-row">
          <span className="track-num">{idx+1}.</span>
          <span className="track-title"><b>{s.song.title}</b> — {s.song.artist}</span>
         </div>
        ))}
       </div>
      </div>

      <div className="spotify-action-cards">
       <div className="action-card" onClick={importToSpotify}>
        <div className="action-badge">RECOMMENDED · 1-CLICK</div>
        <h4>⚡ Import Entire Playlist to Spotify</h4>
        <p>Auto-copies tracklist & opens Spotify Playlist Transfer tool (TuneMyMusic) to create a new playlist in your Spotify account in 10 seconds.</p>
        <button className="btn-spotify modal-card-btn" type="button">
         <span>1-Click Spotify Transfer</span>
        </button>
       </div>

       <div className="action-card" onClick={copyTracklist}>
        <h4>📋 Copy Formatted Spotify Tracklist</h4>
        <p>Copies all {room.submissions.length} tracks to clipboard ready to paste into Spotify Desktop search or playlist creator.</p>
        <button className="btn-export modal-card-btn" type="button">
         <Copy size={14}/> <span>Copy Tracklist</span>
        </button>
       </div>

       <div className="action-card" onClick={()=>{
        const top=room.submissions[0].song;
        window.open(`https://open.spotify.com/search/${encodeURIComponent(top.title+' '+top.artist)}`,'_blank');
       }}>
        <h4>🟢 Launch Spotify Web Search</h4>
        <p>Open the first track of this room directly on Spotify to start listening right away.</p>
        <button className="secondary modal-card-btn" type="button">
         <ExternalLink size={14}/> <span>Launch Spotify</span>
        </button>
       </div>
      </div>
     </div>
    </div>
   </div>
  )}

  <div className="tabs">
   <button onClick={()=>setTab('playlist')} className={tab==='playlist'?'active':''}>Playlist ({room.submissions.length})</button>
   <button onClick={()=>setTab('add')} className={tab==='add'?'active':''}>Add songs</button>
   <button onClick={()=>setTab('people')} className={tab==='people'?'active':''}>People ({room.participants.length})</button>
  </div>

  {msg?.type==='error'&&<div className="notice"><AlertTriangle size={17}/>{msg.text}</div>}
  {msg?.type==='success'&&<div className="notice good"><Check size={17}/>{msg.text}</div>}
  {msg?.type==='similar'&&<div className="notice"><AlertTriangle size={17}/><div><b>Similar songs are already in this room.</b><div className="mini">You can still keep your pick; MixMade is only flagging it.</div><div className="similar">{msg.items?.map((x:any)=><div className="similar-row" key={x.title+x.artist}>{x.artworkUrl&&<img src={x.artworkUrl}/>}<div><b>{x.title}</b><small>{x.artist}</small></div></div>)}</div></div></div>}

  {tab==='add'&&<section className="grid tab-pane">
   <div className="panel">
    <h2>Pick a song</h2>
    <div className="search">
     <Search size={18}/>
     <input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&search()} placeholder="Search songs, artists…"/>
     <button onClick={search} disabled={searching||mine.length>=maxSongs}>{searching?<RefreshCw size={15}/>:'Search'}</button>
    </div>
    <div className="results">
     {results.length===0&&!searching&&<div className="empty">Search a catalog song or upload an MP3 you own.</div>}
     {results.map((s:any)=>{
      const duplicate=findDuplicateSubmission(s,room?.submissions||[]);
      const isAdded=Boolean(duplicate);
      return <div className="song" key={s.providerId}>
       {s.artworkUrl?<img src={s.artworkUrl}/>:<div className="cover"><Music2/></div>}
       <div className="song-main"><b>{s.title}</b><span>{s.artist} · {s.album}</span></div>
       <button disabled={busy||mine.length>=maxSongs||isAdded} onClick={()=>!isAdded&&add(s)} className={isAdded?'btn-added':''} title={isAdded?`Already added: "${duplicate?.song?.title}"`:'Add to playlist'}>
        {isAdded?'In Playlist':'Add'}
       </button>
      </div>;
     })}
    </div>
    <div className="divider"><span>OR</span></div>
    <div className="upload-box">
     <div className="upload-icon"><Upload size={20}/></div>
     <div>
      <h3>Upload your MP3</h3>
      <p>Share an MP3 you own or have permission to share. Max 30 MB.</p>
     </div>
     <input ref={fileRef} type="file" accept="audio/mpeg,.mp3" hidden onChange={e=>chooseFile(e.target.files?.[0]||null)}/>
     <button className="secondary upload-select" onClick={()=>fileRef.current?.click()} disabled={uploading||mine.length>=maxSongs}>Choose MP3</button>
     {file&&(
      <div className="upload-form">
       <div className="file-name">{file.name} <span>{(file.size/1024/1024).toFixed(1)} MB</span></div>
       <div className="two-col">
        <label>Title<input value={uploadTitle} onChange={e=>setUploadTitle(e.target.value)} maxLength={100}/></label>
        <label>Artist<input value={uploadArtist} onChange={e=>setUploadArtist(e.target.value)} placeholder="Artist name" maxLength={80}/></label>
       </div>
       <label className="check-row">
        <input type="checkbox" checked={permission} onChange={e=>setPermission(e.target.checked)}/>
        <span>I own this MP3 or have permission to share it with this room.</span>
       </label>
       <button className="primary upload-btn" disabled={!permission||uploading} onClick={uploadMp3}>
        {uploading?'Uploading…':'Upload & add to playlist'}
       </button>
      </div>
     )}
    </div>
   </div>
   <aside className="panel side">
    <h2>How MixMade works</h2>
    <p><b>{maxSongs} picks each.</b> Your progress is shown above.</p>
    <p><b>Exact repeats are blocked.</b> The same catalog track or exact uploaded MP3 cannot be added twice.</p>
    <p><b>Similar songs are flagged.</b> We compare title, artist, album and duration to spot near-duplicates.</p>
    <p><b>MP3 uploads are playable.</b> Uploaded tracks appear in the final playlist with an audio player.</p>
    <p><b>Downloads are controlled by creator.</b> This room currently {room.allowDownloads?'allows':'does not allow'} members to download uploaded MP3s.</p>
   </aside>
  </section>}

  {tab==='playlist'&&(
   <section className="panel playlist-container tab-pane">
    <div className="platform-bar">
     <div className="platform-bar-title">
      <h3>Play & Export Playlist</h3>
      <p>Listen together right in MixMade, or open on your favorite streaming platform.</p>
     </div>
     <div className="platform-buttons">
      <button
       className={`platform-btn btn-mixmade ${isPlaying?'is-active':''}`}
       onClick={()=>{
        if(isPlaying){
         audioRef.current?.pause();
         setIsPlaying(false);
        }else if(playingIndex!==null){
         audioRef.current?.play();
         setIsPlaying(true);
        }else{
         playSong(0);
        }
       }}
       disabled={room.submissions.length===0}
       title="Play all tracks sequentially in MixMade"
      >
       {isPlaying?<Pause size={15}/>:<Play size={15}/>}
       <span>{isPlaying?'Pause Web Player':'Play All in MixMade'}</span>
      </button>

      <button
       className="platform-btn btn-spotify"
       onClick={openSpotifyPlaylist}
       disabled={room.submissions.length===0}
       title="Search & Play on Spotify"
      >
       <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.5 17.3c-.2.3-.6.4-.9.2-2.5-1.5-5.6-1.9-9.3-1-.4.1-.7-.1-.8-.5-.1-.4.1-.7.5-.8 4.1-1 7.5-.6 10.3 1.1.3.2.4.6.2 1zm1.5-3.3c-.3.4-.8.5-1.2.3-2.9-1.8-7.3-2.3-10.7-1.3-.4.1-.9-.1-1-.5-.1-.4.1-.9.5-1 3.9-1.2 8.8-.6 12.1 1.4.4.2.5.7.3 1.1zm.1-3.5C15.6 8.4 9.8 8.2 6.4 9.2c-.5.2-1-.1-1.2-.6-.2-.5.1-1 .6-1.2 4-1.2 10.4-1 14.4 1.4.5.3.6.9.3 1.4-.3.5-.9.6-1.4.3z"/>
       </svg>
       <span>Spotify</span>
      </button>

      <button
       className="platform-btn btn-ytmusic"
       onClick={openYtMusicPlaylist}
       disabled={room.submissions.length===0}
       title="Play on YouTube Music"
      >
       <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S6.624 0 12 0zm0 19.2c-3.97 0-7.2-3.23-7.2-7.2s3.23-7.2 7.2-7.2 7.2 3.23 7.2 7.2-3.23 7.2-7.2 7.2zm-2.4-10.8v7.2l6-3.6-6-3.6z"/>
       </svg>
       <span>YouTube Music</span>
      </button>

      <button
       className="platform-btn btn-applemusic"
       onClick={openAppleMusic}
       disabled={room.submissions.length===0}
       title="Open in Apple Music"
      >
       <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.38c.62-.75 1.04-1.8 0.92-2.85-.9.04-2 .6-2.64 1.35-.57.65-1.06 1.71-.93 2.73 1.01.08 2.03-.48 2.65-1.23"/>
       </svg>
       <span>Apple Music</span>
      </button>

      <button
       className="platform-btn btn-amazonmusic"
       onClick={openAmazonMusic}
       disabled={room.submissions.length===0}
       title="Play on Amazon Music"
      >
       <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
        <path d="M4 21.5c4-1.2 8-1.2 12 0 .3.1.6-.1.5-.4-.1-.3-.4-.4-.7-.5-3.8-1.1-7.8-1.1-11.6 0-.3.1-.4.4-.3.7.1.1.2.2.4.2z"/>
       </svg>
       <span>Amazon Music</span>
      </button>

      <button
       className="platform-btn btn-export"
       onClick={copyTracklist}
       disabled={room.submissions.length===0}
       title="Copy tracklist for Soundiiz / TuneMyMusic / Spotify paste"
      >
       <Copy size={15}/>
       <span>Copy Tracklist</span>
      </button>

      <button
       className="platform-btn btn-export"
       onClick={downloadM3u}
       disabled={room.submissions.length===0}
       title="Download .M3U file for VLC / Windows Media Player"
      >
       <FileDown size={15}/>
       <span>Download .M3U</span>
      </button>
     </div>
    </div>

    {playingIndex !== null && currentPlayingSong && (
     <div className="web-player-card">
      <div className="player-track-info">
       {currentPlayingSong.artworkUrl ? (
        <img className={`player-art ${isPlaying?'art-spinning':''}`} src={currentPlayingSong.artworkUrl} alt={currentPlayingSong.title}/>
       ) : (
        <div className="player-cover"><Music2/></div>
       )}
       <div className="player-meta">
        <div className="player-badge">
         <span className={`eq-bars ${isPlaying?'eq-playing':''}`}>
          <i className="eq-bar"/><i className="eq-bar"/><i className="eq-bar"/><i className="eq-bar"/>
         </span>
         <span>NOW PLAYING ({playingIndex+1}/{room.submissions.length})</span>
        </div>
        <b>{currentPlayingSong.title}</b>
        <span>{currentPlayingSong.artist} · added by {room.submissions[playingIndex]?.participant?.name}</span>
       </div>
      </div>

      <div className="player-controls">
       <div className="control-buttons">
        <button className={`btn-ctrl ${isShuffle?'active':''}`} onClick={()=>setIsShuffle(!isShuffle)} title="Shuffle whole playlist">
         <Shuffle size={16}/>
        </button>
        <button className={`btn-ctrl ${isLoop?'active':''}`} onClick={()=>setIsLoop(!isLoop)} title={isLoop?'Loop playlist: ON':'Loop playlist: OFF'}>
         <Repeat size={16}/>
        </button>
        <button className="btn-ctrl" onClick={playPrev} title="Previous song">
         <SkipBack size={18}/>
        </button>
        <button className="btn-ctrl btn-play-main" onClick={()=>togglePlaySong(playingIndex)} title={isPlaying?'Pause':'Play'}>
         {isPlaying?<Pause size={20}/>:<Play size={20}/>}
        </button>
        <button className="btn-ctrl" onClick={playNext} title="Next song">
         <SkipForward size={18}/>
        </button>
        <button className={`btn-ctrl ${showQueue?'active':''}`} onClick={()=>setShowQueue(!showQueue)} title={showQueue?'Hide queue':'View queue'}>
         <ListMusic size={16}/>
        </button>
        <button className="btn-ctrl" onClick={stopPlayback} title="Close player">
         <X size={16}/>
        </button>
       </div>

       <div className="scrubber-row">
        <span className="time-text">{formatTime(currentTime)}</span>
        <input
         type="range"
         min="0"
         max={duration || 100}
         value={currentTime || 0}
         onChange={e=>{
          const t=parseFloat(e.target.value);
          setCurrentTime(t);
          if(audioRef.current) audioRef.current.currentTime=t;
         }}
         className="player-scrubber"
        />
        <span className="time-text">{formatTime(duration)}</span>
       </div>

       {showQueue && (
        <div className="queue-drawer">
         <div className="queue-header">
          <span>Whole Playlist Queue ({room.submissions.length} songs)</span>
          <button className="queue-close-btn" onClick={()=>setShowQueue(false)}><X size={13}/></button>
         </div>
         <div className="queue-list">
          {room.submissions.map((sub:any, qIdx:number)=>(
           <div
            key={sub.id}
            className={`queue-item ${playingIndex===qIdx?'active-queue-item':''}`}
            onClick={()=>playSong(qIdx)}
           >
            <span className="queue-num">{qIdx+1}</span>
            {playingIndex===qIdx && isPlaying ? (
             <span className="eq-bars eq-playing"><i className="eq-bar"/><i className="eq-bar"/><i className="eq-bar"/><i className="eq-bar"/></span>
            ) : (
             <Play size={11}/>
            )}
            <span className="queue-song-title">{sub.song.title}</span>
            <span className="queue-song-artist">· {sub.song.artist}</span>
           </div>
          ))}
         </div>
        </div>
       )}
      </div>
     </div>
    )}

    <div className="playlist-list">
     {room.submissions.length===0 ? (
      <div className="empty">No songs in playlist yet. Go to <b>Add songs</b> to add your picks!</div>
     ) : (
      room.submissions.map((s:any,i:number)=>{
       const uploaded = s.song.provider==='upload';
       const canRemove = Boolean(name) && (s.participant.name.toLowerCase()===name.toLowerCase() || isCreator);
       const isCurrent = playingIndex === i;
       return (
        <div className={`playlist-item ${isCurrent?'playing-row':''}`} key={s.id}>
         <strong className="num">{String(i+1).padStart(2,'0')}</strong>
         
         <div className="song-cover-wrapper" onClick={()=>togglePlaySong(i)}>
          {s.song.artworkUrl ? (
           <img className="song-cover" src={s.song.artworkUrl} alt={s.song.title}/>
          ) : (
           <div className="cover"><Music2/></div>
          )}
          <div className="cover-play-overlay">
           {isCurrent && isPlaying ? <Pause size={18}/> : <Play size={18}/>}
          </div>
         </div>

         <div className="song-main">
          <b>{s.song.title}</b>
          <span>
           {s.song.artist} · added by <span className="submitter-pill">{s.participant.name}</span>
           {uploaded ? ' · 📁 MP3' : ''}
           {isCurrent && isPlaying ? (
            <span className="playing-tag">
             <span className="eq-bars eq-playing"><i className="eq-bar"/><i className="eq-bar"/><i className="eq-bar"/><i className="eq-bar"/></span>
             Playing
            </span>
           ) : ''}
          </span>
          {uploaded && s.song.previewUrl && !isCurrent && (
           <audio controls preload="metadata" src={s.song.previewUrl}/>
          )}
         </div>

         <div className="track-actions">
           <button
            className={`icon-link btn-play-row ${isCurrent&&isPlaying?'active':''}`}
            onClick={()=>togglePlaySong(i)}
            title={isCurrent && isPlaying ? 'Pause' : 'Play preview in MixMade'}
           >
           {isCurrent && isPlaying ? <Pause size={15}/> : <Play size={15}/>}
          </button>

          <a
           className="icon-link link-spotify"
           href={`https://open.spotify.com/search/${encodeURIComponent(s.song.title+' '+s.song.artist)}`}
           target="_blank"
           rel="noreferrer"
           title="Listen on Spotify"
          >
           <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
            <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.5 17.3c-.2.3-.6.4-.9.2-2.5-1.5-5.6-1.9-9.3-1-.4.1-.7-.1-.8-.5-.1-.4.1-.7.5-.8 4.1-1 7.5-.6 10.3 1.1.3.2.4.6.2 1zm1.5-3.3c-.3.4-.8.5-1.2.3-2.9-1.8-7.3-2.3-10.7-1.3-.4.1-.9-.1-1-.5-.1-.4.1-.9.5-1 3.9-1.2 8.8-.6 12.1 1.4.4.2.5.7.3 1.1zm.1-3.5C15.6 8.4 9.8 8.2 6.4 9.2c-.5.2-1-.1-1.2-.6-.2-.5.1-1 .6-1.2 4-1.2 10.4-1 14.4 1.4.5.3.6.9.3 1.4-.3.5-.9.6-1.4.3z"/>
           </svg>
          </a>

          <a
           className="icon-link link-ytmusic"
           href={`https://music.youtube.com/search?q=${encodeURIComponent(s.song.title+' '+s.song.artist)}`}
           target="_blank"
           rel="noreferrer"
           title="Listen on YouTube Music"
          >
           <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
            <path d="M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S6.624 0 12 0zm0 19.2c-3.97 0-7.2-3.23-7.2-7.2s3.23-7.2 7.2-7.2 7.2 3.23 7.2 7.2-3.23 7.2-7.2 7.2zm-2.4-10.8v7.2l6-3.6-6-3.6z"/>
           </svg>
          </a>

          <a
           className="icon-link link-applemusic"
           href={s.song.trackUrl && !uploaded ? s.song.trackUrl : `https://music.apple.com/search?term=${encodeURIComponent(s.song.title+' '+s.song.artist)}`}
           target="_blank"
           rel="noreferrer"
           title="Listen on Apple Music"
          >
           <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.38c.62-.75 1.04-1.8 0.92-2.85-.9.04-2 .6-2.64 1.35-.57.65-1.06 1.71-.93 2.73 1.01.08 2.03-.48 2.65-1.23"/>
           </svg>
          </a>

          <a
           className="icon-link link-amazon"
           href={`https://music.amazon.com/search/${encodeURIComponent(s.song.title+' '+s.song.artist)}`}
           target="_blank"
           rel="noreferrer"
           title="Listen on Amazon Music"
          >
           <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
            <path d="M4 21.5c4-1.2 8-1.2 12 0 .3.1.6-.1.5-.4-.1-.3-.4-.4-.7-.5-3.8-1.1-7.8-1.1-11.6 0-.3.1-.4.4-.3.7.1.1.2.2.4.2z"/>
           </svg>
          </a>

          {uploaded && room.allowDownloads && s.song.trackUrl && (
           <a className="icon-link link-download" href={s.song.trackUrl} download title="Download MP3">
            <Download size={15}/>
           </a>
          )}

          {canRemove && (
           <button
            className="icon-link btn-remove"
            onClick={()=>removeSong(s.id,s.song.title)}
            title={s.participant.name.toLowerCase()===name.toLowerCase()?'Remove your pick':'Remove pick (creator action)'}
            disabled={busy}
           >
            <Trash2 size={15}/>
           </button>
          )}
         </div>
        </div>
       );
      })
     )}
    </div>
   </section>
  )}

  {tab==='people'&&(
   <section className="panel tab-pane">
    <h2><Users size={18}/> Participants ({room.participants.length})</h2>
    {room.participants.map((p:any)=>{
     const pSubmissions = room.submissions.filter((s:any)=>s.participantId===p.id);
     const isThisCreator = room.creatorName && p.name.toLowerCase()===room.creatorName.toLowerCase();
     return (
      <div className="person" key={p.id}>
       <div className="person-name">
        <span>{p.name}</span>
        {isThisCreator && <span className="badge-creator-tiny">👑 Room Creator</span>}
        {name && p.name.toLowerCase()===name.toLowerCase() && <span className="badge-you-tiny">(You)</span>}
       </div>
       <b className="person-count">{pSubmissions.length}/{maxSongs} picks</b>
      </div>
     );
    })}
   </section>
  )}
 </main>;
}


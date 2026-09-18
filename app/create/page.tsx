"use client";
import {useState} from 'react';import {useRouter} from 'next/navigation';
export default function Create(){
 const[name,setName]=useState('');
 const[creatorName,setCreatorName]=useState('');
 const[maxSongs,setMaxSongs]=useState<number|string>(10);
 const[allowDownloads,setAllowDownloads]=useState(true);
 const[loading,setLoading]=useState(false);
 const[error,setError]=useState('');
 const router=useRouter();

 async function go(e:any){
  e.preventDefault();
  setLoading(true);
  setError('');
  const finalLimit = Math.max(1, Math.min(50, Number(maxSongs) || 10));
  try{
   const r=await fetch('/api/rooms',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({name,creatorName,allowDownloads,maxSongs:finalLimit})
   });
   const d=await r.json();
   if(!r.ok)throw new Error(d.error||'Could not create room');
   if(typeof window!=='undefined'){
    localStorage.setItem('mixmade_name_'+d.code,creatorName.trim());
    localStorage.setItem('mixmade_user_name',creatorName.trim());
    localStorage.setItem('mixmate_name_'+d.code,creatorName.trim());
    localStorage.setItem('mixmate_user_name',creatorName.trim());
   }
   router.push('/room/'+d.code+'?name='+encodeURIComponent(creatorName.trim()));
  }catch(e:any){
   setError(e.message);
  }finally{
   setLoading(false);
  }
 }

 return <main className="center">
  <form className="card form" onSubmit={go}>
   <div className="brand"><span className="dot">●</span> MIXMADE</div>
   <h1>Create a room</h1>
   <p>Start a shared playlist. Everyone gets {Number(maxSongs)||10} picks and the room updates automatically.</p>
   
   <label>Playlist name
    <input required value={name} onChange={e=>setName(e.target.value)} placeholder="College Trip 2026" maxLength={80}/>
   </label>

   <label>Your name
    <input required value={creatorName} onChange={e=>setCreatorName(e.target.value)} placeholder="Kishore" maxLength={40}/>
   </label>

   <label>Songs limit per person (1–50)
    <div className="limit-stepper-row" style={{marginTop:'8px',marginBottom:'10px'}}>
     <button type="button" className="stepper-btn" onClick={()=>setMaxSongs(c=>Math.max(1,(Number(c)||10)-1))}>-</button>
     <input
      type="number"
      min="1"
      max="50"
      required
      className="stepper-input"
      value={maxSongs}
      onChange={e=>{
       const v=e.target.value;
       if(v===''){
        setMaxSongs('');
       }else{
        const num=parseInt(v,10);
        if(!isNaN(num)) setMaxSongs(Math.max(1,Math.min(50,num)));
       }
      }}
      onBlur={()=>{
       if(!maxSongs||isNaN(Number(maxSongs))) setMaxSongs(10);
      }}
     />
     <button type="button" className="stepper-btn" onClick={()=>setMaxSongs(c=>Math.min(50,(Number(c)||10)+1))}>+</button>
    </div>
    <div className="preset-chips">
     <span className="preset-label">Presets:</span>
     {[3, 5, 10, 15, 20, 25].map(n=>(
      <button
       key={n}
       type="button"
       className={`preset-chip ${Number(maxSongs)===n?'active':''}`}
       onClick={()=>setMaxSongs(n)}
      >
       {n} picks
      </button>
     ))}
    </div>
   </label>

   <label className="check-row" style={{marginTop:'18px'}}>
    <input type="checkbox" checked={allowDownloads} onChange={e=>setAllowDownloads(e.target.checked)}/>
    <span>Allow room members to download uploaded MP3s</span>
   </label>

   {error&&<div className="notice">{error}</div>}
   <button className="primary" disabled={loading}>{loading?'Creating…':'Create room'}</button>
  </form>
 </main>;
}

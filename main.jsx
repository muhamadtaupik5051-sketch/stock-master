import React, {useEffect,useMemo,useRef,useState} from "react";
import {createRoot} from "react-dom/client";
import {createUserWithEmailAndPassword,onAuthStateChanged,signInAnonymously,signInWithEmailAndPassword,signOut} from "firebase/auth";
import {addDoc,collection,deleteDoc,doc,getDoc,getDocs,onSnapshot,orderBy,query,serverTimestamp,setDoc,updateDoc,writeBatch} from "firebase/firestore";
import {accountAuth,auth,db} from "./firebase";
import {Search,Plus,Download,Package,RefreshCw,Edit3,Trash2,X,Wifi,WifiOff,Upload,Minus,Boxes,Filter,Users,ShieldCheck,UserPlus,UserCog,Mic,MicOff} from "lucide-react";
import "./style.css";

async function readXlsx(buf){
 const u=new Uint8Array(buf),dv=new DataView(buf),td=new TextDecoder(),files={};
 let e=u.length-22;while(e>=0&&dv.getUint32(e,true)!==0x06054b50)e--;
 if(e<0)throw new Error("bukan file xlsx");
 const n=dv.getUint16(e+10,true);let p=dv.getUint32(e+16,true);
 for(let i=0;i<n;i++){
  const method=dv.getUint16(p+10,true),csz=dv.getUint32(p+20,true),nl=dv.getUint16(p+28,true),el=dv.getUint16(p+30,true),cl=dv.getUint16(p+32,true),off=dv.getUint32(p+42,true);
  const name=td.decode(u.subarray(p+46,p+46+nl));p+=46+nl+el+cl;
  if(!/^xl\/(sharedStrings\.xml|worksheets\/sheet\d+\.xml)$/.test(name))continue;
  const ls=off+30+dv.getUint16(off+26,true)+dv.getUint16(off+28,true);let data=u.subarray(ls,ls+csz);
  if(method===8)data=new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer());
  files[name]=td.decode(data);
 }
 const dec=x=>x.replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&#(\d+);/g,(_,c)=>String.fromCharCode(c)).replace(/&amp;/g,"&");
 const txt=x=>[...x.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(m=>dec(m[1])).join("");
 const ss=[...(files["xl/sharedStrings.xml"]||"").matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map(m=>txt(m[1]));
 const sn=Object.keys(files).filter(k=>k.includes("worksheets")).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}))[0];
 if(!sn)throw new Error("lembar tidak ditemukan");
 return [...files[sn].matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map(r=>{
  const cells=[];
  for(const m of r[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)){
   const ref=/\br="([A-Z]+)\d+"/.exec(m[1]);if(!ref)continue;
   let col=0;for(const ch of ref[1])col=col*26+ch.charCodeAt(0)-64;
   const t=(/\bt="(\w+)"/.exec(m[1])||[])[1],body=m[2]||"",v=(/<v>([\s\S]*?)<\/v>/.exec(body)||[])[1];
   const val=t==="inlineStr"?txt(body):v===undefined?"":t==="s"?(ss[+v]||""):dec(v);
   cells[col-1]=val.replace(/[\t\r\n]+/g," ");
  }
  return Array.from(cells,x=>x||"").join("\t");
 }).join("\n");
}
function splitLine(l,d){const o=[];let c="",q=false;for(let i=0;i<l.length;i++){const ch=l[i];if(ch==='"'){if(q&&l[i+1]==='"'){c+='"';i++}else q=!q}else if(ch===d&&!q){o.push(c);c=""}else c+=ch}o.push(c);return o.map(x=>x.trim())}
function parseImport(text,existing){
 const lines=text.replace(/\r/g,"").split("\n").filter(l=>l.trim());
 const d=lines.some(l=>l.includes("\t"))?"\t":lines.some(l=>l.includes(";"))?";":",";
 const seen=new Set(existing),ok=[];let skip=0,map=null;
 lines.forEach(l=>{
  const c=splitLine(l,d);
  if(c.some(x=>/^so$/i.test(x))){map={};c.forEach((h,j)=>{const k=h.toLowerCase();if(["so","qty","lot","style","ket"].includes(k))map[k]=j});return}
  const m=map||(c.length>=5?{so:0,qty:1,lot:2,style:3,ket:4}:{so:0,qty:1,lot:2,ket:3});
  const g=k=>m[k]===undefined?"":(c[m[k]]||"");
  const so=g("so");if(!so){skip++;return}
  const key=so.toLowerCase();if(seen.has(key)){skip++;return}seen.add(key);
  const q=Number(g("qty"));ok.push({so,qty:Number.isFinite(q)&&q>=0?q:0,lot:g("lot").toUpperCase(),style:g("style"),ket:g("ket")});
 });
 return {ok,skip};
}
const COLS=["chk","so","qty","lot","style","ket","act"],HEAD={so:"SO",qty:"QTY",lot:"LOT",style:"STYLE",ket:"KET",act:"Aksi"},DEF={chk:34,so:104,qty:58,lot:62,style:104,ket:120,act:72};
function App(){
 const [user,setUser]=useState(null),[profile,setProfile]=useState(null),[authLoading,setAuthLoading]=useState(true),[authError,setAuthError]=useState(""),[loginEmail,setLoginEmail]=useState(""),[loginPassword,setLoginPassword]=useState(""),[loginBusy,setLoginBusy]=useState(false),[adminLoginOpen,setAdminLoginOpen]=useState(false);
 const defaultControl={active:true,allowAddSheet:true,allowDeleteSheet:true,allowAddStock:true,allowEditStock:true,allowDeleteStock:true,sheetNumbers:[1,2,3]};
 const [control,setControl]=useState(defaultControl),[controlReady,setControlReady]=useState(false),[controlExists,setControlExists]=useState(false),[controlModal,setControlModal]=useState(false),[controlError,setControlError]=useState("");
 const [accounts,setAccounts]=useState([]),[accountModal,setAccountModal]=useState(false),[accountBusy,setAccountBusy]=useState(false),[accountError,setAccountError]=useState("");
 const [accountForm,setAccountForm]=useState({name:"",email:"",password:"",role:"operator"});
 const [rows,setRows]=useState([]),[status,setStatus]=useState("Menghubungkan...");
 const [search,setSearch]=useState(""),[lotFilter,setLotFilter]=useState("Semua LOT");
 const [listening,setListening]=useState(false),recRef=useRef(null);
 function voiceToSO(t){const W={nol:"0",kosong:"0",satu:"1",se:"1",dua:"2",tiga:"3",empat:"4",lima:"5",enam:"6",tujuh:"7",delapan:"8",sembilan:"9",zero:"0",one:"1",two:"2",three:"3",four:"4",five:"5",six:"6",seven:"7",eight:"8",nine:"9"};let x=String(t||"").toLowerCase().replace(/[.,!?]/g," ").split(/\s+/).filter(Boolean).map(w=>W[w]!==undefined?W[w]:w);let out="";x.forEach((w,i)=>{const prev=x[i-1];out+=(i&&!(/^\d+$/.test(w)&&/^\d+$/.test(prev))?" ":"")+w});return out.trim()}
 function startVoice(){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){alert("Pencarian suara tidak didukung di browser ini. Gunakan Chrome.");return}if(listening&&recRef.current){recRef.current.stop();return}const r=new SR();r.lang="id-ID";r.interimResults=true;r.maxAlternatives=1;r.continuous=false;r.onstart=()=>setListening(true);r.onend=()=>{setListening(false);recRef.current=null};r.onerror=e=>{setListening(false);if(e.error==="not-allowed"||e.error==="service-not-allowed")alert("Izin mikrofon ditolak. Aktifkan izin mikrofon untuk aplikasi ini.")};r.onresult=e=>{let t="";for(let i=0;i<e.results.length;i++)t+=e.results[i][0].transcript;setSearch(voiceToSO(t))};recRef.current=r;try{r.start()}catch(err){setListening(false)}}
 const [modal,setModal]=useState(false),[editing,setEditing]=useState(null);
 const [form,setForm]=useState({so:"",qty:"",lot:"",style:"",ket:""}),[error,setError]=useState("");
 const [imp,setImp]=useState(null),[online,setOnline]=useState(navigator.onLine);
 const [cw,setCw]=useState(()=>{try{return {...DEF,...JSON.parse(localStorage.getItem("sm-cw")||"{}")}}catch(e){return DEF}});
 const saveCw=v=>{try{localStorage.setItem("sm-cw",JSON.stringify(v))}catch(e){}return v};
 function startRz(e,c){e.preventDefault();const x0=e.clientX,w0=cw[c],el=e.currentTarget;el.setPointerCapture(e.pointerId);
  const mv=ev=>setCw(v=>({...v,[c]:Math.max(36,Math.min(420,Math.round(w0+(ev.clientX-x0)/z)))}));
  const up=()=>{el.removeEventListener("pointermove",mv);el.removeEventListener("pointerup",up);el.removeEventListener("pointercancel",up);setCw(saveCw)};
  el.addEventListener("pointermove",mv);el.addEventListener("pointerup",up);el.addEventListener("pointercancel",up)}
 const resetRz=c=>setCw(v=>saveCw({...v,[c]:DEF[c]}));
 const [z,setZ]=useState(()=>{try{return Number(localStorage.getItem("sm-z"))||1}catch(e){return 1}});
 const zoom=d=>setZ(v=>{const n=Math.min(1.6,Math.max(.4,Math.round((v+d)*10)/10));try{localStorage.setItem("sm-z",n)}catch(e){}return n});
 const [fs,setFs]=useState(()=>{try{return Number(localStorage.getItem("sm-fs"))||1}catch(e){return 1}});
 const fsize=d=>setFs(v=>{const n=Math.min(2,Math.max(.6,Math.round((v+d)*10)/10));try{localStorage.setItem("sm-fs",n)}catch(e){}return n});
 const zRef=useRef(z);zRef.current=z;
 useEffect(()=>{
  let d0=0,z0=1;const dist=t=>Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY);
  const ts=e=>{if(e.touches.length===2&&e.target.closest&&e.target.closest(".tablewrap")){d0=dist(e.touches);z0=zRef.current}else d0=0};
  const tm=e=>{if(d0&&e.touches.length===2){e.preventDefault();setZ(Math.min(1.6,Math.max(.4,Math.round(z0*dist(e.touches)/d0*20)/20)))}};
  const te=e=>{if(d0&&e.touches.length<2){d0=0;try{localStorage.setItem("sm-z",zRef.current)}catch(_){}}};
  document.addEventListener("touchstart",ts,{passive:true});document.addEventListener("touchmove",tm,{passive:false});document.addEventListener("touchend",te);
  return()=>{document.removeEventListener("touchstart",ts);document.removeEventListener("touchmove",tm);document.removeEventListener("touchend",te)};
 },[]);
 const totalW=Math.round(COLS.reduce((a,c)=>a+cw[c],0)*z);
 const [sel,setSel]=useState(()=>{try{const v=JSON.parse(localStorage.getItem("sm-sel")||"[]");return Array.isArray(v)?v:[]}catch(e){return []}}),[undo,setUndo]=useState(null),timer=useRef(null);
 const [sheet,setSheet]=useState(1),[names,setNames]=useState({});
 useEffect(()=>onAuthStateChanged(auth,u=>{
  if(!u){signInAnonymously(auth).catch(e=>{setAuthError("Tidak dapat membuka akses publik: "+e.message);setAuthLoading(false)});return}
  setUser(u);
  if(u.isAnonymous){setProfile({uid:u.uid,role:"public",name:"Pengguna"});setAuthError("");setAuthLoading(false);return}
  setProfile(null);setAuthLoading(true);
  getDoc(doc(db,"users",u.uid)).then(s=>{
   if(s.exists()&&s.data().active!==false&&s.data().role==="admin")setProfile({uid:u.uid,...s.data()});
   else {setAuthError("Akun ini bukan Admin yang terdaftar.");signOut(auth)}
  }).catch(e=>{setAuthError("Gagal memeriksa Admin: "+e.message);signOut(auth)}).finally(()=>setAuthLoading(false));
 }),[]);
 async function login(e){e.preventDefault();setAuthError("");setLoginBusy(true);try{await signInWithEmailAndPassword(auth,loginEmail.trim(),loginPassword);setAdminLoginOpen(false);setLoginPassword("")}catch(e){setAuthError(e.code==="auth/invalid-credential"?"Email atau kata sandi Admin salah.":e.message)}finally{setLoginBusy(false)}}
 async function logout(){await signOut(auth);setProfile(null);setRows([]);setAuthError("")}
 const isAdmin=profile?.role==="admin";
 useEffect(()=>{
  if(!user)return;
  return onSnapshot(doc(db,"appControl","main"),snap=>{setControl({...defaultControl,...(snap.exists()?snap.data():{})});setControlExists(snap.exists());setControlReady(true)},e=>{setControlReady(true);setStatus("Gagal membaca pengaturan: "+e.message)});
 },[user]);
 useEffect(()=>{
  if(!user||!profile||!controlReady||(!control.active&&!isAdmin))return;
  const q=query(collection(db,"stockItems"),orderBy("updatedAt","desc"));
  return onSnapshot(q,s=>{const all=s.docs.map(d=>({id:d.id,...d.data()}));setRows(all.filter(r=>r.id!=="_meta"));setNames((all.find(r=>r.id==="_meta")||{}).names||{});setStatus("Online • Data tersinkron");},e=>setStatus("Gagal memuat: "+e.message));
 },[user,profile,controlReady,control.active,isAdmin]);
 useEffect(()=>{
  if(!user||!isAdmin)return;
  return onSnapshot(collection(db,"users"),snap=>setAccounts(snap.docs.map(d=>({uid:d.id,...d.data()}))),e=>setAccountError("Gagal memuat akun: "+e.message));
 },[user,profile?.role]);
 useEffect(()=>{const on=()=>setOnline(true),off=()=>setOnline(false);window.addEventListener("online",on);window.addEventListener("offline",off);return()=>{window.removeEventListener("online",on);window.removeEventListener("offline",off)}},[]);
 const commit=p=>navigator.onLine?p:(p.catch(()=>{}),null);
 useEffect(()=>{try{localStorage.setItem("sm-sel",JSON.stringify(sel))}catch(e){}},[sel]);
 useEffect(()=>{if(!rows.length)return;const ids=new Set(rows.map(r=>r.id));setSel(v=>{const n=v.filter(x=>ids.has(x));return n.length===v.length?v:n})},[rows]);
 useEffect(()=>{
  if(!modal)return;const vv=window.visualViewport;if(!vv)return;const r=document.documentElement.style;
  const set=()=>{r.setProperty("--vvh",vv.height+"px");r.setProperty("--vvt",vv.offsetTop+"px")};
  set();vv.addEventListener("resize",set);vv.addEventListener("scroll",set);
  return()=>{vv.removeEventListener("resize",set);vv.removeEventListener("scroll",set);r.removeProperty("--vvh");r.removeProperty("--vvt")};
 },[modal]);
 const sheetOf=r=>Number(r.sheet)||1;
 const label=n=>(names[n]&&String(names[n]).trim())||"Lembar "+n;
 function openAccounts(){setAccountError("");setAccountForm({name:"",email:"",password:"",role:"operator"});setAccountModal(true)}
 async function createAccount(e){
  e.preventDefault();if(!isAdmin)return;setAccountError("");
  if(accountForm.password.length<6){setAccountError("Kata sandi minimal 6 karakter.");return}
  setAccountBusy(true);let created=null;
  try{
   const credential=await createUserWithEmailAndPassword(accountAuth,accountForm.email.trim(),accountForm.password);
   created=credential.user;
   await setDoc(doc(db,"users",created.uid),{name:accountForm.name.trim(),email:accountForm.email.trim(),role:accountForm.role,active:true,createdAt:serverTimestamp(),createdBy:user.uid});
   await signOut(accountAuth);setAccountModal(false);setAccountForm({name:"",email:"",password:"",role:"operator"});
   alert("Akun "+accountForm.role+" berhasil dibuat.");
  }catch(err){
   try{await signOut(accountAuth)}catch(_){}
   setAccountError(created?"Akun Authentication dibuat, tetapi profil akses gagal disimpan. Buat dokumen users/"+created.uid+" secara manual. Detail: "+err.message:(err.code==="auth/email-already-in-use"?"Email sudah terdaftar.":err.message));
  }finally{setAccountBusy(false)}
 }
 async function changeRole(a,nextRole){
  if(!isAdmin||a.uid===user.uid||a.role===nextRole)return;
  if(a.role==="admin"&&nextRole!=="admin"&&accounts.filter(x=>x.role==="admin"&&x.active!==false).length<=1){alert("Tidak bisa menurunkan admin terakhir.");return}
  if(!window.confirm("Ubah peran "+(a.name||a.email)+" menjadi "+nextRole.toUpperCase()+"?"))return;
  try{await updateDoc(doc(db,"users",a.uid),{role:nextRole,updatedAt:serverTimestamp(),updatedBy:user.uid})}catch(e){alert("Gagal mengubah peran: "+e.message)}
 }
 async function toggleAccount(a){
  if(!isAdmin||a.uid===user.uid)return;
  if(a.role==="admin"&&a.active!==false&&accounts.filter(x=>x.role==="admin"&&x.active!==false).length<=1){alert("Tidak bisa menonaktifkan admin terakhir.");return}
  const next=a.active===false;
  if(!window.confirm((next?"Aktifkan kembali ":"Nonaktifkan ")+(a.name||a.email)+"?"))return;
  try{await updateDoc(doc(db,"users",a.uid),{active:next,updatedAt:serverTimestamp(),updatedBy:user.uid})}catch(e){alert("Gagal mengubah status: "+e.message)}
 }
 const canAddSheet=isAdmin||control.allowAddSheet===true;
 const canDeleteSheet=isAdmin||control.allowDeleteSheet===true;
 const canAddStock=isAdmin||control.allowAddStock===true;
 const canEditStock=isAdmin||control.allowEditStock===true;
 const canDeleteStock=isAdmin||control.allowDeleteStock===true;
 async function saveControl(patch){if(!isAdmin)return false;setControlError("");try{await setDoc(doc(db,"appControl","main"),{...(controlExists?{}:defaultControl),...patch,updatedAt:serverTimestamp(),updatedBy:user.uid},{merge:true});setControlExists(true);return true}catch(e){setControlError("Gagal menyimpan pengaturan: "+e.message);return false}}
 async function initializeControl(){if(!isAdmin)return;try{const sheetNumbers=[...new Set([...defaultControl.sheetNumbers,...rows.map(sheetOf)])].sort((a,b)=>a-b);await setDoc(doc(db,"appControl","main"),{...defaultControl,sheetNumbers,updatedAt:serverTimestamp(),updatedBy:user.uid},{merge:true});setControlError("")}catch(e){setControlError("Gagal menyiapkan pengaturan: "+e.message)}}
 async function addSheet(){if(!canAddSheet)return;const nums=[...new Set([...(control.sheetNumbers||[1,2,3]),...rows.map(sheetOf)])],n=Math.max(0,...nums)+1;if(!await saveControl({sheetNumbers:[...nums,n]}))return;setSheet(n);setLotFilter("Semua LOT");setSearch("")}
 async function deleteSheet(){if(!canDeleteSheet)return;if((control.sheetNumbers||[1,2,3]).length<=1){alert("Minimal harus ada satu lembar.");return}if(!window.confirm("Hapus "+label(sheet)+" beserta seluruh data di dalamnya? Tindakan ini tidak bisa dibatalkan."))return;
  try{const currentNums=[...new Set([...(control.sheetNumbers||[1,2,3]),...rows.map(sheetOf)])];const nums=currentNums.filter(n=>n!==sheet);if(!await saveControl({sheetNumbers:nums}))return;const qSnap=await getDocs(query(collection(db,"stockItems")));const targets=qSnap.docs.filter(d=>d.id!=="_meta"&&Number(d.data().sheet||1)===sheet);for(let i=0;i<targets.length;i+=400){const b=writeBatch(db);targets.slice(i,i+400).forEach(d=>b.delete(d.ref));await b.commit()}setSheet(nums[0]||1);setSel([]);alert("Lembar dan data di dalamnya berhasil dihapus.")}catch(e){alert("Gagal menghapus lembar: "+e.message)}}
 async function renameSheet(){
  if(!isAdmin)return;
  const nm=window.prompt("Nama lembar (kosongkan untuk kembali ke nama awal):",names[sheet]||"Lembar "+sheet);
  if(nm===null)return;
  try{await commit(setDoc(doc(db,"stockItems","_meta"),{names:{[sheet]:nm.trim().slice(0,30)},updatedAt:serverTimestamp(),updatedBy:user?.uid||"anon"},{merge:true}))}catch(e){alert("Gagal mengubah nama: "+e.message)}
 }
 const sheets=[...new Set([...(control.sheetNumbers||[1,2,3]),...rows.map(sheetOf)])].sort((a,b)=>a-b);
 const sheetRows=useMemo(()=>rows.filter(r=>sheetOf(r)===sheet),[rows,sheet]);
 const lots=useMemo(()=>["Semua LOT",...new Set(sheetRows.map(r=>r.lot).filter(Boolean).sort())],[sheetRows]);
 const filtered=useMemo(()=>sheetRows.filter(r=>(String(r.so).toLowerCase().includes(search.toLowerCase())||String(r.ket||"").toLowerCase().includes(search.toLowerCase())||String(r.style||"").toLowerCase().includes(search.toLowerCase()))&&(lotFilter==="Semua LOT"||r.lot===lotFilter)),[sheetRows,search,lotFilter]);
 const selRows=filtered.filter(r=>sel.includes(r.id));
 const allSel=filtered.length>0&&selRows.length===filtered.length;
 const toggle=id=>setSel(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id]);
 const totalQty=filtered.reduce((a,r)=>a+(Number(r.qty)||0),0);
 function openNew(){if(!canAddStock){alert("Admin sedang menonaktifkan izin tambah data.");return}setEditing(null);setForm({so:"",qty:"",lot:"",style:"",ket:""});setError("");setModal(true)}
 function openEdit(r){if(!canEditStock){alert("Izin edit data sedang OFF.");return}setEditing(r);setForm({so:r.so||"",qty:String(r.qty??""),lot:r.lot||"",style:r.style||"",ket:r.ket||""});setError("");setModal(true)}
 async function save(e){
  e.preventDefault();setError("");
  const so=form.so.trim(),lot=form.lot.trim();
  if(!so||form.qty===""||!lot){setError("SO, QTY, dan LOT wajib diisi.");return}
  const qty=Number(form.qty);if(!Number.isFinite(qty)||qty<0){setError("QTY harus berupa angka 0 atau lebih.");return}
  try{
   const duplicate=sheetRows.find(r=>String(r.so).toLowerCase()===so.toLowerCase()&&r.id!==editing?.id);
   if(duplicate){setError("Nomor SO sudah ada di "+label(sheet)+". Gunakan SO yang berbeda atau edit data tersebut.");alert("SO "+so+" sudah ada di "+label(sheet)+".\nData gagal disimpan.");return}
   const payload={so,qty,lot,style:form.style.trim(),ket:form.ket.trim(),updatedAt:serverTimestamp(),updatedBy:user?.uid||"anon"};
   if(editing&&!canEditStock){setError("Izin edit data sedang OFF.");return}
   if(!editing&&!canAddStock){setError("Izin tambah data sedang OFF.");return}
   if(editing) await commit(updateDoc(doc(db,"stockItems",editing.id),payload));
   else await commit(addDoc(collection(db,"stockItems"),{...payload,sheet,createdAt:serverTimestamp()}));
   setModal(false);
  }catch(e){setError("Gagal menyimpan: "+e.message)}
 }
 async function deleteRows(list){
  if(!canDeleteStock){alert("Izin hapus data sedang OFF. Hanya Admin yang bisa menghapus.");return}
  if(!list.length)return;
  const msg=list.length===1?"Hapus data SO "+list[0].so+" (QTY "+list[0].qty+", LOT "+list[0].lot+")?\nBerlaku untuk semua pengguna.":"Hapus "+list.length+" data terpilih?\nBerlaku untuk semua pengguna.";
  if(!window.confirm(msg))return;
  try{
   for(let i=0;i<list.length;i+=400){const b=writeBatch(db);list.slice(i,i+400).forEach(r=>b.delete(doc(db,"stockItems",r.id)));await commit(b.commit())}
   setSel(v=>v.filter(x=>!list.some(r=>r.id===x)));clearTimeout(timer.current);setUndo(list);timer.current=setTimeout(()=>setUndo(null),10000);
  }catch(e){alert("Gagal menghapus: "+e.message)}
 }
 async function undoDelete(){
  if(!canAddStock){alert("Izin tambah data sedang OFF; data tidak dapat dipulihkan oleh pengguna umum.");return}
  const list=undo;if(!list)return;
  clearTimeout(timer.current);setUndo(null);
  try{
   for(let i=0;i<list.length;i+=400){const b=writeBatch(db);list.slice(i,i+400).forEach(({id,...data})=>b.set(doc(db,"stockItems",id),data));await commit(b.commit())}
  }catch(e){alert("Gagal mengurungkan: "+e.message)}
 }
 const removeRow=r=>deleteRows([r]);
 const parsed=useMemo(()=>imp?parseImport(imp.text,sheetRows.map(r=>String(r.so).toLowerCase())):{ok:[],skip:0},[imp,sheetRows]);
 async function readFile(e){const f=e.target.files[0];if(!f)return;try{const t=/\.xlsx$/i.test(f.name)?await readXlsx(await f.arrayBuffer()):(await f.text()).replace(/^\ufeff/,"");setImp({text:t})}catch(x){alert("File tidak bisa dibaca ("+x.message+"). Coba salin-tempel atau simpan sebagai CSV.")}e.target.value=""}
 async function doImport(){
  const list=parsed.ok;if(!canAddStock){alert("Izin tambah data sedang OFF.");return}if(!list.length)return;setImp(v=>({...v,busy:true}));
  try{
   for(let i=0;i<list.length;i+=400){const b=writeBatch(db);list.slice(i,i+400).forEach(x=>b.set(doc(collection(db,"stockItems")),{...x,sheet,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),updatedBy:user?.uid||"anon"}));await commit(b.commit())}
   setImp(null);
  }catch(e){alert("Gagal impor: "+e.message);setImp(v=>v&&{...v,busy:false})}
 }
 function exportCSV(){
  const data=[["SO","QTY","LOT","STYLE","KET"],...filtered.map(r=>[r.so,r.qty,r.lot,r.style||"",r.ket||""])];
  const csv=data.map(row=>row.map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(",")).join("\n");
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}));a.download="stock-master-"+label(sheet).replace(/[^\w\-]+/g,"-")+".csv";a.click();URL.revokeObjectURL(a.href);
 }
 if(authLoading||!controlReady)return <main className="login-shell"><section className="login-card"><div className="login-logo"><Boxes size={30}/></div><h1>STOCK MASTER</h1><p>Membuka aplikasi...</p></section></main>;
 if(!control.active&&!isAdmin)return <main className="login-shell"><section className="login-card"><div className="login-logo"><Boxes size={30}/></div><div className="login-kicker">PEMELIHARAAN</div><h1>APLIKASI SEMENTARA OFF</h1><p className="login-desc">Stock Master sedang dinonaktifkan oleh Admin. Silakan coba lagi nanti.</p><button className="secondary login-submit" onClick={()=>window.location.reload()}>Coba lagi</button><button className="manage-users-btn login-submit" onClick={()=>setAdminLoginOpen(true)}>Login Admin</button></section>{adminLoginOpen&&<div className="overlay"><form className="modal" onSubmit={login}><div className="modalhead"><h2>Login Admin</h2><button type="button" className="close" onClick={()=>setAdminLoginOpen(false)}><X/></button></div><label>Email Admin<input type="email" required value={loginEmail} onChange={e=>setLoginEmail(e.target.value)}/></label><label>Password Admin<input type="password" required value={loginPassword} onChange={e=>setLoginPassword(e.target.value)}/></label>{authError&&<div className="error">{authError}</div>}<div className="modalbuttons"><button type="button" className="secondary" onClick={()=>setAdminLoginOpen(false)}>Batal</button><button className="primary" disabled={loginBusy}>Masuk Admin</button></div></form></div>}</main>;
 return <main className="app">
  <header><div className="brand"><div className="logo"><Boxes size={25}/></div><div><b>STOCK MASTER</b><small>Stok gudang bersama</small></div></div><div className="user-tools">{isAdmin?<><span className="role-pill admin">ADMIN</span><button className="manage-users-btn" onClick={()=>{setControlError("");setControlModal(true)}}><ShieldCheck size={16}/> Kontrol aplikasi</button><button className="manage-users-btn" onClick={openAccounts}><Users size={16}/> Kelola akun</button><button className="logout-btn" onClick={logout}>Keluar Admin</button></>:<><span className="role-pill">AKSES PUBLIK</span><button className="manage-users-btn" onClick={()=>{setAuthError("");setAdminLoginOpen(true)}}><ShieldCheck size={16}/> Admin</button></>}<span className={"live"+(online?"":" off")}>{online?<Wifi size={16}/>:<WifiOff size={16}/>}<span>{online?status:"Offline • Tidak tersinkron"}</span></span></div></header>
    <section className="stats"><div className="stat"><span>Total data</span><strong>{filtered.length}</strong><small>baris ditampilkan</small></div><div className="stat"><span>Total QTY</span><strong>{totalQty.toLocaleString("id-ID")}</strong><small>jumlah stok terfilter</small></div><div className="stat"><span>Status</span><strong className={online?"online":"offline"}>{online?"Live":"Offline"}</strong><small>{!online?"Tanpa sinyal":user?"Terhubung":"Menunggu akun"}</small></div></section>
  <section className="panel">
   <div className="tabs">{sheets.map(n=><button key={n} className={"tab"+(n===sheet?" active":"")} onClick={()=>{setSheet(n);setLotFilter("Semua LOT");setSearch("")}}>{label(n)}</button>)}{canAddSheet&&<button className="tab add" title="Tambah lembar" onClick={addSheet}><Plus size={16}/></button>}</div>
   <div className="toolbar"><div><h2>Daftar barang • {label(sheet)} {isAdmin&&<button className="rename" title="Ubah nama lembar" onClick={renameSheet}><Edit3 size={15}/></button>} {canDeleteSheet&&<button className="rename" title="Hapus lembar" onClick={deleteSheet}><Trash2 size={15}/></button>}</h2><p>Data SO, jumlah, lot, dan keterangan</p></div></div>
   <div className="filters">{canAddStock&&<button className="primary" onClick={openNew}><Plus size={18}/> Tambah</button>}<label className="search"><Search size={18}/><input placeholder="Cari SO" value={search} onChange={e=>setSearch(e.target.value)}/>{search&&<button type="button" className="vbtn" aria-label="Hapus pencarian" onClick={()=>setSearch("")}><X size={16}/></button>}<button type="button" className={"vbtn"+(listening?" on":"")} title="Cari dengan suara" aria-label="Cari dengan suara" onClick={startVoice}>{listening?<MicOff size={18}/>:<Mic size={18}/>}</button></label>{canAddStock&&<button className="secondary" title="Impor dari Excel" aria-label="Impor dari Excel" onClick={()=>setImp({text:""})}><Upload size={17}/><span className="lbl">Impor</span></button>}<button className="secondary" title="Unduh Excel/CSV" aria-label="Unduh Excel/CSV" onClick={exportCSV}><Download size={17}/><span className="lbl">Excel/CSV</span></button></div>
   {canDeleteStock&&selRows.length>0&&<div className="bulk"><span>{selRows.length} data dipilih{sel.length>selRows.length?" (+"+(sel.length-selRows.length)+" di lembar/filter lain)":""}</span><div><button className="secondary" onClick={()=>setSel([])}>Batal pilih</button><button className="dangerbtn" onClick={()=>deleteRows(selRows)}><Trash2 size={16}/> Hapus terpilih</button></div></div>}
   <div className="zooms"><div className="zoom"><span>Tabel</span><button type="button" aria-label="Perkecil tabel" onClick={()=>zoom(-.1)}><Minus size={15}/></button><b title="Ketuk untuk kembali 100%" onClick={()=>zoom(1-z)}>{Math.round(z*100)}%</b><button type="button" aria-label="Perbesar tabel" onClick={()=>zoom(.1)}><Plus size={15}/></button></div>
   <div className="zoom"><span>Huruf</span><button type="button" aria-label="Perkecil huruf" onClick={()=>fsize(-.1)}><span style={{fontSize:12,fontWeight:700}}>A</span></button><b title="Ketuk untuk kembali 100%" onClick={()=>fsize(1-fs)}>{Math.round(fs*100)}%</b><button type="button" aria-label="Perbesar huruf" onClick={()=>fsize(.1)}><span style={{fontSize:19,fontWeight:700}}>A</span></button></div></div>
   <div className="tablewrap" style={{"--z":z,"--f":fs}}><table style={{width:totalW,minWidth:"100%"}}><colgroup>{COLS.map(c=><col key={c} style={{width:Math.round(cw[c]*z)}}/>)}</colgroup><thead><tr>{COLS.map(c=>c==="chk"?<th key={c} className="chk">{<input type="checkbox" title="Pilih semua" checked={allSel} onChange={()=>setSel(allSel?[]:filtered.map(r=>r.id))}/>}</th>:<th key={c}>{HEAD[c]}<span className="rz" title="Geser untuk ubah lebar (ketuk 2x untuk reset)" onPointerDown={e=>startRz(e,c)} onDoubleClick={()=>resetRz(c)}/></th>)}</tr></thead><tbody>
    {filtered.map(r=><tr key={r.id} className={sel.includes(r.id)?"picked":""}><td className="chk">{<input type="checkbox" checked={sel.includes(r.id)} onChange={()=>toggle(r.id)}/>}</td><td className="so">{r.so}</td><td className="qty">{Number(r.qty).toLocaleString("id-ID")}</td><td className="lotc"><span className="lot">{r.lot}</span></td><td className="sty">{r.style||""}</td><td className="ket">{r.ket||""}</td><td className="act"><div className="actions">{canEditStock&&<button title="Edit" onClick={()=>openEdit(r)}><Edit3 size={16}/></button>}{canDeleteStock&&<button title="Hapus" className="danger" onClick={()=>removeRow(r)}><Trash2 size={16}/></button>}</div></td></tr>)}
    {!filtered.length&&<tr><td colSpan="7" className="empty"><Package size={28}/><b>Belum ada data</b><span>Tambahkan data pertama atau ubah pencarian.</span></td></tr>}
   </tbody></table></div>
   <div className="foot"><span><RefreshCw size={14}/> Sinkronisasi otomatis aktif</span><span>{filtered.length} dari {sheetRows.length} data</span></div>
  </section>
  <footer>STOCK MASTER <span>•</span> {isAdmin?"Admin: kontrol aplikasi dan seluruh data":"Akses publik sesuai izin Admin"}</footer>
  {undo&&<div className="toast"><span>{undo.length} data dihapus</span><button onClick={undoDelete}>Urungkan</button></div>}
  {adminLoginOpen&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setAdminLoginOpen(false)}}><form className="modal" onSubmit={login}><div className="modalhead"><div><span className="eyebrow">AKSES KHUSUS</span><h2>Login Admin</h2></div><button type="button" className="close" onClick={()=>setAdminLoginOpen(false)}><X/></button></div><p className="hint">Pengguna umum tetap bisa langsung memakai aplikasi. Email dan password hanya diperlukan untuk membuka kontrol Admin.</p><label>Email Admin<input type="email" required value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} placeholder="email admin"/></label><label>Password Admin<input type="password" required value={loginPassword} onChange={e=>setLoginPassword(e.target.value)} placeholder="Password Admin"/></label>{authError&&<div className="error">{authError}</div>}<div className="modalbuttons"><button type="button" className="secondary" onClick={()=>setAdminLoginOpen(false)}>Batal</button><button className="primary" disabled={loginBusy}>{loginBusy?"Memeriksa...":"Masuk Admin"}</button></div></form></div>}
  {controlModal&&<div className="overlay control-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setControlModal(false)}}><section className="modal account-modal control-modal"><div className="modalhead"><div><span className="eyebrow">ADMINISTRATOR</span><h2>Kontrol Aplikasi</h2></div><button type="button" className="close" onClick={()=>setControlModal(false)}><X/></button></div><p className="hint">Atur izin pengguna umum. ON berarti semua orang boleh melakukan tindakan tersebut; OFF berarti hanya Admin.</p>
   {!controlReady&&<p>Memuat pengaturan...</p>}
   {[["allowAddSheet","Tambah lembar"],["allowDeleteSheet","Hapus lembar"],["allowAddStock","Tambah data stok"],["allowEditStock","Edit data stok"],["allowDeleteStock","Hapus data stok"]].map(([key,label])=><div className="control-row" key={key}><div><b>{label}</b><small>{control[key]===true?"Pengguna umum diizinkan":"Hanya Admin yang diizinkan"}</small></div><button type="button" className={"switch "+(control[key]===true?"on":"")} onClick={()=>saveControl({[key]:control[key]!==true})}>{control[key]===true?"ON":"OFF"}</button></div>)}
   <div className="control-row app-switch-row"><div><b>Aktifkan aplikasi</b><small>{control.active===false?"Aplikasi ditutup untuk pengguna umum":"Aplikasi bisa diakses semua orang"}</small></div><button type="button" className={"switch "+(control.active!==false?"on":"")} onClick={()=>saveControl({active:control.active===false})}>{control.active===false?"OFF":"ON"}</button></div>
   {controlError&&<div className="error">{controlError}</div>}{!controlExists&&<button type="button" className="secondary" onClick={initializeControl}>Siapkan pengaturan awal</button>}<div className="modalbuttons"><button type="button" className="secondary" onClick={()=>setControlModal(false)}>Tutup</button></div></section></div>}
  {accountModal&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setAccountModal(false)}}><section className="modal account-modal">
   <div className="modalhead"><div><span className="eyebrow">ADMINISTRATOR</span><h2>Kelola akun</h2></div><button type="button" className="close" onClick={()=>setAccountModal(false)}><X/></button></div>
   <p className="hint">Admin dan Operator sama-sama dapat mengelola stok. Admin dapat mengatur peran dan akses pengguna.</p>
   <form className="account-create" onSubmit={createAccount}>
    <h3><UserPlus size={17}/> Tambah pengguna</h3>
    <label>Nama pengguna<input required value={accountForm.name} onChange={e=>setAccountForm(v=>({...v,name:e.target.value}))} placeholder="Nama lengkap"/></label>
    <label>Email<input type="email" required value={accountForm.email} onChange={e=>setAccountForm(v=>({...v,email:e.target.value}))} placeholder="nama@perusahaan.com"/></label>
    <label>Kata sandi sementara<input type="password" minLength="6" required value={accountForm.password} onChange={e=>setAccountForm(v=>({...v,password:e.target.value}))} placeholder="Minimal 6 karakter"/></label>
    <label>Peran<select value={accountForm.role} onChange={e=>setAccountForm(v=>({...v,role:e.target.value}))}><option value="operator">Operator</option><option value="admin">Admin</option></select></label>
    {accountError&&<div className="error">{accountError}</div>}
    <button className="primary" disabled={accountBusy}><UserPlus size={16}/>{accountBusy?"Membuat akun...":"Buat akun"}</button>
   </form>
   <div className="account-list-head"><h3><UserCog size={17}/> Daftar pengguna</h3><span>{accounts.length} akun</span></div>
   <div className="account-list">{accounts.map(a=><div className="account-row" key={a.uid}>
    <div className="account-info"><b>{a.name||a.email||a.uid}</b><small>{a.email||a.uid}</small><span className={"role-pill "+(a.role||"")}>{(a.role||"tanpa peran").toUpperCase()} • {a.active===false?"NONAKTIF":"AKTIF"}</span></div>
    <div className="account-actions">{a.uid!==user.uid&&<><select aria-label={"Peran "+(a.email||a.uid)} value={a.role||"operator"} onChange={e=>changeRole(a,e.target.value)}><option value="operator">Operator</option><option value="admin">Admin</option></select><button type="button" className={a.active===false?"primary":"secondary"} onClick={()=>toggleAccount(a)}>{a.active===false?"Aktifkan":"Nonaktifkan"}</button></>}</div>
   </div>)}</div>
   <div className="modalbuttons"><button type="button" className="secondary" onClick={()=>setAccountModal(false)}>Tutup</button></div>
  </section></div>}
  {imp&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setImp(null)}}><div className="modal"><div className="modalhead"><div><span className="eyebrow">Ke {label(sheet)}</span><h2>Impor dari Excel</h2></div><button type="button" className="close" onClick={()=>setImp(null)}><X/></button></div>
   <p className="hint">Pilih file Excel (.xlsx) atau CSV, atau salin kolom SO, QTY, LOT, STYLE, KET lalu tempel di bawah. Lembar pertama yang dibaca.</p>
   <label>File Excel / CSV<input type="file" accept=".xlsx,.csv,.tsv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain" onChange={readFile}/></label>
   <label>Atau tempel di sini<textarea value={imp.text} onChange={e=>setImp({text:e.target.value})} placeholder={"SO\tQTY\tLOT\tKET\n10270687\t17\tD01"}/></label>
   {imp.text.trim()&&<div className="sum">{parsed.ok.length} data siap diimpor (pratinjau 3 baris pertama){parsed.skip?" • "+parsed.skip+" dilewati (SO kosong atau sudah ada)":""}</div>}
   {parsed.ok.length>0&&<div className="tablewrap pv"><table><thead><tr><th>SO</th><th>QTY</th><th>LOT</th><th>STYLE</th><th>KET</th></tr></thead><tbody>{parsed.ok.slice(0,3).map(x=><tr key={x.so}><td>{x.so}</td><td>{x.qty}</td><td>{x.lot}</td><td>{x.style}</td><td>{x.ket}</td></tr>)}</tbody></table></div>}
   <div className="modalbuttons"><button type="button" className="secondary" onClick={()=>setImp(null)}>Batal</button><button type="button" className="primary" disabled={!parsed.ok.length||imp.busy} onClick={doImport}>Impor {parsed.ok.length||""} data</button></div></div></div>}
  {modal&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setModal(false)}}><form className="modal" onSubmit={save}><div className="modalhead"><div><span className="eyebrow">{editing?"Perbarui":"Input"} data</span><h2>{editing?"Edit barang":"Tambah barang"}</h2></div><button type="button" className="close" onClick={()=>setModal(false)}><X/></button></div>
   <label>SO / Nomor barang<input autoFocus value={form.so} onChange={e=>setForm({...form,so:e.target.value})} placeholder="Contoh: 10270687"/></label>
   <div className="twocol"><label>QTY<input type="number" min="0" step="1" value={form.qty} onChange={e=>setForm({...form,qty:e.target.value})} placeholder="0"/></label><label>LOT<input value={form.lot} onChange={e=>setForm({...form,lot:e.target.value.toUpperCase()})} placeholder="Contoh: D01"/></label></div>
   <label>STYLE <span className="optional">(opsional)</span><input value={form.style} onChange={e=>setForm({...form,style:e.target.value})} placeholder="Contoh: AB1234"/></label>
   <label>KET / Keterangan <span className="optional">(opsional)</span><input value={form.ket} onChange={e=>setForm({...form,ket:e.target.value})} placeholder="Catatan barang..."/></label>
   {error&&<div className="error">{error}</div>}<div className="modalbuttons"><button type="button" className="secondary" onClick={()=>setModal(false)}>Batal</button><button className="primary" type="submit">{editing?"Simpan perubahan":"Simpan data"}</button></div>
  </form></div>}
 </main>
}
createRoot(document.getElementById("root")).render(<App/>);
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").catch(()=>{}));
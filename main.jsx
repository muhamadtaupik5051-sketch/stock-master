import React, {useEffect,useMemo,useRef,useState} from "react";
import {createRoot} from "react-dom/client";
import {onAuthStateChanged} from "firebase/auth";
import {addDoc,collection,deleteDoc,doc,onSnapshot,orderBy,query,serverTimestamp,setDoc,updateDoc,writeBatch} from "firebase/firestore";
import {auth,db,ready} from "./firebase";
import {Search,Plus,Download,Package,RefreshCw,Edit3,Trash2,X,Wifi,WifiOff,Upload,Boxes,Filter} from "lucide-react";
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
 const seen=new Set(existing),ok=[];let skip=0;
 lines.forEach((l,i)=>{
  const c=splitLine(l,d);
  if(/^so$/i.test(c[0]))return;
  const so=c[0];if(!so){skip++;return}
  const k=so.toLowerCase();if(seen.has(k)){skip++;return}seen.add(k);
  const q=Number(c[1]);ok.push({so,qty:Number.isFinite(q)&&q>=0?q:0,lot:(c[2]||"").toUpperCase(),ket:c[3]||""});
 });
 return {ok,skip};
}
function App(){
 const [user,setUser]=useState(null),[rows,setRows]=useState([]),[status,setStatus]=useState("Menghubungkan...");
 const [search,setSearch]=useState(""),[lotFilter,setLotFilter]=useState("Semua LOT");
 const [modal,setModal]=useState(false),[editing,setEditing]=useState(null);
 const [form,setForm]=useState({so:"",qty:"",lot:"",ket:""}),[error,setError]=useState("");
 const [imp,setImp]=useState(null),[online,setOnline]=useState(navigator.onLine);
 const [sel,setSel]=useState([]),[undo,setUndo]=useState(null),timer=useRef(null);
 const [sheet,setSheet]=useState(1),[extra,setExtra]=useState(0),[names,setNames]=useState({});
 useEffect(()=>onAuthStateChanged(auth,u=>setUser(u)),[]);
 useEffect(()=>{
  if(!user)return;
  const q=query(collection(db,"stockItems"),orderBy("updatedAt","desc"));
  return onSnapshot(q,s=>{const all=s.docs.map(d=>({id:d.id,...d.data()}));setRows(all.filter(r=>r.id!=="_meta"));setNames((all.find(r=>r.id==="_meta")||{}).names||{});setStatus("Online • Data tersinkron");},e=>setStatus("Gagal memuat: "+e.message));
 },[user]);
 useEffect(()=>{const on=()=>setOnline(true),off=()=>setOnline(false);window.addEventListener("online",on);window.addEventListener("offline",off);return()=>{window.removeEventListener("online",on);window.removeEventListener("offline",off)}},[]);
 const commit=p=>navigator.onLine?p:(p.catch(()=>{}),null);
 useEffect(()=>setSel([]),[sheet]);
 useEffect(()=>{
  if(!modal)return;const vv=window.visualViewport;if(!vv)return;const r=document.documentElement.style;
  const set=()=>{r.setProperty("--vvh",vv.height+"px");r.setProperty("--vvt",vv.offsetTop+"px")};
  set();vv.addEventListener("resize",set);vv.addEventListener("scroll",set);
  return()=>{vv.removeEventListener("resize",set);vv.removeEventListener("scroll",set);r.removeProperty("--vvh");r.removeProperty("--vvt")};
 },[modal]);
 const sheetOf=r=>Number(r.sheet)||1;
 const label=n=>(names[n]&&String(names[n]).trim())||"Lembar "+n;
 async function renameSheet(){
  const nm=window.prompt("Nama lembar (kosongkan untuk kembali ke nama awal):",names[sheet]||"Lembar "+sheet);
  if(nm===null)return;
  try{await commit(setDoc(doc(db,"stockItems","_meta"),{names:{[sheet]:nm.trim().slice(0,30)},updatedAt:serverTimestamp(),updatedBy:user?.uid||"anon"},{merge:true}))}catch(e){alert("Gagal mengubah nama: "+e.message)}
 }
 const maxSheet=Math.max(3,extra,...rows.map(sheetOf));
 const sheets=Array.from({length:maxSheet},(_,i)=>i+1);
 const sheetRows=useMemo(()=>rows.filter(r=>sheetOf(r)===sheet),[rows,sheet]);
 const lots=useMemo(()=>["Semua LOT",...new Set(sheetRows.map(r=>r.lot).filter(Boolean).sort())],[sheetRows]);
 const filtered=useMemo(()=>sheetRows.filter(r=>(String(r.so).toLowerCase().includes(search.toLowerCase())||String(r.ket||"").toLowerCase().includes(search.toLowerCase()))&&(lotFilter==="Semua LOT"||r.lot===lotFilter)),[sheetRows,search,lotFilter]);
 const selRows=filtered.filter(r=>sel.includes(r.id));
 const allSel=filtered.length>0&&selRows.length===filtered.length;
 const toggle=id=>setSel(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id]);
 const totalQty=filtered.reduce((a,r)=>a+(Number(r.qty)||0),0);
 function openNew(){setEditing(null);setForm({so:"",qty:"",lot:"",ket:""});setError("");setModal(true)}
 function openEdit(r){setEditing(r);setForm({so:r.so||"",qty:String(r.qty??""),lot:r.lot||"",ket:r.ket||""});setError("");setModal(true)}
 async function save(e){
  e.preventDefault();setError("");
  const so=form.so.trim(),lot=form.lot.trim();
  if(!so||form.qty===""||!lot){setError("SO, QTY, dan LOT wajib diisi.");return}
  const qty=Number(form.qty);if(!Number.isFinite(qty)||qty<0){setError("QTY harus berupa angka 0 atau lebih.");return}
  try{
   const duplicate=sheetRows.find(r=>String(r.so).toLowerCase()===so.toLowerCase()&&r.id!==editing?.id);
   if(duplicate){setError("Nomor SO sudah ada di "+label(sheet)+". Gunakan SO yang berbeda atau edit data tersebut.");return}
   const payload={so,qty,lot,ket:form.ket.trim(),updatedAt:serverTimestamp(),updatedBy:user?.uid||"anon"};
   if(editing) await commit(updateDoc(doc(db,"stockItems",editing.id),payload));
   else await commit(addDoc(collection(db,"stockItems"),{...payload,sheet,createdAt:serverTimestamp()}));
   setModal(false);
  }catch(e){setError("Gagal menyimpan: "+e.message)}
 }
 async function deleteRows(list){
  if(!list.length)return;
  const msg=list.length===1?"Hapus data SO "+list[0].so+" (QTY "+list[0].qty+", LOT "+list[0].lot+")?\nBerlaku untuk semua pengguna.":"Hapus "+list.length+" data terpilih?\nBerlaku untuk semua pengguna.";
  if(!window.confirm(msg))return;
  try{
   for(let i=0;i<list.length;i+=400){const b=writeBatch(db);list.slice(i,i+400).forEach(r=>b.delete(doc(db,"stockItems",r.id)));await commit(b.commit())}
   setSel([]);clearTimeout(timer.current);setUndo(list);timer.current=setTimeout(()=>setUndo(null),10000);
  }catch(e){alert("Gagal menghapus: "+e.message)}
 }
 async function undoDelete(){
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
  const list=parsed.ok;if(!list.length)return;setImp(v=>({...v,busy:true}));
  try{
   for(let i=0;i<list.length;i+=400){const b=writeBatch(db);list.slice(i,i+400).forEach(x=>b.set(doc(collection(db,"stockItems")),{...x,sheet,createdAt:serverTimestamp(),updatedAt:serverTimestamp(),updatedBy:user?.uid||"anon"}));await commit(b.commit())}
   setImp(null);
  }catch(e){alert("Gagal impor: "+e.message);setImp(v=>v&&{...v,busy:false})}
 }
 function exportCSV(){
  const data=[["SO","QTY","LOT","KET"],...filtered.map(r=>[r.so,r.qty,r.lot,r.ket||""])];
  const csv=data.map(row=>row.map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(",")).join("\n");
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}));a.download="stock-master-"+label(sheet).replace(/[^\w\-]+/g,"-")+".csv";a.click();URL.revokeObjectURL(a.href);
 }
 return <main className="app">
  <header><div className="brand"><div className="logo"><Boxes size={25}/></div><div><b>STOCK MASTER</b><small>Stok gudang bersama</small></div></div><div className={"live"+(online?"":" off")}>{online?<Wifi size={16}/>:<WifiOff size={16}/>}<span>{online?status:"Offline • Data tersimpan di HP"}</span></div></header>
    <section className="stats"><div className="stat"><span>Total data</span><strong>{filtered.length}</strong><small>baris ditampilkan</small></div><div className="stat"><span>Total QTY</span><strong>{totalQty.toLocaleString("id-ID")}</strong><small>jumlah stok terfilter</small></div><div className="stat"><span>Status</span><strong className={online?"online":"offline"}>{online?"Live":"Offline"}</strong><small>{!online?"Tanpa sinyal":user?"Terhubung":"Menunggu akun"}</small></div></section>
  <section className="panel">
   <div className="tabs">{sheets.map(n=><button key={n} className={"tab"+(n===sheet?" active":"")} onClick={()=>{setSheet(n);setLotFilter("Semua LOT");setSearch("")}}>{label(n)}</button>)}<button className="tab add" title="Tambah lembar" onClick={()=>{const n=maxSheet+1;setExtra(n);setSheet(n);setLotFilter("Semua LOT");setSearch("")}}><Plus size={16}/></button></div>
   <div className="toolbar"><div><h2>Daftar barang • {label(sheet)} <button className="rename" title="Ubah nama lembar" onClick={renameSheet}><Edit3 size={15}/></button></h2><p>Data SO, jumlah, lot, dan keterangan</p></div></div>
   <div className="filters"><button className="primary" onClick={openNew}><Plus size={18}/> Tambah</button><label className="search"><Search size={18}/><input placeholder="Cari SO" value={search} onChange={e=>setSearch(e.target.value)}/></label><button className="secondary" title="Impor dari Excel" aria-label="Impor dari Excel" onClick={()=>setImp({text:""})}><Upload size={17}/><span className="lbl">Impor</span></button><button className="secondary" title="Unduh Excel/CSV" aria-label="Unduh Excel/CSV" onClick={exportCSV}><Download size={17}/><span className="lbl">Excel/CSV</span></button></div>
   {selRows.length>0&&<div className="bulk"><span>{selRows.length} data dipilih</span><div><button className="secondary" onClick={()=>setSel([])}>Batal pilih</button><button className="dangerbtn" onClick={()=>deleteRows(selRows)}><Trash2 size={16}/> Hapus terpilih</button></div></div>}
   <div className="tablewrap"><table><thead><tr><th className="chk"><input type="checkbox" title="Pilih semua" checked={allSel} onChange={()=>setSel(allSel?[]:filtered.map(r=>r.id))}/></th><th>SO</th><th>QTY</th><th>LOT</th><th>KET</th><th>Aksi</th></tr></thead><tbody>
    {filtered.map(r=><tr key={r.id} className={sel.includes(r.id)?"picked":""}><td className="chk"><input type="checkbox" checked={sel.includes(r.id)} onChange={()=>toggle(r.id)}/></td><td className="so">{r.so}</td><td className="qty">{Number(r.qty).toLocaleString("id-ID")}</td><td className="lotc"><span className="lot">{r.lot}</span></td><td className="ket">{r.ket||""}</td><td className="act"><div className="actions"><button title="Edit" onClick={()=>openEdit(r)}><Edit3 size={16}/></button><button title="Hapus" className="danger" onClick={()=>removeRow(r)}><Trash2 size={16}/></button></div></td></tr>)}
    {!filtered.length&&<tr><td colSpan="6" className="empty"><Package size={28}/><b>Belum ada data</b><span>Tambahkan data pertama atau ubah pencarian.</span></td></tr>}
   </tbody></table></div>
   <div className="foot"><span><RefreshCw size={14}/> Sinkronisasi otomatis aktif</span><span>{filtered.length} dari {sheetRows.length} data</span></div>
  </section>
  <footer>STOCK MASTER <span>•</span> Aplikasi stok bersama</footer>
  {undo&&<div className="toast"><span>{undo.length} data dihapus</span><button onClick={undoDelete}>Urungkan</button></div>}
  {imp&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setImp(null)}}><div className="modal"><div className="modalhead"><div><span className="eyebrow">Ke {label(sheet)}</span><h2>Impor dari Excel</h2></div><button type="button" className="close" onClick={()=>setImp(null)}><X/></button></div>
   <p className="hint">Pilih file Excel (.xlsx) atau CSV, atau salin kolom SO, QTY, LOT, KET lalu tempel di bawah. Lembar pertama yang dibaca.</p>
   <label>File Excel / CSV<input type="file" accept=".xlsx,.csv,.tsv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/plain" onChange={readFile}/></label>
   <label>Atau tempel di sini<textarea value={imp.text} onChange={e=>setImp({text:e.target.value})} placeholder={"SO\tQTY\tLOT\tKET\n10270687\t17\tD01"}/></label>
   {imp.text.trim()&&<div className="sum">{parsed.ok.length} data siap diimpor (pratinjau 3 baris pertama){parsed.skip?" • "+parsed.skip+" dilewati (SO kosong atau sudah ada)":""}</div>}
   {parsed.ok.length>0&&<div className="tablewrap pv"><table><thead><tr><th>SO</th><th>QTY</th><th>LOT</th><th>KET</th></tr></thead><tbody>{parsed.ok.slice(0,3).map(x=><tr key={x.so}><td>{x.so}</td><td>{x.qty}</td><td>{x.lot}</td><td>{x.ket}</td></tr>)}</tbody></table></div>}
   <div className="modalbuttons"><button type="button" className="secondary" onClick={()=>setImp(null)}>Batal</button><button type="button" className="primary" disabled={!parsed.ok.length||imp.busy} onClick={doImport}>Impor {parsed.ok.length||""} data</button></div></div></div>}
  {modal&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setModal(false)}}><form className="modal" onSubmit={save}><div className="modalhead"><div><span className="eyebrow">{editing?"Perbarui":"Input"} data</span><h2>{editing?"Edit barang":"Tambah barang"}</h2></div><button type="button" className="close" onClick={()=>setModal(false)}><X/></button></div>
   <label>SO / Nomor barang<input autoFocus value={form.so} onChange={e=>setForm({...form,so:e.target.value})} placeholder="Contoh: 10270687"/></label>
   <div className="twocol"><label>QTY<input type="number" min="0" step="1" value={form.qty} onChange={e=>setForm({...form,qty:e.target.value})} placeholder="0"/></label><label>LOT<input value={form.lot} onChange={e=>setForm({...form,lot:e.target.value.toUpperCase()})} placeholder="Contoh: D01"/></label></div>
   <label>KET / Keterangan <span className="optional">(opsional)</span><input value={form.ket} onChange={e=>setForm({...form,ket:e.target.value})} placeholder="Catatan barang..."/></label>
   {error&&<div className="error">{error}</div>}<div className="modalbuttons"><button type="button" className="secondary" onClick={()=>setModal(false)}>Batal</button><button className="primary" type="submit">{editing?"Simpan perubahan":"Simpan data"}</button></div>
  </form></div>}
 </main>
}
createRoot(document.getElementById("root")).render(<App/>);
if("serviceWorker" in navigator)window.addEventListener("load",()=>navigator.serviceWorker.register("/sw.js").catch(()=>{}));
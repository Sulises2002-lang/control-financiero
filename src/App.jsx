import { useState, useMemo, useEffect, useRef } from "react";

// ══ STORAGE ══
const KEYS = { cls:"fin_clientes", ctas:"fin_cuentas", movs:"fin_movimientos", cierres:"fin_cierres", meta:"fin_meta" };
function load(key, def) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch { return def; } }
function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }

// ══ UTILS ══
const uid = () => Math.random().toString(36).slice(2,10);
const fmt = n => isNaN(n) ? "$0.00" : new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN"}).format(n||0);
const fmtDate = d => new Date(d+"T12:00:00").toLocaleDateString("es-MX",{day:"2-digit",month:"2-digit",year:"numeric"});
const fmtShort = d => new Date(d+"T12:00:00").toLocaleDateString("es-MX",{day:"2-digit",month:"short"});
const today = () => new Date().toISOString().slice(0,10);
const CATEGORIAS = ["Operación","Nómina","Proveedor","Bancario"];
const TIPO_META = {
  ingreso:{ emoji:"📥", bg:"#e8f5e9", color:"#2e7d32", label:"Ingreso" },
  egreso: { emoji:"📤", bg:"#fce4ec", color:"#c62828", label:"Egreso"  },
  ajuste: { emoji:"⚖️", bg:"#fff8e1", color:"#f57f17", label:"Ajuste"  },
};
const C = { navy:"#1a3a5c",blue:"#2e6da4",lblue:"#e8f0fb",xblue:"#f0f5fb",green:"#2e7d32",lgreen:"#e8f5e9",red:"#c62828",lred:"#fce4ec",gold:"#f57f17",lgold:"#fff8e1",gray:"#888",lgray:"#f5f5f5",border:"#e0e0e0",white:"#fff" };

// ══ LÓGICA ══
function calcMov(monto, tipo, cliente) {
  const m = parseFloat(monto)||0;
  if (tipo!=="ingreso"||!cliente) return { montoSinIVA:0, comision:0, montoFinal:m };
  const sinIVA = m/1.16;
  const com = sinIVA*((cliente.porcentajeComision||0)/100);
  return { montoSinIVA:sinIVA, comision:com, montoFinal:m-com };
}
function saldoCliente(c, movs) {
  const cm = movs.filter(m=>m.clienteId===c.id);
  const ing = cm.filter(m=>m.tipo==="ingreso").reduce((a,m)=>a+m.montoFinal,0);
  const eg  = cm.filter(m=>m.tipo==="egreso").reduce((a,m)=>a+m.montoFinal,0);
  const com = cm.filter(m=>m.tipo==="ingreso").reduce((a,m)=>a+m.comision,0);
  const aj  = cm.filter(m=>m.tipo==="ajuste").reduce((a,m)=>a+m.montoFinal,0);
  return (c.saldoInicial||0)+ing-eg-com+aj;
}
function saldoCuenta(c, movs) {
  const cm = movs.filter(m=>m.cuentaId===c.id);
  const ing = cm.filter(m=>m.tipo==="ingreso").reduce((a,m)=>a+m.montoFinal,0);
  const eg  = cm.filter(m=>m.tipo==="egreso").reduce((a,m)=>a+m.montoFinal,0);
  const aj  = cm.filter(m=>m.tipo==="ajuste").reduce((a,m)=>a+m.montoFinal,0);
  return (c.saldoInicial||0)+ing-eg+aj;
}
function resumenTotal(cls, ctas, movs) {
  const total = ctas.reduce((a,c)=>a+saldoCuenta(c,movs),0);
  const dineroC = cls.reduce((a,c)=>a+Math.max(saldoCliente(c,movs),0),0);
  const ing = movs.filter(m=>m.tipo==="ingreso").reduce((a,m)=>a+m.montoFinal,0);
  const eg  = movs.filter(m=>m.tipo==="egreso").reduce((a,m)=>a+m.montoFinal,0);
  const com = movs.filter(m=>m.tipo==="ingreso").reduce((a,m)=>a+m.comision,0);
  return { total, dineroC, disponible:total-dineroC, ing, eg, com };
}

// ══ UI ══
const inp = { width:"100%",padding:"9px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,fontSize:14,boxSizing:"border-box",outline:"none",fontFamily:"inherit",background:C.white };
const btnS = (bg,col="#fff") => ({ padding:"9px 16px",borderRadius:9,border:"none",background:bg,color:col,fontWeight:"bold",fontSize:13,cursor:"pointer",fontFamily:"inherit" });
const card = { background:C.white,borderRadius:14,padding:16,boxShadow:"0 2px 10px rgba(0,0,0,0.07)",marginBottom:10 };
const lbl = { fontSize:10,color:C.gray,letterSpacing:1.5,textTransform:"uppercase",marginBottom:3,display:"block" };

function Modal({ title, onClose, children }) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div style={{background:C.white,borderRadius:"20px 20px 0 0",width:"100%",maxWidth:620,maxHeight:"93vh",overflowY:"auto",padding:"20px 16px 40px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <span style={{fontWeight:"bold",fontSize:16,color:C.navy}}>{title}</span>
          <button onClick={onClose} style={{background:C.lgray,border:"none",borderRadius:20,width:32,height:32,cursor:"pointer",fontSize:16,color:C.gray}}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Calc({ monto, tipo, cliente }) {
  const c = useMemo(()=>calcMov(monto,tipo,cliente),[monto,tipo,cliente]);
  if (!parseFloat(monto)) return null;
  return (
    <div style={{background:C.xblue,borderRadius:10,padding:"12px 14px",marginBottom:12,borderLeft:`4px solid ${C.blue}`}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
        <span style={{fontSize:12,color:C.gray}}>Monto original</span>
        <span style={{fontWeight:"bold",color:C.navy}}>{fmt(parseFloat(monto))}</span>
      </div>
      {c.comision>0&&<>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
          <span style={{fontSize:12,color:C.gray}}>Sin IVA (÷1.16)</span>
          <span style={{color:C.gray}}>{fmt(c.montoSinIVA)}</span>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
          <span style={{fontSize:12,color:C.red}}>Comisión ({cliente?.porcentajeComision}%)</span>
          <span style={{color:C.red,fontWeight:"bold"}}>− {fmt(c.comision)}</span>
        </div>
      </>}
      <div style={{borderTop:`1px solid ${C.border}`,paddingTop:8,display:"flex",justifyContent:"space-between"}}>
        <span style={{fontWeight:"bold",color:C.navy}}>Monto final</span>
        <span style={{fontWeight:"bold",fontSize:17,color:C.green}}>{fmt(c.montoFinal)}</span>
      </div>
    </div>
  );
}

// ══ FORM MOVIMIENTO ══
function FormMov({ clientes, cuentas, ini, onSave, onClose, clientesRecientes }) {
  const [tipo,      setTipo]     = useState(ini?.tipo||"ingreso");
  const [clienteId, setClienteId]= useState(ini?.clienteId||"");
  const [cuentaId,  setCuentaId] = useState(ini?.cuentaId||cuentas[0]?.id||"");
  const [monto,     setMonto]    = useState(ini?.montoOriginal?.toString()||"");
  const [concepto,  setConcepto] = useState(ini?.concepto||"");
  const [categoria, setCategoria]= useState(ini?.categoria||"");
  const [notas,     setNotas]    = useState(ini?.notas||"");
  const [fecha,     setFecha]    = useState(ini?.fecha||today());
  const [estado,    setEstado]   = useState(ini?.estado||"confirmado");
  const [err,       setErr]      = useState("");

  const cliente = clientes.find(c=>c.id===clienteId);
  const cal = useMemo(()=>calcMov(monto,tipo,cliente),[monto,tipo,cliente]);

  // Ordenar clientes: recientes primero
  const clientesOrdenados = useMemo(()=>{
    const recientes = clientesRecientes||[];
    return [...clientes].sort((a,b)=>{
      const ia = recientes.indexOf(a.id), ib = recientes.indexOf(b.id);
      if(ia===-1&&ib===-1) return a.nombre.localeCompare(b.nombre);
      if(ia===-1) return 1; if(ib===-1) return -1;
      return ia-ib;
    });
  },[clientes,clientesRecientes]);

  function guardar() {
    if(!cuentaId) return setErr("Selecciona una cuenta.");
    const m = parseFloat(monto);
    if(!m||m<=0) return setErr("El monto debe ser mayor a 0.");
    setErr("");
    onSave({ id:ini?.id||uid(), tipo, clienteId:clienteId||null, cuentaId, concepto, categoria, notas, fecha, estado, montoOriginal:m, ...cal, historial:ini?.historial||[], revisado:ini?.revisado||false });
  }

  return (
    <div>
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        {["ingreso","egreso","ajuste"].map(t=>{
          const mt=TIPO_META[t];
          return <button key={t} onClick={()=>setTipo(t)} style={{flex:1,padding:"8px 4px",borderRadius:9,border:`2px solid ${tipo===t?mt.color:C.border}`,background:tipo===t?mt.bg:C.lgray,color:tipo===t?mt.color:C.gray,fontWeight:"bold",fontSize:12,cursor:"pointer"}}>{mt.emoji} {mt.label}</button>;
        })}
      </div>
      <span style={lbl}>Cuenta *</span>
      <select value={cuentaId} onChange={e=>setCuentaId(e.target.value)} style={{...inp,marginBottom:12}}>
        <option value="">— Selecciona —</option>
        {cuentas.map(c=><option key={c.id} value={c.id}>{c.nombre} ({c.banco})</option>)}
      </select>
      <span style={lbl}>Cliente (opcional)</span>
      <select value={clienteId} onChange={e=>setClienteId(e.target.value)} style={{...inp,marginBottom:12}}>
        <option value="">— Sin cliente —</option>
        {clientesOrdenados.map((c,i)=><option key={c.id} value={c.id}>{i===0&&clientesRecientes?.includes(c.id)?"⭐ ":""}{c.nombre} ({c.porcentajeComision}%)</option>)}
      </select>
      <span style={lbl}>Monto original ($) *</span>
      <input inputMode="decimal" placeholder="0.00" value={monto} onChange={e=>setMonto(e.target.value)} style={{...inp,fontSize:18,marginBottom:12}} />
      <Calc monto={monto} tipo={tipo} cliente={cliente} />
      <span style={lbl}>Concepto</span>
      <input value={concepto} onChange={e=>setConcepto(e.target.value)} placeholder="Ej: Pago factura marzo" style={{...inp,marginBottom:12}} />
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        <div style={{flex:1}}>
          <span style={lbl}>Categoría</span>
          <select value={categoria} onChange={e=>setCategoria(e.target.value)} style={inp}>
            <option value="">Sin categoría</option>
            {CATEGORIAS.map(cat=><option key={cat}>{cat}</option>)}
          </select>
        </div>
        <div style={{flex:1}}>
          <span style={lbl}>Estado</span>
          <select value={estado} onChange={e=>setEstado(e.target.value)} style={inp}>
            <option value="confirmado">Confirmado</option>
            <option value="pendiente">Pendiente</option>
          </select>
        </div>
      </div>
      <span style={lbl}>Fecha</span>
      <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)} style={{...inp,marginBottom:12}} />
      <span style={lbl}>Notas</span>
      <input value={notas} onChange={e=>setNotas(e.target.value)} placeholder="Opcional" style={{...inp,marginBottom:16}} />
      {err&&<div style={{color:C.red,fontSize:13,padding:"8px 12px",background:C.lred,borderRadius:8,marginBottom:10}}>⚠️ {err}</div>}
      <button onClick={guardar} style={{...btnS(C.navy),width:"100%",padding:13,fontSize:15}}>{ini?"Guardar cambios":"Registrar movimiento"}</button>
    </div>
  );
}

function FormCliente({ ini, onSave }) {
  const [nombre,setNombre]=useState(ini?.nombre||"");
  const [pct,setPct]=useState(ini?.porcentajeComision?.toString()||"3");
  const [saldo0,setSaldo0]=useState(ini?.saldoInicial?.toString()||"0");
  const [notas,setNotas]=useState(ini?.notas||"");
  const [err,setErr]=useState("");
  function guardar(){
    if(!nombre.trim()) return setErr("El nombre es obligatorio.");
    const p=parseFloat(pct); if(isNaN(p)||p<0) return setErr("Porcentaje inválido.");
    setErr("");
    onSave({id:ini?.id||uid(),nombre:nombre.trim(),porcentajeComision:p,saldoInicial:parseFloat(saldo0)||0,notas,activo:true,fechaCreacion:ini?.fechaCreacion||today()});
  }
  return (
    <div>
      <span style={lbl}>Nombre *</span>
      <input value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="Nombre del cliente" style={{...inp,marginBottom:12}} />
      <span style={lbl}>% Comisión *</span>
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        {["3","4"].map(p=><button key={p} onClick={()=>setPct(p)} style={{padding:"8px 20px",borderRadius:8,border:`2px solid ${pct===p?C.navy:C.border}`,background:pct===p?C.navy:C.lgray,color:pct===p?"#fff":C.gray,fontWeight:"bold",cursor:"pointer",fontSize:15}}>{p}%</button>)}
        <input type="number" placeholder="Otro" min="0" max="100" value={!["3","4"].includes(pct)?pct:""} onChange={e=>setPct(e.target.value)} style={{...inp,width:80}} />
      </div>
      <span style={lbl}>Saldo inicial ($)</span>
      <input inputMode="decimal" value={saldo0} onChange={e=>setSaldo0(e.target.value)} style={{...inp,marginBottom:12}} />
      <span style={lbl}>Notas</span>
      <input value={notas} onChange={e=>setNotas(e.target.value)} placeholder="Opcional" style={{...inp,marginBottom:16}} />
      {err&&<div style={{color:C.red,fontSize:13,padding:"8px 12px",background:C.lred,borderRadius:8,marginBottom:10}}>⚠️ {err}</div>}
      <button onClick={guardar} style={{...btnS(C.navy),width:"100%",padding:13,fontSize:15}}>{ini?"Guardar cambios":"Agregar cliente"}</button>
    </div>
  );
}

function FormCuenta({ ini, onSave }) {
  const [nombre,setNombre]=useState(ini?.nombre||"");
  const [banco,setBanco]=useState(ini?.banco||"");
  const [saldo0,setSaldo0]=useState(ini?.saldoInicial?.toString()||"0");
  const [err,setErr]=useState("");
  function guardar(){
    if(!nombre.trim()) return setErr("El nombre es obligatorio.");
    setErr(""); onSave({id:ini?.id||uid(),nombre:nombre.trim(),banco:banco.trim(),saldoInicial:parseFloat(saldo0)||0,activa:true,fechaCreacion:ini?.fechaCreacion||today()});
  }
  return (
    <div>
      <span style={lbl}>Nombre *</span>
      <input value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="Ej: Cuenta principal" style={{...inp,marginBottom:12}} />
      <span style={lbl}>Banco</span>
      <input value={banco} onChange={e=>setBanco(e.target.value)} placeholder="Ej: BBVA, Santander" style={{...inp,marginBottom:12}} />
      <span style={lbl}>Saldo inicial ($)</span>
      <input inputMode="decimal" value={saldo0} onChange={e=>setSaldo0(e.target.value)} style={{...inp,marginBottom:16}} />
      {err&&<div style={{color:C.red,fontSize:13,padding:"8px 12px",background:C.lred,borderRadius:8,marginBottom:10}}>⚠️ {err}</div>}
      <button onClick={guardar} style={{...btnS(C.navy),width:"100%",padding:13,fontSize:15}}>{ini?"Guardar cambios":"Agregar cuenta"}</button>
    </div>
  );
}

// ══ GRÁFICA ══
function GraficaBarras({ movs, clientes, cuentas }) {
  const semanas = useMemo(()=>{
    const map = {};
    movs.forEach(m=>{
      const d = new Date(m.fecha+"T12:00:00");
      const lunes = new Date(d); lunes.setDate(d.getDate()-((d.getDay()+6)%7));
      const k = lunes.toISOString().slice(0,10);
      if(!map[k]) map[k]={k,ing:0,eg:0,com:0};
      if(m.tipo==="ingreso"){ map[k].ing+=m.montoFinal; map[k].com+=m.comision; }
      if(m.tipo==="egreso") map[k].eg+=m.montoFinal;
    });
    return Object.values(map).sort((a,b)=>a.k.localeCompare(b.k)).slice(-6);
  },[movs]);

  if(semanas.length===0) return <div style={{color:C.gray,textAlign:"center",padding:20,fontSize:12}}>Sin datos para graficar</div>;

  const maxVal = Math.max(...semanas.flatMap(s=>[s.ing,s.eg]),1);

  return (
    <div style={{background:C.white,borderRadius:14,padding:"16px 12px",marginBottom:12,boxShadow:"0 2px 10px rgba(0,0,0,0.07)"}}>
      <div style={{fontSize:11,color:C.navy,fontWeight:"bold",marginBottom:12,letterSpacing:1,textTransform:"uppercase"}}>Ingresos vs Egresos por semana</div>
      <div style={{display:"flex",alignItems:"flex-end",gap:6,height:100}}>
        {semanas.map(s=>(
          <div key={s.k} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
            <div style={{width:"100%",display:"flex",gap:2,alignItems:"flex-end",height:80}}>
              <div style={{flex:1,background:C.green,borderRadius:"3px 3px 0 0",height:`${(s.ing/maxVal)*100}%`,minHeight:s.ing>0?3:0,transition:"height .3s"}} title={fmt(s.ing)} />
              <div style={{flex:1,background:C.red,borderRadius:"3px 3px 0 0",height:`${(s.eg/maxVal)*100}%`,minHeight:s.eg>0?3:0,transition:"height .3s"}} title={fmt(s.eg)} />
            </div>
            <div style={{fontSize:8,color:C.gray,textAlign:"center"}}>{fmtShort(s.k)}</div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:16,marginTop:8,justifyContent:"center"}}>
        <div style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:10,height:10,background:C.green,borderRadius:2}}/><span style={{fontSize:10,color:C.gray}}>Ingresos</span></div>
        <div style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:10,height:10,background:C.red,borderRadius:2}}/><span style={{fontSize:10,color:C.gray}}>Egresos</span></div>
      </div>
    </div>
  );
}

// ══ RESUMEN ══
function Resumen({ cls, ctas, movs, metaMensual, onSetMeta }) {
  const r = resumenTotal(cls,ctas,movs);
  const [editMeta,setEditMeta]=useState(false);
  const [metaInput,setMetaInput]=useState(metaMensual?.toString()||"");

  const mesActual = today().slice(0,7);
  const comMes = movs.filter(m=>m.fecha.startsWith(mesActual)&&m.tipo==="ingreso").reduce((a,m)=>a+m.comision,0);
  const pctMeta = metaMensual>0 ? Math.min((comMes/metaMensual)*100,100) : 0;

  const alertas=[];
  cls.forEach(c=>{ if(saldoCliente(c,movs)<0) alertas.push(`⚠️ ${c.nombre} tiene saldo negativo`); if(saldoCliente(c,movs)>=0&&saldoCliente(c,movs)<500&&movs.some(m=>m.clienteId===c.id)) alertas.push(`🔔 ${c.nombre} tiene saldo bajo`); });
  if(movs.filter(m=>m.tipo==="ajuste").length>5) alertas.push("⚠️ Hay muchos ajustes registrados");
  if(r.dineroC>r.total*0.8&&r.total>0) alertas.push("⚠️ Saldo retenido de clientes es alto");

  return (
    <div>
      {alertas.length>0&&<div style={{background:"#fff3e0",borderRadius:12,padding:"12px 16px",marginBottom:12,borderLeft:"4px solid #f57f17"}}>
        {alertas.map((a,i)=><div key={i} style={{fontSize:13,color:"#e65100",marginBottom:i<alertas.length-1?4:0}}>{a}</div>)}
      </div>}

      <div style={{...card,background:C.navy,color:"#fff",marginBottom:12}}>
        <div style={{fontSize:10,opacity:.6,letterSpacing:2,textTransform:"uppercase",marginBottom:6}}>Total en cuentas</div>
        <div style={{fontSize:34,fontWeight:"bold"}}>{fmt(r.total)}</div>
        <div style={{display:"flex",gap:10,marginTop:14}}>
          <div style={{flex:1,background:"rgba(255,255,255,0.1)",borderRadius:10,padding:"10px 12px"}}>
            <div style={{fontSize:10,opacity:.6,marginBottom:3}}>💼 Dinero clientes</div>
            <div style={{fontWeight:"bold",color:"#90caf9",fontSize:15}}>{fmt(r.dineroC)}</div>
          </div>
          <div style={{flex:1,background:"rgba(255,255,255,0.1)",borderRadius:10,padding:"10px 12px"}}>
            <div style={{fontSize:10,opacity:.6,marginBottom:3}}>✅ Disponible real</div>
            <div style={{fontWeight:"bold",color:r.disponible>=0?"#a5d6a7":"#ef9a9a",fontSize:15}}>{fmt(r.disponible)}</div>
          </div>
        </div>
      </div>

      {/* Meta de comisiones */}
      <div style={{...card,marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div style={{fontSize:12,fontWeight:"bold",color:C.navy}}>🎯 Meta de comisiones (mes)</div>
          <button onClick={()=>{setEditMeta(!editMeta);setMetaInput(metaMensual?.toString()||"");}} style={{...btnS(C.lblue,C.navy),padding:"4px 10px",fontSize:11}}>{editMeta?"Cancelar":"Editar"}</button>
        </div>
        {editMeta&&<div style={{display:"flex",gap:8,marginBottom:10}}>
          <input inputMode="decimal" value={metaInput} onChange={e=>setMetaInput(e.target.value)} placeholder="Meta en $" style={{...inp,flex:1}} />
          <button onClick={()=>{onSetMeta(parseFloat(metaInput)||0);setEditMeta(false);}} style={{...btnS(C.navy),padding:"8px 14px"}}>Guardar</button>
        </div>}
        <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:6}}>
          <span style={{color:C.gray}}>Este mes: {fmt(comMes)}</span>
          <span style={{color:C.navy,fontWeight:"bold"}}>{metaMensual>0?`Meta: ${fmt(metaMensual)}`:"Sin meta"}</span>
        </div>
        {metaMensual>0&&<>
          <div style={{background:C.lgray,borderRadius:20,height:10,overflow:"hidden"}}>
            <div style={{height:"100%",background:pctMeta>=100?C.green:C.blue,borderRadius:20,width:`${pctMeta}%`,transition:"width .5s"}} />
          </div>
          <div style={{fontSize:11,color:pctMeta>=100?C.green:C.gray,marginTop:4,textAlign:"right"}}>{pctMeta.toFixed(1)}% {pctMeta>=100?"🎉 ¡Meta alcanzada!":""}</div>
        </>}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
        {[["📥 Ingresos",fmt(r.ing),C.lgreen,C.green],["📤 Egresos",fmt(r.eg),C.lred,C.red],["💸 Comisiones",fmt(r.com),C.lgold,C.gold]].map(([l,v,bg,col])=>(
          <div key={l} style={{background:bg,borderRadius:11,padding:"12px 8px",textAlign:"center"}}>
            <div style={{fontSize:9,color:col,marginBottom:4}}>{l}</div>
            <div style={{fontWeight:"bold",fontSize:13,color:col}}>{v}</div>
          </div>
        ))}
      </div>

      <GraficaBarras movs={movs} cls={cls} ctas={ctas} />

      <div style={{fontSize:10,color:C.gray,letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>Saldo por cuenta</div>
      {ctas.length===0&&<div style={{color:C.gray,textAlign:"center",padding:20,fontSize:13}}>Sin cuentas — agrégalas en la sección Cuentas</div>}
      {ctas.map(c=>{
        const s=saldoCuenta(c,movs); const n=movs.filter(m=>m.cuentaId===c.id).length;
        return (
          <div key={c.id} style={{...card,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div><div style={{fontWeight:"bold",color:C.navy}}>🏦 {c.nombre}</div><div style={{fontSize:11,color:C.gray}}>{c.banco} · {n} mov.</div></div>
            <div style={{fontWeight:"bold",fontSize:17,color:s>=0?C.green:C.red}}>{fmt(s)}</div>
          </div>
        );
      })}
    </div>
  );
}

// ══ CLIENTES ══
function Clientes({ cls, movs, onAdd, onEdit, onDel }) {
  const [modal,setModal]=useState(null);
  const [detalle,setDetalle]=useState(null);

  if(detalle){
    const c=detalle;
    const cm=movs.filter(m=>m.clienteId===c.id);
    const s=saldoCliente(c,movs);
    const ing=cm.filter(m=>m.tipo==="ingreso").reduce((a,m)=>a+m.montoFinal,0);
    const eg=cm.filter(m=>m.tipo==="egreso").reduce((a,m)=>a+m.montoFinal,0);
    const com=cm.filter(m=>m.tipo==="ingreso").reduce((a,m)=>a+m.comision,0);
    return (
      <div>
        <button onClick={()=>setDetalle(null)} style={{...btnS(C.lgray,C.navy),marginBottom:14}}>← Volver</button>
        <div style={{...card,background:C.navy,color:"#fff"}}>
          <div style={{fontSize:18,fontWeight:"bold"}}>{c.nombre}</div>
          <div style={{opacity:.6,fontSize:12,marginTop:2}}>Comisión: {c.porcentajeComision}%</div>
          <div style={{fontSize:30,fontWeight:"bold",marginTop:10,color:s>=0?"#a5d6a7":"#ef9a9a"}}>{fmt(s)}</div>
          <div style={{fontSize:11,opacity:.6}}>Saldo actual</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
          {[["📥",fmt(ing),C.lgreen,C.green],["📤",fmt(eg),C.lred,C.red],["💸",fmt(com),C.lgold,C.gold]].map(([l,v,bg,col])=>(
            <div key={l} style={{background:bg,borderRadius:10,padding:"10px 8px",textAlign:"center"}}>
              <div style={{fontSize:16}}>{l}</div>
              <div style={{fontWeight:"bold",fontSize:12,color:col}}>{v}</div>
            </div>
          ))}
        </div>
        {[...cm].sort((a,b)=>b.fecha.localeCompare(a.fecha)).map(m=>{
          const mt=TIPO_META[m.tipo];
          return (
            <div key={m.id} style={{...card,display:"flex",gap:10,alignItems:"center"}}>
              <div style={{background:mt.bg,borderRadius:8,padding:"6px 8px",fontSize:16}}>{mt.emoji}</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:"bold",fontSize:13,color:C.navy}}>{m.concepto||"Sin concepto"}</div>
                <div style={{fontSize:11,color:C.gray}}>{fmtDate(m.fecha)}{m.categoria&&` · ${m.categoria}`}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontWeight:"bold",color:m.tipo==="egreso"?C.red:C.green}}>{fmt(m.montoFinal)}</div>
                {m.comision>0&&<div style={{fontSize:10,color:C.gold}}>com: {fmt(m.comision)}</div>}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div>
      <button onClick={()=>setModal("nuevo")} style={{...btnS(C.navy),width:"100%",marginBottom:14}}>+ Agregar cliente</button>
      {cls.length===0&&<div style={{color:C.gray,textAlign:"center",padding:30,fontSize:13}}>Sin clientes — agrega uno para empezar</div>}
      {cls.map(c=>{
        const s=saldoCliente(c,movs);
        const com=movs.filter(m=>m.clienteId===c.id&&m.tipo==="ingreso").reduce((a,m)=>a+m.comision,0);
        const alerta=s<0?"🔴":s<500&&movs.some(m=>m.clienteId===c.id)?"🟡":"🟢";
        return (
          <div key={c.id} style={{...card}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div style={{flex:1,cursor:"pointer"}} onClick={()=>setDetalle(c)}>
                <div style={{fontWeight:"bold",fontSize:15,color:C.navy}}>{alerta} {c.nombre}</div>
                <div style={{fontSize:11,color:C.gray,marginTop:2}}>
                  <span style={{background:C.lblue,color:C.navy,borderRadius:20,padding:"2px 8px",fontSize:10,fontWeight:"bold"}}>{c.porcentajeComision}%</span>
                  <span style={{marginLeft:8}}>Com: {fmt(com)}</span>
                </div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontWeight:"bold",fontSize:16,color:s>=0?C.green:C.red}}>{fmt(s)}</div>
                <div style={{display:"flex",gap:6,marginTop:6,justifyContent:"flex-end"}}>
                  <button onClick={()=>setModal(c)} style={{...btnS(C.lblue,C.navy),padding:"4px 10px",fontSize:11}}>Editar</button>
                  <button onClick={()=>{if(window.confirm(`¿Eliminar a ${c.nombre}?\nSaldo: ${fmt(s)}`))onDel(c.id);}} style={{...btnS(C.lred,C.red),padding:"4px 10px",fontSize:11}}>Eliminar</button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
      {modal&&<Modal title={modal==="nuevo"?"Nuevo cliente":`Editar: ${modal.nombre}`} onClose={()=>setModal(null)}>
        <FormCliente ini={modal==="nuevo"?null:modal} onSave={c=>{modal==="nuevo"?onAdd(c):onEdit(c);setModal(null);}} />
      </Modal>}
    </div>
  );
}

// ══ CUENTAS ══
function Cuentas({ ctas, movs, onAdd, onEdit, onDel, onConciliar }) {
  const [modal,setModal]=useState(null);
  const [conciliar,setConciliar]=useState(null);
  const [saldoBanco,setSaldoBanco]=useState("");

  return (
    <div>
      <button onClick={()=>setModal("nueva")} style={{...btnS(C.navy),width:"100%",marginBottom:14}}>+ Agregar cuenta</button>
      {ctas.length===0&&<div style={{color:C.gray,textAlign:"center",padding:30,fontSize:13}}>Sin cuentas — agrega una para empezar</div>}
      {ctas.map(c=>{
        const s=saldoCuenta(c,movs); const n=movs.filter(m=>m.cuentaId===c.id).length;
        return (
          <div key={c.id} style={{...card}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div><div style={{fontWeight:"bold",fontSize:15,color:C.navy}}>🏦 {c.nombre}</div><div style={{fontSize:12,color:C.gray}}>{c.banco} · {n} movimientos</div></div>
              <div style={{fontWeight:"bold",fontSize:18,color:s>=0?C.green:C.red}}>{fmt(s)}</div>
            </div>
            <div style={{display:"flex",gap:6,marginTop:10}}>
              <button onClick={()=>setModal(c)} style={{...btnS(C.lblue,C.navy),padding:"5px 12px",fontSize:11}}>Editar</button>
              <button onClick={()=>{setConciliar(c);setSaldoBanco("");}} style={{...btnS(C.lgold,C.gold),padding:"5px 12px",fontSize:11}}>Conciliar</button>
              <button onClick={()=>{if(window.confirm(`¿Eliminar ${c.nombre}?\nSaldo actual: ${fmt(s)}`))onDel(c.id);}} style={{...btnS(C.lred,C.red),padding:"5px 12px",fontSize:11}}>Eliminar</button>
            </div>
          </div>
        );
      })}
      {modal&&<Modal title={modal==="nueva"?"Nueva cuenta":`Editar: ${modal.nombre}`} onClose={()=>setModal(null)}>
        <FormCuenta ini={modal==="nueva"?null:modal} onSave={c=>{modal==="nueva"?onAdd(c):onEdit(c);setModal(null);}} />
      </Modal>}
      {conciliar&&(()=>{
        const s=saldoCuenta(conciliar,movs);
        const real=parseFloat(saldoBanco)||0;
        const dif=real-s;
        return (
          <Modal title={`Conciliar: ${conciliar.nombre}`} onClose={()=>setConciliar(null)}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:12,padding:"10px 14px",background:C.xblue,borderRadius:10}}>
              <span style={{color:C.gray}}>Saldo en app</span>
              <span style={{fontWeight:"bold",color:C.navy}}>{fmt(s)}</span>
            </div>
            <span style={lbl}>Saldo real en banco ($)</span>
            <input inputMode="decimal" placeholder="0.00" value={saldoBanco} onChange={e=>setSaldoBanco(e.target.value)} style={{...inp,marginBottom:12}} />
            {saldoBanco&&<div style={{background:Math.abs(dif)<0.01?C.lgreen:C.lred,borderRadius:10,padding:"12px 14px",marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <span style={{fontWeight:"bold",color:dif>=0?C.green:C.red}}>Diferencia</span>
                <span style={{fontWeight:"bold",fontSize:18,color:dif>=0?C.green:C.red}}>{fmt(dif)}</span>
              </div>
              {Math.abs(dif)<0.01&&<div style={{fontSize:12,color:C.green,marginTop:4}}>✅ Todo cuadrado</div>}
            </div>}
            {saldoBanco&&Math.abs(dif)>0.01&&<button onClick={()=>{onConciliar({id:uid(),tipo:"ajuste",clienteId:null,cuentaId:conciliar.id,concepto:`Ajuste conciliación (${conciliar.nombre})`,categoria:"Bancario",notas:`Banco: ${fmt(real)} · App: ${fmt(s)}`,fecha:today(),estado:"confirmado",montoOriginal:Math.abs(dif),montoSinIVA:0,comision:0,montoFinal:dif,revisado:false,historial:[]});setConciliar(null);}} style={{...btnS(C.navy),width:"100%",padding:12}}>Crear ajuste automático ({fmt(Math.abs(dif))})</button>}
          </Modal>
        );
      })()}
    </div>
  );
}

// ══ MOVIMIENTOS ══
function Movimientos({ cls, ctas, movs, onAdd, onEdit, onDel, clientesRecientes, onUpdateRecientes }) {
  const [modal,setModal]=useState(null);
  const [buscar,setBuscar]=useState("");
  const [f,setF]=useState({tipo:"",clienteId:"",cuentaId:"",fecha:""});

  const filtrados=useMemo(()=>movs.filter(m=>{
    if(f.tipo&&m.tipo!==f.tipo) return false;
    if(f.clienteId&&m.clienteId!==f.clienteId) return false;
    if(f.cuentaId&&m.cuentaId!==f.cuentaId) return false;
    if(f.fecha&&m.fecha!==f.fecha) return false;
    if(buscar&&!(m.concepto||"").toLowerCase().includes(buscar.toLowerCase())) return false;
    return true;
  }).sort((a,b)=>b.fecha.localeCompare(a.fecha)),[movs,f,buscar]);

  function handleAdd(m){
    onAdd(m);
    if(m.clienteId) onUpdateRecientes(m.clienteId);
  }
  function handleEdit(m){
    const orig=movs.find(x=>x.id===m.id);
    const hist=[...(orig?.historial||[]),{fecha:new Date().toISOString(),cambio:`Editado: ${fmt(orig?.montoOriginal)}→${fmt(m.montoOriginal)}`}];
    onEdit({...m,historial:hist});
    if(m.clienteId) onUpdateRecientes(m.clienteId);
  }

  return (
    <div>
      <button onClick={()=>setModal("nuevo")} style={{...btnS(C.navy),width:"100%",marginBottom:12}}>+ Registrar movimiento</button>

      {/* Búsqueda */}
      <input value={buscar} onChange={e=>setBuscar(e.target.value)} placeholder="🔍 Buscar por concepto..." style={{...inp,marginBottom:10}} />

      {/* Filtros tipo */}
      <div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap"}}>
        {["ingreso","egreso","ajuste"].map(t=>{
          const mt=TIPO_META[t];
          return <button key={t} onClick={()=>setF(p=>({...p,tipo:p.tipo===t?"":t}))} style={{padding:"5px 12px",borderRadius:20,border:`1.5px solid ${f.tipo===t?mt.color:C.border}`,background:f.tipo===t?mt.bg:C.white,color:f.tipo===t?mt.color:C.gray,fontSize:12,cursor:"pointer",fontWeight:f.tipo===t?"bold":"normal"}}>{mt.emoji} {mt.label}</button>;
        })}
        {(f.tipo||f.clienteId||f.cuentaId||f.fecha||buscar)&&<button onClick={()=>{setF({tipo:"",clienteId:"",cuentaId:"",fecha:""});setBuscar("");}} style={{padding:"5px 12px",borderRadius:20,border:`1.5px solid ${C.red}`,background:C.lred,color:C.red,fontSize:12,cursor:"pointer"}}>✕ Limpiar</button>}
      </div>
      <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
        <select value={f.clienteId} onChange={e=>setF(p=>({...p,clienteId:e.target.value}))} style={{...inp,flex:1,marginBottom:0,fontSize:11}}>
          <option value="">Todos los clientes</option>
          {cls.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <select value={f.cuentaId} onChange={e=>setF(p=>({...p,cuentaId:e.target.value}))} style={{...inp,flex:1,marginBottom:0,fontSize:11}}>
          <option value="">Todas las cuentas</option>
          {ctas.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <input type="date" value={f.fecha} onChange={e=>setF(p=>({...p,fecha:e.target.value}))} style={{...inp,flex:1,marginBottom:0,fontSize:11}} />
      </div>

      <div style={{fontSize:11,color:C.gray,marginBottom:8}}>{filtrados.length} movimiento{filtrados.length!==1?"s":""}</div>
      {filtrados.length===0&&<div style={{color:C.gray,textAlign:"center",padding:30,fontSize:13}}>Sin movimientos</div>}
      {filtrados.map(m=>{
        const mt=TIPO_META[m.tipo];
        const cli=cls.find(c=>c.id===m.clienteId);
        const cta=ctas.find(c=>c.id===m.cuentaId);
        return (
          <div key={m.id} style={{...card,opacity:m.revisado?.5:1,borderLeft:m.revisado?`3px solid ${C.green}`:"none"}}>
            <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
              <div style={{background:mt.bg,borderRadius:8,padding:"6px 8px",fontSize:16,flexShrink:0}}>{mt.emoji}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:"bold",fontSize:14,color:C.navy}}>{m.concepto||"Sin concepto"}</div>
                    <div style={{fontSize:11,color:C.gray,marginTop:2}}>{cta?.nombre}{cli&&` · ${cli.nombre}`} · {fmtDate(m.fecha)}{m.categoria&&` · ${m.categoria}`}</div>
                    <div style={{display:"flex",gap:4,marginTop:3,flexWrap:"wrap"}}>
                      {m.estado==="pendiente"&&<span style={{background:"#fff3e0",color:C.gold,borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:"bold"}}>Pendiente</span>}
                      {m.revisado&&<span style={{background:C.lgreen,color:C.green,borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:"bold"}}>✓ Revisado</span>}
                      {(m.historial?.length>0)&&<span style={{background:C.lgray,color:C.gray,borderRadius:20,padding:"1px 8px",fontSize:10}}>Editado {m.historial.length}x</span>}
                    </div>
                  </div>
                  <div style={{textAlign:"right",marginLeft:8,flexShrink:0}}>
                    <div style={{fontWeight:"bold",color:m.tipo==="egreso"?C.red:m.tipo==="ajuste"?C.gold:C.green}}>{fmt(m.montoFinal)}</div>
                    {m.comision>0&&<div style={{fontSize:10,color:C.gold}}>com: {fmt(m.comision)}</div>}
                  </div>
                </div>
                <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
                  <button onClick={()=>setModal(m)} style={{...btnS(C.lblue,C.navy),padding:"4px 10px",fontSize:11}}>Editar</button>
                  <button onClick={()=>{ const clon={...m,id:uid(),concepto:(m.concepto||"")+" (copia)",historial:[],revisado:false}; onAdd(clon); }} style={{...btnS(C.lgold,C.gold),padding:"4px 10px",fontSize:11}}>Duplicar</button>
                  <button onClick={()=>onEdit({...m,revisado:!m.revisado})} style={{...btnS(m.revisado?C.lgray:C.lgreen,m.revisado?C.gray:C.green),padding:"4px 10px",fontSize:11}}>{m.revisado?"Sin revisar":"✓ Revisar"}</button>
                  <button onClick={()=>{if(window.confirm(`¿Eliminar este movimiento?\n${m.concepto||"Sin concepto"} · ${fmt(m.montoFinal)}`))onDel(m.id);}} style={{...btnS(C.lred,C.red),padding:"4px 10px",fontSize:11}}>Eliminar</button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
      {modal&&<Modal title={modal==="nuevo"?"Nuevo movimiento":"Editar movimiento"} onClose={()=>setModal(null)}>
        <FormMov cls={cls} ctas={ctas} ini={modal==="nuevo"?null:modal} clientesRecientes={clientesRecientes} onSave={m=>{ modal==="nuevo"?handleAdd(m):handleEdit(m); setModal(null); }} onClose={()=>setModal(null)} />
      </Modal>}
    </div>
  );
}

// ══ REPORTES ══
function Reportes({ cls, ctas, movs }) {
  const [rango,setRango]=useState("hoy");
  const [desde,setDesde]=useState(today());
  const [hasta,setHasta]=useState(today());

  const {d,h}=useMemo(()=>{
    const t=today(); const now=new Date();
    if(rango==="hoy") return {d:t,h:t};
    if(rango==="semana"){const l=new Date(now);l.setDate(now.getDate()-((now.getDay()+6)%7));return{d:l.toISOString().slice(0,10),h:t};}
    if(rango==="mes") return{d:`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`,h:t};
    return{d:desde,h:hasta};
  },[rango,desde,hasta]);

  const mr=movs.filter(m=>m.fecha>=d&&m.fecha<=h);
  const ing=mr.filter(m=>m.tipo==="ingreso").reduce((a,m)=>a+m.montoFinal,0);
  const eg=mr.filter(m=>m.tipo==="egreso").reduce((a,m)=>a+m.montoFinal,0);
  const com=mr.filter(m=>m.tipo==="ingreso").reduce((a,m)=>a+m.comision,0);

  // Comparativo mes anterior
  const now=new Date();
  const mesAnterior=new Date(now.getFullYear(),now.getMonth()-1,1);
  const maDesde=`${mesAnterior.getFullYear()}-${String(mesAnterior.getMonth()+1).padStart(2,"0")}-01`;
  const maHasta=`${mesAnterior.getFullYear()}-${String(mesAnterior.getMonth()+1).padStart(2,"0")}-${new Date(now.getFullYear(),now.getMonth(),0).getDate().toString().padStart(2,"0")}`;
  const comMesAnt=movs.filter(m=>m.fecha>=maDesde&&m.fecha<=maHasta&&m.tipo==="ingreso").reduce((a,m)=>a+m.comision,0);
  const mesActual=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const comMesAct=movs.filter(m=>m.fecha.startsWith(mesActual)&&m.tipo==="ingreso").reduce((a,m)=>a+m.comision,0);
  const difCom=comMesAnt>0?((comMesAct-comMesAnt)/comMesAnt)*100:0;

  const saldosCta=ctas.map(c=>{
    const cm=movs.filter(m=>m.cuentaId===c.id&&m.fecha<=h);
    const i=cm.filter(m=>m.tipo==="ingreso").reduce((a,m)=>a+m.montoFinal,0);
    const e=cm.filter(m=>m.tipo==="egreso").reduce((a,m)=>a+m.montoFinal,0);
    const a=cm.filter(m=>m.tipo==="ajuste").reduce((a,m)=>a+m.montoFinal,0);
    return{...c,saldo:(c.saldoInicial||0)+i-e+a};
  });

  return (
    <div>
      <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
        {[["hoy","Hoy"],["semana","Semana"],["mes","Mes"],["personalizado","Rango"]].map(([k,l])=>(
          <button key={k} onClick={()=>setRango(k)} style={{padding:"7px 14px",borderRadius:20,border:`1.5px solid ${rango===k?C.navy:C.border}`,background:rango===k?C.navy:C.white,color:rango===k?"#fff":C.gray,fontSize:12,cursor:"pointer",fontWeight:rango===k?"bold":"normal"}}>{l}</button>
        ))}
      </div>
      {rango==="personalizado"&&<div style={{display:"flex",gap:8,marginBottom:12}}>
        <input type="date" value={desde} onChange={e=>setDesde(e.target.value)} style={{...inp,marginBottom:0,flex:1}} />
        <input type="date" value={hasta} onChange={e=>setHasta(e.target.value)} style={{...inp,marginBottom:0,flex:1}} />
      </div>}

      <div style={{...card,background:C.navy,color:"#fff",marginBottom:12}}>
        <div style={{fontSize:10,opacity:.6,letterSpacing:2,textTransform:"uppercase",marginBottom:10}}>Resumen del período</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {[["📥 Ingresos",fmt(ing),"#a5d6a7"],["📤 Egresos",fmt(eg),"#ef9a9a"],["💸 Comisiones",fmt(com),"#fff176"],["📋 Movimientos",mr.length,"#90caf9"]].map(([l,v,col])=>(
            <div key={l} style={{background:"rgba(255,255,255,0.08)",borderRadius:10,padding:"10px 12px"}}>
              <div style={{fontSize:10,opacity:.6,marginBottom:3}}>{l}</div>
              <div style={{fontWeight:"bold",color:col,fontSize:15}}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Comparativo de comisiones */}
      <div style={{...card,marginBottom:12}}>
        <div style={{fontSize:12,fontWeight:"bold",color:C.navy,marginBottom:10}}>📊 Comisiones: mes actual vs anterior</div>
        <div style={{display:"flex",gap:10}}>
          <div style={{flex:1,background:C.lgold,borderRadius:10,padding:"10px 12px",textAlign:"center"}}>
            <div style={{fontSize:10,color:C.gold,marginBottom:4}}>Mes anterior</div>
            <div style={{fontWeight:"bold",color:C.gold,fontSize:14}}>{fmt(comMesAnt)}</div>
          </div>
          <div style={{flex:1,background:C.lgreen,borderRadius:10,padding:"10px 12px",textAlign:"center"}}>
            <div style={{fontSize:10,color:C.green,marginBottom:4}}>Mes actual</div>
            <div style={{fontWeight:"bold",color:C.green,fontSize:14}}>{fmt(comMesAct)}</div>
          </div>
        </div>
        {comMesAnt>0&&<div style={{marginTop:8,fontSize:12,textAlign:"center",color:difCom>=0?C.green:C.red,fontWeight:"bold"}}>
          {difCom>=0?"▲":"▼"} {Math.abs(difCom).toFixed(1)}% vs mes anterior
        </div>}
      </div>

      <div style={{fontSize:10,color:C.gray,letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>Saldos acumulados por cuenta (hasta {fmtDate(h)})</div>
      {saldosCta.map(c=>(
        <div key={c.id} style={{...card,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div style={{fontWeight:"bold",color:C.navy}}>🏦 {c.nombre}</div><div style={{fontSize:11,color:C.gray}}>{c.banco}</div></div>
          <div style={{fontWeight:"bold",fontSize:16,color:c.saldo>=0?C.green:C.red}}>{fmt(c.saldo)}</div>
        </div>
      ))}
    </div>
  );
}

// ══ CIERRES ══
function Cierres({ cls, ctas, movs, cierres, onCerrar }) {
  const [detalle,setDetalle]=useState(null);
  const [notasCierre,setNotasCierre]=useState("");
  const r=resumenTotal(cls,ctas,movs);

  function cerrar(){
    if(!window.confirm("¿Cerrar el día? Se guardará un snapshot fijo del estado actual.")) return;
    const hoy=today();
    const mh=movs.filter(m=>m.fecha===hoy);
    onCerrar({id:uid(),fecha:hoy,totalEnCuentas:r.total,dineroClientes:r.dineroC,dineroDisponible:r.disponible,ingresosDelDia:mh.filter(m=>m.tipo==="ingreso").reduce((a,m)=>a+m.montoFinal,0),egresosDelDia:mh.filter(m=>m.tipo==="egreso").reduce((a,m)=>a+m.montoFinal,0),comisionesDelDia:mh.filter(m=>m.tipo==="ingreso").reduce((a,m)=>a+m.comision,0),numeroMovimientos:mh.length,saldosPorCuenta:ctas.map(c=>({nombre:c.nombre,banco:c.banco,saldo:saldoCuenta(c,movs)})),notas:notasCierre,fechaCreacion:new Date().toISOString()});
    setNotasCierre("");
  }

  if(detalle) return (
    <div>
      <button onClick={()=>setDetalle(null)} style={{...btnS(C.lgray,C.navy),marginBottom:14}}>← Volver</button>
      <div style={{...card,background:C.navy,color:"#fff"}}>
        <div style={{fontSize:10,opacity:.6,letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>Cierre del día</div>
        <div style={{fontSize:22,fontWeight:"bold"}}>{fmtDate(detalle.fecha)}</div>
        <div style={{fontSize:30,fontWeight:"bold",color:"#a5d6a7",marginTop:8}}>{fmt(detalle.totalEnCuentas)}</div>
        <div style={{fontSize:11,opacity:.6}}>Total en cuentas</div>
      </div>
      {[["📥 Ingresos del día",fmt(detalle.ingresosDelDia),C.lgreen,C.green],["📤 Egresos del día",fmt(detalle.egresosDelDia),C.lred,C.red],["💸 Comisiones",fmt(detalle.comisionesDelDia),C.lgold,C.gold],["💼 Dinero clientes",fmt(detalle.dineroClientes),C.lblue,C.blue],["✅ Disponible real",fmt(detalle.dineroDisponible),C.lgreen,C.green],["📋 Movimientos",detalle.numeroMovimientos,C.lgray,C.gray]].map(([l,v,bg,col])=>(
        <div key={l} style={{...card,display:"flex",justifyContent:"space-between"}}>
          <span style={{color:C.gray,fontSize:14}}>{l}</span>
          <span style={{fontWeight:"bold",color:col}}>{v}</span>
        </div>
      ))}
      {detalle.notas&&<div style={{...card,background:C.lgold,borderLeft:`4px solid ${C.gold}`}}>
        <div style={{fontSize:11,color:C.gold,fontWeight:"bold",marginBottom:4}}>📝 Notas</div>
        <div style={{fontSize:13,color:"#5d4037"}}>{detalle.notas}</div>
      </div>}
      <div style={{fontSize:10,color:C.gray,letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>Saldos por cuenta</div>
      {detalle.saldosPorCuenta.map((c,i)=>(
        <div key={i} style={{...card,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div style={{fontWeight:"bold",color:C.navy}}>🏦 {c.nombre}</div><div style={{fontSize:11,color:C.gray}}>{c.banco}</div></div>
          <div style={{fontWeight:"bold",color:c.saldo>=0?C.green:C.red}}>{fmt(c.saldo)}</div>
        </div>
      ))}
    </div>
  );

  return (
    <div>
      <div style={{...card,background:C.lgray,borderLeft:`4px solid ${C.navy}`}}>
        <div style={{fontWeight:"bold",color:C.navy,marginBottom:8}}>Estado actual</div>
        {[["Total en cuentas",fmt(r.total),C.navy],["Dinero clientes",fmt(r.dineroC),C.blue],["Disponible real",fmt(r.disponible),r.disponible>=0?C.green:C.red]].map(([l,v,col])=>(
          <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:4}}>
            <span style={{color:C.gray}}>{l}</span>
            <span style={{fontWeight:"bold",color:col}}>{v}</span>
          </div>
        ))}
      </div>
      <span style={lbl}>Notas del cierre (opcional)</span>
      <input value={notasCierre} onChange={e=>setNotasCierre(e.target.value)} placeholder="Observaciones del día..." style={{...inp,marginBottom:12}} />
      <button onClick={cerrar} style={{...btnS(C.navy),width:"100%",padding:14,fontSize:15,marginBottom:18}}>🔒 Cerrar día</button>
      <div style={{fontSize:10,color:C.gray,letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>Historial ({cierres.length})</div>
      {cierres.length===0&&<div style={{color:C.gray,textAlign:"center",padding:20,fontSize:13}}>Sin cierres registrados</div>}
      {[...cierres].reverse().map(c=>(
        <div key={c.id} style={{...card,cursor:"pointer"}} onClick={()=>setDetalle(c)}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div><div style={{fontWeight:"bold",color:C.navy}}>{fmtDate(c.fecha)}</div><div style={{fontSize:11,color:C.gray}}>{c.numeroMovimientos} movimientos · Com: {fmt(c.comisionesDelDia)}</div></div>
            <div style={{textAlign:"right"}}><div style={{fontWeight:"bold",color:C.green}}>{fmt(c.totalEnCuentas)}</div><div style={{fontSize:11,color:C.gray}}>›</div></div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ══ APP PRINCIPAL ══
const TABS=[
  {key:"resumen",    label:"Resumen",    emoji:"📊"},
  {key:"movimientos",label:"Movimientos",emoji:"📝"},
  {key:"clientes",   label:"Clientes",   emoji:"👤"},
  {key:"cuentas",    label:"Cuentas",    emoji:"🏦"},
  {key:"reportes",   label:"Reportes",   emoji:"📈"},
  {key:"cierres",    label:"Cierres",    emoji:"🔒"},
];

export default function App() {
  const [tab,setTab]=useState("resumen");
  const [cls,setCls]=useState(()=>load(KEYS.cls,[]));
  const [ctas,setCtas]=useState(()=>load(KEYS.ctas,[]));
  const [movs,setMovs]=useState(()=>load(KEYS.movs,[]));
  const [cierres,setCierres]=useState(()=>load(KEYS.cierres,[]));
  const [meta,setMeta]=useState(()=>load(KEYS.meta,0));
  const [recientes,setRecientes]=useState([]);

  // Auto-guardar
  useEffect(()=>save(KEYS.cls,cls),[cls]);
  useEffect(()=>save(KEYS.ctas,ctas),[ctas]);
  useEffect(()=>save(KEYS.movs,movs),[movs]);
  useEffect(()=>save(KEYS.cierres,cierres),[cierres]);
  useEffect(()=>save(KEYS.meta,meta),[meta]);

  function updateRecientes(clienteId){
    setRecientes(p=>{const f=p.filter(x=>x!==clienteId);return [clienteId,...f].slice(0,3);});
  }

  return (
    <div style={{fontFamily:"Georgia,serif",minHeight:"100vh",background:"#f7f3ee",paddingBottom:80}}>
      <div style={{background:C.navy,padding:"16px 16px 12px",color:"#fff",position:"sticky",top:0,zIndex:10,boxShadow:"0 2px 8px rgba(0,0,0,0.2)"}}>
        <div style={{fontSize:9,letterSpacing:4,opacity:.5,textTransform:"uppercase"}}>Control Financiero</div>
        <div style={{fontSize:20,fontWeight:"bold",marginTop:2}}>{TABS.find(t=>t.key===tab)?.emoji} {TABS.find(t=>t.key===tab)?.label}</div>
      </div>

      <div style={{padding:"14px 12px",maxWidth:620,margin:"0 auto"}}>
        {tab==="resumen"     && <Resumen cls={cls} ctas={ctas} movs={movs} metaMensual={meta} onSetMeta={setMeta} />}
        {tab==="movimientos" && <Movimientos cls={cls} ctas={ctas} movs={movs} onAdd={m=>setMovs(p=>[...p,m])} onEdit={m=>setMovs(p=>p.map(x=>x.id===m.id?m:x))} onDel={id=>setMovs(p=>p.filter(x=>x.id!==id))} clientesRecientes={recientes} onUpdateRecientes={updateRecientes} />}
        {tab==="clientes"    && <Clientes cls={cls} movs={movs} onAdd={c=>setCls(p=>[...p,c])} onEdit={c=>setCls(p=>p.map(x=>x.id===c.id?c:x))} onDel={id=>setCls(p=>p.filter(x=>x.id!==id))} />}
        {tab==="cuentas"     && <Cuentas ctas={ctas} movs={movs} onAdd={c=>setCtas(p=>[...p,c])} onEdit={c=>setCtas(p=>p.map(x=>x.id===c.id?c:x))} onDel={id=>setCtas(p=>p.filter(x=>x.id!==id))} onConciliar={m=>setMovs(p=>[...p,m])} />}
        {tab==="reportes"    && <Reportes cls={cls} ctas={ctas} movs={movs} />}
        {tab==="cierres"     && <Cierres cls={cls} ctas={ctas} movs={movs} cierres={cierres} onCerrar={c=>setCierres(p=>[...p,c])} />}
      </div>

      <div style={{position:"fixed",bottom:0,left:0,right:0,background:C.white,borderTop:`1px solid ${C.border}`,display:"flex",zIndex:20,boxShadow:"0 -2px 8px rgba(0,0,0,0.06)"}}>
        {TABS.map(t=>(
          <button key={t.key} onClick={()=>setTab(t.key)} style={{flex:1,padding:"9px 0 7px",border:"none",background:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
            <span style={{fontSize:17}}>{t.emoji}</span>
            <span style={{fontSize:9,color:tab===t.key?C.navy:C.gray,fontWeight:tab===t.key?"bold":"normal",letterSpacing:.5}}>{t.label}</span>
            {tab===t.key&&<div style={{width:20,height:2,background:C.navy,borderRadius:2}} />}
          </button>
        ))}
      </div>
    </div>
  );
}

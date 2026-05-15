import { useState, useMemo, useEffect, useRef } from "react";

// ══ STORAGE ══
const KEYS = { cls:"fin_clientes",ctas:"fin_cuentas",movs:"fin_movimientos",cierres:"fin_cierres",meta:"fin_meta",dark:"fin_dark",pin:"fin_pin",locked:"fin_locked" };
function load(key,def){try{const v=localStorage.getItem(key);return v?JSON.parse(v):def;}catch{return def;}}
function save(key,val){try{localStorage.setItem(key,JSON.stringify(val));}catch{}}

// ══ UTILS ══
const uid=()=>Math.random().toString(36).slice(2,10);
const fmt=n=>isNaN(n)?"$0.00":new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN"}).format(n||0);
const fmtDate=d=>new Date(d+"T12:00:00").toLocaleDateString("es-MX",{day:"2-digit",month:"2-digit",year:"numeric"});
const fmtShort=d=>new Date(d+"T12:00:00").toLocaleDateString("es-MX",{day:"2-digit",month:"short"});
const today=()=>{const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;};
const BANCOS=["Cruco Banorte","Cruco Afirme","Colpi Afirme"];
const CATEGORIAS=["Operación","Nómina","Proveedor","Bancario"];
const TIPO_META={ingreso:{emoji:"📥",bg:"#e8f5e9",color:"#2e7d32",label:"Ingreso"},egreso:{emoji:"📤",bg:"#fce4ec",color:"#c62828",label:"Egreso"},ajuste:{emoji:"⚖️",bg:"#fff8e1",color:"#f57f17",label:"Ajuste"},transferencia:{emoji:"🔄",bg:"#ede7f6",color:"#6a1b9a",label:"Transferencia"}};

// ══ TEMA ══
const LIGHT={navy:"#1a3a5c",blue:"#2e6da4",lblue:"#e8f0fb",xblue:"#f0f5fb",green:"#2e7d32",lgreen:"#e8f5e9",red:"#c62828",lred:"#fce4ec",gold:"#f57f17",lgold:"#fff8e1",gray:"#888",lgray:"#f5f5f5",border:"#e0e0e0",white:"#fff",bg:"#f7f3ee",cardBg:"#fff",text:"#1a1a1a"};
const DARK={navy:"#90caf9",blue:"#64b5f6",lblue:"#1e2a3a",xblue:"#1a2233",green:"#81c784",lgreen:"#1a2e1a",red:"#ef9a9a",lred:"#2e1a1a",gold:"#ffd54f",lgold:"#2e2a1a",gray:"#aaa",lgray:"#2a2a2a",border:"#333",white:"#1e1e1e",bg:"#121212",cardBg:"#1e1e1e",text:"#f0f0f0"};

// ══ LÓGICA ══
function calcMov(monto,tipo,cliente,banco,esNomina){
  const m=parseFloat(monto)||0;
  if(tipo!=="ingreso"||!cliente||!banco)return{montoSinIVA:0,comision:0,montoFinal:m,pct:0};
  const config=(cliente.bancos||[]).find(b=>b.banco===banco);
  const pct=config?config.porcentaje:0;
  const base=esNomina?m:m/1.16;
  const comision=base*(pct/100);
  return{montoSinIVA:esNomina?m:m/1.16,comision,montoFinal:m-comision,pct};
}
function saldoCliente(c,movs){
  const cm=movs.filter(m=>m.clienteId===c.id);
  return(c.saldoInicial||0)+cm.filter(m=>m.tipo==="ingreso").reduce((a,m)=>a+m.montoFinal,0)-cm.filter(m=>m.tipo==="egreso").reduce((a,m)=>a+m.montoFinal,0)-cm.filter(m=>m.tipo==="ingreso").reduce((a,m)=>a+m.comision,0)+cm.filter(m=>m.tipo==="ajuste").reduce((a,m)=>a+m.montoFinal,0);
}
function saldoCuenta(c,movs){
  const cm=movs.filter(m=>m.cuentaId===c.id);
  const transferSalida=movs.filter(m=>m.tipo==="transferencia"&&m.cuentaOrigenId===c.id).reduce((a,m)=>a+m.montoFinal,0);
  const transferEntrada=movs.filter(m=>m.tipo==="transferencia"&&m.cuentaDestinoId===c.id).reduce((a,m)=>a+m.montoFinal,0);
  // Las comisiones SE QUEDAN en la cuenta — solo se restan del saldo del cliente
  return(c.saldoInicial||0)
    +cm.filter(m=>m.tipo==="ingreso").reduce((a,m)=>a+m.montoOriginal,0) // monto completo, sin restar comisión
    -cm.filter(m=>m.tipo==="egreso").reduce((a,m)=>a+m.montoFinal,0)
    +cm.filter(m=>m.tipo==="ajuste").reduce((a,m)=>a+m.montoFinal,0)
    -transferSalida+transferEntrada;
}
function resumenTotal(cls,ctas,movs){
  const total=ctas.reduce((a,c)=>a+saldoCuenta(c,movs),0);
  // Dinero de clientes = suma de saldos de clientes (lo que les pertenece a ellos)
  const dineroC=cls.reduce((a,c)=>a+Math.max(saldoCliente(c,movs),0),0);
  // Disponible real = total en cuentas - dinero de clientes = tus comisiones + otros ingresos sin cliente
  const ing=movs.filter(m=>m.tipo==="ingreso").reduce((a,m)=>a+m.montoOriginal,0);
  const eg=movs.filter(m=>m.tipo==="egreso").reduce((a,m)=>a+m.montoFinal,0);
  const com=movs.filter(m=>m.tipo==="ingreso").reduce((a,m)=>a+m.comision,0);
  return{total,dineroC,disponible:total-dineroC,ing,eg,com};
}

// ══ LOGIN ══
function Login({onLogin,C}){
  const [savedPin,setSavedPin]=useState(()=>load(KEYS.pin,""));
  const [mode,setMode]=useState(savedPin?"login":"setup");
  const [fase,setFase]=useState("ingresar"); // "ingresar" | "confirmar"
  const [pin,setPin]=useState("");
  const [confirm,setConfirm]=useState("");
  const [err,setErr]=useState("");

  const valorActual = fase==="confirmar" ? confirm : pin;
  const setValorActual = fase==="confirmar" ? setConfirm : setPin;

  function presionar(n){
    if(valorActual.length>=6) return;
    setValorActual(p=>p+n.toString());
    setErr("");
  }
  function borrar(){ setValorActual(p=>p.slice(0,-1)); }

  function handleContinuar(){
    if(pin.length<4) return setErr("Mínimo 4 dígitos");
    setFase("confirmar");
    setErr("");
  }
  function handleSetup(){
    if(confirm.length<4) return setErr("Mínimo 4 dígitos");
    if(pin!==confirm) return setErr("Los PINs no coinciden — intenta de nuevo");
    save(KEYS.pin,pin); onLogin();
  }
  function handleLogin(){
    if(pin===savedPin){ save(KEYS.locked,false); onLogin(); }
    else{ setErr("PIN incorrecto"); setPin(""); }
  }

  const titulo = mode==="login" ? "Ingresa tu PIN" : fase==="ingresar" ? "Crea tu PIN (4-6 dígitos)" : "Confirma tu PIN";

  return(
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{fontSize:44,marginBottom:8}}>🔐</div>
      <div style={{fontSize:22,fontWeight:"bold",color:C.navy,marginBottom:4}}>Control Financiero</div>
      <div style={{fontSize:13,color:C.gray,marginBottom:28,textAlign:"center"}}>{titulo}</div>

      {/* Puntos */}
      <div style={{display:"flex",gap:14,marginBottom:28}}>
        {[0,1,2,3,4,5].map(i=>(
          <div key={i} style={{width:16,height:16,borderRadius:8,background:valorActual.length>i?C.navy:C.border,transition:"background .15s"}} />
        ))}
      </div>

      {/* Teclado — SIEMPRE visible */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
        {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((n,i)=>(
          <button key={i} onClick={()=>{ if(n==="⌫") borrar(); else if(n!=="") presionar(n); }}
            style={{width:68,height:68,borderRadius:34,border:`1.5px solid ${C.border}`,background:n==="⌫"?C.lred:n===""?"transparent":C.cardBg,fontSize:n==="⌫"?18:22,fontWeight:"bold",color:n==="⌫"?C.red:C.text,cursor:n===""?"default":"pointer",boxShadow:n===""?"none":"0 2px 6px rgba(0,0,0,0.08)",visibility:n===""?"hidden":"visible"}}>
            {n}
          </button>
        ))}
      </div>

      {err&&<div style={{color:C.red,fontSize:13,marginTop:14,padding:"8px 16px",background:C.lred,borderRadius:8,textAlign:"center"}}>{err}</div>}

      <div style={{marginTop:20,display:"flex",flexDirection:"column",gap:10,width:"100%",maxWidth:240}}>
        {/* Login */}
        {mode==="login"&&pin.length>=4&&(
          <button onClick={handleLogin} style={{padding:"14px",borderRadius:12,border:"none",background:C.navy,color:"#fff",fontWeight:"bold",fontSize:15,cursor:"pointer"}}>Entrar →</button>
        )}
        {/* Setup paso 1 */}
        {mode==="setup"&&fase==="ingresar"&&pin.length>=4&&(
          <button onClick={handleContinuar} style={{padding:"14px",borderRadius:12,border:"none",background:C.blue,color:"#fff",fontWeight:"bold",fontSize:15,cursor:"pointer"}}>Continuar →</button>
        )}
        {/* Setup paso 2 */}
        {mode==="setup"&&fase==="confirmar"&&confirm.length>=4&&(
          <button onClick={handleSetup} style={{padding:"14px",borderRadius:12,border:"none",background:C.navy,color:"#fff",fontWeight:"bold",fontSize:15,cursor:"pointer"}}>✅ Crear PIN</button>
        )}
        {mode==="setup"&&fase==="confirmar"&&(
          <button onClick={()=>{setFase("ingresar");setPin("");setConfirm("");setErr("");}} style={{padding:"10px",borderRadius:12,border:`1px solid ${C.border}`,background:"transparent",color:C.gray,fontSize:13,cursor:"pointer"}}>← Volver a escribir PIN</button>
        )}
      </div>
    </div>
  );
}

// ══ COMPONENTES BASE ══
function Modal({title,onClose,children,C}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div style={{background:C.cardBg,borderRadius:"20px 20px 0 0",width:"100%",maxWidth:620,maxHeight:"93vh",overflowY:"auto",padding:"20px 16px 40px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <span style={{fontWeight:"bold",fontSize:16,color:C.navy}}>{title}</span>
          <button onClick={onClose} style={{background:C.lgray,border:"none",borderRadius:20,width:32,height:32,cursor:"pointer",fontSize:16,color:C.gray}}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Calc({monto,tipo,cliente,banco,esNomina,C}){
  const c=useMemo(()=>calcMov(monto,tipo,cliente,banco,esNomina),[monto,tipo,cliente,banco,esNomina]);
  if(!parseFloat(monto)||!banco||tipo!=="ingreso")return null;
  const config=(cliente?.bancos||[]).find(b=>b.banco===banco);
  if(!config)return<div style={{background:C.lgold,borderRadius:10,padding:"10px 14px",marginBottom:12,borderLeft:`4px solid ${C.gold}`}}><span style={{fontSize:12,color:C.gold}}>⚠️ {banco} no configurado para este cliente</span></div>;
  return(
    <div style={{background:C.xblue,borderRadius:10,padding:"12px 14px",marginBottom:12,borderLeft:`4px solid ${C.blue}`}}>
      <div style={{fontSize:11,color:C.blue,fontWeight:"bold",marginBottom:8,textTransform:"uppercase",letterSpacing:1}}>{esNomina?"🧾 Nómina":"💸 Transferencia"} — {banco} ({c.pct}%)</div>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:12,color:C.gray}}>Monto original</span><span style={{fontWeight:"bold",color:C.navy}}>{fmt(parseFloat(monto))}</span></div>
      {!esNomina&&<div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:12,color:C.gray}}>Sin IVA (÷1.16)</span><span style={{color:C.gray}}>{fmt(c.montoSinIVA)}</span></div>}
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}><span style={{fontSize:12,color:C.red}}>Comisión {c.pct}% {esNomina?"(total)":"(subtotal)"}</span><span style={{color:C.red,fontWeight:"bold"}}>− {fmt(c.comision)}</span></div>
      <div style={{borderTop:`1px solid ${C.border}`,paddingTop:8,display:"flex",justifyContent:"space-between"}}><span style={{fontWeight:"bold",color:C.navy}}>Monto final</span><span style={{fontWeight:"bold",fontSize:17,color:C.green}}>{fmt(c.montoFinal)}</span></div>
    </div>
  );
}

// ══ FORM TRANSFERENCIA INTERNA ══
function FormTransferencia({cuentas,ini,onSave,C}){
  const inp2={width:"100%",padding:"9px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,fontSize:14,boxSizing:"border-box",outline:"none",fontFamily:"inherit",background:C.cardBg,color:C.text};
  const lbl2={fontSize:10,color:C.gray,letterSpacing:1.5,textTransform:"uppercase",marginBottom:3,display:"block"};
  const [origenId,setOrigenId]=useState(ini?.cuentaOrigenId||"");
  const [destinoId,setDestinoId]=useState(ini?.cuentaDestinoId||"");
  const [monto,setMonto]=useState(ini?.montoFinal?.toString()||"");
  const [concepto,setConcepto]=useState(ini?.concepto||"Transferencia entre cuentas");
  const [fecha,setFecha]=useState(ini?.fecha||today());
  const [notas,setNotas]=useState(ini?.notas||"");
  const [err,setErr]=useState("");

  const origen=cuentas.find(c=>c.id===origenId);
  const destino=cuentas.find(c=>c.id===destinoId);

  function guardar(){
    if(!origenId)return setErr("Selecciona la cuenta origen.");
    if(!destinoId)return setErr("Selecciona la cuenta destino.");
    if(origenId===destinoId)return setErr("La cuenta origen y destino deben ser diferentes.");
    const m=parseFloat(monto);
    if(!m||m<=0)return setErr("El monto debe ser mayor a 0.");
    setErr("");
    onSave({
      id:ini?.id||uid(),
      tipo:"transferencia",
      cuentaId:origenId, // para compatibilidad con filtros
      cuentaOrigenId:origenId,
      cuentaDestinoId:destinoId,
      clienteId:null,
      concepto,notas,fecha,
      montoOriginal:m,montoSinIVA:0,comision:0,montoFinal:m,pct:0,
      estado:"confirmado",revisado:false,historial:[],esNomina:false,banco:null,
    });
  }

  return(
    <div>
      <div style={{background:"#ede7f6",borderRadius:12,padding:"12px 14px",marginBottom:16,borderLeft:"4px solid #6a1b9a"}}>
        <div style={{fontSize:12,color:"#6a1b9a",fontWeight:"bold",marginBottom:4}}>🔄 Transferencia interna</div>
        <div style={{fontSize:12,color:"#888"}}>El monto sale de una cuenta y entra a otra. Sin comisión.</div>
      </div>

      <span style={lbl2}>Cuenta origen (sale el dinero) *</span>
      <select value={origenId} onChange={e=>{setOrigenId(e.target.value);if(e.target.value===destinoId)setDestinoId("");}} style={{...inp2,marginBottom:12}}>
        <option value="">— Selecciona —</option>
        {cuentas.map(c=><option key={c.id} value={c.id}>🏦 {c.nombre} ({c.banco})</option>)}
      </select>

      <span style={lbl2}>Cuenta destino (entra el dinero) *</span>
      <select value={destinoId} onChange={e=>{setDestinoId(e.target.value);if(e.target.value===origenId)setOrigenId("");}} style={{...inp2,marginBottom:12}}>
        <option value="">— Selecciona —</option>
        {cuentas.filter(c=>c.id!==origenId).map(c=><option key={c.id} value={c.id}>🏦 {c.nombre} ({c.banco})</option>)}
      </select>

      {/* Preview */}
      {origenId&&destinoId&&parseFloat(monto)>0&&(
        <div style={{background:C.xblue,borderRadius:10,padding:"12px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:10}}>
          <div style={{textAlign:"center",flex:1}}>
            <div style={{fontSize:11,color:C.gray}}>Sale de</div>
            <div style={{fontWeight:"bold",color:C.red,fontSize:13}}>{origen?.nombre}</div>
            <div style={{fontSize:16,color:C.red}}>− {fmt(parseFloat(monto))}</div>
          </div>
          <div style={{fontSize:24}}>→</div>
          <div style={{textAlign:"center",flex:1}}>
            <div style={{fontSize:11,color:C.gray}}>Llega a</div>
            <div style={{fontWeight:"bold",color:C.green,fontSize:13}}>{destino?.nombre}</div>
            <div style={{fontSize:16,color:C.green}}>+ {fmt(parseFloat(monto))}</div>
          </div>
        </div>
      )}

      <span style={lbl2}>Monto ($) *</span>
      <input inputMode="decimal" placeholder="0.00" value={monto} onChange={e=>setMonto(e.target.value)} style={{...inp2,fontSize:18,marginBottom:12}} />

      <span style={lbl2}>Concepto</span>
      <input value={concepto} onChange={e=>setConcepto(e.target.value)} style={{...inp2,marginBottom:12}} />

      <span style={lbl2}>Fecha</span>
      <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)} style={{...inp2,marginBottom:12}} />

      <span style={lbl2}>Notas</span>
      <input value={notas} onChange={e=>setNotas(e.target.value)} placeholder="Opcional" style={{...inp2,marginBottom:16}} />

      {err&&<div style={{color:C.red,fontSize:13,padding:"8px 12px",background:C.lred,borderRadius:8,marginBottom:10}}>⚠️ {err}</div>}
      <button onClick={guardar} style={{width:"100%",padding:13,borderRadius:9,border:"none",background:"#6a1b9a",color:"#fff",fontWeight:"bold",fontSize:15,cursor:"pointer"}}>{ini?"Guardar cambios":"Registrar transferencia"}</button>
    </div>
  );
}

// ══ FORMS ══
function FormCliente({ini,onSave,C}){
  const inp={width:"100%",padding:"9px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,fontSize:14,boxSizing:"border-box",outline:"none",fontFamily:"inherit",background:C.cardBg,color:C.text};
  const lbl={fontSize:10,color:C.gray,letterSpacing:1.5,textTransform:"uppercase",marginBottom:3,display:"block"};
  const [nombre,setNombre]=useState(ini?.nombre||"");
  const [saldo0,setSaldo0]=useState(ini?.saldoInicial?.toString()||"0");
  const [notas,setNotas]=useState(ini?.notas||"");
  const [vip,setVip]=useState(ini?.vip||false);
  const [bancos,setBancos]=useState(ini?.bancos||[]);
  const [err,setErr]=useState("");

  function toggleBanco(banco){setBancos(p=>p.find(b=>b.banco===banco)?p.filter(b=>b.banco!==banco):[...p,{banco,porcentaje:3}]);}
  function setPct(banco,pct){setBancos(p=>p.map(b=>b.banco===banco?{...b,porcentaje:parseFloat(pct)||0}:b));}

  function guardar(){
    if(!nombre.trim())return setErr("El nombre es obligatorio.");
    if(bancos.length===0)return setErr("Configura al menos un banco.");
    setErr("");
    onSave({id:ini?.id||uid(),nombre:nombre.trim(),bancos,saldoInicial:parseFloat(saldo0)||0,notas,vip,activo:true,fechaCreacion:ini?.fechaCreacion||today()});
  }

  return(
    <div>
      <span style={lbl}>Nombre *</span>
      <input value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="Nombre del cliente" style={{...inp,marginBottom:12}} />
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,padding:"10px 14px",background:C.lgold,borderRadius:10,cursor:"pointer"}} onClick={()=>setVip(!vip)}>
        <span style={{fontSize:20}}>{vip?"⭐":"☆"}</span>
        <div><div style={{fontWeight:"bold",color:C.gold,fontSize:13}}>Cliente VIP / Frecuente</div><div style={{fontSize:11,color:C.gray}}>Aparece destacado en la lista</div></div>
      </div>
      <div style={{fontSize:11,fontWeight:"bold",color:C.navy,marginBottom:8,letterSpacing:1,textTransform:"uppercase"}}>🏦 Bancos y comisiones *</div>
      {BANCOS.map(banco=>{
        const config=bancos.find(b=>b.banco===banco);
        const activo=!!config;
        return(
          <div key={banco} style={{background:activo?C.xblue:C.lgray,borderRadius:10,padding:"12px 14px",marginBottom:8,border:`1.5px solid ${activo?C.blue:C.border}`}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <button onClick={()=>toggleBanco(banco)} style={{background:activo?C.blue:C.border,border:"none",borderRadius:20,width:24,height:24,cursor:"pointer",color:"#fff",fontSize:12,flexShrink:0}}>{activo?"✓":""}</button>
              <span style={{fontWeight:"bold",color:activo?C.navy:C.gray,flex:1,fontSize:13}}>{banco}</span>
              {activo&&<div style={{display:"flex",alignItems:"center",gap:6}}>
                {["3","4"].map(p=><button key={p} onClick={()=>setPct(banco,p)} style={{padding:"4px 12px",borderRadius:8,border:`2px solid ${config?.porcentaje?.toString()===p?C.navy:C.border}`,background:config?.porcentaje?.toString()===p?C.navy:C.cardBg,color:config?.porcentaje?.toString()===p?"#fff":C.gray,fontWeight:"bold",cursor:"pointer",fontSize:13}}>{p}%</button>)}
                <input type="number" placeholder="%" min="0" max="100" value={!["3","4"].includes(config?.porcentaje?.toString())?config?.porcentaje||"":""} onChange={e=>setPct(banco,e.target.value)} style={{...inp,width:60,padding:"4px 8px",fontSize:13}} />
              </div>}
            </div>
          </div>
        );
      })}
      <span style={{...lbl,marginTop:14}}>Saldo inicial ($)</span>
      <input inputMode="decimal" value={saldo0} onChange={e=>setSaldo0(e.target.value)} style={{...inp,marginBottom:12}} />
      <span style={lbl}>Notas rápidas</span>
      <input value={notas} onChange={e=>setNotas(e.target.value)} placeholder="Ej: Prefiere Banorte, llamar antes" style={{...inp,marginBottom:16}} />
      {err&&<div style={{color:C.red,fontSize:13,padding:"8px 12px",background:C.lred,borderRadius:8,marginBottom:10}}>⚠️ {err}</div>}
      <button onClick={guardar} style={{width:"100%",padding:13,borderRadius:9,border:"none",background:C.navy,color:"#fff",fontWeight:"bold",fontSize:15,cursor:"pointer"}}>{ini?"Guardar cambios":"Agregar cliente"}</button>
    </div>
  );
}

function FormCuenta({ini,onSave,C}){
  const inp2={width:"100%",padding:"9px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,fontSize:14,boxSizing:"border-box",outline:"none",fontFamily:"inherit",background:C.cardBg,color:C.text};
  const lbl2={fontSize:10,color:C.gray,letterSpacing:1.5,textTransform:"uppercase",marginBottom:3,display:"block"};
  const [nombre,setNombre]=useState(ini?.nombre||"");
  const [banco,setBanco]=useState(ini?.banco||"");
  const [saldo0,setSaldo0]=useState(ini?.saldoInicial?.toString()||"0");
  const [err,setErr]=useState("");
  function guardar(){if(!nombre.trim())return setErr("El nombre es obligatorio.");setErr("");onSave({id:ini?.id||uid(),nombre:nombre.trim(),banco:banco.trim(),saldoInicial:parseFloat(saldo0)||0,activa:true,fechaCreacion:ini?.fechaCreacion||today()});}
  return(
    <div>
      <span style={lbl2}>Nombre *</span><input value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="Ej: Cuenta principal" style={{...inp2,marginBottom:12}} />
      <span style={lbl2}>Banco</span><input value={banco} onChange={e=>setBanco(e.target.value)} placeholder="Ej: BBVA" style={{...inp2,marginBottom:12}} />
      <span style={lbl2}>Saldo inicial ($)</span><input inputMode="decimal" value={saldo0} onChange={e=>setSaldo0(e.target.value)} style={{...inp2,marginBottom:16}} />
      {err&&<div style={{color:C.red,fontSize:13,padding:"8px 12px",background:C.lred,borderRadius:8,marginBottom:10}}>⚠️ {err}</div>}
      <button onClick={guardar} style={{width:"100%",padding:13,borderRadius:9,border:"none",background:C.navy,color:"#fff",fontWeight:"bold",fontSize:15,cursor:"pointer"}}>{ini?"Guardar cambios":"Agregar cuenta"}</button>
    </div>
  );
}

function FormMov({clientes,cuentas,ini,onSave,clientesRecientes,C}){
  const inp2={width:"100%",padding:"9px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,fontSize:14,boxSizing:"border-box",outline:"none",fontFamily:"inherit",background:C.cardBg,color:C.text};
  const lbl2={fontSize:10,color:C.gray,letterSpacing:1.5,textTransform:"uppercase",marginBottom:3,display:"block"};
  const [tipo,setTipo]=useState(ini?.tipo||"ingreso");
  const [clienteId,setClienteId]=useState(ini?.clienteId||"");
  const [cuentaId,setCuentaId]=useState(ini?.cuentaId||cuentas[0]?.id||"");
  const [banco,setBanco]=useState(ini?.banco||"");
  const [esNomina,setEsNomina]=useState(ini?.esNomina||false);
  const [monto,setMonto]=useState(ini?.montoOriginal?.toString()||"");
  const [concepto,setConcepto]=useState(ini?.concepto||"");
  const [categoria,setCategoria]=useState(ini?.categoria||"");
  const [notas,setNotas]=useState(ini?.notas||"");
  const [fecha,setFecha]=useState(ini?.fecha||today());
  const [estado,setEstado]=useState(ini?.estado||"confirmado");
  const [err,setErr]=useState("");

  const cliente=clientes.find(c=>c.id===clienteId);
  const bancosCliente=cliente?.bancos||[];
  const cal=useMemo(()=>calcMov(monto,tipo,cliente,banco,esNomina),[monto,tipo,cliente,banco,esNomina]);

  const clientesOrdenados=useMemo(()=>{
    const vips=clientes.filter(c=>c.vip);
    const rec=(clientesRecientes||[]).map(id=>clientes.find(c=>c.id===id)).filter(Boolean);
    const resto=clientes.filter(c=>!c.vip&&!(clientesRecientes||[]).includes(c.id));
    return[...vips,...rec.filter(c=>!c.vip),...resto];
  },[clientes,clientesRecientes]);

  function guardar(){
    if(!cuentaId)return setErr("Selecciona una cuenta.");
    const m=parseFloat(monto);
    if(!m||m<=0)return setErr("El monto debe ser mayor a 0.");
    if(tipo==="ingreso"&&clienteId&&!banco)return setErr("Selecciona el banco de origen.");
    setErr("");
    onSave({id:ini?.id||uid(),tipo,clienteId:clienteId||null,cuentaId,banco:banco||null,esNomina,concepto,categoria,notas,fecha,estado,montoOriginal:m,...cal,historial:ini?.historial||[],revisado:ini?.revisado||false});
  }

  return(
    <div>
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        {["ingreso","egreso","ajuste"].map(t=>{const mt=TIPO_META[t];return<button key={t} onClick={()=>setTipo(t)} style={{flex:1,padding:"8px 4px",borderRadius:9,border:`2px solid ${tipo===t?mt.color:C.border}`,background:tipo===t?mt.bg:C.lgray,color:tipo===t?mt.color:C.gray,fontWeight:"bold",fontSize:12,cursor:"pointer"}}>{mt.emoji} {mt.label}</button>;})}
      </div>
      <span style={lbl2}>Cuenta *</span>
      <select value={cuentaId} onChange={e=>setCuentaId(e.target.value)} style={{...inp2,marginBottom:12}}>
        <option value="">— Selecciona —</option>
        {cuentas.map(c=><option key={c.id} value={c.id}>{c.nombre} ({c.banco})</option>)}
      </select>
      <span style={lbl2}>Cliente (opcional)</span>
      <select value={clienteId} onChange={e=>{setClienteId(e.target.value);setBanco("");}} style={{...inp2,marginBottom:12}}>
        <option value="">— Sin cliente —</option>
        {clientesOrdenados.map(c=><option key={c.id} value={c.id}>{c.vip?"⭐ ":""}{c.nombre}</option>)}
      </select>
      {tipo==="ingreso"&&clienteId&&<>
        <span style={lbl2}>Banco de origen *</span>
        <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
          {bancosCliente.length===0?<div style={{color:C.red,fontSize:12,padding:"8px 12px",background:C.lred,borderRadius:8,width:"100%"}}>⚠️ Sin bancos configurados</div>:bancosCliente.map(b=><button key={b.banco} onClick={()=>setBanco(b.banco)} style={{padding:"8px 14px",borderRadius:9,border:`2px solid ${banco===b.banco?C.blue:C.border}`,background:banco===b.banco?C.lblue:C.lgray,color:banco===b.banco?C.navy:C.gray,fontWeight:"bold",fontSize:12,cursor:"pointer"}}>🏦 {b.banco} <span style={{color:C.blue}}>({b.porcentaje}%)</span></button>)}
        </div>
        <div style={{marginBottom:12}}>
          <span style={lbl2}>Tipo de operación</span>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>setEsNomina(false)} style={{flex:1,padding:"9px",borderRadius:9,border:`2px solid ${!esNomina?C.navy:C.border}`,background:!esNomina?C.navy:C.lgray,color:!esNomina?"#fff":C.gray,fontWeight:"bold",fontSize:13,cursor:"pointer"}}>💸 Transferencia</button>
            <button onClick={()=>setEsNomina(true)} style={{flex:1,padding:"9px",borderRadius:9,border:`2px solid ${esNomina?C.navy:C.border}`,background:esNomina?C.navy:C.lgray,color:esNomina?"#fff":C.gray,fontWeight:"bold",fontSize:13,cursor:"pointer"}}>🧾 Nómina</button>
          </div>
        </div>
      </>}
      <span style={lbl2}>Monto ($) *</span>
      <input inputMode="decimal" placeholder="0.00" value={monto} onChange={e=>setMonto(e.target.value)} style={{...inp2,fontSize:18,marginBottom:12}} />
      <Calc monto={monto} tipo={tipo} cliente={cliente} banco={banco} esNomina={esNomina} C={C} />
      <span style={lbl2}>Concepto</span>
      <input value={concepto} onChange={e=>setConcepto(e.target.value)} placeholder="Ej: Pago factura marzo" style={{...inp2,marginBottom:12}} />
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        <div style={{flex:1}}><span style={lbl2}>Categoría</span><select value={categoria} onChange={e=>setCategoria(e.target.value)} style={inp2}><option value="">Sin categoría</option>{CATEGORIAS.map(cat=><option key={cat}>{cat}</option>)}</select></div>
        <div style={{flex:1}}><span style={lbl2}>Estado</span><select value={estado} onChange={e=>setEstado(e.target.value)} style={inp2}><option value="confirmado">Confirmado</option><option value="pendiente">Pendiente</option></select></div>
      </div>
      <span style={lbl2}>Fecha</span>
      <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)} style={{...inp2,marginBottom:12}} />
      <span style={lbl2}>Notas</span>
      <input value={notas} onChange={e=>setNotas(e.target.value)} placeholder="Opcional" style={{...inp2,marginBottom:16}} />
      {err&&<div style={{color:C.red,fontSize:13,padding:"8px 12px",background:C.lred,borderRadius:8,marginBottom:10}}>⚠️ {err}</div>}
      <button onClick={guardar} style={{width:"100%",padding:13,borderRadius:9,border:"none",background:C.navy,color:"#fff",fontWeight:"bold",fontSize:15,cursor:"pointer"}}>{ini?"Guardar cambios":"Registrar movimiento"}</button>
    </div>
  );
}

// ══ GRÁFICA ══
function GraficaBarras({movs,C}){
  const semanas=useMemo(()=>{
    const map={};
    movs.forEach(m=>{const d=new Date(m.fecha+"T12:00:00");const l=new Date(d);l.setDate(d.getDate()-((d.getDay()+6)%7));const k=l.toISOString().slice(0,10);if(!map[k])map[k]={k,ing:0,eg:0};if(m.tipo==="ingreso")map[k].ing+=m.montoFinal;if(m.tipo==="egreso")map[k].eg+=m.montoFinal;});
    return Object.values(map).sort((a,b)=>a.k.localeCompare(b.k)).slice(-6);
  },[movs]);
  if(semanas.length===0)return<div style={{color:C.gray,textAlign:"center",padding:20,fontSize:12}}>Sin datos para graficar</div>;
  const maxVal=Math.max(...semanas.flatMap(s=>[s.ing,s.eg]),1);
  return(
    <div style={{background:C.cardBg,borderRadius:14,padding:"16px 12px",marginBottom:12,boxShadow:"0 2px 10px rgba(0,0,0,0.07)"}}>
      <div style={{fontSize:11,color:C.navy,fontWeight:"bold",marginBottom:12,letterSpacing:1,textTransform:"uppercase"}}>Ingresos vs Egresos por semana</div>
      <div style={{display:"flex",alignItems:"flex-end",gap:6,height:100}}>
        {semanas.map(s=>(
          <div key={s.k} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
            <div style={{width:"100%",display:"flex",gap:2,alignItems:"flex-end",height:80}}>
              <div style={{flex:1,background:C.green,borderRadius:"3px 3px 0 0",height:`${(s.ing/maxVal)*100}%`,minHeight:s.ing>0?3:0}} />
              <div style={{flex:1,background:C.red,borderRadius:"3px 3px 0 0",height:`${(s.eg/maxVal)*100}%`,minHeight:s.eg>0?3:0}} />
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

// ══ PANTALLAS ══
function Resumen({cls,ctas,movs,meta,onSetMeta,dark,onToggleDark,onLock,C}){
  const r=resumenTotal(cls,ctas,movs);
  const [editMeta,setEditMeta]=useState(false);
  const [metaInput,setMetaInput]=useState(meta?.toString()||"");
  const mesActual=today().slice(0,7);
  const comMes=movs.filter(m=>m.fecha.startsWith(mesActual)&&m.tipo==="ingreso").reduce((a,m)=>a+m.comision,0);
  const pctMeta=meta>0?Math.min((comMes/meta)*100,100):0;
  const inp2={width:"100%",padding:"9px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,fontSize:14,boxSizing:"border-box",outline:"none",fontFamily:"inherit",background:C.cardBg,color:C.text};

  // Análisis: top cliente por comisiones
  const topCliente=cls.map(c=>({...c,com:movs.filter(m=>m.clienteId===c.id&&m.tipo==="ingreso").reduce((a,m)=>a+m.comision,0)})).sort((a,b)=>b.com-a.com)[0];
  const topBanco=BANCOS.map(b=>({banco:b,com:movs.filter(m=>m.banco===b&&m.tipo==="ingreso").reduce((a,m)=>a+m.comision,0)})).sort((a,b)=>b.com-a.com)[0];

  const alertas=[];
  cls.forEach(c=>{if(saldoCliente(c,movs)<0)alertas.push(`⚠️ ${c.nombre} tiene saldo negativo`);if(saldoCliente(c,movs)>=0&&saldoCliente(c,movs)<500&&movs.some(m=>m.clienteId===c.id))alertas.push(`🔔 ${c.nombre} tiene saldo bajo`);});
  if(movs.filter(m=>m.tipo==="ajuste").length>5)alertas.push("⚠️ Hay muchos ajustes registrados");
  if(r.dineroC>r.total*0.8&&r.total>0)alertas.push("⚠️ Saldo retenido de clientes es alto");

  return(
    <div>
      {/* Controles header */}
      <div style={{display:"flex",gap:8,marginBottom:12,justifyContent:"flex-end",flexWrap:"wrap"}}>
        <button onClick={onToggleDark} style={{padding:"6px 14px",borderRadius:20,border:`1.5px solid ${C.border}`,background:C.cardBg,color:C.text,fontSize:13,cursor:"pointer"}}>{dark?"☀️ Claro":"🌙 Oscuro"}</button>
        <button onClick={onLock} style={{padding:"6px 14px",borderRadius:20,border:`1.5px solid ${C.border}`,background:C.cardBg,color:C.text,fontSize:13,cursor:"pointer"}}>🔒 Bloquear</button>
        <button onClick={()=>{if(window.confirm("¿Cambiar PIN? Se cerrará la sesión.")){save(KEYS.pin,"");onLock();}}} style={{padding:"6px 14px",borderRadius:20,border:`1.5px solid ${C.border}`,background:C.cardBg,color:C.gray,fontSize:13,cursor:"pointer"}}>🔑 Cambiar PIN</button>
      </div>

      {alertas.length>0&&<div style={{background:C.lgold,borderRadius:12,padding:"12px 16px",marginBottom:12,borderLeft:"4px solid #f57f17"}}>
        {alertas.map((a,i)=><div key={i} style={{fontSize:13,color:"#e65100",marginBottom:i<alertas.length-1?4:0}}>{a}</div>)}
      </div>}

      <div style={{background:C.navy,borderRadius:14,padding:18,boxShadow:"0 2px 10px rgba(0,0,0,0.07)",marginBottom:12,color:"#fff"}}>
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

      {/* Meta */}
      <div style={{background:C.cardBg,borderRadius:14,padding:16,boxShadow:"0 2px 10px rgba(0,0,0,0.07)",marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div style={{fontSize:12,fontWeight:"bold",color:C.navy}}>🎯 Meta de comisiones (mes)</div>
          <button onClick={()=>{setEditMeta(!editMeta);setMetaInput(meta?.toString()||"");}} style={{padding:"4px 10px",borderRadius:9,border:"none",background:C.lblue,color:C.navy,fontWeight:"bold",fontSize:11,cursor:"pointer"}}>{editMeta?"Cancelar":"Editar"}</button>
        </div>
        {editMeta&&<div style={{display:"flex",gap:8,marginBottom:10}}>
          <input inputMode="decimal" value={metaInput} onChange={e=>setMetaInput(e.target.value)} placeholder="Meta en $" style={{...inp2,flex:1}} />
          <button onClick={()=>{onSetMeta(parseFloat(metaInput)||0);setEditMeta(false);}} style={{padding:"8px 14px",borderRadius:9,border:"none",background:C.navy,color:"#fff",fontWeight:"bold",cursor:"pointer"}}>Guardar</button>
        </div>}
        <div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:6}}>
          <span style={{color:C.gray}}>Este mes: {fmt(comMes)}</span>
          <span style={{color:C.navy,fontWeight:"bold"}}>{meta>0?`Meta: ${fmt(meta)}`:"Sin meta"}</span>
        </div>
        {meta>0&&<><div style={{background:C.lgray,borderRadius:20,height:10,overflow:"hidden"}}><div style={{height:"100%",background:pctMeta>=100?C.green:C.blue,borderRadius:20,width:`${pctMeta}%`,transition:"width .5s"}} /></div><div style={{fontSize:11,color:pctMeta>=100?C.green:C.gray,marginTop:4,textAlign:"right"}}>{pctMeta.toFixed(1)}% {pctMeta>=100?"🎉 ¡Meta alcanzada!":""}</div></>}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
        {[["📥 Ingresos",fmt(r.ing),C.lgreen,C.green],["📤 Egresos",fmt(r.eg),C.lred,C.red],["💸 Comisiones",fmt(r.com),C.lgold,C.gold]].map(([l,v,bg,col])=>(
          <div key={l} style={{background:bg,borderRadius:11,padding:"12px 8px",textAlign:"center"}}>
            <div style={{fontSize:9,color:col,marginBottom:4}}>{l}</div>
            <div style={{fontWeight:"bold",fontSize:13,color:col}}>{v}</div>
          </div>
        ))}
      </div>

      {/* Análisis */}
      {(topCliente?.com>0||topBanco?.com>0)&&<div style={{background:C.cardBg,borderRadius:14,padding:16,boxShadow:"0 2px 10px rgba(0,0,0,0.07)",marginBottom:12}}>
        <div style={{fontSize:11,color:C.navy,fontWeight:"bold",marginBottom:10,letterSpacing:1,textTransform:"uppercase"}}>📊 Análisis</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {topCliente?.com>0&&<div style={{background:C.lblue,borderRadius:10,padding:"10px 12px"}}>
            <div style={{fontSize:10,color:C.gray,marginBottom:4}}>🏆 Top cliente</div>
            <div style={{fontWeight:"bold",color:C.navy,fontSize:13}}>{topCliente.nombre}</div>
            <div style={{fontSize:12,color:C.blue}}>{fmt(topCliente.com)} com.</div>
          </div>}
          {topBanco?.com>0&&<div style={{background:C.lgold,borderRadius:10,padding:"10px 12px"}}>
            <div style={{fontSize:10,color:C.gray,marginBottom:4}}>🏦 Top banco</div>
            <div style={{fontWeight:"bold",color:C.navy,fontSize:13}}>{topBanco.banco.split(" ")[1]||topBanco.banco}</div>
            <div style={{fontSize:12,color:C.gold}}>{fmt(topBanco.com)} com.</div>
          </div>}
        </div>
        {/* Promedio diario */}
        {movs.length>0&&(()=>{
          const diasUnicos=[...new Set(movs.filter(m=>m.fecha.startsWith(mesActual)).map(m=>m.fecha))].length;
          const ingMes=movs.filter(m=>m.fecha.startsWith(mesActual)&&m.tipo==="ingreso").reduce((a,m)=>a+m.montoFinal,0);
          const promDiario=diasUnicos>0?ingMes/diasUnicos:0;
          return diasUnicos>0?<div style={{marginTop:10,padding:"10px 12px",background:C.lgreen,borderRadius:10}}>
            <div style={{fontSize:10,color:C.gray,marginBottom:2}}>📅 Promedio diario de ingresos</div>
            <div style={{fontWeight:"bold",color:C.green,fontSize:15}}>{fmt(promDiario)}</div>
            <div style={{fontSize:11,color:C.gray}}>en {diasUnicos} días activos este mes</div>
          </div>:null;
        })()}
      </div>}

      <GraficaBarras movs={movs} C={C} />

      <div style={{fontSize:10,color:C.gray,letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>Saldo por cuenta</div>
      {ctas.length===0&&<div style={{color:C.gray,textAlign:"center",padding:20,fontSize:13}}>Sin cuentas registradas</div>}
      {ctas.map(c=>{const s=saldoCuenta(c,movs);const n=movs.filter(m=>m.cuentaId===c.id).length;return(
        <div key={c.id} style={{background:C.cardBg,borderRadius:14,padding:16,boxShadow:"0 2px 10px rgba(0,0,0,0.07)",marginBottom:10,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div style={{fontWeight:"bold",color:C.navy}}>🏦 {c.nombre}</div><div style={{fontSize:11,color:C.gray}}>{c.banco} · {n} mov.</div></div>
          <div style={{fontWeight:"bold",fontSize:17,color:s>=0?C.green:C.red}}>{fmt(s)}</div>
        </div>
      );})}
    </div>
  );
}

function CalculadoraRapida({clientes,C}){
  const inp2={width:"100%",padding:"9px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,fontSize:14,boxSizing:"border-box",outline:"none",fontFamily:"inherit",background:C.cardBg,color:C.text};
  const lbl2={fontSize:10,color:C.gray,letterSpacing:1.5,textTransform:"uppercase",marginBottom:3,display:"block"};
  const [clienteId,setClienteId]=useState("");
  const [banco,setBanco]=useState("");
  const [monto,setMonto]=useState("");
  const [esNomina,setEsNomina]=useState(false);
  const cliente=clientes.find(c=>c.id===clienteId);
  return(
    <div>
      <div style={{background:C.cardBg,borderRadius:14,padding:18,boxShadow:"0 2px 10px rgba(0,0,0,0.07)",border:`2px solid ${C.blue}`}}>
        <div style={{fontSize:12,fontWeight:"bold",color:C.navy,marginBottom:12,letterSpacing:1,textTransform:"uppercase"}}>⚡ Calculadora rápida</div>
        <div style={{display:"flex",gap:8,marginBottom:10}}>
          <div style={{flex:1}}><span style={lbl2}>Cliente</span><select value={clienteId} onChange={e=>{setClienteId(e.target.value);setBanco("");}} style={inp2}><option value="">— Selecciona —</option>{clientes.map(c=><option key={c.id} value={c.id}>{c.vip?"⭐ ":""}{c.nombre}</option>)}</select></div>
          <div style={{flex:1}}><span style={lbl2}>Banco</span><select value={banco} onChange={e=>setBanco(e.target.value)} style={inp2} disabled={!clienteId}><option value="">— Banco —</option>{(cliente?.bancos||[]).map(b=><option key={b.banco} value={b.banco}>{b.banco} ({b.porcentaje}%)</option>)}</select></div>
        </div>
        <div style={{display:"flex",gap:8,marginBottom:10,alignItems:"flex-end"}}>
          <div style={{flex:1}}><span style={lbl2}>Monto ($)</span><input inputMode="decimal" placeholder="0.00" value={monto} onChange={e=>setMonto(e.target.value)} style={{...inp2,fontSize:16}} /></div>
          <button onClick={()=>setEsNomina(!esNomina)} style={{padding:"9px 14px",borderRadius:9,border:"none",background:esNomina?C.navy:C.lgray,color:esNomina?"#fff":C.gray,fontWeight:"bold",fontSize:12,cursor:"pointer",marginBottom:1,whiteSpace:"nowrap"}}>{esNomina?"🧾 Nómina":"💸 Normal"}</button>
        </div>
        <Calc monto={monto} tipo="ingreso" cliente={cliente} banco={banco} esNomina={esNomina} C={C} />
      </div>
    </div>
  );
}

function Clientes({cls,movs,onAdd,onEdit,onDel,C}){
  const inp2={width:"100%",padding:"9px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,fontSize:14,boxSizing:"border-box",outline:"none",fontFamily:"inherit",background:C.cardBg,color:C.text};
  const [modal,setModal]=useState(null);
  const [detalle,setDetalle]=useState(null);

  if(detalle){
    const c=detalle;
    const cm=movs.filter(m=>m.clienteId===c.id);
    const s=saldoCliente(c,movs);
    const ing=cm.filter(m=>m.tipo==="ingreso").reduce((a,m)=>a+m.montoFinal,0);
    const eg=cm.filter(m=>m.tipo==="egreso").reduce((a,m)=>a+m.montoFinal,0);
    const com=cm.filter(m=>m.tipo==="ingreso").reduce((a,m)=>a+m.comision,0);
    return(
      <div>
        <button onClick={()=>setDetalle(null)} style={{padding:"9px 16px",borderRadius:9,border:"none",background:C.lgray,color:C.navy,fontWeight:"bold",fontSize:13,cursor:"pointer",marginBottom:14}}>← Volver</button>
        <div style={{background:C.navy,borderRadius:14,padding:18,marginBottom:12,color:"#fff"}}>
          <div style={{fontSize:18,fontWeight:"bold"}}>{c.vip?"⭐ ":""}{c.nombre}</div>
          <div style={{opacity:.6,fontSize:12,marginTop:4}}>{(c.bancos||[]).map(b=>`${b.banco}: ${b.porcentaje}%`).join(" · ")}</div>
          {c.notas&&<div style={{marginTop:6,fontSize:12,opacity:.8,background:"rgba(255,255,255,0.1)",borderRadius:8,padding:"6px 10px"}}>📝 {c.notas}</div>}
          <div style={{fontSize:30,fontWeight:"bold",marginTop:10,color:s>=0?"#a5d6a7":"#ef9a9a"}}>{fmt(s)}</div>
          <div style={{fontSize:11,opacity:.6}}>Saldo actual</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
          {[["📥",fmt(ing),C.lgreen,C.green],["📤",fmt(eg),C.lred,C.red],["💸",fmt(com),C.lgold,C.gold]].map(([l,v,bg,col])=>(
            <div key={l} style={{background:bg,borderRadius:10,padding:"10px 8px",textAlign:"center"}}><div style={{fontSize:16}}>{l}</div><div style={{fontWeight:"bold",fontSize:12,color:col}}>{v}</div></div>
          ))}
        </div>
        {[...cm].sort((a,b)=>b.fecha.localeCompare(a.fecha)).map(m=>{const mt=TIPO_META[m.tipo];return(
          <div key={m.id} style={{background:C.cardBg,borderRadius:14,padding:14,boxShadow:"0 2px 10px rgba(0,0,0,0.07)",marginBottom:8,display:"flex",gap:10,alignItems:"center"}}>
            <div style={{background:mt.bg,borderRadius:8,padding:"6px 8px",fontSize:16}}>{mt.emoji}</div>
            <div style={{flex:1}}><div style={{fontWeight:"bold",fontSize:13,color:C.navy}}>{m.concepto||"Sin concepto"}</div><div style={{fontSize:11,color:C.gray}}>{fmtDate(m.fecha)}{m.banco&&` · ${m.banco}`}{m.esNomina&&" · Nómina"}</div></div>
            <div style={{textAlign:"right"}}><div style={{fontWeight:"bold",color:m.tipo==="egreso"?C.red:C.green}}>{fmt(m.montoFinal)}</div>{m.comision>0&&<div style={{fontSize:10,color:C.gold}}>com: {fmt(m.comision)}</div>}</div>
          </div>
        );})}
      </div>
    );
  }

  const vips=cls.filter(c=>c.vip);
  const normales=cls.filter(c=>!c.vip);

  return(
    <div>
      <button onClick={()=>setModal("nuevo")} style={{width:"100%",padding:"10px",borderRadius:9,border:"none",background:C.navy,color:"#fff",fontWeight:"bold",fontSize:13,cursor:"pointer",marginBottom:14}}>+ Agregar cliente</button>
      {cls.length===0&&<div style={{color:C.gray,textAlign:"center",padding:30,fontSize:13}}>Sin clientes — agrega uno para empezar</div>}
      {vips.length>0&&<div style={{fontSize:10,color:C.gold,letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>⭐ VIP / Frecuentes</div>}
      {[...vips,...normales].map(c=>{
        const s=saldoCliente(c,movs);
        const com=movs.filter(m=>m.clienteId===c.id&&m.tipo==="ingreso").reduce((a,m)=>a+m.comision,0);
        const alerta=s<0?"🔴":s<500&&movs.some(m=>m.clienteId===c.id)?"🟡":"🟢";
        return(
          <div key={c.id} style={{background:c.vip?C.lgold:C.cardBg,borderRadius:14,padding:16,boxShadow:"0 2px 10px rgba(0,0,0,0.07)",marginBottom:10,border:c.vip?`1.5px solid ${C.gold}`:"none"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
              <div style={{flex:1,cursor:"pointer"}} onClick={()=>setDetalle(c)}>
                <div style={{fontWeight:"bold",fontSize:15,color:C.navy}}>{alerta} {c.vip?"⭐ ":""}{c.nombre}</div>
                <div style={{fontSize:11,color:C.gray,marginTop:4}}>{(c.bancos||[]).map(b=><span key={b.banco} style={{background:C.lblue,color:C.navy,borderRadius:20,padding:"2px 8px",fontSize:10,fontWeight:"bold",marginRight:4}}>{b.banco} {b.porcentaje}%</span>)}</div>
                {c.notas&&<div style={{fontSize:11,color:C.gray,marginTop:4,fontStyle:"italic"}}>📝 {c.notas}</div>}
                <div style={{fontSize:11,color:C.gray,marginTop:4}}>Com total: {fmt(com)}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontWeight:"bold",fontSize:16,color:s>=0?C.green:C.red}}>{fmt(s)}</div>
                <div style={{display:"flex",gap:6,marginTop:6,justifyContent:"flex-end"}}>
                  <button onClick={()=>setModal(c)} style={{padding:"4px 10px",borderRadius:9,border:"none",background:C.lblue,color:C.navy,fontWeight:"bold",fontSize:11,cursor:"pointer"}}>Editar</button>
                  <button onClick={()=>{if(window.confirm(`¿Eliminar a ${c.nombre}?`))onDel(c.id);}} style={{padding:"4px 10px",borderRadius:9,border:"none",background:C.lred,color:C.red,fontWeight:"bold",fontSize:11,cursor:"pointer"}}>Eliminar</button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
      {modal&&<Modal title={modal==="nuevo"?"Nuevo cliente":`Editar: ${modal.nombre}`} onClose={()=>setModal(null)} C={C}>
        <FormCliente ini={modal==="nuevo"?null:modal} onSave={c=>{modal==="nuevo"?onAdd(c):onEdit(c);setModal(null);}} C={C} />
      </Modal>}
    </div>
  );
}

function Cuentas({ctas,movs,onAdd,onEdit,onDel,onConciliar,C}){
  const inp2={width:"100%",padding:"9px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,fontSize:14,boxSizing:"border-box",outline:"none",fontFamily:"inherit",background:C.cardBg,color:C.text};
  const lbl2={fontSize:10,color:C.gray,letterSpacing:1.5,textTransform:"uppercase",marginBottom:3,display:"block"};
  const [modal,setModal]=useState(null);
  const [conciliar,setConciliar]=useState(null);
  const [saldoBanco,setSaldoBanco]=useState("");
  return(
    <div>
      <button onClick={()=>setModal("nueva")} style={{width:"100%",padding:"10px",borderRadius:9,border:"none",background:C.navy,color:"#fff",fontWeight:"bold",fontSize:13,cursor:"pointer",marginBottom:14}}>+ Agregar cuenta</button>
      {ctas.length===0&&<div style={{color:C.gray,textAlign:"center",padding:30,fontSize:13}}>Sin cuentas registradas</div>}
      {ctas.map(c=>{const s=saldoCuenta(c,movs);const n=movs.filter(m=>m.cuentaId===c.id).length;return(
        <div key={c.id} style={{background:C.cardBg,borderRadius:14,padding:16,boxShadow:"0 2px 10px rgba(0,0,0,0.07)",marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
            <div><div style={{fontWeight:"bold",fontSize:15,color:C.navy}}>🏦 {c.nombre}</div><div style={{fontSize:12,color:C.gray}}>{c.banco} · {n} movimientos</div></div>
            <div style={{fontWeight:"bold",fontSize:18,color:s>=0?C.green:C.red}}>{fmt(s)}</div>
          </div>
          <div style={{display:"flex",gap:6,marginTop:10}}>
            <button onClick={()=>setModal(c)} style={{padding:"5px 12px",borderRadius:9,border:"none",background:C.lblue,color:C.navy,fontWeight:"bold",fontSize:11,cursor:"pointer"}}>Editar</button>
            <button onClick={()=>{setConciliar(c);setSaldoBanco("");}} style={{padding:"5px 12px",borderRadius:9,border:"none",background:C.lgold,color:C.gold,fontWeight:"bold",fontSize:11,cursor:"pointer"}}>Conciliar</button>
            <button onClick={()=>{if(window.confirm(`¿Eliminar ${c.nombre}?`))onDel(c.id);}} style={{padding:"5px 12px",borderRadius:9,border:"none",background:C.lred,color:C.red,fontWeight:"bold",fontSize:11,cursor:"pointer"}}>Eliminar</button>
          </div>
        </div>
      );})}
      {modal&&<Modal title={modal==="nueva"?"Nueva cuenta":`Editar: ${modal.nombre}`} onClose={()=>setModal(null)} C={C}><FormCuenta ini={modal==="nueva"?null:modal} onSave={c=>{modal==="nueva"?onAdd(c):onEdit(c);setModal(null);}} C={C} /></Modal>}
      {conciliar&&(()=>{const s=saldoCuenta(conciliar,movs);const real=parseFloat(saldoBanco)||0;const dif=real-s;return(
        <Modal title={`Conciliar: ${conciliar.nombre}`} onClose={()=>setConciliar(null)} C={C}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:12,padding:"10px 14px",background:C.xblue,borderRadius:10}}><span style={{color:C.gray}}>Saldo en app</span><span style={{fontWeight:"bold",color:C.navy}}>{fmt(s)}</span></div>
          <span style={lbl2}>Saldo real en banco ($)</span>
          <input inputMode="decimal" placeholder="0.00" value={saldoBanco} onChange={e=>setSaldoBanco(e.target.value)} style={{...inp2,marginBottom:12}} />
          {saldoBanco&&<div style={{background:Math.abs(dif)<0.01?C.lgreen:C.lred,borderRadius:10,padding:"12px 14px",marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontWeight:"bold",color:dif>=0?C.green:C.red}}>Diferencia</span><span style={{fontWeight:"bold",fontSize:18,color:dif>=0?C.green:C.red}}>{fmt(dif)}</span></div>
            {Math.abs(dif)<0.01&&<div style={{fontSize:12,color:C.green,marginTop:4}}>✅ Todo cuadrado</div>}
          </div>}
          {saldoBanco&&Math.abs(dif)>0.01&&<button onClick={()=>{onConciliar({id:uid(),tipo:"ajuste",clienteId:null,cuentaId:conciliar.id,concepto:`Ajuste conciliación (${conciliar.nombre})`,categoria:"Bancario",notas:`Banco: ${fmt(real)} · App: ${fmt(s)}`,fecha:today(),estado:"confirmado",montoOriginal:Math.abs(dif),montoSinIVA:0,comision:0,montoFinal:dif,revisado:false,historial:[]});setConciliar(null);}} style={{width:"100%",padding:12,borderRadius:9,border:"none",background:C.navy,color:"#fff",fontWeight:"bold",cursor:"pointer"}}>Crear ajuste automático ({fmt(Math.abs(dif))})</button>}
        </Modal>
      );})()} 
    </div>
  );
}

function Movimientos({cls,ctas,movs,onAdd,onEdit,onDel,clientesRecientes,onUpdateRecientes,C}){
  const inp2={width:"100%",padding:"9px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,fontSize:14,boxSizing:"border-box",outline:"none",fontFamily:"inherit",background:C.cardBg,color:C.text};
  const [modal,setModal]=useState(null);
  const [buscar,setBuscar]=useState("");
  const [f,setF]=useState({tipo:"",clienteId:"",cuentaId:"",fecha:""});

  const filtrados=useMemo(()=>movs.filter(m=>{
    if(f.tipo&&m.tipo!==f.tipo)return false;
    if(f.clienteId&&m.clienteId!==f.clienteId)return false;
    if(f.cuentaId&&m.cuentaId!==f.cuentaId)return false;
    if(f.fecha&&m.fecha!==f.fecha)return false;
    if(buscar&&!(m.concepto||"").toLowerCase().includes(buscar.toLowerCase()))return false;
    return true;
  }).sort((a,b)=>b.fecha.localeCompare(a.fecha)),[movs,f,buscar]);

  function handleAdd(m){onAdd({...m});if(m.clienteId)onUpdateRecientes(m.clienteId);}
  function handleEdit(m){const orig=movs.find(x=>x.id===m.id);onEdit({...m,historial:[...(orig?.historial||[]),{fecha:new Date().toISOString(),cambio:`${fmt(orig?.montoOriginal)}→${fmt(m.montoOriginal)}`}]});if(m.clienteId)onUpdateRecientes(m.clienteId);}

  return(
    <div>
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        <button onClick={()=>setModal("nuevo")} style={{flex:1,padding:"10px",borderRadius:9,border:"none",background:C.navy,color:"#fff",fontWeight:"bold",fontSize:13,cursor:"pointer"}}>+ Registrar movimiento</button>
        <button onClick={()=>setModal("transferencia")} style={{flex:"0 0 auto",padding:"10px 14px",borderRadius:9,border:"none",background:"#6a1b9a",color:"#fff",fontWeight:"bold",fontSize:13,cursor:"pointer"}}>🔄 Transferencia</button>
      </div>
      <input value={buscar} onChange={e=>setBuscar(e.target.value)} placeholder="🔍 Buscar por concepto..." style={{...inp2,marginBottom:10}} />
      <div style={{display:"flex",gap:6,marginBottom:8,flexWrap:"wrap"}}>
        {["ingreso","egreso","ajuste"].map(t=>{const mt=TIPO_META[t];return<button key={t} onClick={()=>setF(p=>({...p,tipo:p.tipo===t?"":t}))} style={{padding:"5px 12px",borderRadius:20,border:`1.5px solid ${f.tipo===t?mt.color:C.border}`,background:f.tipo===t?mt.bg:C.cardBg,color:f.tipo===t?mt.color:C.gray,fontSize:12,cursor:"pointer",fontWeight:f.tipo===t?"bold":"normal"}}>{mt.emoji} {mt.label}</button>;})}
        {(f.tipo||f.clienteId||f.cuentaId||f.fecha||buscar)&&<button onClick={()=>{setF({tipo:"",clienteId:"",cuentaId:"",fecha:""});setBuscar("");}} style={{padding:"5px 12px",borderRadius:20,border:`1.5px solid ${C.red}`,background:C.lred,color:C.red,fontSize:12,cursor:"pointer"}}>✕ Limpiar</button>}
      </div>
      <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
        <select value={f.clienteId} onChange={e=>setF(p=>({...p,clienteId:e.target.value}))} style={{...inp2,flex:1,marginBottom:0,fontSize:11}}><option value="">Todos los clientes</option>{cls.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
        <select value={f.cuentaId} onChange={e=>setF(p=>({...p,cuentaId:e.target.value}))} style={{...inp2,flex:1,marginBottom:0,fontSize:11}}><option value="">Todas las cuentas</option>{ctas.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}</select>
        <input type="date" value={f.fecha} onChange={e=>setF(p=>({...p,fecha:e.target.value}))} style={{...inp2,flex:1,marginBottom:0,fontSize:11}} />
      </div>
      <div style={{fontSize:11,color:C.gray,marginBottom:8}}>{filtrados.length} movimiento{filtrados.length!==1?"s":""}</div>
      {filtrados.length===0&&<div style={{color:C.gray,textAlign:"center",padding:30,fontSize:13}}>Sin movimientos</div>}
      {filtrados.map(m=>{
        const mt=TIPO_META[m.tipo]||TIPO_META.ajuste;
        const cli=cls.find(c=>c.id===m.clienteId);
        const cta=ctas.find(c=>c.id===m.cuentaId);
        const ctaOrigen=ctas.find(c=>c.id===m.cuentaOrigenId);
        const ctaDestino=ctas.find(c=>c.id===m.cuentaDestinoId);
        const esTransf=m.tipo==="transferencia";
        return(
        <div key={m.id} style={{background:C.cardBg,borderRadius:14,padding:14,boxShadow:"0 2px 10px rgba(0,0,0,0.07)",marginBottom:8,borderLeft:m.revisado?`3px solid ${C.green}`:esTransf?"3px solid #6a1b9a":"none"}}>
          <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
            <div style={{background:esTransf?"#ede7f6":mt.bg,borderRadius:8,padding:"6px 8px",fontSize:16,flexShrink:0}}>{esTransf?"🔄":mt.emoji}</div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div style={{flex:1}}>
                  <div style={{fontWeight:"bold",fontSize:14,color:C.navy}}>{m.concepto||"Sin concepto"}</div>
                  {esTransf?(
                    <div style={{fontSize:11,color:C.gray,marginTop:2}}>
                      🏦 {ctaOrigen?.nombre} → {ctaDestino?.nombre} · {fmtDate(m.fecha)}
                    </div>
                  ):(
                    <div style={{fontSize:11,color:C.gray,marginTop:2}}>{cta?.nombre}{cli&&` · ${cli.nombre}`} · {fmtDate(m.fecha)}{m.banco&&` · ${m.banco}`}{m.esNomina&&<span style={{background:C.lgold,color:C.gold,borderRadius:20,padding:"1px 6px",fontSize:10,fontWeight:"bold",marginLeft:4}}>Nómina</span>}</div>
                  )}
                  <div style={{display:"flex",gap:4,marginTop:3,flexWrap:"wrap"}}>
                    {m.estado==="pendiente"&&<span style={{background:"#fff3e0",color:C.gold,borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:"bold"}}>Pendiente</span>}
                    {m.revisado&&<span style={{background:C.lgreen,color:C.green,borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:"bold"}}>✓ Revisado</span>}
                    {esTransf&&<span style={{background:"#ede7f6",color:"#6a1b9a",borderRadius:20,padding:"1px 8px",fontSize:10,fontWeight:"bold"}}>Interna</span>}
                  </div>
                </div>
                <div style={{textAlign:"right",marginLeft:8,flexShrink:0}}>
                  <div style={{fontWeight:"bold",color:esTransf?"#6a1b9a":m.tipo==="egreso"?C.red:m.tipo==="ajuste"?C.gold:C.green}}>{fmt(m.montoFinal)}</div>
                  {m.comision>0&&<div style={{fontSize:10,color:C.gold}}>com {m.pct}%: {fmt(m.comision)}</div>}
                </div>
              </div>
              <div style={{display:"flex",gap:6,marginTop:8,flexWrap:"wrap"}}>
                <button onClick={()=>setModal(esTransf?{...m,_esTransf:true}:m)} style={{padding:"4px 10px",borderRadius:9,border:"none",background:C.lblue,color:C.navy,fontWeight:"bold",fontSize:11,cursor:"pointer"}}>Editar</button>
                {!esTransf&&<button onClick={()=>{const clon={...m,id:uid(),concepto:(m.concepto||"")+" (copia)",historial:[],revisado:false};onAdd(clon);}} style={{padding:"4px 10px",borderRadius:9,border:"none",background:C.lgold,color:C.gold,fontWeight:"bold",fontSize:11,cursor:"pointer"}}>Duplicar</button>}
                <button onClick={()=>onEdit({...m,revisado:!m.revisado})} style={{padding:"4px 10px",borderRadius:9,border:"none",background:m.revisado?C.lgray:C.lgreen,color:m.revisado?C.gray:C.green,fontWeight:"bold",fontSize:11,cursor:"pointer"}}>{m.revisado?"Sin revisar":"✓ Revisar"}</button>
                <button onClick={()=>{if(window.confirm(`¿Eliminar?\n${m.concepto||"Sin concepto"} · ${fmt(m.montoFinal)}`))onDel(m.id);}} style={{padding:"4px 10px",borderRadius:9,border:"none",background:C.lred,color:C.red,fontWeight:"bold",fontSize:11,cursor:"pointer"}}>Eliminar</button>
              </div>
            </div>
          </div>
        </div>
      );})}
      {modal&&modal!=="transferencia"&&!modal?._esTransf&&<Modal title={modal==="nuevo"?"Nuevo movimiento":"Editar movimiento"} onClose={()=>setModal(null)} C={C}>
        <FormMov clientes={cls} cuentas={ctas} ini={modal==="nuevo"?null:modal} clientesRecientes={clientesRecientes} onSave={m=>{modal==="nuevo"?handleAdd(m):handleEdit(m);setModal(null);}} C={C} />
      </Modal>}
      {modal&&(modal==="transferencia"||modal?._esTransf)&&<Modal title={modal==="transferencia"?"Nueva transferencia":"Editar transferencia"} onClose={()=>setModal(null)} C={C}>
        <FormTransferencia cuentas={ctas} ini={modal==="transferencia"?null:modal} onSave={m=>{modal==="transferencia"?handleAdd(m):handleEdit(m);setModal(null);}} C={C} />
      </Modal>}
      {modal&&modal!=="nuevo"&&modal!=="transferencia"&&!modal?._esTransf&&<Modal title="Editar movimiento" onClose={()=>setModal(null)} C={C}>
        <FormMov clientes={cls} cuentas={ctas} ini={modal} clientesRecientes={clientesRecientes} onSave={m=>{handleEdit(m);setModal(null);}} C={C} />
      </Modal>}
    </div>
  );
}

function Reportes({cls,ctas,movs,C}){
  const inp2={width:"100%",padding:"9px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,fontSize:14,boxSizing:"border-box",outline:"none",fontFamily:"inherit",background:C.cardBg,color:C.text};
  const [rango,setRango]=useState("hoy");
  const [desde,setDesde]=useState(today());
  const [hasta,setHasta]=useState(today());
  const {d,h}=useMemo(()=>{const t=today();const now=new Date();if(rango==="hoy")return{d:t,h:t};if(rango==="semana"){const l=new Date(now);l.setDate(now.getDate()-((now.getDay()+6)%7));return{d:l.toISOString().slice(0,10),h:t};}if(rango==="mes")return{d:`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`,h:t};return{d:desde,h:hasta};},[rango,desde,hasta]);

  const mr=movs.filter(m=>m.fecha>=d&&m.fecha<=h);
  const ing=mr.filter(m=>m.tipo==="ingreso").reduce((a,m)=>a+m.montoFinal,0);
  const eg=mr.filter(m=>m.tipo==="egreso").reduce((a,m)=>a+m.montoFinal,0);
  const com=mr.filter(m=>m.tipo==="ingreso").reduce((a,m)=>a+m.comision,0);
  const comPorBanco=BANCOS.map(b=>({banco:b,com:mr.filter(m=>m.tipo==="ingreso"&&m.banco===b).reduce((a,m)=>a+m.comision,0),movs:mr.filter(m=>m.banco===b).length})).filter(b=>b.com>0||b.movs>0);
  const now=new Date();
  const comMesAct=movs.filter(m=>m.fecha.startsWith(`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`)&&m.tipo==="ingreso").reduce((a,m)=>a+m.comision,0);
  const prevMes=new Date(now.getFullYear(),now.getMonth()-1,1);
  const comMesAnt=movs.filter(m=>m.fecha.startsWith(`${prevMes.getFullYear()}-${String(prevMes.getMonth()+1).padStart(2,"0")}`)&&m.tipo==="ingreso").reduce((a,m)=>a+m.comision,0);
  const difCom=comMesAnt>0?((comMesAct-comMesAnt)/comMesAnt)*100:0;
  const saldosCta=ctas.map(c=>{const cm=movs.filter(m=>m.cuentaId===c.id&&m.fecha<=h);return{...c,saldo:(c.saldoInicial||0)+cm.filter(m=>m.tipo==="ingreso").reduce((a,m)=>a+m.montoFinal,0)-cm.filter(m=>m.tipo==="egreso").reduce((a,m)=>a+m.montoFinal,0)+cm.filter(m=>m.tipo==="ajuste").reduce((a,m)=>a+m.montoFinal,0)};});

  return(
    <div>
      <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
        {[["hoy","Hoy"],["semana","Semana"],["mes","Mes"],["personalizado","Rango"]].map(([k,l])=>(
          <button key={k} onClick={()=>setRango(k)} style={{padding:"7px 14px",borderRadius:20,border:`1.5px solid ${rango===k?C.navy:C.border}`,background:rango===k?C.navy:C.cardBg,color:rango===k?"#fff":C.gray,fontSize:12,cursor:"pointer",fontWeight:rango===k?"bold":"normal"}}>{l}</button>
        ))}
      </div>
      {rango==="personalizado"&&<div style={{display:"flex",gap:8,marginBottom:12}}><input type="date" value={desde} onChange={e=>setDesde(e.target.value)} style={{...inp2,marginBottom:0,flex:1}} /><input type="date" value={hasta} onChange={e=>setHasta(e.target.value)} style={{...inp2,marginBottom:0,flex:1}} /></div>}
      <div style={{background:C.navy,borderRadius:14,padding:18,marginBottom:12,color:"#fff"}}>
        <div style={{fontSize:10,opacity:.6,letterSpacing:2,textTransform:"uppercase",marginBottom:10}}>Resumen del período</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {[["📥 Ingresos",fmt(ing),"#a5d6a7"],["📤 Egresos",fmt(eg),"#ef9a9a"],["💸 Comisiones",fmt(com),"#fff176"],["📋 Movimientos",mr.length,"#90caf9"]].map(([l,v,col])=>(
            <div key={l} style={{background:"rgba(255,255,255,0.08)",borderRadius:10,padding:"10px 12px"}}><div style={{fontSize:10,opacity:.6,marginBottom:3}}>{l}</div><div style={{fontWeight:"bold",color:col,fontSize:15}}>{v}</div></div>
          ))}
        </div>
      </div>
      {comPorBanco.length>0&&<div style={{background:C.cardBg,borderRadius:14,padding:16,boxShadow:"0 2px 10px rgba(0,0,0,0.07)",marginBottom:12}}>
        <div style={{fontSize:12,fontWeight:"bold",color:C.navy,marginBottom:10}}>🏦 Comisiones por banco</div>
        {comPorBanco.map(b=>(
          <div key={b.banco} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
            <div><div style={{fontSize:13,color:C.navy,fontWeight:"bold"}}>{b.banco}</div><div style={{fontSize:11,color:C.gray}}>{b.movs} movimientos</div></div>
            <div style={{fontWeight:"bold",color:C.gold,fontSize:14}}>{fmt(b.com)}</div>
          </div>
        ))}
      </div>}
      <div style={{background:C.cardBg,borderRadius:14,padding:16,boxShadow:"0 2px 10px rgba(0,0,0,0.07)",marginBottom:12}}>
        <div style={{fontSize:12,fontWeight:"bold",color:C.navy,marginBottom:10}}>📊 Comisiones mes actual vs anterior</div>
        <div style={{display:"flex",gap:10}}>
          <div style={{flex:1,background:C.lgold,borderRadius:10,padding:"10px 12px",textAlign:"center"}}><div style={{fontSize:10,color:C.gold,marginBottom:4}}>Mes anterior</div><div style={{fontWeight:"bold",color:C.gold,fontSize:14}}>{fmt(comMesAnt)}</div></div>
          <div style={{flex:1,background:C.lgreen,borderRadius:10,padding:"10px 12px",textAlign:"center"}}><div style={{fontSize:10,color:C.green,marginBottom:4}}>Mes actual</div><div style={{fontWeight:"bold",color:C.green,fontSize:14}}>{fmt(comMesAct)}</div></div>
        </div>
        {comMesAnt>0&&<div style={{marginTop:8,fontSize:12,textAlign:"center",color:difCom>=0?C.green:C.red,fontWeight:"bold"}}>{difCom>=0?"▲":"▼"} {Math.abs(difCom).toFixed(1)}% vs mes anterior</div>}
      </div>
      <div style={{fontSize:10,color:C.gray,letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>Saldos acumulados por cuenta</div>
      {saldosCta.map(c=>(
        <div key={c.id} style={{background:C.cardBg,borderRadius:14,padding:14,boxShadow:"0 2px 10px rgba(0,0,0,0.07)",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div style={{fontWeight:"bold",color:C.navy}}>🏦 {c.nombre}</div><div style={{fontSize:11,color:C.gray}}>{c.banco}</div></div>
          <div style={{fontWeight:"bold",fontSize:16,color:c.saldo>=0?C.green:C.red}}>{fmt(c.saldo)}</div>
        </div>
      ))}
    </div>
  );
}

function Cierres({cls,ctas,movs,cierres,onCerrar,onBorrarUno,onBorrarTodos,C,todosMovs,todasCtas}){
  const inp2={width:"100%",padding:"9px 12px",borderRadius:8,border:`1.5px solid ${C.border}`,fontSize:14,boxSizing:"border-box",outline:"none",fontFamily:"inherit",background:C.cardBg,color:C.text};
  const [detalle,setDetalle]=useState(null);
  const [notas,setNotas]=useState("");
  const r=resumenTotal(cls,ctas,movs);

  // Enriquecer movimientos con info de cuenta en tiempo real
  function enriquecerMovs(fecha) {
    const mh = (todosMovs||movs).filter(m=>m.fecha===fecha);
    return mh.map(m => {
      const ctaOrigen  = (todasCtas||ctas).find(c=>c.id===m.cuentaOrigenId);
      const ctaDestino = (todasCtas||ctas).find(c=>c.id===m.cuentaDestinoId);
      const cta        = (todasCtas||ctas).find(c=>c.id===m.cuentaId);
      return {
        ...m,
        _cuentaNombre:       cta?.nombre        || m._cuentaNombre        || "",
        _cuentaBanco:        cta?.banco          || m._cuentaBanco         || m.banco || "",
        _cuentaOrigenNombre: ctaOrigen?.nombre   || m._cuentaOrigenNombre  || "",
        _cuentaOrigenBanco:  ctaOrigen?.banco    || m._cuentaOrigenBanco   || "",
        _cuentaDestinoNombre:ctaDestino?.nombre  || m._cuentaDestinoNombre || "",
        _cuentaDestinoBanco: ctaDestino?.banco   || m._cuentaDestinoBanco  || "",
      };
    });
  }

  function cerrar(){
    if(!window.confirm("¿Cerrar el día? Se guardará un snapshot fijo."))return;
    const hoy=today();
    const mhEnriquecidos=enriquecerMovs(hoy);
    onCerrar({id:uid(),fecha:hoy,totalEnCuentas:r.total,dineroClientes:r.dineroC,dineroDisponible:r.disponible,ingresosDelDia:mhEnriquecidos.filter(m=>m.tipo==="ingreso").reduce((a,m)=>a+m.montoFinal,0),egresosDelDia:mhEnriquecidos.filter(m=>m.tipo==="egreso").reduce((a,m)=>a+m.montoFinal,0),comisionesDelDia:mhEnriquecidos.filter(m=>m.tipo==="ingreso").reduce((a,m)=>a+m.comision,0),numeroMovimientos:mhEnriquecidos.length,movimientosDelDia:mhEnriquecidos,saldosPorCuenta:ctas.map(c=>({nombre:c.nombre,banco:c.banco,saldo:saldoCuenta(c,movs),_id:c.id})),notas,fechaCreacion:new Date().toISOString()});
    setNotas("");
  }

  function descargarPDF(detalle){
    // Enriquecer movimientos en tiempo real (por si el cierre es antiguo)
    const movsEnriquecidos = enriquecerMovs(detalle.fecha);
    const movs = movsEnriquecidos.length > 0 ? movsEnriquecidos : (detalle.movimientosDelDia || []);
    const cuentas = detalle.saldosPorCuenta || [];

    // Agrupar por cuenta — ingresos por m.banco, egresos/ajustes por m.cuentaId
    // Para el PDF construimos una lista de movimientos por cuenta
    const movsPorCuenta = cuentas.map(cta => {
      const ctaId = detalle.saldosPorCuenta.indexOf(cta); // usamos nombre como clave
      const nombre = cta.nombre;

      // Ingresos que tienen este banco asignado
      const ingresos = movs.filter(m => m.tipo === "ingreso" && m.banco === nombre);

      // Egresos y ajustes que pertenecen a esta cuenta por nombre
      const egresosAjustes = movs.filter(m =>
        (m.tipo === "egreso" || m.tipo === "ajuste") &&
        detalle.saldosPorCuenta.findIndex(c => c.nombre === nombre) >= 0 &&
        m._cuentaNombre === nombre
      );

      // Transferencias donde esta cuenta es origen (egreso) o destino (ingreso)
      const transferenciasSalida = movs.filter(m =>
        m.tipo === "transferencia" && m._cuentaOrigenNombre === nombre
      ).map(m => ({...m, _transferenciaDireccion: "salida"}));

      const transferenciasEntrada = movs.filter(m =>
        m.tipo === "transferencia" && m._cuentaDestinoNombre === nombre
      ).map(m => ({...m, _transferenciaDireccion: "entrada"}));

      return {
        nombre,
        banco: cta.banco,
        saldo: cta.saldo,
        movimientos: [...ingresos, ...egresosAjustes, ...transferenciasSalida, ...transferenciasEntrada]
      };
    });

    // Fallback: agrupar por banco del movimiento o cuenta
    const bancosAgrupados = BANCOS.map(banco => {
      const ingresos = movs.filter(m => m.tipo === "ingreso" && m.banco === banco);
      const egresos  = movs.filter(m => (m.tipo === "egreso" || m.tipo === "ajuste") && m._cuentaBanco === banco);
      const transOut = movs.filter(m => m.tipo === "transferencia" && m._cuentaOrigenBanco === banco)
                           .map(m => ({...m, _dir: "salida"}));
      const transIn  = movs.filter(m => m.tipo === "transferencia" && m._cuentaDestinoBanco === banco)
                           .map(m => ({...m, _dir: "entrada"}));
      return { banco, movimientos: [...ingresos, ...egresos, ...transOut, ...transIn] };
    }).filter(b => b.movimientos.length > 0);

    // Si no hay info de banco en egresos, agrupar por cuenta
    const cuentasAgrupadas = cuentas.map(cta => {
      const ing = movs.filter(m => m.tipo === "ingreso" && m.banco === cta.nombre);
      const eg  = movs.filter(m => (m.tipo === "egreso" || m.tipo === "ajuste") && m.cuentaId === cta._id);
      const tOut = movs.filter(m => m.tipo === "transferencia" && m.cuentaOrigenId === cta._id)
                       .map(m => ({...m, _dir: "salida"}));
      const tIn  = movs.filter(m => m.tipo === "transferencia" && m.cuentaDestinoId === cta._id)
                       .map(m => ({...m, _dir: "entrada"}));
      return { nombre: cta.nombre, banco: cta.banco, saldo: cta.saldo, movimientos: [...ing, ...eg, ...tOut, ...tIn] };
    }).filter(c => c.movimientos.length > 0);

    function filaMovimiento(m) {
      const esTransf = m.tipo === "transferencia";
      const dir = m._dir;
      const esEntrada = dir === "entrada";
      const esSalida = dir === "salida";
      const tipo = esTransf
        ? (esEntrada ? "📥 Transferencia entrada" : "📤 Transferencia salida")
        : m.tipo === "ingreso" ? "📥 Ingreso"
        : m.tipo === "egreso"  ? "📤 Egreso"
        : "⚖️ Ajuste";
      const color = esTransf
        ? (esEntrada ? "#2e7d32" : "#c62828")
        : m.tipo === "ingreso" ? "#2e7d32"
        : m.tipo === "egreso"  ? "#c62828"
        : "#f57f17";
      const signo = esTransf ? (esEntrada ? "+" : "−") : m.tipo === "ingreso" ? "+" : "−";
      return `
        <tr>
          <td>${tipo}</td>
          <td>${m.concepto || "Sin concepto"}</td>
          <td>${m.esNomina ? "🧾 Nómina" : esTransf ? "🔄 Interna" : "💸 Transferencia"}</td>
          <td style="text-align:right;font-weight:bold;color:${color}">${signo}${fmt(m.montoFinal)}</td>
          <td style="text-align:right;color:#f57f17">${!esTransf && m.comision > 0 ? fmt(m.comision) : "-"}</td>
        </tr>`;
    }

    function subtotalSeccion(movimientos) {
      const ing = movimientos.filter(m => m.tipo === "ingreso").reduce((a, m) => a + m.montoFinal, 0);
      const eg  = movimientos.filter(m => m.tipo === "egreso" || m.tipo === "ajuste").reduce((a, m) => a + m.montoFinal, 0);
      const tOut= movimientos.filter(m => m.tipo === "transferencia" && m._dir === "salida").reduce((a, m) => a + m.montoFinal, 0);
      const tIn = movimientos.filter(m => m.tipo === "transferencia" && m._dir === "entrada").reduce((a, m) => a + m.montoFinal, 0);
      const com = movimientos.filter(m => m.tipo === "ingreso").reduce((a, m) => a + m.comision, 0);
      const neto = ing + tIn - eg - tOut;
      return `
        <tr style="background:#1a3a5c;color:#fff;font-weight:bold;">
          <td colspan="3">Subtotal</td>
          <td style="text-align:right;color:${neto >= 0 ? "#a5d6a7" : "#ef9a9a"}">${neto >= 0 ? "+" : ""}${fmt(neto)}</td>
          <td style="text-align:right;color:#fff176">${fmt(com)}</td>
        </tr>`;
    }

    const contenido = `
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body{font-family:Arial,sans-serif;padding:30px;color:#1a1a1a;max-width:750px;margin:0 auto;}
          .header{background:#1a3a5c;color:#fff;padding:20px 24px;border-radius:10px;margin-bottom:24px;}
          .header .total{font-size:28px;font-weight:bold;color:#a5d6a7;margin:8px 0 0 0;}
          .resumen{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px;}
          .card{padding:12px 14px;border-radius:8px;}
          .card.green{background:#e8f5e9;} .card.red{background:#fce4ec;} .card.gold{background:#fff8e1;} .card.blue{background:#e8f0fb;} .card.gray{background:#f5f5f5;}
          .card-label{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;}
          .card-value{font-size:15px;font-weight:bold;}
          .section{font-size:11px;color:#1a3a5c;letter-spacing:2px;text-transform:uppercase;margin:20px 0 8px;padding-bottom:6px;border-bottom:2px solid #1a3a5c;font-weight:bold;}
          .cuenta-header{background:#2e6da4;color:#fff;padding:9px 14px;border-radius:6px 6px 0 0;font-weight:bold;font-size:13px;margin-top:16px;}
          table{width:100%;border-collapse:collapse;font-size:12px;}
          th{background:#1a3a5c;color:#fff;padding:8px 10px;text-align:left;font-size:11px;}
          td{padding:8px 10px;border-bottom:1px solid #eee;}
          tr:nth-child(even) td{background:#f9f9f9;}
          .notas{background:#fff8e1;border-left:4px solid #f57f17;padding:12px 14px;border-radius:8px;margin-bottom:16px;font-size:13px;}
          .footer{margin-top:30px;padding-top:16px;border-top:1px solid #eee;font-size:11px;color:#aaa;text-align:center;}
          .total-final td{background:#1a3a5c!important;color:#fff!important;font-weight:bold;padding:11px 10px;}
          @media print{body{padding:10px;}}
        </style>
      </head>
      <body>
        <div class="header">
          <div style="font-size:11px;opacity:.6;letter-spacing:2px;text-transform:uppercase">Cierre del Día</div>
          <div style="font-size:18px;font-weight:bold;margin:4px 0">${fmtDate(detalle.fecha)}</div>
          <div class="total">${fmt(detalle.totalEnCuentas)}</div>
          <div style="font-size:12px;opacity:.6;margin-top:4px">Total en cuentas</div>
        </div>

        <div class="section">Resumen del día</div>
        <div class="resumen">
          <div class="card green"><div class="card-label">📥 Ingresos</div><div class="card-value" style="color:#2e7d32">${fmt(detalle.ingresosDelDia)}</div></div>
          <div class="card red"><div class="card-label">📤 Egresos</div><div class="card-value" style="color:#c62828">${fmt(detalle.egresosDelDia)}</div></div>
          <div class="card gold"><div class="card-label">💸 Comisiones</div><div class="card-value" style="color:#f57f17">${fmt(detalle.comisionesDelDia)}</div></div>
          <div class="card blue"><div class="card-label">💼 Dinero clientes</div><div class="card-value" style="color:#2e6da4">${fmt(detalle.dineroClientes)}</div></div>
          <div class="card green"><div class="card-label">✅ Disponible real</div><div class="card-value" style="color:#2e7d32">${fmt(detalle.dineroDisponible)}</div></div>
          <div class="card gray"><div class="card-label">📋 Movimientos</div><div class="card-value">${detalle.numeroMovimientos}</div></div>
        </div>

        ${detalle.notas ? `<div class="notas">📝 ${detalle.notas}</div>` : ""}

        <div class="section">Saldos por cuenta</div>
        <table>
          <tr><th>Cuenta</th><th>Banco</th><th style="text-align:right">Saldo final</th></tr>
          ${cuentas.map(c => `
            <tr>
              <td><b>${c.nombre}</b></td>
              <td>${c.banco}</td>
              <td style="text-align:right;font-weight:bold;color:${c.saldo >= 0 ? "#2e7d32" : "#c62828"}">${fmt(c.saldo)}</td>
            </tr>`).join("")}
        </table>

        <div class="section">Movimientos por cuenta</div>
        ${cuentasAgrupadas.map(({nombre, banco, movimientos}) => `
          <div class="cuenta-header">🏦 ${nombre} — ${banco}</div>
          <table>
            <tr>
              <th>Tipo</th><th>Concepto</th><th>Operación</th>
              <th style="text-align:right">Monto</th>
              <th style="text-align:right">Comisión</th>
            </tr>
            ${movimientos.map(m => filaMovimiento(m)).join("")}
            ${subtotalSeccion(movimientos)}
          </table>
        `).join("")}

        <table style="margin-top:20px">
          <tr class="total-final">
            <td colspan="3">TOTAL GENERAL DEL DÍA</td>
            <td style="text-align:right">${fmt(detalle.ingresosDelDia - detalle.egresosDelDia)}</td>
            <td style="text-align:right">${fmt(detalle.comisionesDelDia)}</td>
          </tr>
        </table>

        <div class="footer">Control Financiero · Generado el ${fmtDate(today())} a las ${new Date().toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"})}</div>
      </body>
      </html>
    `;

    const ventana = window.open("", "_blank");
    ventana.document.write(contenido);
    ventana.document.close();
    ventana.focus();
    setTimeout(() => ventana.print(), 600);
  }

  if(detalle)return(
    <div>
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        <button onClick={()=>setDetalle(null)} style={{flex:1,padding:"9px 16px",borderRadius:9,border:"none",background:C.lgray,color:C.navy,fontWeight:"bold",fontSize:13,cursor:"pointer"}}>← Volver</button>
        <button onClick={()=>descargarPDF(detalle)} style={{flex:1,padding:"9px 16px",borderRadius:9,border:"none",background:"#2e7d32",color:"#fff",fontWeight:"bold",fontSize:13,cursor:"pointer"}}>📄 Descargar PDF</button>
      </div>
      <div style={{background:C.navy,borderRadius:14,padding:18,marginBottom:12,color:"#fff"}}>
        <div style={{fontSize:10,opacity:.6,letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>Cierre del día</div>
        <div style={{fontSize:22,fontWeight:"bold"}}>{fmtDate(detalle.fecha)}</div>
        <div style={{fontSize:30,fontWeight:"bold",color:"#a5d6a7",marginTop:8}}>{fmt(detalle.totalEnCuentas)}</div>
      </div>
      {[["📥 Ingresos",fmt(detalle.ingresosDelDia),C.lgreen,C.green],["📤 Egresos",fmt(detalle.egresosDelDia),C.lred,C.red],["💸 Comisiones",fmt(detalle.comisionesDelDia),C.lgold,C.gold],["💼 Dinero clientes",fmt(detalle.dineroClientes),C.lblue,C.blue],["✅ Disponible real",fmt(detalle.dineroDisponible),C.lgreen,C.green],["📋 Movimientos",detalle.numeroMovimientos,C.lgray,C.gray]].map(([l,v,bg,col])=>(
        <div key={l} style={{background:C.cardBg,borderRadius:14,padding:14,boxShadow:"0 2px 10px rgba(0,0,0,0.07)",marginBottom:8,display:"flex",justifyContent:"space-between"}}><span style={{color:C.gray,fontSize:14}}>{l}</span><span style={{fontWeight:"bold",color:col}}>{v}</span></div>
      ))}
      {detalle.notas&&<div style={{background:C.lgold,borderRadius:14,padding:14,marginBottom:8,borderLeft:`4px solid ${C.gold}`}}><div style={{fontSize:11,color:C.gold,fontWeight:"bold",marginBottom:4}}>📝 Notas</div><div style={{fontSize:13,color:"#5d4037"}}>{detalle.notas}</div></div>}
      {detalle.movimientosDelDia?.length>0&&<>
        <div style={{fontSize:10,color:C.gray,letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>Movimientos del día ({detalle.movimientosDelDia.length})</div>
        {detalle.movimientosDelDia.map(m=>{const mt=TIPO_META[m.tipo];return(
          <div key={m.id} style={{background:C.cardBg,borderRadius:14,padding:12,boxShadow:"0 2px 10px rgba(0,0,0,0.07)",marginBottom:8,display:"flex",gap:10,alignItems:"center"}}>
            <div style={{background:mt.bg,borderRadius:8,padding:"6px 8px",fontSize:16,flexShrink:0}}>{mt.emoji}</div>
            <div style={{flex:1}}><div style={{fontWeight:"bold",fontSize:13,color:C.navy}}>{m.concepto||"Sin concepto"}</div><div style={{fontSize:11,color:C.gray}}>{m.banco&&`${m.banco}`}{m.esNomina&&" · Nómina"}</div></div>
            <div style={{textAlign:"right",flexShrink:0}}><div style={{fontWeight:"bold",color:m.tipo==="egreso"?C.red:m.tipo==="ajuste"?C.gold:C.green}}>{fmt(m.montoFinal)}</div>{m.comision>0&&<div style={{fontSize:10,color:C.gold}}>com: {fmt(m.comision)}</div>}</div>
          </div>
        );})}
      </>}
      <div style={{fontSize:10,color:C.gray,letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>Saldos por cuenta</div>
      {detalle.saldosPorCuenta.map((c,i)=>(
        <div key={i} style={{background:C.cardBg,borderRadius:14,padding:14,boxShadow:"0 2px 10px rgba(0,0,0,0.07)",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div style={{fontWeight:"bold",color:C.navy}}>🏦 {c.nombre}</div><div style={{fontSize:11,color:C.gray}}>{c.banco}</div></div>
          <div style={{fontWeight:"bold",color:c.saldo>=0?C.green:C.red}}>{fmt(c.saldo)}</div>
        </div>
      ))}
    </div>
  );

  return(
    <div>
      <div style={{background:C.lgray,borderRadius:14,padding:16,marginBottom:12,borderLeft:`4px solid ${C.navy}`}}>
        <div style={{fontWeight:"bold",color:C.navy,marginBottom:8}}>Estado actual</div>
        {[["Total en cuentas",fmt(r.total),C.navy],["Dinero clientes",fmt(r.dineroC),C.blue],["Disponible real",fmt(r.disponible),r.disponible>=0?C.green:C.red]].map(([l,v,col])=>(
          <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:13,marginBottom:4}}><span style={{color:C.gray}}>{l}</span><span style={{fontWeight:"bold",color:col}}>{v}</span></div>
        ))}
      </div>
      <span style={{fontSize:10,color:C.gray,letterSpacing:1.5,textTransform:"uppercase",marginBottom:3,display:"block"}}>Notas del cierre</span>
      <input value={notas} onChange={e=>setNotas(e.target.value)} placeholder="Observaciones del día..." style={{...inp2,marginBottom:12}} />
      <button onClick={cerrar} style={{width:"100%",padding:14,borderRadius:9,border:"none",background:C.navy,color:"#fff",fontWeight:"bold",fontSize:15,cursor:"pointer",marginBottom:18}}>🔒 Cerrar día</button>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
        <div style={{fontSize:10,color:C.gray,letterSpacing:2,textTransform:"uppercase"}}>Historial ({cierres.length})</div>
        {cierres.length>0&&<button onClick={()=>{if(window.confirm("¿Borrar TODOS los cierres?"))onBorrarTodos();}} style={{padding:"4px 10px",borderRadius:9,border:"none",background:C.lred,color:C.red,fontWeight:"bold",fontSize:11,cursor:"pointer"}}>🗑️ Borrar todos</button>}
      </div>
      {cierres.length===0&&<div style={{color:C.gray,textAlign:"center",padding:20,fontSize:13}}>Sin cierres registrados</div>}
      {[...cierres].reverse().map(c=>(
        <div key={c.id} style={{background:C.cardBg,borderRadius:14,padding:14,boxShadow:"0 2px 10px rgba(0,0,0,0.07)",marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{flex:1,cursor:"pointer"}} onClick={()=>setDetalle(c)}><div style={{fontWeight:"bold",color:C.navy}}>{fmtDate(c.fecha)}</div><div style={{fontSize:11,color:C.gray}}>{c.numeroMovimientos} movimientos · Com: {fmt(c.comisionesDelDia)}</div></div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{textAlign:"right"}}><div style={{fontWeight:"bold",color:C.green}}>{fmt(c.totalEnCuentas)}</div></div>
              <button onClick={()=>{if(window.confirm(`¿Borrar cierre del ${fmtDate(c.fecha)}?`))onBorrarUno(c.id);}} style={{padding:"4px 8px",borderRadius:9,border:"none",background:C.lred,color:C.red,fontWeight:"bold",fontSize:13,cursor:"pointer"}}>🗑️</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ══ APP ══
const TABS=[{key:"resumen",label:"Resumen",emoji:"📊"},{key:"calc",label:"Calc",emoji:"⚡"},{key:"movimientos",label:"Movimientos",emoji:"📝"},{key:"clientes",label:"Clientes",emoji:"👤"},{key:"cuentas",label:"Cuentas",emoji:"🏦"},{key:"reportes",label:"Reportes",emoji:"📈"},{key:"cierres",label:"Cierres",emoji:"🔒"}];

export default function App(){
  const [dark,setDark]=useState(()=>load(KEYS.dark,false));
  const [loggedIn,setLoggedIn]=useState(()=>{const pin=load(KEYS.pin,"");return !pin;});
  const [tab,setTab]=useState("resumen");
  const [cls,setCls]=useState(()=>load(KEYS.cls,[]));
  const [ctas,setCtas]=useState(()=>load(KEYS.ctas,[]));
  const [movs,setMovs]=useState(()=>load(KEYS.movs,[]));
  const [cierres,setCierres]=useState(()=>load(KEYS.cierres,[]));
  const [meta,setMeta]=useState(()=>load(KEYS.meta,0));
  const [recientes,setRecientes]=useState([]);

  const C=dark?DARK:LIGHT;

  useEffect(()=>save(KEYS.cls,cls),[cls]);
  useEffect(()=>save(KEYS.ctas,ctas),[ctas]);
  useEffect(()=>save(KEYS.movs,movs),[movs]);
  useEffect(()=>save(KEYS.cierres,cierres),[cierres]);
  useEffect(()=>save(KEYS.meta,meta),[meta]);
  useEffect(()=>save(KEYS.dark,dark),[dark]);

  // Auto-bloqueo 5 minutos
  const timer=useRef(null);
  useEffect(()=>{
    const pin=load(KEYS.pin,"");
    if(!pin||!loggedIn)return;
    const reset=()=>{clearTimeout(timer.current);timer.current=setTimeout(()=>setLoggedIn(false),5*60*1000);};
    window.addEventListener("click",reset);window.addEventListener("keydown",reset);reset();
    return()=>{clearTimeout(timer.current);window.removeEventListener("click",reset);window.removeEventListener("keydown",reset);};
  },[loggedIn]);

  function updateRecientes(id){setRecientes(p=>[id,...p.filter(x=>x!==id)].slice(0,3));}

  if(!loggedIn)return<Login onLogin={()=>setLoggedIn(true)} C={C} />;

  return(
    <div style={{fontFamily:"Georgia,serif",minHeight:"100vh",background:C.bg,paddingBottom:80,color:C.text}}>
      <div style={{background:C.navy,padding:"16px 16px 12px",color:"#fff",position:"sticky",top:0,zIndex:10,boxShadow:"0 2px 8px rgba(0,0,0,0.2)"}}>
        <div style={{fontSize:9,letterSpacing:4,opacity:.5,textTransform:"uppercase"}}>Control Financiero</div>
        <div style={{fontSize:20,fontWeight:"bold",marginTop:2}}>{TABS.find(t=>t.key===tab)?.emoji} {TABS.find(t=>t.key===tab)?.label}</div>
      </div>
      <div style={{padding:"14px 12px",maxWidth:620,margin:"0 auto"}}>
        {tab==="resumen"&&<Resumen cls={cls} ctas={ctas} movs={movs} meta={meta} onSetMeta={v=>{setMeta(v);}} dark={dark} onToggleDark={()=>setDark(!dark)} onLock={()=>setLoggedIn(false)} C={C} />}
        {tab==="calc"&&<CalculadoraRapida clientes={cls} C={C} />}
        {tab==="movimientos"&&<Movimientos cls={cls} ctas={ctas} movs={movs} onAdd={m=>setMovs(p=>[...p,m])} onEdit={m=>setMovs(p=>p.map(x=>x.id===m.id?m:x))} onDel={id=>setMovs(p=>p.filter(x=>x.id!==id))} clientesRecientes={recientes} onUpdateRecientes={updateRecientes} C={C} />}
        {tab==="clientes"&&<Clientes cls={cls} movs={movs} onAdd={c=>setCls(p=>[...p,c])} onEdit={c=>setCls(p=>p.map(x=>x.id===c.id?c:x))} onDel={id=>setCls(p=>p.filter(x=>x.id!==id))} C={C} />}
        {tab==="cuentas"&&<Cuentas ctas={ctas} movs={movs} onAdd={c=>setCtas(p=>[...p,c])} onEdit={c=>setCtas(p=>p.map(x=>x.id===c.id?c:x))} onDel={id=>setCtas(p=>p.filter(x=>x.id!==id))} onConciliar={m=>setMovs(p=>[...p,m])} C={C} />}
        {tab==="reportes"&&<Reportes cls={cls} ctas={ctas} movs={movs} C={C} />}
        {tab==="cierres"&&<Cierres cls={cls} ctas={ctas} movs={movs} cierres={cierres} onCerrar={c=>setCierres(p=>[...p,c])} onBorrarUno={id=>setCierres(p=>p.filter(x=>x.id!==id))} onBorrarTodos={()=>setCierres([])} C={C} todosMovs={movs} todasCtas={ctas} />}
      </div>
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:C.cardBg,borderTop:`1px solid ${C.border}`,display:"flex",zIndex:20,boxShadow:"0 -2px 8px rgba(0,0,0,0.06)",overflowX:"auto"}}>
        {TABS.map(t=>(
          <button key={t.key} onClick={()=>setTab(t.key)} style={{flex:"0 0 auto",minWidth:60,padding:"9px 8px 7px",border:"none",background:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
            <span style={{fontSize:17}}>{t.emoji}</span>
            <span style={{fontSize:9,color:tab===t.key?C.navy:C.gray,fontWeight:tab===t.key?"bold":"normal",letterSpacing:.5,whiteSpace:"nowrap"}}>{t.label}</span>
            {tab===t.key&&<div style={{width:20,height:2,background:C.navy,borderRadius:2}} />}
          </button>
        ))}
      </div>
    </div>
  );
}

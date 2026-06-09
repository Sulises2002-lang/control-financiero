import { useState, useMemo, useEffect, useRef } from "react";

// ══ STORAGE ══
const KEYS={cls:"fin_clientes",ctas:"fin_cuentas",movs:"fin_movimientos",cierres:"fin_cierres",meta:"fin_meta",dark:"fin_dark",pin:"fin_pin"};
function load(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d;}catch{return d;}}
function save(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch{}}

// ══ UTILS ══
const uid=()=>Math.random().toString(36).slice(2,10);
const fmt=n=>isNaN(n)?"$0.00":new Intl.NumberFormat("es-MX",{style:"currency",currency:"MXN"}).format(n||0);
const fmtDate=d=>new Date(d+"T12:00:00").toLocaleDateString("es-MX",{day:"2-digit",month:"2-digit",year:"numeric"});
const fmtShort=d=>new Date(d+"T12:00:00").toLocaleDateString("es-MX",{day:"2-digit",month:"short"});
const today=()=>{const d=new Date();return`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;};
const parseMonto=v=>parseFloat((v||"").toString().replace(/,/g,""))||0;
const BANCOS=["Cruco Banorte","Cruco Afirme","Colpi Afirme"];
const CATEGORIAS=["Operación","Nómina","Proveedor","Bancario"];

// ══ TEMA ══
const T={
  light:{
    bg:"#f5f5f5",card:"#ffffff",text:"#111111",sub:"#666666",
    border:"#e5e5e5",accent:"#111111",
    green:"#16a34a",greenBg:"#f0fdf4",
    red:"#dc2626",redBg:"#fef2f2",
    amber:"#d97706",amberBg:"#fffbeb",
    blue:"#2563eb",blueBg:"#eff6ff",
    purple:"#7c3aed",purpleBg:"#f5f3ff",
    muted:"#f5f5f5",
  },
  dark:{
    bg:"#0a0a0a",card:"#1a1a1a",text:"#f5f5f5",sub:"#888888",
    border:"#2a2a2a",accent:"#f5f5f5",
    green:"#4ade80",greenBg:"#052e16",
    red:"#f87171",redBg:"#1c0a0a",
    amber:"#fbbf24",amberBg:"#1c1107",
    blue:"#60a5fa",blueBg:"#0c1a2e",
    purple:"#a78bfa",purpleBg:"#1e1533",
    muted:"#1a1a1a",
  }
};

// ══ LÓGICA ══
function calcMov(monto,tipo,cliente,banco,esNomina){
  const m=parseMonto(monto);
  if(tipo!=="ingreso"||!cliente||!banco)return{montoSinIVA:0,comision:0,montoFinal:m,pct:0};
  const config=(cliente.bancos||[]).find(b=>b.banco===banco);
  const pct=config?config.porcentaje:0;
  const base=esNomina?m:m/1.16;
  const comision=base*(pct/100);
  return{montoSinIVA:base,comision,montoFinal:m-comision,pct};
}
function saldoCliente(c,movs){
  const cm=movs.filter(m=>m.clienteId===c.id);
  return(c.saldoInicial||0)
    +cm.filter(m=>m.tipo==="ingreso").reduce((a,m)=>a+m.montoFinal,0)
    -cm.filter(m=>m.tipo==="egreso").reduce((a,m)=>a+m.montoFinal,0)
    +cm.filter(m=>m.tipo==="ajuste").reduce((a,m)=>a+m.montoFinal,0);
}
function saldoCuenta(c,movs){
  const cm=movs.filter(m=>m.cuentaId===c.id);
  const tOut=movs.filter(m=>m.tipo==="transferencia"&&m.cuentaOrigenId===c.id).reduce((a,m)=>a+m.montoFinal,0);
  const tIn =movs.filter(m=>m.tipo==="transferencia"&&m.cuentaDestinoId===c.id).reduce((a,m)=>a+m.montoFinal,0);
  return(c.saldoInicial||0)
    +cm.filter(m=>m.tipo==="ingreso").reduce((a,m)=>a+m.montoOriginal,0)
    -cm.filter(m=>m.tipo==="egreso").reduce((a,m)=>a+m.montoFinal,0)
    +cm.filter(m=>m.tipo==="ajuste"&&m.cuentaId).reduce((a,m)=>a+m.montoFinal,0)
    -tOut+tIn;
}
function resumen(cls,ctas,movs){
  const total=ctas.reduce((a,c)=>a+saldoCuenta(c,movs),0);
  const dineroC=cls.reduce((a,c)=>a+Math.max(saldoCliente(c,movs),0),0);
  const ing=movs.filter(m=>m.tipo==="ingreso").reduce((a,m)=>a+m.montoOriginal,0);
  const eg=movs.filter(m=>m.tipo==="egreso").reduce((a,m)=>a+m.montoFinal,0);
  const com=movs.filter(m=>m.tipo==="ingreso").reduce((a,m)=>a+m.comision,0);
  return{total,dineroC,disponible:total-dineroC,ing,eg,com};
}

// ══ ESTILOS BASE ══
const F="system-ui,-apple-system,sans-serif";
const inp=(t)=>({width:"100%",padding:"10px 12px",borderRadius:8,border:`1px solid ${t.border}`,fontSize:14,boxSizing:"border-box",outline:"none",fontFamily:F,background:t.card,color:t.text,transition:"border .15s"});
const card=(t,extra={})=>({background:t.card,borderRadius:12,border:`1px solid ${t.border}`,marginBottom:8,...extra});
const row=(extra={})=>({display:"flex",justifyContent:"space-between",alignItems:"center",...extra});
const btn=(bg,col,extra={})=>({padding:"10px 16px",borderRadius:8,border:"none",background:bg,color:col,fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:F,...extra});
const tag=(bg,col)=>({display:"inline-block",padding:"2px 8px",borderRadius:6,fontSize:11,fontWeight:600,background:bg,color:col});
const lbl=(t)=>({fontSize:11,color:t.sub,letterSpacing:.5,marginBottom:4,display:"block",fontFamily:F});

// ══ COMPONENTES ══
function Divider({t}){return<div style={{height:1,background:t.border,margin:"4px 0"}}/>;}

function Modal({title,onClose,children,t}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div style={{background:t.card,borderRadius:"16px 16px 0 0",width:"100%",maxWidth:600,maxHeight:"92vh",overflowY:"auto",padding:"20px 16px 40px",fontFamily:F}}>
        <div style={row({marginBottom:16})}>
          <span style={{fontWeight:700,fontSize:16,color:t.text}}>{title}</span>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:20,color:t.sub,padding:4}}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ══ PREVIEW CÁLCULO ══
function CalcPreview({monto,tipo,cliente,banco,esNomina,t}){
  const c=useMemo(()=>calcMov(monto,tipo,cliente,banco,esNomina),[monto,tipo,cliente,banco,esNomina]);
  if(!parseMonto(monto)||tipo!=="ingreso"||!banco)return null;
  const config=(cliente?.bancos||[]).find(b=>b.banco===banco);
  if(!config)return<div style={{...card(t),padding:"10px 14px",borderLeft:`3px solid ${t.amber}`}}><span style={{fontSize:12,color:t.amber}}>{banco} no está configurado para este cliente</span></div>;
  return(
    <div style={{...card(t),padding:"14px",borderLeft:`3px solid ${t.blue}`,marginBottom:12}}>
      <div style={row({marginBottom:6})}><span style={{fontSize:12,color:t.sub}}>Monto original</span><span style={{fontWeight:600,color:t.text}}>{fmt(parseMonto(monto))}</span></div>
      {!esNomina&&<div style={row({marginBottom:6})}><span style={{fontSize:12,color:t.sub}}>Sin IVA</span><span style={{fontSize:12,color:t.sub}}>{fmt(c.montoSinIVA)}</span></div>}
      <div style={row({marginBottom:10})}><span style={{fontSize:12,color:t.red}}>Comisión {c.pct}%{esNomina?" (total)":""}</span><span style={{fontSize:12,color:t.red}}>−{fmt(c.comision)}</span></div>
      <Divider t={t}/>
      <div style={row({marginTop:10})}><span style={{fontWeight:600,color:t.text}}>Monto final</span><span style={{fontWeight:700,fontSize:18,color:t.green}}>{fmt(c.montoFinal)}</span></div>
    </div>
  );
}

// ══ LOGIN ══
function Login({onLogin,t}){
  const [savedPin]=useState(()=>load(KEYS.pin,""));
  const [mode]=useState(savedPin?"login":"setup");
  const [fase,setFase]=useState("ingresar");
  const [pin,setPin]=useState("");
  const [confirm,setConfirm]=useState("");
  const [err,setErr]=useState("");
  const val=fase==="confirmar"?confirm:pin;
  const setVal=fase==="confirmar"?setConfirm:setPin;

  function press(n){if(val.length<6){setVal(p=>p+n);setErr("");}}
  function del(){setVal(p=>p.slice(0,-1));}
  function next(){
    if(pin.length<4)return setErr("Mínimo 4 dígitos");
    setFase("confirmar");
  }
  function setup(){
    if(confirm.length<4)return setErr("Mínimo 4 dígitos");
    if(pin!==confirm)return setErr("Los PINs no coinciden");
    save(KEYS.pin,pin);onLogin();
  }
  function login(){
    if(pin===savedPin){onLogin();}
    else{setErr("PIN incorrecto");setPin("");}
  }

  return(
    <div style={{minHeight:"100vh",background:t.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32,fontFamily:F}}>
      <div style={{fontSize:13,fontWeight:600,letterSpacing:3,color:t.sub,textTransform:"uppercase",marginBottom:8}}>Control Financiero</div>
      <div style={{fontSize:22,fontWeight:700,color:t.text,marginBottom:4}}>
        {mode==="login"?"Bienvenido":fase==="ingresar"?"Crear PIN":"Confirmar PIN"}
      </div>
      <div style={{fontSize:13,color:t.sub,marginBottom:36}}>
        {mode==="login"?"Ingresa tu PIN":fase==="ingresar"?"Elige un PIN de 4–6 dígitos":"Escribe tu PIN de nuevo"}
      </div>

      {/* Puntos */}
      <div style={{display:"flex",gap:12,marginBottom:40}}>
        {[0,1,2,3,4,5].map(i=>(
          <div key={i} style={{width:12,height:12,borderRadius:6,background:val.length>i?t.text:t.border,transition:"background .15s"}}/>
        ))}
      </div>

      {/* Teclado */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:24}}>
        {[1,2,3,4,5,6,7,8,9,"",0,"⌫"].map((n,i)=>(
          <button key={i} onClick={()=>n==="⌫"?del():n!==""?press(n.toString()):null}
            style={{width:72,height:72,borderRadius:36,border:`1px solid ${n==="⌫"?t.redBg:t.border}`,background:n==="⌫"?t.redBg:t.card,fontSize:n==="⌫"?18:22,fontWeight:600,color:n==="⌫"?t.red:t.text,cursor:n===""?"default":"pointer",visibility:n===""?"hidden":"visible",fontFamily:F}}>
            {n}
          </button>
        ))}
      </div>

      {err&&<div style={{color:t.red,fontSize:13,marginBottom:12}}>{err}</div>}

      <div style={{display:"flex",flexDirection:"column",gap:10,width:"100%",maxWidth:240}}>
        {mode==="login"&&pin.length>=4&&<button onClick={login} style={btn(t.text,"#fff",{width:"100%",padding:14,fontSize:15})}>Entrar</button>}
        {mode==="setup"&&fase==="ingresar"&&pin.length>=4&&<button onClick={next} style={btn(t.blue,"#fff",{width:"100%",padding:14,fontSize:15})}>Continuar</button>}
        {mode==="setup"&&fase==="confirmar"&&confirm.length>=4&&<button onClick={setup} style={btn(t.text,"#fff",{width:"100%",padding:14,fontSize:15})}>Crear PIN</button>}
        {mode==="setup"&&fase==="confirmar"&&<button onClick={()=>{setFase("ingresar");setPin("");setConfirm("");}} style={btn("transparent",t.sub,{width:"100%",padding:12,fontSize:13})}>← Volver</button>}
      </div>
    </div>
  );
}

// ══ FORMS ══
function FormCliente({ini,onSave,t}){
  const [nombre,setNombre]=useState(ini?.nombre||"");
  const [saldo0,setSaldo0]=useState(ini?.saldoInicial?.toString()||"0");
  const [notas,setNotas]=useState(ini?.notas||"");
  const [vip,setVip]=useState(ini?.vip||false);
  const [bancos,setBancos]=useState(ini?.bancos||[]);
  const [err,setErr]=useState("");

  function toggleBanco(b){setBancos(p=>p.find(x=>x.banco===b)?p.filter(x=>x.banco!==b):[...p,{banco:b,porcentaje:3}]);}
  function setPct(b,p){setBancos(prev=>prev.map(x=>x.banco===b?{...x,porcentaje:parseFloat(p)||0}:x));}

  function guardar(){
    if(!nombre.trim())return setErr("El nombre es obligatorio");
    if(!bancos.length)return setErr("Configura al menos un banco");
    setErr("");
    onSave({id:ini?.id||uid(),nombre:nombre.trim(),bancos,saldoInicial:parseMonto(saldo0),notas,vip,activo:true,fechaCreacion:ini?.fechaCreacion||today()});
  }

  return(
    <div style={{fontFamily:F}}>
      <span style={lbl(t)}>Nombre</span>
      <input value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="Nombre del cliente" style={{...inp(t),marginBottom:16}}/>

      <div style={row({marginBottom:16,cursor:"pointer"})} onClick={()=>setVip(!vip)}>
        <div><div style={{fontWeight:600,fontSize:14,color:t.text}}>Cliente VIP</div><div style={{fontSize:12,color:t.sub}}>Aparece destacado</div></div>
        <div style={{width:44,height:26,borderRadius:13,background:vip?t.text:t.border,display:"flex",alignItems:"center",padding:"0 3px",transition:"background .2s",justifyContent:vip?"flex-end":"flex-start"}}>
          <div style={{width:20,height:20,borderRadius:10,background:"white"}}/>
        </div>
      </div>

      <span style={lbl(t)}>Bancos y comisiones</span>
      {BANCOS.map(banco=>{
        const cfg=bancos.find(b=>b.banco===banco);
        const on=!!cfg;
        return(
          <div key={banco} style={{...card(t,{padding:"12px 14px",marginBottom:6})}}>
            <div style={row()}>
              <div style={row({gap:10,flex:1})}>
                <div onClick={()=>toggleBanco(banco)} style={{width:20,height:20,borderRadius:4,border:`1.5px solid ${on?t.text:t.border}`,background:on?t.text:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {on&&<span style={{color:"#fff",fontSize:13,lineHeight:1}}>✓</span>}
                </div>
                <span style={{fontSize:13,color:on?t.text:t.sub,fontWeight:on?600:400}}>{banco}</span>
              </div>
              {on&&(
                <div style={{display:"flex",gap:6}}>
                  {["3","4"].map(p=>(
                    <button key={p} onClick={()=>setPct(banco,p)} style={{padding:"4px 10px",borderRadius:6,border:`1px solid ${cfg?.porcentaje?.toString()===p?t.text:t.border}`,background:cfg?.porcentaje?.toString()===p?t.text:t.card,color:cfg?.porcentaje?.toString()===p?"#fff":t.sub,fontSize:12,fontWeight:600,cursor:"pointer"}}>{p}%</button>
                  ))}
                  <input type="number" placeholder="%" value={!["3","4"].includes(cfg?.porcentaje?.toString())?cfg?.porcentaje||"":""} onChange={e=>setPct(banco,e.target.value)} style={{...inp(t),width:54,padding:"4px 8px",fontSize:12}}/>
                </div>
              )}
            </div>
          </div>
        );
      })}

      <div style={{marginTop:16}}>
        <span style={lbl(t)}>Saldo inicial</span>
        <input value={saldo0} onChange={e=>setSaldo0(e.target.value)} style={{...inp(t),marginBottom:12}}/>
        <span style={lbl(t)}>Notas</span>
        <input value={notas} onChange={e=>setNotas(e.target.value)} placeholder="Opcional" style={{...inp(t),marginBottom:16}}/>
      </div>

      {err&&<div style={{color:t.red,fontSize:13,marginBottom:10}}>{err}</div>}
      <button onClick={guardar} style={btn(t.text,"#fff",{width:"100%",padding:12,fontSize:14})}>{ini?"Guardar":"Agregar cliente"}</button>
    </div>
  );
}

function FormCuenta({ini,onSave,t}){
  const [nombre,setNombre]=useState(ini?.nombre||"");
  const [banco,setBanco]=useState(ini?.banco||"");
  const [saldo0,setSaldo0]=useState(ini?.saldoInicial?.toString()||"0");
  const [err,setErr]=useState("");
  function guardar(){
    if(!nombre.trim())return setErr("El nombre es obligatorio");
    setErr("");
    onSave({id:ini?.id||uid(),nombre:nombre.trim(),banco:banco.trim(),saldoInicial:parseMonto(saldo0),activa:true,fechaCreacion:ini?.fechaCreacion||today()});
  }
  return(
    <div style={{fontFamily:F}}>
      <span style={lbl(t)}>Nombre</span>
      <input value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="Ej: Cuenta principal" style={{...inp(t),marginBottom:12}}/>
      <span style={lbl(t)}>Banco</span>
      <input value={banco} onChange={e=>setBanco(e.target.value)} placeholder="Ej: BBVA" style={{...inp(t),marginBottom:12}}/>
      <span style={lbl(t)}>Saldo inicial</span>
      <input value={saldo0} onChange={e=>setSaldo0(e.target.value)} style={{...inp(t),marginBottom:16}}/>
      {err&&<div style={{color:t.red,fontSize:13,marginBottom:10}}>{err}</div>}
      <button onClick={guardar} style={btn(t.text,"#fff",{width:"100%",padding:12,fontSize:14})}>{ini?"Guardar":"Agregar cuenta"}</button>
    </div>
  );
}

function FormMov({cls,ctas,ini,onSave,recientes,t}){
  const [tipo,setTipo]=useState(ini?.tipo||"ingreso");
  const [clienteId,setClienteId]=useState(ini?.clienteId||"");
  const [cuentaId,setCuentaId]=useState(ini?.cuentaId||ctas[0]?.id||"");
  const [banco,setBanco]=useState(ini?.banco||"");
  const [esNomina,setEsNomina]=useState(ini?.esNomina||false);
  const [monto,setMonto]=useState(ini?.montoOriginal?.toString()||"");
  const [concepto,setConcepto]=useState(ini?.concepto||"");
  const [categoria,setCategoria]=useState(ini?.categoria||"");
  const [notas,setNotas]=useState(ini?.notas||"");
  const [fecha,setFecha]=useState(ini?.fecha||today());
  const [estado,setEstado]=useState(ini?.estado||"confirmado");
  const [err,setErr]=useState("");

  const cliente=cls.find(c=>c.id===clienteId);
  const bancosCliente=cliente?.bancos||[];

  const clsOrdenados=useMemo(()=>{
    const vips=cls.filter(c=>c.vip);
    const rec=(recientes||[]).map(id=>cls.find(c=>c.id===id)).filter(Boolean);
    const resto=cls.filter(c=>!c.vip&&!(recientes||[]).includes(c.id));
    return[...vips,...rec.filter(c=>!c.vip),...resto];
  },[cls,recientes]);

  function guardar(){
    if(!cuentaId)return setErr("Selecciona una cuenta");
    const m=parseMonto(monto);
    if(!m||m<=0)return setErr("El monto debe ser mayor a 0");
    if(tipo==="ingreso"&&clienteId&&!banco)return setErr("Selecciona el banco de origen");
    setErr("");
    onSave({id:ini?.id||uid(),tipo,clienteId:clienteId||null,cuentaId,banco:banco||null,esNomina,concepto,categoria,notas,fecha,estado,montoOriginal:m,...calcMov(monto,tipo,cliente,banco,esNomina),historial:ini?.historial||[],revisado:ini?.revisado||false});
  }

  const tipoColors={ingreso:{bg:t.greenBg,color:t.green},egreso:{bg:t.redBg,color:t.red},ajuste:{bg:t.amberBg,color:t.amber}};

  return(
    <div style={{fontFamily:F}}>
      {/* Tipo */}
      <div style={{display:"flex",gap:6,marginBottom:16}}>
        {["ingreso","egreso","ajuste"].map(tp=>{
          const tc=tipoColors[tp];
          return<button key={tp} onClick={()=>setTipo(tp)} style={{flex:1,padding:"9px 4px",borderRadius:8,border:`1px solid ${tipo===tp?tc.color:t.border}`,background:tipo===tp?tc.bg:t.card,color:tipo===tp?tc.color:t.sub,fontWeight:600,fontSize:12,cursor:"pointer",fontFamily:F,textTransform:"capitalize"}}>{tp}</button>;
        })}
      </div>

      <span style={lbl(t)}>Cuenta</span>
      <select value={cuentaId} onChange={e=>setCuentaId(e.target.value)} style={{...inp(t),marginBottom:12}}>
        <option value="">Selecciona</option>
        {ctas.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}
      </select>

      <span style={lbl(t)}>Cliente (opcional)</span>
      <select value={clienteId} onChange={e=>{setClienteId(e.target.value);setBanco("");}} style={{...inp(t),marginBottom:12}}>
        <option value="">Sin cliente</option>
        {clsOrdenados.map(c=><option key={c.id} value={c.id}>{c.vip?"⭐ ":""}{c.nombre}</option>)}
      </select>

      {tipo==="ingreso"&&clienteId&&<>
        <span style={lbl(t)}>Banco de origen</span>
        <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
          {!bancosCliente.length
            ?<div style={{fontSize:12,color:t.red}}>Sin bancos configurados</div>
            :bancosCliente.map(b=><button key={b.banco} onClick={()=>setBanco(b.banco)} style={{padding:"8px 12px",borderRadius:8,border:`1px solid ${banco===b.banco?t.text:t.border}`,background:banco===b.banco?t.text:t.card,color:banco===b.banco?"#fff":t.sub,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:F}}>{b.banco} {b.porcentaje}%</button>)}
        </div>
        <div style={{display:"flex",gap:6,marginBottom:12}}>
          {["Transferencia","Nómina"].map(op=><button key={op} onClick={()=>setEsNomina(op==="Nómina")} style={{flex:1,padding:"9px",borderRadius:8,border:`1px solid ${(op==="Nómina")===esNomina?t.text:t.border}`,background:(op==="Nómina")===esNomina?t.text:t.card,color:(op==="Nómina")===esNomina?"#fff":t.sub,fontWeight:600,fontSize:13,cursor:"pointer",fontFamily:F}}>{op}</button>)}
        </div>
      </>}

      <span style={lbl(t)}>Monto</span>
      <input type="text" inputMode="decimal" placeholder="0.00" value={monto} onChange={e=>setMonto(e.target.value)} style={{...inp(t),fontSize:18,marginBottom:12}}/>
      <CalcPreview monto={monto} tipo={tipo} cliente={cliente} banco={banco} esNomina={esNomina} t={t}/>

      <span style={lbl(t)}>Concepto</span>
      <input value={concepto} onChange={e=>setConcepto(e.target.value)} placeholder="Descripción" style={{...inp(t),marginBottom:12}}/>

      <div style={{display:"flex",gap:8,marginBottom:12}}>
        <div style={{flex:1}}>
          <span style={lbl(t)}>Categoría</span>
          <select value={categoria} onChange={e=>setCategoria(e.target.value)} style={inp(t)}>
            <option value="">Ninguna</option>
            {CATEGORIAS.map(c=><option key={c}>{c}</option>)}
          </select>
        </div>
        <div style={{flex:1}}>
          <span style={lbl(t)}>Estado</span>
          <select value={estado} onChange={e=>setEstado(e.target.value)} style={inp(t)}>
            <option value="confirmado">Confirmado</option>
            <option value="pendiente">Pendiente</option>
          </select>
        </div>
      </div>

      <span style={lbl(t)}>Fecha</span>
      <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)} style={{...inp(t),marginBottom:12}}/>
      <span style={lbl(t)}>Notas</span>
      <input value={notas} onChange={e=>setNotas(e.target.value)} placeholder="Opcional" style={{...inp(t),marginBottom:16}}/>

      {err&&<div style={{color:t.red,fontSize:13,marginBottom:10}}>{err}</div>}
      <button onClick={guardar} style={btn(t.text,"#fff",{width:"100%",padding:12,fontSize:14})}>{ini?"Guardar":"Registrar movimiento"}</button>
    </div>
  );
}

function FormTransferencia({ctas,ini,onSave,t}){
  const [origenId,setOrigenId]=useState(ini?.cuentaOrigenId||"");
  const [destinoId,setDestinoId]=useState(ini?.cuentaDestinoId||"");
  const [monto,setMonto]=useState(ini?.montoFinal?.toString()||"");
  const [concepto,setConcepto]=useState(ini?.concepto||"Transferencia entre cuentas");
  const [fecha,setFecha]=useState(ini?.fecha||today());
  const [err,setErr]=useState("");
  const origen=ctas.find(c=>c.id===origenId);
  const destino=ctas.find(c=>c.id===destinoId);

  function guardar(){
    if(!origenId)return setErr("Selecciona la cuenta origen");
    if(!destinoId)return setErr("Selecciona la cuenta destino");
    if(origenId===destinoId)return setErr("Las cuentas deben ser diferentes");
    const m=parseMonto(monto);
    if(!m||m<=0)return setErr("El monto debe ser mayor a 0");
    setErr("");
    onSave({id:ini?.id||uid(),tipo:"transferencia",cuentaId:origenId,cuentaOrigenId:origenId,cuentaDestinoId:destinoId,clienteId:null,concepto,notas:"",fecha,montoOriginal:m,montoSinIVA:0,comision:0,montoFinal:m,pct:0,estado:"confirmado",revisado:false,historial:[],esNomina:false,banco:null});
  }

  return(
    <div style={{fontFamily:F}}>
      <div style={{...card(t,{padding:"12px 14px",borderLeft:`3px solid ${t.purple}`,marginBottom:16})}}>
        <div style={{fontSize:13,color:t.purple,fontWeight:600}}>Transferencia interna — sin comisión</div>
      </div>

      <span style={lbl(t)}>Cuenta origen</span>
      <select value={origenId} onChange={e=>{setOrigenId(e.target.value);if(e.target.value===destinoId)setDestinoId("");}} style={{...inp(t),marginBottom:12}}>
        <option value="">Selecciona</option>
        {ctas.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}
      </select>

      <span style={lbl(t)}>Cuenta destino</span>
      <select value={destinoId} onChange={e=>setDestinoId(e.target.value)} style={{...inp(t),marginBottom:12}}>
        <option value="">Selecciona</option>
        {ctas.filter(c=>c.id!==origenId).map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}
      </select>

      {origenId&&destinoId&&parseMonto(monto)>0&&(
        <div style={{...card(t,{padding:"12px 14px",marginBottom:12})}}>
          <div style={row()}>
            <div style={{textAlign:"center",flex:1}}><div style={{fontSize:11,color:t.sub}}>Sale de</div><div style={{fontWeight:600,color:t.red}}>{origen?.nombre}</div><div style={{color:t.red}}>−{fmt(parseMonto(monto))}</div></div>
            <div style={{color:t.sub,fontSize:18}}>→</div>
            <div style={{textAlign:"center",flex:1}}><div style={{fontSize:11,color:t.sub}}>Llega a</div><div style={{fontWeight:600,color:t.green}}>{destino?.nombre}</div><div style={{color:t.green}}>+{fmt(parseMonto(monto))}</div></div>
          </div>
        </div>
      )}

      <span style={lbl(t)}>Monto</span>
      <input type="text" inputMode="decimal" placeholder="0.00" value={monto} onChange={e=>setMonto(e.target.value)} style={{...inp(t),fontSize:18,marginBottom:12}}/>
      <span style={lbl(t)}>Concepto</span>
      <input value={concepto} onChange={e=>setConcepto(e.target.value)} style={{...inp(t),marginBottom:12}}/>
      <span style={lbl(t)}>Fecha</span>
      <input type="date" value={fecha} onChange={e=>setFecha(e.target.value)} style={{...inp(t),marginBottom:16}}/>
      {err&&<div style={{color:t.red,fontSize:13,marginBottom:10}}>{err}</div>}
      <button onClick={guardar} style={btn(t.text,"#fff",{width:"100%",padding:12,fontSize:14})}>{ini?"Guardar":"Registrar transferencia"}</button>
    </div>
  );
}

// ══ PANTALLAS ══
function Resumen({cls,ctas,movs,meta,onSetMeta,dark,onToggleDark,onLock,onCambiarPin,t}){
  const r=resumen(cls,ctas,movs);
  const [editMeta,setEditMeta]=useState(false);
  const [metaInput,setMetaInput]=useState(meta?.toString()||"");
  const mes=today().slice(0,7);
  const comMes=movs.filter(m=>m.fecha.startsWith(mes)&&m.tipo==="ingreso").reduce((a,m)=>a+m.comision,0);
  const pctMeta=meta>0?Math.min((comMes/meta)*100,100):0;

  const alertas=[];
  cls.forEach(c=>{
    const s=saldoCliente(c,movs);
    if(s<0)alertas.push(`${c.nombre} tiene saldo negativo`);
    else if(s<500&&movs.some(m=>m.clienteId===c.id))alertas.push(`${c.nombre} tiene saldo bajo`);
  });

  const topCliente=cls.map(c=>({...c,com:movs.filter(m=>m.clienteId===c.id&&m.tipo==="ingreso").reduce((a,m)=>a+m.comision,0)})).sort((a,b)=>b.com-a.com)[0];

  return(
    <div>
      {/* Controles */}
      <div style={row({marginBottom:16,gap:8})}>
        <button onClick={onToggleDark} style={btn(t.muted,t.sub,{padding:"6px 12px",fontSize:12})}>{dark?"☀️":"🌙"}</button>
        <button onClick={onLock} style={btn(t.muted,t.sub,{padding:"6px 12px",fontSize:12})}>Bloquear</button>
        <button onClick={onCambiarPin} style={btn(t.muted,t.sub,{padding:"6px 12px",fontSize:12})}>PIN</button>
      </div>

      {alertas.length>0&&(
        <div style={{...card(t,{padding:"12px 14px",borderLeft:`3px solid ${t.amber}`,marginBottom:12})}}>
          {alertas.map((a,i)=><div key={i} style={{fontSize:13,color:t.amber,marginBottom:i<alertas.length-1?4:0}}>⚠ {a}</div>)}
        </div>
      )}

      {/* Total */}
      <div style={{background:t.text,borderRadius:12,padding:"20px 18px",marginBottom:8,color:t.bg}}>
        <div style={{fontSize:11,opacity:.5,letterSpacing:2,textTransform:"uppercase",marginBottom:8}}>Total en cuentas</div>
        <div style={{fontSize:36,fontWeight:700,letterSpacing:"-1.5px",marginBottom:16}}>{fmt(r.total)}</div>
        <div style={{display:"flex",gap:12}}>
          <div style={{flex:1}}>
            <div style={{fontSize:11,opacity:.5,marginBottom:2}}>Clientes</div>
            <div style={{fontWeight:600,fontSize:15}}>{fmt(r.dineroC)}</div>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:11,opacity:.5,marginBottom:2}}>Disponible</div>
            <div style={{fontWeight:600,fontSize:15,color:r.disponible>=0?"#86efac":"#fca5a5"}}>{fmt(r.disponible)}</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:8}}>
        {[[fmt(r.ing),"Ingresos",t.green],[fmt(r.eg),"Egresos",t.red],[fmt(r.com),"Comisiones",t.amber]].map(([v,l,col])=>(
          <div key={l} style={{...card(t,{padding:"12px 10px",textAlign:"center"})}}>
            <div style={{fontWeight:700,fontSize:14,color:col,marginBottom:2}}>{v}</div>
            <div style={{fontSize:10,color:t.sub,textTransform:"uppercase",letterSpacing:.5}}>{l}</div>
          </div>
        ))}
      </div>

      {/* Meta */}
      <div style={card(t,{padding:"14px"})}>
        <div style={row({marginBottom:8})}>
          <span style={{fontWeight:600,fontSize:13,color:t.text}}>Meta de comisiones</span>
          <button onClick={()=>{setEditMeta(!editMeta);setMetaInput(meta?.toString()||"");}} style={btn(t.muted,t.sub,{padding:"4px 10px",fontSize:11})}>{editMeta?"Cancelar":"Editar"}</button>
        </div>
        {editMeta&&<div style={{display:"flex",gap:8,marginBottom:10}}>
          <input value={metaInput} onChange={e=>setMetaInput(e.target.value)} placeholder="Meta en $" style={{...inp(t),flex:1}}/>
          <button onClick={()=>{onSetMeta(parseMonto(metaInput));setEditMeta(false);}} style={btn(t.text,"#fff",{padding:"8px 14px"})}>OK</button>
        </div>}
        <div style={row({fontSize:12,color:t.sub,marginBottom:meta>0?8:0})}>
          <span>Este mes: {fmt(comMes)}</span>
          <span>{meta>0?`Meta: ${fmt(meta)}`:"Sin meta"}</span>
        </div>
        {meta>0&&<>
          <div style={{height:6,background:t.border,borderRadius:3,overflow:"hidden"}}>
            <div style={{height:"100%",background:pctMeta>=100?t.green:t.blue,borderRadius:3,width:`${pctMeta}%`,transition:"width .5s"}}/>
          </div>
          <div style={{fontSize:11,color:pctMeta>=100?t.green:t.sub,marginTop:4,textAlign:"right"}}>{pctMeta.toFixed(0)}%{pctMeta>=100?" · Meta alcanzada 🎉":""}</div>
        </>}
      </div>

      {/* Análisis */}
      {topCliente?.com>0&&(
        <div style={card(t,{padding:"14px"})}>
          <div style={{fontSize:11,color:t.sub,textTransform:"uppercase",letterSpacing:.5,marginBottom:10}}>Análisis</div>
          <div style={row()}>
            <div><div style={{fontSize:12,color:t.sub}}>Top cliente</div><div style={{fontWeight:600,color:t.text}}>{topCliente.nombre}</div></div>
            <div style={{fontWeight:600,color:t.amber}}>{fmt(topCliente.com)}</div>
          </div>
        </div>
      )}

      {/* Gráfica simple */}
      {(()=>{
        const semanas=[];
        const map={};
        movs.forEach(m=>{const d=new Date(m.fecha+"T12:00:00");const l=new Date(d);l.setDate(d.getDate()-((d.getDay()+6)%7));const k=l.toISOString().slice(0,10);if(!map[k])map[k]={k,ing:0,eg:0};if(m.tipo==="ingreso")map[k].ing+=m.montoFinal;if(m.tipo==="egreso")map[k].eg+=m.montoFinal;});
        const sw=Object.values(map).sort((a,b)=>a.k.localeCompare(b.k)).slice(-6);
        if(!sw.length)return null;
        const mx=Math.max(...sw.flatMap(s=>[s.ing,s.eg]),1);
        return(
          <div style={card(t,{padding:"14px"})}>
            <div style={{fontSize:11,color:t.sub,textTransform:"uppercase",letterSpacing:.5,marginBottom:12}}>Semanas recientes</div>
            <div style={{display:"flex",alignItems:"flex-end",gap:6,height:80}}>
              {sw.map(s=>(
                <div key={s.k} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}>
                  <div style={{width:"100%",display:"flex",gap:2,alignItems:"flex-end",height:64}}>
                    <div style={{flex:1,background:t.green,borderRadius:"2px 2px 0 0",opacity:.7,height:`${(s.ing/mx)*100}%`,minHeight:s.ing>0?2:0}}/>
                    <div style={{flex:1,background:t.red,borderRadius:"2px 2px 0 0",opacity:.7,height:`${(s.eg/mx)*100}%`,minHeight:s.eg>0?2:0}}/>
                  </div>
                  <div style={{fontSize:8,color:t.sub}}>{fmtShort(s.k)}</div>
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:12,marginTop:8}}>
              <div style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:8,height:8,borderRadius:2,background:t.green,opacity:.7}}/><span style={{fontSize:10,color:t.sub}}>Ing</span></div>
              <div style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:8,height:8,borderRadius:2,background:t.red,opacity:.7}}/><span style={{fontSize:10,color:t.sub}}>Eg</span></div>
            </div>
          </div>
        );
      })()}

      {/* Cuentas */}
      <div style={{fontSize:11,color:t.sub,textTransform:"uppercase",letterSpacing:.5,marginTop:8,marginBottom:8}}>Cuentas</div>
      {!ctas.length&&<div style={{color:t.sub,textAlign:"center",padding:20,fontSize:13}}>Sin cuentas</div>}
      {ctas.map(c=>{
        const s=saldoCuenta(c,movs);
        return(
          <div key={c.id} style={card(t,{padding:"14px"})}>
            <div style={row()}>
              <div><div style={{fontWeight:600,color:t.text,fontSize:14}}>{c.nombre}</div><div style={{fontSize:11,color:t.sub}}>{c.banco}</div></div>
              <div style={{fontWeight:700,fontSize:16,color:s>=0?t.green:t.red}}>{fmt(s)}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Clientes({cls,movs,onAdd,onEdit,onDel,onAddMov,t}){
  const [modal,setModal]=useState(null);
  const [detalle,setDetalle]=useState(null);
  const [reajuste,setReajuste]=useState(false);
  const [nuevoSaldo,setNuevoSaldo]=useState("");
  const [notaAjuste,setNotaAjuste]=useState("Reajuste de saldo");

  if(detalle){
    const c=detalle;
    const cm=movs.filter(m=>m.clienteId===c.id);
    const s=saldoCliente(c,movs);
    const ing=cm.filter(m=>m.tipo==="ingreso").reduce((a,m)=>a+m.montoFinal,0);
    const eg=cm.filter(m=>m.tipo==="egreso").reduce((a,m)=>a+m.montoFinal,0);
    const com=cm.filter(m=>m.tipo==="ingreso").reduce((a,m)=>a+m.comision,0);

    function hacerReajuste(){
      const nuevo=parseMonto(nuevoSaldo);
      const dif=nuevo-s;
      if(dif===0)return;
      onAddMov({id:uid(),tipo:"ajuste",clienteId:c.id,cuentaId:null,banco:null,esNomina:false,concepto:notaAjuste||"Reajuste de saldo",categoria:"Operación",notas:`${fmt(s)} → ${fmt(nuevo)}`,fecha:today(),estado:"confirmado",montoOriginal:dif,montoSinIVA:0,comision:0,montoFinal:dif,pct:0,historial:[],revisado:false});
      setReajuste(false);setNuevoSaldo("");setNotaAjuste("Reajuste de saldo");
    }

    return(
      <div style={{fontFamily:F}}>
        <button onClick={()=>{setDetalle(null);setReajuste(false);}} style={btn(t.muted,t.sub,{marginBottom:14})}>← Volver</button>
        <div style={{background:t.text,borderRadius:12,padding:"18px",marginBottom:8,color:t.bg}}>
          <div style={{fontWeight:700,fontSize:18}}>{c.vip?"⭐ ":""}{c.nombre}</div>
          <div style={{fontSize:11,opacity:.5,marginTop:4}}>{(c.bancos||[]).map(b=>`${b.banco} ${b.porcentaje}%`).join(" · ")}</div>
          {c.notas&&<div style={{fontSize:12,opacity:.6,marginTop:6}}>{c.notas}</div>}
          <div style={{fontSize:32,fontWeight:700,marginTop:12,color:s>=0?"#86efac":"#fca5a5",letterSpacing:"-1px"}}>{fmt(s)}</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:8}}>
          {[[fmt(ing),"Ingresos",t.green],[fmt(eg),"Egresos",t.red],[fmt(com),"Comisiones",t.amber]].map(([v,l,col])=>(
            <div key={l} style={card(t,{padding:"10px 8px",textAlign:"center"})}><div style={{fontWeight:700,fontSize:12,color:col}}>{v}</div><div style={{fontSize:10,color:t.sub}}>{l}</div></div>
          ))}
        </div>

        <button onClick={()=>setReajuste(!reajuste)} style={{...btn(reajuste?t.amberBg:t.muted,reajuste?t.amber:t.sub,{width:"100%",padding:"10px",marginBottom:10})}}>⚖ {reajuste?"Cancelar reajuste":"Reajustar saldo"}</button>

        {reajuste&&(
          <div style={card(t,{padding:"14px",borderLeft:`3px solid ${t.amber}`,marginBottom:10})}>
            <div style={row({marginBottom:10})}><span style={{fontSize:12,color:t.sub}}>Saldo actual</span><span style={{fontWeight:600,color:s>=0?t.green:t.red}}>{fmt(s)}</span></div>
            <span style={lbl(t)}>Nuevo saldo</span>
            <input type="text" inputMode="decimal" placeholder="0.00" value={nuevoSaldo} onChange={e=>setNuevoSaldo(e.target.value)} style={{...inp(t),fontSize:16,marginBottom:10}}/>
            {nuevoSaldo&&(()=>{const nuevo=parseMonto(nuevoSaldo);const dif=nuevo-s;return<div style={row({marginBottom:10})}><span style={{fontSize:12,color:t.sub}}>Diferencia</span><span style={{fontWeight:600,color:dif>=0?t.green:t.red}}>{dif>=0?"+":""}{fmt(dif)}</span></div>;})()}
            <span style={lbl(t)}>Concepto</span>
            <input value={notaAjuste} onChange={e=>setNotaAjuste(e.target.value)} style={{...inp(t),marginBottom:12}}/>
            <button onClick={hacerReajuste} disabled={!nuevoSaldo} style={btn(t.text,"#fff",{width:"100%",padding:"10px",opacity:nuevoSaldo?1:.5})}>Aplicar reajuste</button>
          </div>
        )}

        <div style={{fontSize:11,color:t.sub,textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>Movimientos</div>
        {!cm.length&&<div style={{color:t.sub,textAlign:"center",padding:20,fontSize:13}}>Sin movimientos</div>}
        {[...cm].sort((a,b)=>b.fecha.localeCompare(a.fecha)).map(m=>{
          const esPos=m.montoFinal>=0;
          return(
            <div key={m.id} style={card(t,{padding:"12px 14px"})}>
              <div style={row()}>
                <div style={{flex:1}}>
                  <div style={{fontWeight:600,fontSize:13,color:t.text}}>{m.concepto||"Sin concepto"}</div>
                  <div style={{fontSize:11,color:t.sub,marginTop:2}}>{fmtDate(m.fecha)}{m.banco&&` · ${m.banco}`}{m.esNomina&&" · Nómina"}</div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontWeight:600,color:m.tipo==="egreso"||(m.tipo==="ajuste"&&!esPos)?t.red:t.green}}>{esPos&&m.tipo!=="egreso"?"+":""}{fmt(m.montoFinal)}</div>
                  {m.comision>0&&<div style={{fontSize:10,color:t.amber}}>com: {fmt(m.comision)}</div>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const vips=cls.filter(c=>c.vip);
  const normales=cls.filter(c=>!c.vip);

  return(
    <div style={{fontFamily:F}}>
      <button onClick={()=>setModal("nuevo")} style={btn(t.text,"#fff",{width:"100%",padding:"10px",marginBottom:14,fontSize:14})}>+ Agregar cliente</button>
      {!cls.length&&<div style={{color:t.sub,textAlign:"center",padding:30,fontSize:13}}>Sin clientes</div>}
      {vips.length>0&&<div style={{fontSize:10,color:t.sub,textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>VIP</div>}
      {[...vips,...normales].map(c=>{
        const s=saldoCliente(c,movs);
        const com=movs.filter(m=>m.clienteId===c.id&&m.tipo==="ingreso").reduce((a,m)=>a+m.comision,0);
        return(
          <div key={c.id} style={card(t,{padding:"14px",borderLeft:c.vip?`3px solid ${t.amber}`:""})}>
            <div style={row()}>
              <div style={{flex:1,cursor:"pointer"}} onClick={()=>setDetalle(c)}>
                <div style={row({gap:8,marginBottom:4})}>
                  <span style={{fontWeight:600,fontSize:14,color:t.text}}>{c.vip?"⭐ ":""}{c.nombre}</span>
                  <span style={{...tag(s<0?t.redBg:s<500&&movs.some(m=>m.clienteId===c.id)?t.amberBg:t.greenBg,s<0?t.red:s<500&&movs.some(m=>m.clienteId===c.id)?t.amber:t.green),fontSize:10}}>{s<0?"●":s<500&&movs.some(m=>m.clienteId===c.id)?"●":"●"}</span>
                </div>
                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  {(c.bancos||[]).map(b=><span key={b.banco} style={tag(t.muted,t.sub)}>{b.banco} {b.porcentaje}%</span>)}
                </div>
                {c.notas&&<div style={{fontSize:11,color:t.sub,marginTop:4,fontStyle:"italic"}}>{c.notas}</div>}
                <div style={{fontSize:11,color:t.sub,marginTop:4}}>Com: {fmt(com)}</div>
              </div>
              <div style={{textAlign:"right",marginLeft:12}}>
                <div style={{fontWeight:700,fontSize:16,color:s>=0?t.green:t.red}}>{fmt(s)}</div>
                <div style={{display:"flex",gap:4,marginTop:6}}>
                  <button onClick={()=>setModal(c)} style={btn(t.muted,t.sub,{padding:"4px 8px",fontSize:11})}>Editar</button>
                  <button onClick={()=>{if(window.confirm(`¿Eliminar a ${c.nombre}?`))onDel(c.id);}} style={btn(t.redBg,t.red,{padding:"4px 8px",fontSize:11})}>Eliminar</button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
      {modal&&<Modal title={modal==="nuevo"?"Nuevo cliente":`Editar: ${modal.nombre}`} onClose={()=>setModal(null)} t={t}>
        <FormCliente ini={modal==="nuevo"?null:modal} onSave={c=>{modal==="nuevo"?onAdd(c):onEdit(c);setModal(null);}} t={t}/>
      </Modal>}
    </div>
  );
}

function Cuentas({ctas,movs,onAdd,onEdit,onDel,onConciliar,t}){
  const [modal,setModal]=useState(null);
  const [conciliar,setConciliar]=useState(null);
  const [saldoBanco,setSaldoBanco]=useState("");

  return(
    <div style={{fontFamily:F}}>
      <button onClick={()=>setModal("nueva")} style={btn(t.text,"#fff",{width:"100%",padding:"10px",marginBottom:14,fontSize:14})}>+ Agregar cuenta</button>
      {!ctas.length&&<div style={{color:t.sub,textAlign:"center",padding:30,fontSize:13}}>Sin cuentas</div>}
      {ctas.map(c=>{
        const s=saldoCuenta(c,movs);
        const n=movs.filter(m=>m.cuentaId===c.id).length;
        return(
          <div key={c.id} style={card(t,{padding:"14px"})}>
            <div style={row({marginBottom:10})}>
              <div><div style={{fontWeight:600,fontSize:14,color:t.text}}>{c.nombre}</div><div style={{fontSize:11,color:t.sub}}>{c.banco} · {n} mov.</div></div>
              <div style={{fontWeight:700,fontSize:18,color:s>=0?t.green:t.red}}>{fmt(s)}</div>
            </div>
            <div style={{display:"flex",gap:6}}>
              <button onClick={()=>setModal(c)} style={btn(t.muted,t.sub,{padding:"5px 10px",fontSize:11})}>Editar</button>
              <button onClick={()=>{setConciliar(c);setSaldoBanco("");}} style={btn(t.amberBg,t.amber,{padding:"5px 10px",fontSize:11})}>Conciliar</button>
              <button onClick={()=>{if(window.confirm(`¿Eliminar ${c.nombre}?`))onDel(c.id);}} style={btn(t.redBg,t.red,{padding:"5px 10px",fontSize:11})}>Eliminar</button>
            </div>
          </div>
        );
      })}
      {modal&&<Modal title={modal==="nueva"?"Nueva cuenta":`Editar: ${modal.nombre}`} onClose={()=>setModal(null)} t={t}>
        <FormCuenta ini={modal==="nueva"?null:modal} onSave={c=>{modal==="nueva"?onAdd(c):onEdit(c);setModal(null);}} t={t}/>
      </Modal>}
      {conciliar&&(()=>{
        const s=saldoCuenta(conciliar,movs);
        const real=parseMonto(saldoBanco);
        const dif=real-s;
        return(
          <Modal title={`Conciliar: ${conciliar.nombre}`} onClose={()=>setConciliar(null)} t={t}>
            <div style={row({marginBottom:12})}><span style={{color:t.sub,fontSize:13}}>Saldo en app</span><span style={{fontWeight:600,color:t.text}}>{fmt(s)}</span></div>
            <span style={lbl(t)}>Saldo real en banco</span>
            <input type="text" inputMode="decimal" placeholder="0.00" value={saldoBanco} onChange={e=>setSaldoBanco(e.target.value)} style={{...inp(t),marginBottom:12}}/>
            {saldoBanco&&<div style={card(t,{padding:"12px 14px",borderLeft:`3px solid ${Math.abs(dif)<0.01?t.green:t.red}`,marginBottom:12})}>
              <div style={row()}><span style={{fontSize:12,color:t.sub}}>Diferencia</span><span style={{fontWeight:700,color:dif>=0?t.green:t.red}}>{fmt(dif)}</span></div>
              {Math.abs(dif)<0.01&&<div style={{fontSize:12,color:t.green,marginTop:4}}>✓ Todo cuadrado</div>}
            </div>}
            {saldoBanco&&Math.abs(dif)>0.01&&<button onClick={()=>{onConciliar({id:uid(),tipo:"ajuste",clienteId:null,cuentaId:conciliar.id,concepto:`Ajuste conciliación (${conciliar.nombre})`,categoria:"Bancario",notas:`Banco: ${fmt(real)} · App: ${fmt(s)}`,fecha:today(),estado:"confirmado",montoOriginal:Math.abs(dif),montoSinIVA:0,comision:0,montoFinal:dif,revisado:false,historial:[],esNomina:false,banco:null});setConciliar(null);}} style={btn(t.text,"#fff",{width:"100%",padding:"10px"})}>Crear ajuste ({fmt(Math.abs(dif))})</button>}
          </Modal>
        );
      })()}
    </div>
  );
}

function Movimientos({cls,ctas,movs,onAdd,onEdit,onDel,recientes,onUpdateRecientes,t}){
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

  function handleAdd(m){onAdd(m);if(m.clienteId)onUpdateRecientes(m.clienteId);}
  function handleEdit(m){const o=movs.find(x=>x.id===m.id);onEdit({...m,historial:[...(o?.historial||[]),{fecha:new Date().toISOString(),cambio:`${fmt(o?.montoOriginal)}→${fmt(m.montoOriginal)}`}]});if(m.clienteId)onUpdateRecientes(m.clienteId);}

  const tipoColor={ingreso:t.green,egreso:t.red,ajuste:t.amber,transferencia:t.purple};

  return(
    <div style={{fontFamily:F}}>
      <div style={{display:"flex",gap:6,marginBottom:12}}>
        <button onClick={()=>setModal("nuevo")} style={btn(t.text,"#fff",{flex:1,padding:"10px",fontSize:14})}>+ Movimiento</button>
        <button onClick={()=>setModal("transferencia")} style={btn(t.purpleBg,t.purple,{padding:"10px 14px",fontSize:14})}>⇄</button>
      </div>

      <input value={buscar} onChange={e=>setBuscar(e.target.value)} placeholder="Buscar..." style={{...inp(t),marginBottom:10}}/>

      <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
        {["ingreso","egreso","ajuste"].map(tp=><button key={tp} onClick={()=>setF(p=>({...p,tipo:p.tipo===tp?"":tp}))} style={{padding:"5px 12px",borderRadius:6,border:`1px solid ${f.tipo===tp?tipoColor[tp]:t.border}`,background:f.tipo===tp?t.muted:t.card,color:f.tipo===tp?tipoColor[tp]:t.sub,fontSize:12,cursor:"pointer",fontFamily:F,textTransform:"capitalize",fontWeight:f.tipo===tp?600:400}}>{tp}</button>)}
        {(f.tipo||f.clienteId||f.cuentaId||f.fecha||buscar)&&<button onClick={()=>{setF({tipo:"",clienteId:"",cuentaId:"",fecha:""});setBuscar("");}} style={{padding:"5px 12px",borderRadius:6,border:`1px solid ${t.red}`,background:t.redBg,color:t.red,fontSize:12,cursor:"pointer",fontFamily:F}}>✕</button>}
      </div>

      <div style={{display:"flex",gap:6,marginBottom:12}}>
        <select value={f.clienteId} onChange={e=>setF(p=>({...p,clienteId:e.target.value}))} style={{...inp(t),flex:1,fontSize:11}}>
          <option value="">Todos los clientes</option>
          {cls.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <input type="date" value={f.fecha} onChange={e=>setF(p=>({...p,fecha:e.target.value}))} style={{...inp(t),flex:1,fontSize:11}}/>
      </div>

      <div style={{fontSize:11,color:t.sub,marginBottom:8}}>{filtrados.length} movimiento{filtrados.length!==1?"s":""}</div>
      {!filtrados.length&&<div style={{color:t.sub,textAlign:"center",padding:30,fontSize:13}}>Sin movimientos</div>}
      {filtrados.map(m=>{
        const cli=cls.find(c=>c.id===m.clienteId);
        const cta=ctas.find(c=>c.id===m.cuentaId);
        const ctaO=ctas.find(c=>c.id===m.cuentaOrigenId);
        const ctaD=ctas.find(c=>c.id===m.cuentaDestinoId);
        const esT=m.tipo==="transferencia";
        const col=tipoColor[m.tipo]||t.sub;
        return(
          <div key={m.id} style={card(t,{padding:"12px 14px",borderLeft:m.revisado?`3px solid ${t.green}`:""})}>
            <div style={row({marginBottom:6})}>
              <div style={{flex:1}}>
                <div style={row({gap:6,marginBottom:2})}>
                  <span style={{fontWeight:600,fontSize:14,color:t.text}}>{m.concepto||"Sin concepto"}</span>
                  <span style={tag(t.muted,col)}>{m.tipo}</span>
                  {m.esNomina&&<span style={tag(t.amberBg,t.amber)}>Nómina</span>}
                  {m.estado==="pendiente"&&<span style={tag(t.amberBg,t.amber)}>Pendiente</span>}
                  {m.revisado&&<span style={tag(t.greenBg,t.green)}>✓</span>}
                </div>
                <div style={{fontSize:11,color:t.sub}}>
                  {esT?`${ctaO?.nombre} → ${ctaD?.nombre}`:`${cta?.nombre}${cli?` · ${cli.nombre}`:""}`} · {fmtDate(m.fecha)}
                </div>
              </div>
              <div style={{textAlign:"right",marginLeft:8}}>
                <div style={{fontWeight:700,color:col}}>{fmt(m.montoFinal)}</div>
                {m.comision>0&&<div style={{fontSize:10,color:t.amber}}>com: {fmt(m.comision)}</div>}
              </div>
            </div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              <button onClick={()=>setModal(esT?{...m,_t:true}:m)} style={btn(t.muted,t.sub,{padding:"4px 8px",fontSize:11})}>Editar</button>
              {!esT&&<button onClick={()=>{const clon={...m,id:uid(),concepto:(m.concepto||"")+" (copia)",historial:[],revisado:false};onAdd(clon);}} style={btn(t.muted,t.sub,{padding:"4px 8px",fontSize:11})}>Duplicar</button>}
              <button onClick={()=>onEdit({...m,revisado:!m.revisado})} style={btn(m.revisado?t.muted:t.greenBg,m.revisado?t.sub:t.green,{padding:"4px 8px",fontSize:11})}>{m.revisado?"Sin revisar":"✓ Revisar"}</button>
              <button onClick={()=>{if(window.confirm(`¿Eliminar?\n${m.concepto||"Sin concepto"} · ${fmt(m.montoFinal)}`))onDel(m.id);}} style={btn(t.redBg,t.red,{padding:"4px 8px",fontSize:11})}>Eliminar</button>
            </div>
          </div>
        );
      })}

      {modal&&modal!=="nuevo"&&modal!=="transferencia"&&!modal._t&&<Modal title="Editar movimiento" onClose={()=>setModal(null)} t={t}>
        <FormMov cls={cls} ctas={ctas} ini={modal} recientes={recientes} onSave={m=>{handleEdit(m);setModal(null);}} t={t}/>
      </Modal>}
      {modal&&(modal==="nuevo")&&<Modal title="Nuevo movimiento" onClose={()=>setModal(null)} t={t}>
        <FormMov cls={cls} ctas={ctas} ini={null} recientes={recientes} onSave={m=>{handleAdd(m);setModal(null);}} t={t}/>
      </Modal>}
      {modal&&(modal==="transferencia"||modal?._t)&&<Modal title={modal==="transferencia"?"Nueva transferencia":"Editar transferencia"} onClose={()=>setModal(null)} t={t}>
        <FormTransferencia ctas={ctas} ini={modal==="transferencia"?null:modal} onSave={m=>{modal==="transferencia"?handleAdd(m):handleEdit(m);setModal(null);}} t={t}/>
      </Modal>}
    </div>
  );
}

function Reportes({cls,ctas,movs,t}){
  const [rango,setRango]=useState("hoy");
  const [desde,setDesde]=useState(today());
  const [hasta,setHasta]=useState(today());

  const {d,h}=useMemo(()=>{
    const tn=today();const now=new Date();
    if(rango==="hoy")return{d:tn,h:tn};
    if(rango==="semana"){const l=new Date(now);l.setDate(now.getDate()-((now.getDay()+6)%7));return{d:l.toISOString().slice(0,10),h:tn};}
    if(rango==="mes")return{d:`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`,h:tn};
    return{d:desde,h:hasta};
  },[rango,desde,hasta]);

  const mr=movs.filter(m=>m.fecha>=d&&m.fecha<=h);
  const ing=mr.filter(m=>m.tipo==="ingreso").reduce((a,m)=>a+m.montoFinal,0);
  const eg=mr.filter(m=>m.tipo==="egreso").reduce((a,m)=>a+m.montoFinal,0);
  const com=mr.filter(m=>m.tipo==="ingreso").reduce((a,m)=>a+m.comision,0);

  const now=new Date();
  const mesAct=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const prevMes=new Date(now.getFullYear(),now.getMonth()-1,1);
  const mesAnt=`${prevMes.getFullYear()}-${String(prevMes.getMonth()+1).padStart(2,"0")}`;
  const comAct=movs.filter(m=>m.fecha.startsWith(mesAct)&&m.tipo==="ingreso").reduce((a,m)=>a+m.comision,0);
  const comAnt=movs.filter(m=>m.fecha.startsWith(mesAnt)&&m.tipo==="ingreso").reduce((a,m)=>a+m.comision,0);
  const dif=comAnt>0?((comAct-comAnt)/comAnt)*100:0;

  const saldosCta=ctas.map(c=>{
    const cm=movs.filter(m=>m.cuentaId===c.id&&m.fecha<=h);
    return{...c,saldo:(c.saldoInicial||0)+cm.filter(m=>m.tipo==="ingreso").reduce((a,m)=>a+m.montoOriginal,0)-cm.filter(m=>m.tipo==="egreso").reduce((a,m)=>a+m.montoFinal,0)+cm.filter(m=>m.tipo==="ajuste"&&m.cuentaId).reduce((a,m)=>a+m.montoFinal,0)};
  });

  const comPorBanco=BANCOS.map(b=>({banco:b,com:mr.filter(m=>m.tipo==="ingreso"&&m.banco===b).reduce((a,m)=>a+m.comision,0)})).filter(b=>b.com>0);

  return(
    <div style={{fontFamily:F}}>
      <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
        {[["hoy","Hoy"],["semana","Semana"],["mes","Mes"],["personalizado","Rango"]].map(([k,l])=>(
          <button key={k} onClick={()=>setRango(k)} style={{padding:"7px 14px",borderRadius:6,border:`1px solid ${rango===k?t.text:t.border}`,background:rango===k?t.text:t.card,color:rango===k?t.bg:t.sub,fontSize:12,cursor:"pointer",fontWeight:rango===k?600:400,fontFamily:F}}>{l}</button>
        ))}
      </div>
      {rango==="personalizado"&&<div style={{display:"flex",gap:8,marginBottom:12}}>
        <input type="date" value={desde} onChange={e=>setDesde(e.target.value)} style={{...inp(t),flex:1}}/>
        <input type="date" value={hasta} onChange={e=>setHasta(e.target.value)} style={{...inp(t),flex:1}}/>
      </div>}

      <div style={{background:t.text,borderRadius:12,padding:"18px",marginBottom:8,color:t.bg}}>
        <div style={{fontSize:11,opacity:.5,textTransform:"uppercase",letterSpacing:2,marginBottom:12}}>Período</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
          {[[fmt(ing),"Ingresos","#86efac"],[fmt(eg),"Egresos","#fca5a5"],[fmt(com),"Comisiones","#fde68a"],[mr.length,"Movimientos","#bfdbfe"]].map(([v,l,col])=>(
            <div key={l} style={{background:"rgba(255,255,255,0.07)",borderRadius:8,padding:"10px 12px"}}>
              <div style={{fontSize:10,opacity:.5,marginBottom:3}}>{l}</div>
              <div style={{fontWeight:700,color:col,fontSize:15}}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {comPorBanco.length>0&&<div style={card(t,{padding:"14px"})}>
        <div style={{fontSize:11,color:t.sub,textTransform:"uppercase",letterSpacing:.5,marginBottom:10}}>Comisiones por banco</div>
        {comPorBanco.map(b=>(
          <div key={b.banco} style={row({padding:"8px 0",borderBottom:`1px solid ${t.border}`})}>
            <span style={{fontSize:13,color:t.text}}>{b.banco}</span>
            <span style={{fontWeight:600,color:t.amber}}>{fmt(b.com)}</span>
          </div>
        ))}
      </div>}

      <div style={card(t,{padding:"14px"})}>
        <div style={{fontSize:11,color:t.sub,textTransform:"uppercase",letterSpacing:.5,marginBottom:10}}>Mes actual vs anterior</div>
        <div style={{display:"flex",gap:8}}>
          <div style={{flex:1,background:t.amberBg,borderRadius:8,padding:"10px",textAlign:"center"}}><div style={{fontSize:10,color:t.amber,marginBottom:4}}>Anterior</div><div style={{fontWeight:700,color:t.amber}}>{fmt(comAnt)}</div></div>
          <div style={{flex:1,background:t.greenBg,borderRadius:8,padding:"10px",textAlign:"center"}}><div style={{fontSize:10,color:t.green,marginBottom:4}}>Actual</div><div style={{fontWeight:700,color:t.green}}>{fmt(comAct)}</div></div>
        </div>
        {comAnt>0&&<div style={{fontSize:12,textAlign:"center",color:dif>=0?t.green:t.red,fontWeight:600,marginTop:8}}>{dif>=0?"▲":"▼"} {Math.abs(dif).toFixed(1)}%</div>}
      </div>

      <div style={{fontSize:11,color:t.sub,textTransform:"uppercase",letterSpacing:.5,marginBottom:8}}>Saldos por cuenta</div>
      {saldosCta.map(c=>(
        <div key={c.id} style={card(t,{padding:"12px 14px"})}>
          <div style={row()}><div><div style={{fontWeight:600,color:t.text}}>{c.nombre}</div><div style={{fontSize:11,color:t.sub}}>{c.banco}</div></div><div style={{fontWeight:700,color:c.saldo>=0?t.green:t.red}}>{fmt(c.saldo)}</div></div>
        </div>
      ))}
    </div>
  );
}

function Cierres({cls,ctas,movs,cierres,onCerrar,onBorrarUno,onBorrarTodos,t}){
  const [detalle,setDetalle]=useState(null);
  const [notas,setNotas]=useState("");
  const r=resumen(cls,ctas,movs);

  function enriquecer(fecha){
    return movs.filter(m=>m.fecha===fecha).map(m=>{
      const ctaO=ctas.find(c=>c.id===m.cuentaOrigenId);
      const ctaD=ctas.find(c=>c.id===m.cuentaDestinoId);
      const cta=ctas.find(c=>c.id===m.cuentaId);
      return{...m,_cuentaNombre:cta?.nombre||m._cuentaNombre||"",_cuentaBanco:cta?.banco||m._cuentaBanco||m.banco||"",_cuentaOrigenNombre:ctaO?.nombre||m._cuentaOrigenNombre||"",_cuentaDestinoNombre:ctaD?.nombre||m._cuentaDestinoNombre||""};
    });
  }

  function cerrar(){
    if(!window.confirm("¿Cerrar el día?"))return;
    const hoy=today();
    const mh=enriquecer(hoy);
    onCerrar({id:uid(),fecha:hoy,totalEnCuentas:r.total,dineroClientes:r.dineroC,dineroDisponible:r.disponible,ingresosDelDia:mh.filter(m=>m.tipo==="ingreso").reduce((a,m)=>a+m.montoFinal,0),egresosDelDia:mh.filter(m=>m.tipo==="egreso").reduce((a,m)=>a+m.montoFinal,0),comisionesDelDia:mh.filter(m=>m.tipo==="ingreso").reduce((a,m)=>a+m.comision,0),numeroMovimientos:mh.length,movimientosDelDia:mh,saldosPorCuenta:ctas.map(c=>({nombre:c.nombre,banco:c.banco,saldo:saldoCuenta(c,movs),_id:c.id})),notas,fechaCreacion:new Date().toISOString()});
    setNotas("");
  }

  function descargarPDF(det){
    const mvs=enriquecer(det.fecha);
    const cts=det.saldosPorCuenta||[];
    const cuentasAgrupadas=cts.map(cta=>{
      const nombre=cta.nombre;
      const ingresos=mvs.filter(m=>(m.tipo==="ingreso")&&m._cuentaNombre===nombre);
      const egresos=mvs.filter(m=>(m.tipo==="egreso"||m.tipo==="ajuste")&&m._cuentaNombre===nombre);
      const tOut=mvs.filter(m=>m.tipo==="transferencia"&&m._cuentaOrigenNombre===nombre).map(m=>({...m,_dir:"salida"}));
      const tIn=mvs.filter(m=>m.tipo==="transferencia"&&m._cuentaDestinoNombre===nombre).map(m=>({...m,_dir:"entrada"}));
      return{nombre,banco:cta.banco,saldo:cta.saldo,ingresos:[...ingresos,...tIn.filter(m=>m._dir==="entrada")],egresos:[...egresos,...tOut.filter(m=>m._dir==="salida")]};
    }).filter(c=>c.ingresos.length||c.egresos.length);

    const html=`<html><head><meta charset="UTF-8"><style>
      *{box-sizing:border-box;margin:0;padding:0;}
      body{font-family:system-ui,sans-serif;padding:28px;color:#111;font-size:13px;}
      .header{background:#111;color:#fff;padding:20px 24px;border-radius:10px;margin-bottom:20px;}
      .header .total{font-size:28px;font-weight:700;color:#86efac;margin:6px 0 2px;}
      .grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px;}
      .stat{background:#f5f5f5;border-radius:8px;padding:12px;}
      .stat-val{font-size:16px;font-weight:700;margin-bottom:2px;}
      .stat-lbl{font-size:10px;color:#666;text-transform:uppercase;letter-spacing:.5px;}
      .section{font-size:10px;color:#666;text-transform:uppercase;letter-spacing:2px;margin:18px 0 8px;padding-bottom:6px;border-bottom:1px solid #e5e5e5;}
      table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:4px;}
      th{background:#111;color:#fff;padding:7px 10px;text-align:left;font-size:11px;font-weight:600;}
      td{padding:7px 10px;border-bottom:1px solid #f0f0f0;}
      tr:nth-child(even) td{background:#fafafa;}
      .sub{background:#f5f5f5;font-weight:600;}
      .green{color:#16a34a;font-weight:600;} .red{color:#dc2626;font-weight:600;}
      .amber{color:#d97706;font-weight:600;}
      .total-row td{background:#111;color:#fff;font-weight:700;padding:10px;}
      .cuenta-title{background:#374151;color:#fff;padding:8px 12px;border-radius:6px 6px 0 0;font-weight:600;margin-top:14px;}
      .two-col{display:grid;grid-template-columns:1fr 1fr;gap:0;}
      .col-header{padding:7px 10px;font-size:11px;font-weight:700;}
      .green-header{background:#f0fdf4;color:#16a34a;}
      .red-header{background:#fef2f2;color:#dc2626;}
      @media print{body{padding:12px;}}
    </style></head><body>
    <div class="header">
      <div style="font-size:11px;opacity:.6;letter-spacing:2px;text-transform:uppercase">Cierre del Día</div>
      <div style="font-size:18px;font-weight:700;margin:4px 0">${fmtDate(det.fecha)}</div>
      <div class="total">${fmt(det.totalEnCuentas)}</div>
      <div style="font-size:11px;opacity:.5">Total en cuentas</div>
    </div>
    <div class="grid3">
      <div class="stat"><div class="stat-val green">${fmt(det.ingresosDelDia)}</div><div class="stat-lbl">Ingresos</div></div>
      <div class="stat"><div class="stat-val red">${fmt(det.egresosDelDia)}</div><div class="stat-lbl">Egresos</div></div>
      <div class="stat"><div class="stat-val amber">${fmt(det.comisionesDelDia)}</div><div class="stat-lbl">Comisiones</div></div>
      <div class="stat"><div class="stat-val">${fmt(det.dineroClientes)}</div><div class="stat-lbl">Clientes</div></div>
      <div class="stat"><div class="stat-val green">${fmt(det.dineroDisponible)}</div><div class="stat-lbl">Disponible</div></div>
      <div class="stat"><div class="stat-val">${det.numeroMovimientos}</div><div class="stat-lbl">Movimientos</div></div>
    </div>
    ${det.notas?`<div style="background:#fffbeb;border-left:3px solid #d97706;padding:10px 14px;border-radius:6px;margin-bottom:16px;font-size:13px">${det.notas}</div>`:""}
    <div class="section">Saldos por cuenta</div>
    <table><tr><th>Cuenta</th><th>Banco</th><th style="text-align:right">Saldo</th></tr>
    ${cts.map(c=>`<tr><td><b>${c.nombre}</b></td><td>${c.banco}</td><td style="text-align:right" class="${c.saldo>=0?"green":"red"}">${fmt(c.saldo)}</td></tr>`).join("")}
    </table>
    <div class="section">Movimientos por cuenta</div>
    ${cuentasAgrupadas.map(({nombre,banco,ingresos,egresos})=>{
      const totalIng=ingresos.reduce((a,m)=>a+m.montoFinal,0);
      const totalEg=egresos.reduce((a,m)=>a+m.montoFinal,0);
      const totalCom=ingresos.filter(m=>m.tipo==="ingreso").reduce((a,m)=>a+m.comision,0);
      return`<div class="cuenta-title">🏦 ${nombre} — ${banco}</div>
      <div class="two-col">
        <div>
          <div class="col-header green-header">Ingresos — ${fmt(totalIng)}</div>
          <table><tr><th style="background:#16a34a">Concepto</th><th style="background:#16a34a">Tipo</th><th style="background:#16a34a;text-align:right">Monto</th><th style="background:#16a34a;text-align:right">Com.</th></tr>
          ${ingresos.length?ingresos.map(m=>`<tr><td>${m.concepto||"-"}</td><td>${m.esNomina?"Nómina":m._dir==="entrada"?"↓ Entrada":"Transf."}</td><td style="text-align:right" class="green">+${fmt(m.montoFinal)}</td><td style="text-align:right" class="amber">${m.comision>0?fmt(m.comision):"-"}</td></tr>`).join(""):`<tr><td colspan="4" style="text-align:center;color:#aaa;padding:10px">Sin ingresos</td></tr>`}
          <tr class="sub"><td colspan="2">Subtotal</td><td style="text-align:right" class="green">+${fmt(totalIng)}</td><td style="text-align:right" class="amber">${fmt(totalCom)}</td></tr></table>
        </div>
        <div>
          <div class="col-header red-header">Egresos — ${fmt(totalEg)}</div>
          <table><tr><th style="background:#dc2626">Concepto</th><th style="background:#dc2626">Tipo</th><th style="background:#dc2626;text-align:right">Monto</th></tr>
          ${egresos.length?egresos.map(m=>`<tr><td>${m.concepto||"-"}</td><td>${m._dir==="salida"?"↑ Salida":m.tipo==="ajuste"?"Ajuste":"Egreso"}</td><td style="text-align:right" class="red">-${fmt(m.montoFinal)}</td></tr>`).join(""):`<tr><td colspan="3" style="text-align:center;color:#aaa;padding:10px">Sin egresos</td></tr>`}
          <tr class="sub"><td colspan="2">Subtotal</td><td style="text-align:right" class="red">-${fmt(totalEg)}</td></tr></table>
        </div>
      </div>
      <table style="margin-bottom:4px"><tr class="total-row"><td>Neto ${nombre}</td><td></td><td style="text-align:right">${fmt(totalIng-totalEg)}</td><td style="text-align:right">${fmt(totalCom)}</td></tr></table>`;
    }).join("")}
    <table style="margin-top:16px"><tr class="total-row"><td colspan="2">TOTAL GENERAL</td><td style="text-align:right">${fmt(det.ingresosDelDia-det.egresosDelDia)}</td><td style="text-align:right">${fmt(det.comisionesDelDia)}</td></tr></table>
    <div style="margin-top:24px;padding-top:12px;border-top:1px solid #e5e5e5;font-size:11px;color:#aaa;text-align:center">Control Financiero · ${fmtDate(today())} ${new Date().toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"})}</div>
    </body></html>`;
    const w=window.open("","_blank");w.document.write(html);w.document.close();w.focus();setTimeout(()=>w.print(),600);
  }

  if(detalle){
    const mh=enriquecer(detalle.fecha);
    return(
      <div style={{fontFamily:F}}>
        <div style={{display:"flex",gap:8,marginBottom:14}}>
          <button onClick={()=>setDetalle(null)} style={btn(t.muted,t.sub,{flex:1})}>← Volver</button>
          <button onClick={()=>descargarPDF(detalle)} style={btn(t.greenBg,t.green,{flex:1})}>↓ PDF</button>
        </div>
        <div style={{background:t.text,borderRadius:12,padding:"18px",marginBottom:8,color:t.bg}}>
          <div style={{fontSize:11,opacity:.5,textTransform:"uppercase",letterSpacing:2}}>Cierre</div>
          <div style={{fontSize:20,fontWeight:700,margin:"4px 0"}}>{fmtDate(detalle.fecha)}</div>
          <div style={{fontSize:30,fontWeight:700,color:"#86efac",letterSpacing:"-1px"}}>{fmt(detalle.totalEnCuentas)}</div>
        </div>
        {[["Ingresos",fmt(detalle.ingresosDelDia),t.green,t.greenBg],["Egresos",fmt(detalle.egresosDelDia),t.red,t.redBg],["Comisiones",fmt(detalle.comisionesDelDia),t.amber,t.amberBg],["Clientes",fmt(detalle.dineroClientes),t.blue,t.blueBg],["Disponible",fmt(detalle.dineroDisponible),t.green,t.greenBg],["Movimientos",detalle.numeroMovimientos,t.sub,t.muted]].map(([l,v,col,bg])=>(
          <div key={l} style={card(t,{padding:"12px 14px"})}>
            <div style={row()}><span style={{fontSize:13,color:t.sub}}>{l}</span><span style={{fontWeight:600,color:col}}>{v}</span></div>
          </div>
        ))}
        {detalle.notas&&<div style={card(t,{padding:"12px 14px",borderLeft:`3px solid ${t.amber}`})}><div style={{fontSize:12,color:t.amber,fontWeight:600,marginBottom:4}}>Notas</div><div style={{fontSize:13,color:t.text}}>{detalle.notas}</div></div>}
        {mh.length>0&&<>
          <div style={{fontSize:11,color:t.sub,textTransform:"uppercase",letterSpacing:.5,marginTop:8,marginBottom:8}}>Movimientos del día</div>
          {mh.map(m=>(
            <div key={m.id} style={card(t,{padding:"12px 14px"})}>
              <div style={row()}>
                <div style={{flex:1}}><div style={{fontWeight:600,fontSize:13,color:t.text}}>{m.concepto||"Sin concepto"}</div><div style={{fontSize:11,color:t.sub}}>{m._cuentaNombre||""}{m.banco&&` · ${m.banco}`}</div></div>
                <div style={{textAlign:"right"}}><div style={{fontWeight:600,color:m.tipo==="egreso"?t.red:m.tipo==="ajuste"?t.amber:t.green}}>{fmt(m.montoFinal)}</div>{m.comision>0&&<div style={{fontSize:10,color:t.amber}}>com: {fmt(m.comision)}</div>}</div>
              </div>
            </div>
          ))}
        </>}
        <div style={{fontSize:11,color:t.sub,textTransform:"uppercase",letterSpacing:.5,marginTop:8,marginBottom:8}}>Saldos por cuenta</div>
        {detalle.saldosPorCuenta.map((c,i)=>(
          <div key={i} style={card(t,{padding:"12px 14px"})}>
            <div style={row()}><div><div style={{fontWeight:600,color:t.text}}>{c.nombre}</div><div style={{fontSize:11,color:t.sub}}>{c.banco}</div></div><div style={{fontWeight:700,color:c.saldo>=0?t.green:t.red}}>{fmt(c.saldo)}</div></div>
          </div>
        ))}
      </div>
    );
  }

  return(
    <div style={{fontFamily:F}}>
      <div style={card(t,{padding:"14px",marginBottom:12})}>
        <div style={{fontWeight:600,color:t.text,marginBottom:10}}>Estado actual</div>
        {[["Total",fmt(r.total),t.text],["Clientes",fmt(r.dineroC),t.blue],["Disponible",fmt(r.disponible),r.disponible>=0?t.green:t.red]].map(([l,v,col])=>(
          <div key={l} style={row({marginBottom:6})}><span style={{fontSize:13,color:t.sub}}>{l}</span><span style={{fontWeight:600,color:col}}>{v}</span></div>
        ))}
      </div>
      <span style={lbl(t)}>Notas del cierre</span>
      <input value={notas} onChange={e=>setNotas(e.target.value)} placeholder="Opcional" style={{...inp(t),marginBottom:12}}/>
      <button onClick={cerrar} style={btn(t.text,"#fff",{width:"100%",padding:"12px",fontSize:14,marginBottom:20})}>Cerrar día</button>

      <div style={row({marginBottom:10})}>
        <span style={{fontSize:11,color:t.sub,textTransform:"uppercase",letterSpacing:.5}}>Historial ({cierres.length})</span>
        {cierres.length>0&&<button onClick={()=>{if(window.confirm("¿Borrar todos los cierres?"))onBorrarTodos();}} style={btn(t.redBg,t.red,{padding:"4px 10px",fontSize:11})}>Borrar todos</button>}
      </div>
      {!cierres.length&&<div style={{color:t.sub,textAlign:"center",padding:20,fontSize:13}}>Sin cierres</div>}
      {[...cierres].reverse().map(c=>(
        <div key={c.id} style={card(t,{padding:"12px 14px"})}>
          <div style={row()}>
            <div style={{flex:1,cursor:"pointer"}} onClick={()=>setDetalle(c)}>
              <div style={{fontWeight:600,color:t.text}}>{fmtDate(c.fecha)}</div>
              <div style={{fontSize:11,color:t.sub}}>{c.numeroMovimientos} mov. · Com: {fmt(c.comisionesDelDia)}</div>
            </div>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <span style={{fontWeight:700,color:t.green}}>{fmt(c.totalEnCuentas)}</span>
              <button onClick={()=>{if(window.confirm(`¿Borrar cierre del ${fmtDate(c.fecha)}?`))onBorrarUno(c.id);}} style={btn(t.redBg,t.red,{padding:"4px 8px",fontSize:12})}>✕</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Calc({cls,t}){
  const [clienteId,setClienteId]=useState("");
  const [banco,setBanco]=useState("");
  const [monto,setMonto]=useState("");
  const [esNomina,setEsNomina]=useState(false);
  const cliente=cls.find(c=>c.id===clienteId);
  return(
    <div style={{fontFamily:F}}>
      <div style={card(t,{padding:"14px",borderLeft:`3px solid ${t.blue}`})}>
        <div style={{fontSize:11,color:t.blue,fontWeight:600,textTransform:"uppercase",letterSpacing:.5,marginBottom:14}}>Calculadora rápida</div>
        <div style={{display:"flex",gap:8,marginBottom:10}}>
          <div style={{flex:1}}>
            <span style={lbl(t)}>Cliente</span>
            <select value={clienteId} onChange={e=>{setClienteId(e.target.value);setBanco("");}} style={inp(t)}>
              <option value="">Selecciona</option>
              {cls.map(c=><option key={c.id} value={c.id}>{c.vip?"⭐ ":""}{c.nombre}</option>)}
            </select>
          </div>
          <div style={{flex:1}}>
            <span style={lbl(t)}>Banco</span>
            <select value={banco} onChange={e=>setBanco(e.target.value)} style={inp(t)} disabled={!clienteId}>
              <option value="">Selecciona</option>
              {(cliente?.bancos||[]).map(b=><option key={b.banco} value={b.banco}>{b.banco} {b.porcentaje}%</option>)}
            </select>
          </div>
        </div>
        <div style={{display:"flex",gap:8,marginBottom:12,alignItems:"flex-end"}}>
          <div style={{flex:1}}>
            <span style={lbl(t)}>Monto</span>
            <input type="text" inputMode="decimal" placeholder="0.00" value={monto} onChange={e=>setMonto(e.target.value)} style={{...inp(t),fontSize:18}}/>
          </div>
          <button onClick={()=>setEsNomina(!esNomina)} style={btn(esNomina?t.text:t.muted,esNomina?"#fff":t.sub,{padding:"10px 12px",whiteSpace:"nowrap",marginBottom:0})}>{esNomina?"Nómina":"Normal"}</button>
        </div>
        <CalcPreview monto={monto} tipo="ingreso" cliente={cliente} banco={banco} esNomina={esNomina} t={t}/>
      </div>
    </div>
  );
}

// ══ APP ══
const TABS=[
  {key:"resumen",  label:"Inicio",      emoji:"○"},
  {key:"calc",     label:"Calc",        emoji:"◈"},
  {key:"movs",     label:"Movimientos", emoji:"↕"},
  {key:"clientes", label:"Clientes",    emoji:"◉"},
  {key:"cuentas",  label:"Cuentas",     emoji:"▣"},
  {key:"reportes", label:"Reportes",    emoji:"◈"},
  {key:"cierres",  label:"Cierres",     emoji:"◻"},
];

export default function App(){
  const [dark,setDark]=useState(()=>load(KEYS.dark,false));
  const [loggedIn,setLoggedIn]=useState(()=>!load(KEYS.pin,""));
  const [tab,setTab]=useState("resumen");
  const [cls,setCls]=useState(()=>load(KEYS.cls,[]));
  const [ctas,setCtas]=useState(()=>load(KEYS.ctas,[]));
  const [movs,setMovs]=useState(()=>load(KEYS.movs,[]));
  const [cierres,setCierres]=useState(()=>load(KEYS.cierres,[]));
  const [meta,setMeta]=useState(()=>load(KEYS.meta,0));
  const [recientes,setRecientes]=useState([]);
  const t=dark?T.dark:T.light;
  const timer=useRef(null);

  useEffect(()=>save(KEYS.cls,cls),[cls]);
  useEffect(()=>save(KEYS.ctas,ctas),[ctas]);
  useEffect(()=>save(KEYS.movs,movs),[movs]);
  useEffect(()=>save(KEYS.cierres,cierres),[cierres]);
  useEffect(()=>save(KEYS.meta,meta),[meta]);
  useEffect(()=>save(KEYS.dark,dark),[dark]);

  useEffect(()=>{
    const pin=load(KEYS.pin,"");
    if(!pin||!loggedIn)return;
    const reset=()=>{clearTimeout(timer.current);timer.current=setTimeout(()=>setLoggedIn(false),5*60*1000);};
    window.addEventListener("click",reset);window.addEventListener("keydown",reset);reset();
    return()=>{clearTimeout(timer.current);window.removeEventListener("click",reset);window.removeEventListener("keydown",reset);};
  },[loggedIn]);

  function updateRecientes(id){setRecientes(p=>[id,...p.filter(x=>x!==id)].slice(0,3));}

  if(!loggedIn)return<Login onLogin={()=>setLoggedIn(true)} t={t}/>;

  return(
    <div style={{fontFamily:F,minHeight:"100vh",background:t.bg,paddingBottom:72,color:t.text}}>
      {/* Header */}
      <div style={{background:t.card,borderBottom:`1px solid ${t.border}`,padding:"14px 16px 10px",position:"sticky",top:0,zIndex:10}}>
        <div style={{fontSize:10,color:t.sub,letterSpacing:3,textTransform:"uppercase"}}>Control Financiero</div>
        <div style={{fontSize:18,fontWeight:700,marginTop:2,letterSpacing:"-.5px"}}>{TABS.find(x=>x.key===tab)?.label}</div>
      </div>

      {/* Content */}
      <div style={{padding:"14px 14px",maxWidth:600,margin:"0 auto"}}>
        {tab==="resumen"  &&<Resumen cls={cls} ctas={ctas} movs={movs} meta={meta} onSetMeta={setMeta} dark={dark} onToggleDark={()=>setDark(!dark)} onLock={()=>setLoggedIn(false)} onCambiarPin={()=>{if(window.confirm("¿Cambiar PIN? Se cerrará la sesión.")){save(KEYS.pin,"");setLoggedIn(false);}}} t={t}/>}
        {tab==="calc"     &&<Calc cls={cls} t={t}/>}
        {tab==="movs"     &&<Movimientos cls={cls} ctas={ctas} movs={movs} onAdd={m=>setMovs(p=>[...p,m])} onEdit={m=>setMovs(p=>p.map(x=>x.id===m.id?m:x))} onDel={id=>setMovs(p=>p.filter(x=>x.id!==id))} recientes={recientes} onUpdateRecientes={updateRecientes} t={t}/>}
        {tab==="clientes" &&<Clientes cls={cls} movs={movs} onAdd={c=>setCls(p=>[...p,c])} onEdit={c=>setCls(p=>p.map(x=>x.id===c.id?c:x))} onDel={id=>setCls(p=>p.filter(x=>x.id!==id))} onAddMov={m=>setMovs(p=>[...p,m])} t={t}/>}
        {tab==="cuentas"  &&<Cuentas ctas={ctas} movs={movs} onAdd={c=>setCtas(p=>[...p,c])} onEdit={c=>setCtas(p=>p.map(x=>x.id===c.id?c:x))} onDel={id=>setCtas(p=>p.filter(x=>x.id!==id))} onConciliar={m=>setMovs(p=>[...p,m])} t={t}/>}
        {tab==="reportes" &&<Reportes cls={cls} ctas={ctas} movs={movs} t={t}/>}
        {tab==="cierres"  &&<Cierres cls={cls} ctas={ctas} movs={movs} cierres={cierres} onCerrar={c=>setCierres(p=>[...p,c])} onBorrarUno={id=>setCierres(p=>p.filter(x=>x.id!==id))} onBorrarTodos={()=>setCierres([])} t={t}/>}
      </div>

      {/* Nav */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:t.card,borderTop:`1px solid ${t.border}`,display:"flex",zIndex:20,overflowX:"auto"}}>
        {TABS.map(tb=>(
          <button key={tb.key} onClick={()=>setTab(tb.key)} style={{flex:"0 0 auto",minWidth:52,padding:"8px 6px 6px",border:"none",background:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,fontFamily:F}}>
            <span style={{fontSize:14,color:tab===tb.key?t.text:t.sub}}>{tb.emoji}</span>
            <span style={{fontSize:9,color:tab===tb.key?t.text:t.sub,fontWeight:tab===tb.key?600:400,letterSpacing:.3,whiteSpace:"nowrap"}}>{tb.label}</span>
            {tab===tb.key&&<div style={{width:14,height:2,background:t.text,borderRadius:1}}/>}
          </button>
        ))}
      </div>
    </div>
  );
}

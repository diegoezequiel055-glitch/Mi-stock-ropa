import { state } from './state.js';
import { db, collection, doc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, getDocs, writeBatch, increment, getDoc, limit } from './firebase-config.js';

// ══════════════════════════════════════════
// REGISTRAR VENTA — carrito único
// ══════════════════════════════════════════
const TIPOS_PRECIO={menor:'Menor',mayorista:'Mayorista',curva:'Curva'};
const TIPO_VENTA={menor:'minorista',mayorista:'mayorista',curva:'curva'};
const precioSegunTipo=(p,tipo)=>(tipo==='mayorista'?p.pmayorista:tipo==='curva'?p.pcurva:p.pventa)||0;

window.uvSearchFilter=function(){
  const q=document.getElementById('uv-search').value.toLowerCase().trim();
  const results=document.getElementById('uv-results');
  if(!q){results.classList.remove('open');return;}
  const matches=state.stockData.filter(p=>p.qty>0).filter(p=>[p.cat,p.modelo,p.color||'',p.talle].join(' ').toLowerCase().includes(q)).slice(0,8);
  results.innerHTML=matches.length?matches.map(p=>`<div class="vs-item" onmousedown="addToUv('${p.id}')">
    <div class="vs-item-title">${p.modelo}${p.color?' — '+p.color:''}</div>
    <div class="vs-item-sub"><span>${p.cat}</span><span>T.${p.talle}</span><span style="color:${p.qty<=1?'var(--warning)':'var(--success)'}">x${p.qty}</span>${p.pventa?`<span style="color:var(--accent)">Menor $${fmt(p.pventa)}</span>`:''}${p.pmayorista?`<span style="color:var(--blue)">May $${fmt(p.pmayorista)}</span>`:''}${p.pcurva?`<span style="color:var(--teal)">Curva $${fmt(p.pcurva)}</span>`:''}</div>
  </div>`).join(''):`<div class="vs-item"><div class="vs-item-title" style="color:var(--muted)">Sin resultados</div></div>`;
  results.classList.add('open');
}
window.addToUv=function(id){
  const p=state.stockData.find(x=>x.id===id); if(!p)return;
  if(state.ventaCart.find(x=>x.prodId===id)){toast('Ya está en la lista. Cambiá la cantidad.','error');return;}
  if(state.uvModo==='cuotas'&&state.ventaCart.length>=1){toast('En cuotas solo se puede vender un producto a la vez.','error');return;}
  const tipoPrecio=state.uvTipoPrecio;
  state.ventaCart.push({prodId:id,cant:1,tipoPrecio,pventa:precioSegunTipo(p,tipoPrecio),pcosto:p.pcosto||0});
  document.getElementById('uv-search').value='';
  document.getElementById('uv-results').classList.remove('open');
  renderUvItems();
}
window.updateUvItem=function(idx,field,val){
  state.ventaCart[idx][field]=parseFloat(val)||0;
  if(field==='cant') state.ventaCart[idx].cant=Math.max(1,parseInt(val)||1);
  renderUvItems();
}
window.removeUvItem=function(idx){ state.ventaCart.splice(idx,1); renderUvItems(); }
window.setUvItemTipo=function(idx,tipo){
  const item=state.ventaCart[idx];
  const p=state.stockData.find(x=>x.id===item.prodId); if(!p)return;
  item.tipoPrecio=tipo;
  item.pventa=precioSegunTipo(p,tipo);
  renderUvItems();
}
window.setUvTipoPrecio=function(tipo){
  state.uvTipoPrecio=tipo;
  Object.keys(TIPOS_PRECIO).forEach(t=>document.getElementById('uv-tp-'+t).classList.toggle('active',t===tipo));
  // El selector de arriba re-precia todo el carrito; después se puede cambiar fila por fila
  state.ventaCart.forEach(item=>{
    const p=state.stockData.find(x=>x.id===item.prodId); if(!p)return;
    item.tipoPrecio=tipo;
    item.pventa=precioSegunTipo(p,tipo);
  });
  renderUvItems();
}
function renderUvItems(){
  const cont=document.getElementById('uv-items');
  if(!state.ventaCart.length){
    cont.innerHTML=`<div class="empty" style="padding:20px"><div class="empty-icon">🛒</div><p>Buscá productos para agregar a la venta</p></div>`;
    document.getElementById('uv-total').textContent='$0 — 0 productos'; return;
  }
  let totalMonto=0, totalItems=0;
  cont.innerHTML=state.ventaCart.map((item,idx)=>{
    const p=state.stockData.find(x=>x.id===item.prodId); if(!p)return'';
    const subtotal=item.pventa*item.cant;
    totalMonto+=subtotal; totalItems+=item.cant;
    const gan=item.pcosto&&item.pventa?(item.pventa-item.pcosto)*item.cant:null;
    const cantDisabled=state.uvModo==='cuotas'; // en cuotas se vende 1 unidad del producto
    const falta=!item.pventa;
    return`<div class="mventa-item"${falta?' style="border-color:var(--danger)"':''}>
      <div>
        <div style="font-size:.85rem;font-weight:500">${p.modelo}${p.color?' ('+p.color+')':''}</div>
        <div style="font-size:.72rem;color:var(--muted)">${p.cat} · T.${p.talle} · Stock: ${p.qty}</div>
        <select onchange="setUvItemTipo(${idx},this.value)" style="width:auto;padding:3px 8px;font-size:.72rem;margin-top:4px">
          ${Object.entries(TIPOS_PRECIO).map(([t,n])=>`<option value="${t}"${t===item.tipoPrecio?' selected':''}>${n}</option>`).join('')}
        </select>
        ${falta?`<div style="font-size:.7rem;color:var(--danger);margin-top:4px">⚠ Falta precio ${TIPOS_PRECIO[item.tipoPrecio].toLowerCase()} — escribilo o cambiá el tipo</div>`:''}
      </div>
      <input type="number" value="${item.cant}" min="1" max="${p.qty}" onchange="updateUvItem(${idx},'cant',this.value)" ${cantDisabled?'disabled':''} style="text-align:center">
      <input type="number" value="${item.pventa||''}" min="0" placeholder="Precio" onchange="updateUvItem(${idx},'pventa',this.value)">
      <div style="text-align:right">
        <div style="font-size:.82rem;color:var(--accent)">$${fmt(Math.round(subtotal))}</div>
        ${gan!==null?`<div style="font-size:.7rem;color:${gan>=0?'var(--success)':'var(--danger)'}">$${fmt(Math.round(gan))}</div>`:''}
      </div>
      <button class="btn-ghost btn" onclick="removeUvItem(${idx})" style="padding:4px 8px">✕</button>
    </div>`;
  }).join('');
  document.getElementById('uv-total').textContent=`$${fmt(Math.round(totalMonto))} — ${totalItems} producto${totalItems!==1?'s':''}`;
  if(state.uvModo==='cuotas') calcUvCuotas();
}

window.setUvModoCobro=function(modo){
  if(modo==='cuotas'&&state.ventaCart.length>1){
    toast('En cuotas solo se puede vender un producto a la vez. Sacá los demás del carrito.','error');
    return;
  }
  state.uvModo=modo;
  document.getElementById('uv-modo-ahora').className='tipo-btn'+(modo==='ahora'?' active-min':'');
  document.getElementById('uv-modo-cuotas').className='tipo-btn'+(modo==='cuotas'?' active-cuo':'');
  document.getElementById('uv-ncuotas-wrap').style.display=modo==='cuotas'?'block':'none';
  document.getElementById('uv-fecha1-wrap').style.display=modo==='cuotas'?'block':'none';
  document.getElementById('uv-cliente-req').textContent=modo==='cuotas'?'— obligatorio':'— opcional';
  document.getElementById('btn-registrar-uv').textContent=modo==='cuotas'?'💳 Registrar venta en cuotas':'✓ Registrar venta';
  if(modo==='cuotas'){
    if(!document.getElementById('uv-fecha1').value) document.getElementById('uv-fecha1').value=hoyISO();
    calcUvCuotas();
  } else {
    document.getElementById('uv-cuota-calc').style.display='none';
  }
  renderUvItems();
}
window.calcUvCuotas=function(){
  const calc=document.getElementById('uv-cuota-calc');
  if(state.uvModo!=='cuotas'||!state.ventaCart.length){ if(calc) calc.style.display='none'; return; }
  const item=state.ventaCart[0];
  const total=item.pventa*item.cant;
  const costo=item.pcosto?item.pcosto*item.cant:0;
  const n=parseInt(document.getElementById('uv-ncuotas').value)||3;
  if(!total){calc.style.display='none';return;}
  const montoCuota=Math.ceil(total/n);
  const ultimaCuota=total-(montoCuota*(n-1));
  const ganProyectada=costo?total-costo:null;
  calc.style.display='block';
  const desglose=ultimaCuota!==montoCuota
    ? `${n-1} × $${fmt(montoCuota)} + 1 × $${fmt(Math.max(0,ultimaCuota))}`
    : `${n} × $${fmt(montoCuota)}`;
  calc.innerHTML=`💳 <strong>${desglose}</strong> = $${fmt(total)} total`+
    (ganProyectada!==null?` · Ganancia proyectada: <strong style="color:${ganProyectada>=0?'var(--success)':'var(--danger)'}">$${fmt(Math.round(ganProyectada))}</strong>`:'');
}

window.registrarVentaUnificada=async function(){
  if(!state.ventaCart.length){toast('Agregá al menos un producto.','error');return;}
  for(const item of state.ventaCart){
    const p=state.stockData.find(x=>x.id===item.prodId);
    if(!p||p.qty<item.cant){toast(`Stock insuficiente: ${p?.modelo||'?'} T.${p?.talle}`,'error');return;}
    if(!item.pventa||item.pventa<=0){toast(`Falta el precio ${TIPOS_PRECIO[item.tipoPrecio].toLowerCase()} de ${p.modelo} T.${p.talle}. Escribilo o cambiá el tipo.`,'error');return;}
  }
  const fechaSel=document.getElementById('uv-fecha').value||hoyISO();
  if(fechaSel>hoyISO()){toast('La fecha de la venta no puede ser futura.','error');return;}
  if(state.uvModo==='cuotas') return registrarCuotaDesdeCarrito();

  const btn=document.getElementById('btn-registrar-uv'); btn.disabled=true; btn.textContent='Registrando...';
  const cliente=document.getElementById('uv-cliente').value.trim()||null;
  const fechaStr=document.getElementById('uv-fecha').value||hoyISO();
  try{
    const cartLen=await guardarVentaItems(state.ventaCart,cliente,fechaDesdeInput(fechaStr));
    state.ventaCart=[];
    document.getElementById('uv-cliente').value='';
    document.getElementById('uv-fecha').value=hoyISO();
    renderUvItems();
    toast(`${cartLen} producto${cartLen!==1?'s':''} vendido${cartLen!==1?'s':''} ✓`,'success');
  }catch(e){toast('Error: '+e.message,'error');}
  finally{btn.disabled=false;btn.textContent='✓ Registrar venta';}
}

// Guarda una venta (una o varias líneas) y descuenta el stock. La usan el carrito y la Carga rápida.
// items: [{prodId, cant, tipoPrecio:'menor'|'mayorista'|'curva', pventa, pcosto}]
window.guardarVentaItems=async function(items,cliente,fechaVenta){
  const fecha=fechaVenta||Date.now();
  const loteId=items.length>1?fecha.toString():null;
  // Las líneas de tipo curva de una misma venta comparten curvaId (para poder borrarlas juntas)
  const curvaId=items.filter(i=>i.tipoPrecio==='curva').length>1?fecha.toString():null;
  const batch=writeBatch(db);
  for(const item of items){
    const p=state.stockData.find(x=>x.id===item.prodId);
    batch.update(doc(db,'stock',item.prodId),{qty:increment(-item.cant)});
    batch.set(doc(collection(db,'ventas')),{
      prodId:item.prodId,cat:p.cat,modelo:p.modelo,color:p.color||'',talle:p.talle,
      pventa:item.pventa,pcosto:item.pcosto||null,cant:item.cant,tipo:TIPO_VENTA[item.tipoPrecio],cliente:cliente||null,
      ...(curvaId&&item.tipoPrecio==='curva'?{curvaId}:{}),...(loteId?{loteId}:{}),
      fecha
    });
  }
  await batch.commit();
  return items.length;
}

async function registrarCuotaDesdeCarrito(){
  const item=state.ventaCart[0];
  const p=state.stockData.find(x=>x.id===item.prodId);
  const cliente=document.getElementById('uv-cliente').value.trim();
  const n=parseInt(document.getElementById('uv-ncuotas').value)||3;
  const fecha1Str=document.getElementById('uv-fecha1').value;
  const total=item.pventa*item.cant;
  const costo=item.pcosto?item.pcosto*item.cant:null;
  if(!cliente){toast('Ingresá el nombre del cliente.','error');return;}
  if(total<n){toast(`El monto $${fmt(total)} es menor que ${n} cuotas. Reducí las cuotas o aumentá el precio.`,'error');return;}
  if(!fecha1Str){toast('Ingresá la fecha de la primera cuota.','error');return;}
  const btn=document.getElementById('btn-registrar-uv'); btn.disabled=true; btn.textContent='Registrando...';
  try{
    const montoCuota=Math.ceil(total/n);
    const cuotas=[];
    const fecha1=new Date(fecha1Str+'T12:00:00');
    for(let i=0;i<n;i++){
      const venc=new Date(fecha1);
      venc.setMonth(venc.getMonth()+i);
      cuotas.push({nro:i+1,monto:i<n-1?montoCuota:total-(montoCuota*(n-1)),vencimiento:venc.getTime(),pagada:false,fechaPago:null});
    }
    const batch=writeBatch(db);
    batch.update(doc(db,'stock',item.prodId),{qty:p.qty-item.cant});
    batch.set(doc(collection(db,'cuotas')),{
      prodId:item.prodId,cat:p.cat,modelo:p.modelo,color:p.color||'',talle:p.talle,
      cliente,totalVenta:total,pcosto:costo,cuotas,
      estado:'pendiente', // pendiente | parcial | cobrado
      createdAt:fechaDesdeInput(document.getElementById('uv-fecha').value)
    });
    await batch.commit();
    state.ventaCart=[];
    document.getElementById('uv-cliente').value='';
    document.getElementById('uv-cuota-calc').style.display='none';
    document.getElementById('uv-fecha').value=hoyISO();
    renderUvItems();
    toast(`Venta en ${n} cuotas registrada para ${cliente} ✓`,'success');
  }catch(e){toast('Error: '+e.message,'error');}
  finally{btn.disabled=false;btn.textContent='💳 Registrar venta en cuotas';}
}

window.setDateFilter=function(f,btn){
  state.dateFilter=f;
  document.querySelectorAll('#tab-ventas .date-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active'); renderVentas();
}

window.renderVentas=function(){
  const now=new Date();
  const filtered=state.ventasData.filter(v=>{
    const d=new Date(v.fecha);
    if(state.dateFilter==='today') return d.toDateString()===now.toDateString();
    if(state.dateFilter==='week'){const s=new Date(now);s.setDate(now.getDate()-now.getDay());return d>=s;}
    if(state.dateFilter==='month') return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();
    return true;
  });
  // Bug #7 fix: incluir cuotas en el historial de ventas
  const filteredCuotas=state.cuotasData.filter(c=>{
    const d=new Date(c.createdAt);
    if(state.dateFilter==='today') return d.toDateString()===now.toDateString();
    if(state.dateFilter==='week'){const s=new Date(now);s.setDate(now.getDate()-now.getDay());return d>=s;}
    if(state.dateFilter==='month') return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();
    return true;
  });
  const totalMonto=filtered.reduce((a,v)=>a+v.pventa*v.cant,0)
    +filteredCuotas.reduce((a,c)=>a+c.totalVenta,0);
  const mayoristas=filtered.filter(v=>v.tipo==='mayorista'||v.tipo==='curva').length;
  // Bug #7 fix: mostrar ventas de hoy correctamente
  const hoy=new Date().toDateString();
  const ventasHoy=state.ventasData.filter(v=>new Date(v.fecha).toDateString()===hoy).length
    +state.cuotasData.filter(c=>new Date(c.createdAt).toDateString()===hoy).length;
  const totalItems=filtered.length+filteredCuotas.length;
  // Bug #3 fix: ticket promedio solo sobre ventas individuales — las cuotas inflan el monto
  const ticketBase=filtered.length?filtered.reduce((a,v)=>a+v.pventa*v.cant,0)/filtered.length:0;
  document.getElementById('vk-total').textContent=totalItems;
  document.getElementById('vk-monto').textContent='$'+fmt(Math.round(totalMonto));
  document.getElementById('vk-may').textContent=ventasHoy;
  document.getElementById('vk-ticket').textContent='$'+fmt(Math.round(ticketBase));
  const list=document.getElementById('ventas-list');
  if(!filtered.length&&!filteredCuotas.length){list.innerHTML=`<div class="empty"><div class="empty-icon">🛒</div><p>No hay ventas en este período</p></div>`;return;}
  const busq=(document.getElementById('ventas-search')?.value||'').toLowerCase().trim();
  const clearBtn=document.getElementById('ventas-search-clear');
  if(clearBtn) clearBtn.classList.toggle('visible',busq.length>0);
  // Bug #18 fix: filtrar por texto libre en historial
  const todas=[
    ...filtered.map(v=>({...v,_tipo:'venta'})),
    ...filteredCuotas.map(c=>({...c,_tipo:'cuota',fecha:c.createdAt}))
  ].sort((a,b)=>b.fecha-a.fecha)
  .filter(item=>{
    if(!busq)return true;
    if(item._tipo==='cuota') return [item.cat,item.modelo,item.color||'',item.talle,item.cliente||''].join(' ').toLowerCase().includes(busq);
    return [item.cat,item.modelo,item.color||'',item.talle].join(' ').toLowerCase().includes(busq);
  });
  const curvasVistas=new Set();
  list.innerHTML=todas.map(item=>{
    if(item._tipo==='cuota'){
      const c=item;
      const pagadas=c.cuotas.filter(q=>q.pagada).length;
      const d=new Date(c.createdAt);
      const ds=d.toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric'})+' '+d.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});
      const montoCobrado=c.cuotas.filter(q=>q.pagada).reduce((a,q)=>a+q.monto,0);
      const ganProyectada=c.pcosto?c.totalVenta-c.pcosto:null;
      return`<div class="venta-card">
        <div class="venta-info">
          <div class="venta-title">${c.cat} — ${c.modelo}${c.color?' ('+c.color+')':''} <span class="badge b-cuota" style="margin-left:6px">💳 Cuotas</span></div>
          <div class="venta-sub">👤 ${c.cliente} · T.${c.talle} · ${pagadas}/${c.cuotas.length} cuotas cobradas</div>
          <div class="venta-date">${ds}</div>
        </div>
        <div class="venta-right">
          <div class="venta-precio">$${fmt(c.totalVenta)}</div>
          ${ganProyectada!==null?`<div class="venta-gan" style="color:var(--muted)">gan proyec: $${fmt(Math.round(ganProyectada))}</div>`:''}
          <div style="font-size:.7rem;color:${montoCobrado>0?'var(--success)':'var(--muted)'}">cobrado $${fmt(Math.round(montoCobrado))}</div>
        </div>
        <button class="btn btn-outline btn-sm" onclick="showTab('cobros',null)" style="flex-shrink:0">ver →</button>
      </div>`;
    }
    const v=item;
    const gan=v.pcosto?(v.pventa-v.pcosto)*v.cant:null;
    const d=new Date(v.fecha);
    const ds=d.toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric'})+' '+d.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});
    const tipoBadge=v.tipo==='mayorista'?'<span class="badge b-may" style="margin-left:6px">💼 May</span>':v.tipo==='curva'?'<span class="badge b-cur" style="margin-left:6px">🔄 Curva</span>':v.tipo==='multiple'?'<span class="badge b-ok" style="margin-left:6px">📦 Lote</span>':'';
    let btnCurva='';
    if(v.tipo==='curva'&&v.curvaId&&!curvasVistas.has(v.curvaId)){
      curvasVistas.add(v.curvaId);
      btnCurva=`<button class="btn btn-outline btn-sm" style="color:var(--danger);border-color:var(--danger-dim);font-size:.7rem;margin-bottom:4px" onclick="delCurvaCompleta('${v.curvaId}')">🗑 Toda la curva</button>`;
    }
    return`<div class="venta-card">
      <div class="venta-info">
        <div class="venta-title">${v.cat} — ${v.modelo}${v.color?' ('+v.color+')':''}${tipoBadge}</div>
        <div class="venta-sub">T.${v.talle} · Cant: ${v.cant}${v.pcosto?' · Costo: $'+fmt(v.pcosto):''}${v.cliente?' · 👤 '+v.cliente:''}</div>
        <div class="venta-date">${ds}</div>
      </div>
      <div class="venta-right">
        <div class="venta-precio">$${fmt(v.pventa*v.cant)}</div>
        ${gan!==null?`<div class="venta-gan" style="color:${gan>=0?'var(--success)':'var(--danger)'}">gan: $${fmt(Math.round(gan))}</div>`:''}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px">
        ${btnCurva}
        <button class="btn btn-outline btn-sm" onclick="openEditVentaModal('${v.id}')" style="font-size:.7rem">✏️</button>
        <button class="btn-ghost btn" onclick="delVenta('${v.id}','${v.prodId||''}',${v.cant})">🗑</button>
      </div>
    </div>`;
  }).join('');
}

window.delVenta=async function(id,prodId,cant){
  const ok=await confirm2('¿Eliminar venta?',`Se repondrán ${cant} unidad${cant>1?'es':''} al stock.`); if(!ok)return;
  try{
    const batch=writeBatch(db);
    batch.delete(doc(db,'ventas',id));
    if(prodId){const s=await getDoc(doc(db,'stock',prodId));if(s.exists())batch.update(doc(db,'stock',prodId),{qty:increment(cant)});}
    await batch.commit(); toast('Venta eliminada y stock repuesto ✓','success');
  }catch(e){toast('Error: '+e.message,'error');}
}

// Bug #6 fix: eliminar toda una curva de una vez y reponer stock de cada prenda
window.delCurvaCompleta=async function(curvaId){
  const itemsCurva=state.ventasData.filter(v=>v.curvaId===curvaId);
  if(!itemsCurva.length){toast('No se encontraron items de esta curva.','error');return;}
  const totalPrendas=itemsCurva.reduce((a,v)=>a+v.cant,0);
  const ok=await confirm2(
    '¿Eliminar curva completa?',
    `Se eliminarán ${itemsCurva.length} registros y se repondrán ${totalPrendas} prendas al stock.`
  ); if(!ok)return;
  try{
    const batch=writeBatch(db);
    for(const v of itemsCurva){
      batch.delete(doc(db,'ventas',v.id));
      if(v.prodId){const s=await getDoc(doc(db,'stock',v.prodId));if(s.exists())batch.update(doc(db,'stock',v.prodId),{qty:increment(v.cant)});}
    }
    await batch.commit(); toast(`Curva eliminada — ${totalPrendas} prendas repuestas ✓`,'success');
  }catch(e){toast('Error: '+e.message,'error');}
}

window.clearVentasSearch=function(){
  const inp=document.getElementById('ventas-search');
  if(inp){ inp.value=''; }
  const cl=document.getElementById('ventas-search-clear');
  if(cl) cl.classList.remove('visible');
  renderVentas();
}

// ══════════════════════════════════════════
// EDITAR VENTA
// ══════════════════════════════════════════
window.openEditVentaModal=function(id){
  const v=state.ventasData.find(x=>x.id===id); if(!v)return;
  document.getElementById('ev-id').value=id;
  document.getElementById('ev-prod-info').textContent=`${v.cat} — ${v.modelo}${v.color?' ('+v.color+')':''} · T.${v.talle}`;
  document.getElementById('ev-precio').value=v.pventa||'';
  document.getElementById('ev-costo').value=v.pcosto||'';
  document.getElementById('ev-cant').value=v.cant||1;
  document.getElementById('ev-cliente').value=v.cliente||'';
  document.getElementById('ev-fecha').value=fechaAInput(v.fecha);
  document.getElementById('edit-venta-modal').classList.add('open');
}
window.closeEditVentaModal=function(){ document.getElementById('edit-venta-modal').classList.remove('open'); }
window.saveEditVenta=async function(){
  const id=document.getElementById('ev-id').value;
  const pventa=parseFloat(document.getElementById('ev-precio').value);
  const pcosto=parseFloat(document.getElementById('ev-costo').value)||null;
  const cant=parseInt(document.getElementById('ev-cant').value)||1;
  if(!pventa||pventa<=0){toast('El precio debe ser mayor a 0.','error');return;}
  const cliente=document.getElementById('ev-cliente').value.trim()||null;
  const fechaStr=document.getElementById('ev-fecha').value;
  if(fechaStr&&fechaStr>hoyISO()){toast('La fecha de la venta no puede ser futura.','error');return;}
  const v=state.ventasData.find(x=>x.id===id);
  const cambios={pventa,pcosto,cant,cliente};
  // Si cambió el día, se guarda el nuevo (al mediodía) y se recuerda la fecha original.
  if(v&&fechaStr&&fechaStr!==fechaAInput(v.fecha)){
    cambios.fecha=fechaDesdeInput(fechaStr);
    if(!v.fechaOriginal) cambios.fechaOriginal=v.fecha;
  }
  const btn=document.getElementById('ev-save-btn'); btn.disabled=true; btn.textContent='Guardando...';
  try{
    await updateDoc(doc(db,'ventas',id),cambios);
    toast('Venta actualizada ✓','success');
    closeEditVentaModal();
  }catch(e){toast('Error: '+e.message,'error');}
  finally{btn.disabled=false;btn.textContent='Guardar';}
}

document.getElementById('edit-venta-modal').addEventListener('click',e=>{if(e.target===e.currentTarget)closeEditVentaModal();});

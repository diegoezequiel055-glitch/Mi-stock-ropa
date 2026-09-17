import { state } from './state.js';
import { db, collection, doc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, getDocs, writeBatch, increment, getDoc, limit } from './firebase-config.js';

window.setTipoVenta=function(tipo){
  state.tipoVenta=tipo;
  document.getElementById('tipo-min').className='tipo-btn'+(tipo==='minorista'?' active-min':'');
  document.getElementById('tipo-may').className='tipo-btn'+(tipo==='mayorista'?' active-may':'');
  document.getElementById('tipo-cur').className='tipo-btn'+(tipo==='curva'?' active-cur':'');
  document.getElementById('tipo-cuo').className='tipo-btn'+(tipo==='cuotas'?' active-cuo':'');
  document.getElementById('tipo-multi').className='tipo-btn'+(tipo==='multiple'?' active-min':'');
  document.getElementById('form-single').style.display=(tipo==='curva'||tipo==='cuotas'||tipo==='multiple')?'none':'grid';
  document.getElementById('form-curva').style.display=tipo==='curva'?'block':'none';
  document.getElementById('form-cuotas').style.display=tipo==='cuotas'?'block':'none';
  document.getElementById('form-multiple').style.display=tipo==='multiple'?'block':'none';
  const mayExtra=document.getElementById('mayorista-extra');
  mayExtra.classList.toggle('visible',tipo==='mayorista');
  if(tipo==='mayorista'){
    document.getElementById('lbl-precio-venta').textContent='Precio mayorista ($)';
    const id=document.getElementById('v-prod').value;
    if(id){ const p=state.stockData.find(x=>x.id===id); if(p?.pmayorista) document.getElementById('v-precio').value=p.pmayorista; }
  } else if(tipo!=='cuotas'&&tipo!=='curva'&&tipo!=='multiple') {
    document.getElementById('lbl-precio-venta').textContent='Precio venta ($)';
    const id=document.getElementById('v-prod').value;
    if(id){ const p=state.stockData.find(x=>x.id===id); if(p?.pventa) document.getElementById('v-precio').value=p.pventa; }
  }
}
window.fillVentaCats=function(){
  const cats=[...new Set(state.stockData.filter(p=>p.qty>0).map(p=>p.cat))].sort();
  ['v-cat','cuo-cat'].forEach(selId=>{
    const sel=document.getElementById(selId); if(!sel)return;
    const cur=sel.value;
    sel.innerHTML='<option value="">Seleccionar categoría...</option>';
    cats.forEach(c=>{const o=document.createElement('option');o.value=c;o.textContent=c;if(c===cur)o.selected=true;sel.appendChild(o);});
  });
}
window.fillProductosByCat=function(){
  const cat=document.getElementById('v-cat').value;
  const sel=document.getElementById('v-prod');
  sel.innerHTML='<option value="">Seleccionar producto...</option>';
  if(!cat)return;
  state.stockData.filter(p=>p.cat===cat&&p.qty>0).forEach(p=>{
    const o=document.createElement('option'); o.value=p.id;
    o.textContent=`${p.modelo}${p.color?' ('+p.color+')':''} — T.${p.talle} [x${p.qty}]`;
    sel.appendChild(o);
  });
  document.getElementById('v-precio').value='';
  document.getElementById('v-costo').value='';
  document.getElementById('prod-preview').classList.remove('visible');
}
window.fillVentaPrecio=function(){
  const id=document.getElementById('v-prod').value;
  if(!id){document.getElementById('prod-preview').classList.remove('visible');return;}
  const p=state.stockData.find(x=>x.id===id); if(!p)return;
  const precioInput=document.getElementById('v-precio');
  const costoInput=document.getElementById('v-costo');
  // Según tipo de venta, autocompletar precio correspondiente
  if(state.tipoVenta==='mayorista'&&p.pmayorista&&!precioInput.value) precioInput.value=p.pmayorista;
  else if(state.tipoVenta!=='mayorista'&&p.pventa&&!precioInput.value) precioInput.value=p.pventa;
  if(p.pcosto&&!costoInput.value) costoInput.value=p.pcosto;
  showProdPreview(p);
}
window.showProdPreview = function(p){
  const preview=document.getElementById('prod-preview');
  const data=document.getElementById('prod-preview-data');
  const margen=p.pventa&&p.pcosto?Math.round((p.pventa-p.pcosto)/p.pventa*100):null;
  data.innerHTML=`
    <div class="prod-preview-item"><span>Cat:</span> ${p.cat}</div>
    <div class="prod-preview-item"><span>Talle:</span> ${p.talle}</div>
    <div class="prod-preview-item"><span>Stock:</span> <strong style="color:${p.qty<=1?'var(--warning)':'var(--success)'}">${p.qty} ud.</strong></div>
    ${p.pventa?`<div class="prod-preview-item"><span>P.Venta:</span> <strong>$${fmt(p.pventa)}</strong></div>`:''}
    ${p.pmayorista?`<div class="prod-preview-item"><span>P.Mayor:</span> <strong style="color:var(--blue)">$${fmt(p.pmayorista)}</strong></div>`:''}
    ${p.pcosto?`<div class="prod-preview-item"><span>Costo:</span> $${fmt(p.pcosto)}</div>`:''}
    ${margen!==null?`<div class="prod-preview-item"><span>Margen:</span> <strong style="color:${margen>30?'var(--success)':margen>10?'var(--warning)':'var(--danger)'}">${margen}%</strong></div>`:''}`;
  preview.classList.add('visible');
}
window.ventaSearchFilter=function(){
  const q=document.getElementById('vs-search').value.toLowerCase().trim();
  const results=document.getElementById('vs-results');
  if(!q){results.classList.remove('open');return;}
  const matches=state.stockData.filter(p=>p.qty>0).filter(p=>[p.cat,p.modelo,p.color||'',p.talle].join(' ').toLowerCase().includes(q)).slice(0,8);
  if(!matches.length){results.innerHTML=`<div class="vs-item"><div class="vs-item-title" style="color:var(--muted)">Sin resultados</div></div>`;results.classList.add('open');return;}
  results.innerHTML=matches.map(p=>`<div class="vs-item" onmousedown="selectVentaProduct('${p.id}')">
    <div class="vs-item-title">${p.modelo}${p.color?' — '+p.color:''}</div>
    <div class="vs-item-sub"><span>${p.cat}</span><span>T.${p.talle}</span><span style="color:${p.qty<=1?'var(--warning)':'var(--success)'}">x${p.qty}</span>${p.pventa?`<span style="color:var(--accent)">$${fmt(p.pventa)}</span>`:''}${p.pmayorista?`<span style="color:var(--blue)">May $${fmt(p.pmayorista)}</span>`:''}</div>
  </div>`).join('');
  results.classList.add('open');
}
window.selectVentaProduct=function(id){
  const p=state.stockData.find(x=>x.id===id); if(!p)return;
  document.getElementById('v-cat').value=p.cat; fillProductosByCat();
  document.getElementById('v-prod').value=p.id;
  if(state.tipoVenta==='mayorista'&&p.pmayorista) document.getElementById('v-precio').value=p.pmayorista;
  else if(p.pventa) document.getElementById('v-precio').value=p.pventa;
  if(p.pcosto) document.getElementById('v-costo').value=p.pcosto;
  showProdPreview(p);
  document.getElementById('vs-search').value='';
  document.getElementById('vs-results').classList.remove('open');
  document.getElementById('v-precio').focus();
}

window.registrarVenta=async function(){
  const id=document.getElementById('v-prod').value;
  const pventa=parseFloat(document.getElementById('v-precio').value);
  const pcosto=parseFloat(document.getElementById('v-costo').value)||null;
  const cant=parseInt(document.getElementById('v-cant').value)||1;
  if(!id){toast('Seleccioná un producto.','error');return;}
  if(!pventa||pventa<=0){toast('El precio debe ser mayor a 0.','error');return;}
  if(cant<=0){toast('La cantidad debe ser mayor a 0.','error');return;}
  // Bug #5 fix: costo >= precio es advertencia, no bloqueo (puede ser liquidación/mayorista con pérdida)
  if(pcosto&&pcosto>=pventa) toast('⚠️ El costo supera el precio de venta. Registrando igual.','error');
  const prod=state.stockData.find(p=>p.id===id);
  if(!prod){toast('Producto no encontrado.','error');return;}
  if(prod.qty<cant){toast(`Solo hay ${prod.qty} unidades.`,'error');return;}
  const btn=document.getElementById('btn-registrar-venta'); btn.disabled=true; btn.textContent='Registrando...';
  try{
    const batch=writeBatch(db);
    batch.update(doc(db,'stock',id),{qty:prod.qty-cant});
    if(pcosto&&!prod.pcosto) batch.update(doc(db,'stock',id),{pcosto});
    batch.set(doc(collection(db,'ventas')),{prodId:id,cat:prod.cat,modelo:prod.modelo,color:prod.color||'',talle:prod.talle,pventa,pcosto,cant,tipo:state.tipoVenta,fecha:Date.now()});
    await batch.commit();
    document.getElementById('v-cat').value='';
    document.getElementById('v-prod').innerHTML='<option value="">Primero elegí categoría</option>';
    document.getElementById('v-precio').value='';
    document.getElementById('v-costo').value='';
    document.getElementById('v-cant').value=1;
    document.getElementById('vs-search').value='';
    document.getElementById('prod-preview').classList.remove('visible');
    toast(`Venta ${state.tipoVenta} registrada ✓`,'success');
  }catch(e){toast('Error: '+e.message,'error');}
  finally{btn.disabled=false;btn.textContent='✓ Registrar venta';}
}

window.curvaSearchFilter=function(){
  const q=document.getElementById('curva-search').value.toLowerCase().trim();
  const results=document.getElementById('curva-results');
  if(!q){results.classList.remove('open');return;}
  const matches=state.stockData.filter(p=>p.qty>0).filter(p=>[p.cat,p.modelo,p.color||'',p.talle].join(' ').toLowerCase().includes(q)).slice(0,8);
  results.innerHTML=matches.length?matches.map(p=>`<div class="vs-item" onmousedown="addToCurva('${p.id}')">
    <div class="vs-item-title">${p.modelo}${p.color?' — '+p.color:''}</div>
    <div class="vs-item-sub"><span>${p.cat}</span><span>T.${p.talle}</span><span style="color:${p.qty<=1?'var(--warning)':'var(--success)'}">x${p.qty}</span>${p.pventa?`<span style="color:var(--accent)">$${fmt(p.pventa)}</span>`:''}</div>
  </div>`).join(''):`<div class="vs-item"><div class="vs-item-title" style="color:var(--muted)">Sin resultados</div></div>`;
  results.classList.add('open');
}
window.addToCurva=function(id){
  const p=state.stockData.find(x=>x.id===id); if(!p)return;
  const existing=state.curvaItems.find(x=>x.prodId===id);
  if(existing){toast('Ya está en la curva. Editá la cantidad.','error');return;}
  state.curvaItems.push({prodId:id,cant:1,pcosto:p.pcosto||null});
  document.getElementById('curva-search').value='';
  document.getElementById('curva-results').classList.remove('open');
  renderCurvaItems();
}
window.updateCurvaCant=function(idx,val){
  const n=parseInt(val)||1;
  const item=state.curvaItems[idx];
  const prod=state.stockData.find(x=>x.id===item.prodId);
  if(prod&&n>prod.qty){toast(`Máximo disponible: ${prod.qty}`,'error');state.curvaItems[idx].cant=prod.qty;}
  else state.curvaItems[idx].cant=Math.max(1,n);
  renderCurvaItems();
}
window.removeCurvaItem=function(idx){
  state.curvaItems.splice(idx,1); renderCurvaItems();
}
window.renderCurvaItems = function(){
  const cont=document.getElementById('curva-items');
  const precioUnit=parseFloat(document.getElementById('curva-precio-unit').value)||0;
  const costoUnit=parseFloat(document.getElementById('curva-costo-unit').value)||0;
  if(!state.curvaItems.length){
    cont.innerHTML=`<div class="empty" style="padding:20px"><div class="empty-icon">👕</div><p>Buscá y agregá productos a la curva</p></div>`;
    document.getElementById('curva-total').textContent='$0 — 0 prendas'; return;
  }
  let totalCant=0,totalMonto=0,totalCosto=0;
  cont.innerHTML=state.curvaItems.map((item,idx)=>{
    const p=state.stockData.find(x=>x.id===item.prodId);
    if(!p)return'';
    totalCant+=item.cant; totalMonto+=item.cant*precioUnit; totalCosto+=item.cant*costoUnit;
    const gan=precioUnit&&costoUnit?(precioUnit-costoUnit)*item.cant:null;
    return`<div class="curva-item">
      <div class="curva-item-info"><div class="curva-item-title">${p.modelo}${p.color?' ('+p.color+')':''}</div><div class="curva-item-sub">${p.cat} · T.${p.talle} · Disp: ${p.qty}</div></div>
      <input type="number" value="${item.cant}" min="1" max="${p.qty}" style="width:60px;text-align:center" onchange="updateCurvaCant(${idx},this.value)">
      <div style="font-size:.82rem;text-align:right">
        ${precioUnit?`<div style="color:var(--accent)">$${fmt(item.cant*precioUnit)}</div>`:'<div style="color:var(--muted)">—</div>'}
        ${gan!==null?`<div style="color:${gan>=0?'var(--success)':'var(--danger)'};font-size:.72rem">gan: $${fmt(Math.round(gan))}</div>`:''}
      </div>
      <button class="btn-ghost btn" onclick="removeCurvaItem(${idx})" style="padding:4px 8px">✕</button>
    </div>`;
  }).join('');
  const ganTotal=precioUnit&&costoUnit?totalMonto-totalCosto:null;
  document.getElementById('curva-total').innerHTML=
    `$${fmt(Math.round(totalMonto))} — ${totalCant} prenda${totalCant!==1?'s':''}` +
    (ganTotal!==null?` <span style="font-size:.85rem;color:${ganTotal>=0?'var(--success)':'var(--danger)'}">· gan: $${fmt(Math.round(ganTotal))}</span>`:'');
}
window.registrarCurva=async function(){
  if(!state.curvaItems.length){toast('Agregá al menos un producto a la curva.','error');return;}
  const precioUnit=parseFloat(document.getElementById('curva-precio-unit').value);
  const costoUnit=parseFloat(document.getElementById('curva-costo-unit').value)||null;
  if(!precioUnit||precioUnit<=0){toast('Ingresá el precio mayorista por unidad.','error');return;}
  // Bug #7-style check: avisar si no hay costo
  if(!costoUnit) toast('⚠️ Sin costo unitario — la ganancia no se podrá calcular.','error');
  // Verificar stock suficiente
  for(const item of state.curvaItems){
    const p=state.stockData.find(x=>x.id===item.prodId);
    if(!p||p.qty<item.cant){toast(`Stock insuficiente: ${p?.modelo||'?'} T.${p?.talle}`,'error');return;}
  }
  const btn=document.getElementById('btn-registrar-curva'); btn.disabled=true; btn.textContent='Registrando...';
  // Bug #2 fix: guardar cantidad antes de vaciar el array
  const totalItems=state.curvaItems.length;
  const totalPrendas=state.curvaItems.reduce((a,i)=>a+i.cant,0);
  // Bug #6 fix: ID compartido para identificar la curva completa en el historial
  const curvaId=Date.now().toString();
  try{
    const batch=writeBatch(db);
    for(const item of state.curvaItems){
      const p=state.stockData.find(x=>x.id===item.prodId);
      batch.update(doc(db,'stock',item.prodId),{qty:p.qty-item.cant});
      // Bug #1 fix: usar costoUnit del formulario, no el pcosto del producto
      const pcostoFinal=costoUnit!==null?costoUnit:(item.pcosto||null);
      batch.set(doc(collection(db,'ventas')),{
        prodId:item.prodId,cat:p.cat,modelo:p.modelo,color:p.color||'',talle:p.talle,
        pventa:precioUnit,pcosto:pcostoFinal,cant:item.cant,tipo:'curva',
        curvaId,fecha:Date.now()
      });
    }
    await batch.commit();
    state.curvaItems=[];
    renderCurvaItems();
    document.getElementById('curva-precio-unit').value='';
    document.getElementById('curva-costo-unit').value='';
    // Bug #2 fix: usar variables guardadas antes del vaciado
    toast(`Curva registrada — ${totalItems} productos, ${totalPrendas} prendas ✓`,'success');
  }catch(e){toast('Error: '+e.message,'error');}
  finally{btn.disabled=false;btn.textContent='✓ Confirmar pedido curva';}
}

window.setDateFilter=function(f,btn){
  state.dateFilter=f;
  document.querySelectorAll('#tab-ventas .date-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active'); renderVentas();
}

window.renderVentas=function(){
  fillVentaCats();
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
        <div class="venta-sub">T.${v.talle} · Cant: ${v.cant}${v.pcosto?' · Costo: $'+fmt(v.pcosto):''}</div>
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

// F#5: Modo toma de inventario
window.multiSearchFilter=function(){
  const q=document.getElementById('multi-search').value.toLowerCase().trim();
  const results=document.getElementById('multi-results');
  if(!q){results.classList.remove('open');return;}
  const matches=state.stockData.filter(p=>p.qty>0).filter(p=>[p.cat,p.modelo,p.color||'',p.talle].join(' ').toLowerCase().includes(q)).slice(0,8);
  results.innerHTML=matches.length?matches.map(p=>`<div class="vs-item" onmousedown="addToMulti('${p.id}')">
    <div class="vs-item-title">${p.modelo}${p.color?' — '+p.color:''}</div>
    <div class="vs-item-sub"><span>${p.cat}</span><span>T.${p.talle}</span><span style="color:${p.qty<=1?'var(--warning)':'var(--success)'}">x${p.qty}</span>${p.pventa?`<span style="color:var(--accent)">$${fmt(p.pventa)}</span>`:''}</div>
  </div>`).join(''):`<div class="vs-item"><div class="vs-item-title" style="color:var(--muted)">Sin resultados</div></div>`;
  results.classList.add('open');
}
window.addToMulti=function(id){
  const p=state.stockData.find(x=>x.id===id); if(!p)return;
  if(state.multiItems.find(x=>x.prodId===id)){toast('Ya está en la lista. Cambiá la cantidad.','error');return;}
  state.multiItems.push({prodId:id,cant:1,pventa:p.pventa||0,pcosto:p.pcosto||0});
  document.getElementById('multi-search').value='';
  document.getElementById('multi-results').classList.remove('open');
  renderMultiItems();
}
window.updateMultiItem=function(idx,field,val){
  state.multiItems[idx][field]=parseFloat(val)||0;
  if(field==='cant') state.multiItems[idx].cant=Math.max(1,parseInt(val)||1);
  renderMultiItems();
}
window.removeMultiItem=function(idx){ state.multiItems.splice(idx,1); renderMultiItems(); }
function renderMultiItems(){
  const cont=document.getElementById('multi-items');
  if(!state.multiItems.length){
    cont.innerHTML=`<div class="empty" style="padding:20px"><div class="empty-icon">🛒</div><p>Buscá productos para agregar a la venta</p></div>`;
    document.getElementById('multi-total').textContent='$0 — 0 productos'; return;
  }
  let totalMonto=0, totalItems=0;
  cont.innerHTML=state.multiItems.map((item,idx)=>{
    const p=state.stockData.find(x=>x.id===item.prodId); if(!p)return'';
    const subtotal=item.pventa*item.cant;
    totalMonto+=subtotal; totalItems+=item.cant;
    const gan=item.pcosto?(item.pventa-item.pcosto)*item.cant:null;
    return`<div class="mventa-item">
      <div><div style="font-size:.85rem;font-weight:500">${p.modelo}${p.color?' ('+p.color+')':''}</div><div style="font-size:.72rem;color:var(--muted)">${p.cat} · T.${p.talle} · Stock: ${p.qty}</div></div>
      <input type="number" value="${item.cant}" min="1" max="${p.qty}" onchange="updateMultiItem(${idx},'cant',this.value)" style="text-align:center">
      <input type="number" value="${item.pventa}" min="0" placeholder="Precio" onchange="updateMultiItem(${idx},'pventa',this.value)">
      <div style="text-align:right">
        <div style="font-size:.82rem;color:var(--accent)">$${fmt(Math.round(subtotal))}</div>
        ${gan!==null?`<div style="font-size:.7rem;color:${gan>=0?'var(--success)':'var(--danger)'}">$${fmt(Math.round(gan))}</div>`:''}
      </div>
      <button class="btn-ghost btn" onclick="removeMultiItem(${idx})" style="padding:4px 8px">✕</button>
    </div>`;
  }).join('');
  document.getElementById('multi-total').textContent=`$${fmt(Math.round(totalMonto))} — ${totalItems} producto${totalItems!==1?'s':''}`;
}
window.registrarMultiple=async function(){
  if(!state.multiItems.length){toast('Agregá al menos un producto.','error');return;}
  for(const item of state.multiItems){
    const p=state.stockData.find(x=>x.id===item.prodId);
    if(!p||p.qty<item.cant){toast(`Stock insuficiente: ${p?.modelo||'?'} T.${p?.talle}`,'error');return;}
    if(!item.pventa||item.pventa<=0){toast('Todos los productos deben tener precio.','error');return;}
  }
  const btn=document.getElementById('btn-registrar-multi'); btn.disabled=true; btn.textContent='Registrando...';
  const total=state.multiItems.length; const fecha=Date.now(); const loteId=fecha.toString();
  try{
    const batch=writeBatch(db);
    for(const item of state.multiItems){
      const p=state.stockData.find(x=>x.id===item.prodId);
      batch.update(doc(db,'stock',item.prodId),{qty:p.qty-item.cant});
      batch.set(doc(collection(db,'ventas')),{
        prodId:item.prodId,cat:p.cat,modelo:p.modelo,color:p.color||'',talle:p.talle,
        pventa:item.pventa,pcosto:item.pcosto||null,cant:item.cant,
        tipo:'multiple',loteId,fecha
      });
    }
    await batch.commit();
    state.multiItems=[];
    renderMultiItems();
    toast(`${total} producto${total!==1?'s':''} vendidos en lote ✓`,'success');
  }catch(e){toast('Error: '+e.message,'error');}
  finally{btn.disabled=false;btn.textContent='✓ Registrar todo';}
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
  document.getElementById('edit-venta-modal').classList.add('open');
}
window.closeEditVentaModal=function(){ document.getElementById('edit-venta-modal').classList.remove('open'); }
window.saveEditVenta=async function(){
  const id=document.getElementById('ev-id').value;
  const pventa=parseFloat(document.getElementById('ev-precio').value);
  const pcosto=parseFloat(document.getElementById('ev-costo').value)||null;
  const cant=parseInt(document.getElementById('ev-cant').value)||1;
  if(!pventa||pventa<=0){toast('El precio debe ser mayor a 0.','error');return;}
  const btn=document.getElementById('ev-save-btn'); btn.disabled=true; btn.textContent='Guardando...';
  try{
    await updateDoc(doc(db,'ventas',id),{pventa,pcosto,cant});
    toast('Venta actualizada ✓','success');
    closeEditVentaModal();
  }catch(e){toast('Error: '+e.message,'error');}
  finally{btn.disabled=false;btn.textContent='Guardar';}
}

// ══════════════════════════════════════════
// EDITAR GASTO
// ══════════════════════════════════════════
document.getElementById('edit-venta-modal').addEventListener('click',e=>{if(e.target===e.currentTarget)closeEditVentaModal();});

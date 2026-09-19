import { state } from './state.js';
import { db, collection, doc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, getDocs, writeBatch, increment, getDoc, limit } from './firebase-config.js';

window.loadCompras = async function(){
  try{
    const snap=await getDocs(query(collection(db,'compras'),orderBy('fecha','desc')));
    state.comprasData=snap.docs.map(d=>({id:d.id,...d.data()}));
    renderComprasKPI(); dbRefresh();
    if(document.getElementById('tab-compras').classList.contains('active')) renderCompras();
  }catch(e){ console.error('Error cargando compras:',e); }
}
window.compraSearchFilter=function(){
  const q=document.getElementById('cp-search').value.toLowerCase().trim();
  const results=document.getElementById('cp-results');
  if(!q){results.classList.remove('open');return;}
  // Bug #8 fix: separar con stock vs sin stock visualmente
  const matches=state.stockData.filter(p=>[p.cat,p.modelo,p.color||'',p.talle].join(' ').toLowerCase().includes(q)).slice(0,8);
  results.innerHTML=matches.length?matches.map(p=>`<div class="vs-item" onmousedown="addToCompra('${p.id}')">
    <div class="vs-item-title">${p.modelo}${p.color?' — '+p.color:''} ${p.qty===0?'<span style="color:var(--danger);font-size:.7rem">(sin stock)</span>':''}</div>
    <div class="vs-item-sub"><span>${p.cat}</span><span>T.${p.talle}</span><span style="color:${p.qty===0?'var(--danger)':'var(--text2)'}">Stock: ${p.qty}</span>${p.pcosto?`<span>Último costo: $${fmt(p.pcosto)}</span>`:''}</div>
  </div>`).join(''):`<div class="vs-item"><div class="vs-item-title" style="color:var(--muted)">Sin resultados</div></div>`;
  results.classList.add('open');
}
window.addToCompra=function(id){
  const p=state.stockData.find(x=>x.id===id); if(!p)return;
  if(state.cpItems.find(x=>x.prodId===id)){toast('Ya está en el pedido.','error');return;}
  state.cpItems.push({prodId:id,cant:1,pcosto_unit:p.pcosto||0});
  document.getElementById('cp-search').value='';
  document.getElementById('cp-results').classList.remove('open');
  renderCpItems();
}
window.updateCpItem=function(idx,field,val){
  state.cpItems[idx][field]=parseFloat(val)||0;
  if(field==='cant') state.cpItems[idx].cant=Math.max(1,parseInt(val)||1);
  renderCpItems();
}
window.removeCpItem=function(idx){state.cpItems.splice(idx,1);renderCpItems();}
window.renderCpItems = function(){
  const cont=document.getElementById('cp-items');
  if(!state.cpItems.length){cont.innerHTML=`<div class="empty" style="padding:16px"><div class="empty-icon">📦</div><p>Buscá productos del stock para agregarlos</p></div>`;document.getElementById('cp-total').textContent='$0 — 0 unidades';return;}
  let totalU=0,totalM=0;
  cont.innerHTML=state.cpItems.map((item,idx)=>{
    const p=state.stockData.find(x=>x.id===item.prodId); if(!p)return'';
    totalU+=item.cant; totalM+=item.cant*item.pcosto_unit;
    return`<div class="compra-prod-row">
      <div style="font-size:.82rem"><strong>${p.modelo}${p.color?' ('+p.color+')':''}</strong><div style="color:var(--muted);font-size:.72rem">${p.cat} · T.${p.talle}</div></div>
      <input type="number" value="${item.cant}" min="1" placeholder="Cant" onchange="updateCpItem(${idx},'cant',this.value)" style="text-align:center">
      <input type="number" value="${item.pcosto_unit||''}" min="0" placeholder="Costo $" onchange="updateCpItem(${idx},'pcosto_unit',this.value)">
      <div style="font-size:.8rem;color:var(--blue);text-align:right;min-width:60px">$${fmt(Math.round(item.cant*item.pcosto_unit))}</div>
      <button class="btn-ghost btn" onclick="removeCpItem(${idx})" style="padding:4px 8px">✕</button>
    </div>`;
  }).join('');
  document.getElementById('cp-total').textContent=`$${fmt(Math.round(totalM))} — ${totalU} unidad${totalU!==1?'es':''}`;
}

window.setCpStockMode=function(actualizar){
  state.cpActualizaStock=actualizar;
  document.getElementById('cp-stock-si').className='tipo-btn'+(actualizar?' active-blue':'');
  document.getElementById('cp-stock-no').className='tipo-btn'+(!actualizar?' active-blue':'');
  const aviso=document.getElementById('cp-stock-aviso');
  if(actualizar){
    aviso.style.color='var(--success)';
    aviso.textContent='Las unidades se sumarán automáticamente al stock';
  } else {
    aviso.style.color='var(--warning)';
    aviso.textContent='⚠️ Solo se guarda el historial y el costo. El stock NO se modifica.';
  }
}

window.guardarCompra=async function(){
  if(!state.cpItems.length){toast('Agregá al menos un producto.','error');return;}
  const sinCosto=state.cpItems.filter(i=>!i.pcosto_unit||i.pcosto_unit<=0);
  // Bug #9 fix: usar tipo '' (neutro) no 'error' para no confundir al usuario
  if(sinCosto.length>0) toast(`⚠️ ${sinCosto.length} producto${sinCosto.length>1?'s':''} sin precio de costo — se guardará igual.`,'');
  const proveedor=document.getElementById('cp-proveedor').value.trim();
  const fechaStr=document.getElementById('cp-fecha').value;
  const notas=document.getElementById('cp-notas').value.trim();
  if(!fechaStr){toast('Ingresá la fecha de la compra.','error');return;}
  const fecha=new Date(fechaStr+'T12:00:00').getTime();
  const btn=document.getElementById('btn-guardar-compra'); btn.disabled=true; btn.textContent='Guardando...';
  try{
    await guardarCompraItems({items:state.cpItems,proveedor,fecha,notas,actualizaStock:state.cpActualizaStock});
    // Limpiar formulario
    state.cpItems=[];
    renderCpItems();
    document.getElementById('cp-proveedor').value='';
    document.getElementById('cp-notas').value='';
    document.getElementById('cp-fecha').value=hoyISO();
    toast(state.cpActualizaStock
      ? `Compra registrada — stock actualizado ✓`
      : `Compra registrada — historial y costos guardados (stock sin cambios) ✓`
    ,'success');
  }catch(e){toast('Error: '+e.message,'error');}
  finally{btn.disabled=false;btn.textContent='📥 Registrar compra';}
}

// Guarda una compra: suma al stock, actualiza el costo (con historial) y registra el pedido.
// La usan el formulario de Compras y la Carga rápida.
// items: [{prodId, cant, pcosto_unit}]  o  [{nuevo:{cat,modelo,color,talle,pventa,pmayorista,pcurva}, cant, pcosto_unit}]
window.guardarCompraItems=async function({items,proveedor,fecha,notas,actualizaStock=true}){
  const batch=writeBatch(db);
  const detalle=[];
  for(const item of items){
    let prodId=item.prodId, info;
    if(item.nuevo){
      const n=item.nuevo, ref=doc(collection(db,'stock'));
      prodId=ref.id; info=n;
      batch.set(ref,{
        cat:n.cat,modelo:n.modelo,color:n.color||'',talle:n.talle,qty:actualizaStock?item.cant:0,
        pventa:n.pventa||null,pmayorista:n.pmayorista||null,pcurva:n.pcurva||null,
        pcosto:item.pcosto_unit>0?item.pcosto_unit:null,notas:null,createdAt:Date.now(),
        ...(item.pcosto_unit>0?{historialCosto:[{precio:item.pcosto_unit,fecha}]}:{})
      });
    } else {
      const prod=state.stockData.find(x=>x.id===prodId);
      info=prod||{};
      const updates={};
      if(actualizaStock) updates.qty=increment(item.cant);
      if(item.pcosto_unit>0){
        updates.pcosto=item.pcosto_unit;
        // F#4: guardar historial de precios de costo
        const histEntry={precio:item.pcosto_unit,fecha:fecha};
        if(prod?.historialCosto) updates.historialCosto=[...prod.historialCosto,histEntry].slice(-12); // máx 12 entradas
        else updates.historialCosto=[histEntry];
      }
      if(Object.keys(updates).length>0)
        batch.update(doc(db,'stock',prodId),updates);
    }
    detalle.push({prodId,cat:info.cat||'',modelo:info.modelo||'',color:info.color||'',talle:info.talle||'',cant:item.cant,pcosto_unit:item.pcosto_unit});
  }
  // Guardar el pedido completo
  batch.set(doc(collection(db,'compras')),{
    proveedor:proveedor||'Sin especificar', fecha, notas:notas||'',
    actualizaStock,
    items:detalle,
    total:items.reduce((a,i)=>a+i.cant*(i.pcosto_unit||0),0), createdAt:Date.now()
  });
  await batch.commit();
  await loadCompras();
}

window.setCompraFilter=function(f,btn){
  state.compraFilter=f;
  document.querySelectorAll('#tab-compras .date-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active'); renderCompras();
}

window.renderComprasKPI = function(){
  // Capital invertido = suma de todos los pedidos
  const totalInv=state.comprasData.reduce((a,c)=>a+(c.total||0),0);
  // Capital recuperado = ventas con pcosto conocido, usando el costo registrado
  const recuperado=state.ventasData.filter(v=>v.pcosto).reduce((a,v)=>a+v.pcosto*v.cant,0);
  // Stock inmovilizado = stock actual * ultimo pcosto conocido
  const inmovilizado=state.stockData.filter(p=>p.pcosto&&p.qty>0).reduce((a,p)=>a+p.pcosto*p.qty,0);
  document.getElementById('ck-total').textContent='$'+fmt(Math.round(totalInv));
  document.getElementById('ck-recuperado').textContent='$'+fmt(Math.round(recuperado));
  document.getElementById('ck-inmovilizado').textContent='$'+fmt(Math.round(inmovilizado));
  document.getElementById('ck-pedidos').textContent=state.comprasData.length;
}

window.renderCompras=function(){
  const now=new Date();
  const filtered=state.comprasData.filter(c=>{
    const d=new Date(c.fecha);
    if(state.compraFilter==='month') return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();
    if(state.compraFilter==='3m'){const s=new Date(now);s.setMonth(s.getMonth()-3);return d>=s;}
    return true;
  });
  const list=document.getElementById('compras-list');
  if(!filtered.length){list.innerHTML=`<div class="empty"><div class="empty-icon">📥</div><p>No hay compras en este período</p></div>`;return;}
  list.innerHTML=filtered.map(c=>{
    const d=new Date(c.fecha);
    const ds=d.toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric'});
    const items=(c.items||[]).map(i=>`<div class="compra-item-row"><span>${i.cat} — ${i.modelo}${i.color?' ('+i.color+')':''} T.${i.talle}</span><span>x${i.cant} · $${fmt(i.pcosto_unit)} c/u</span></div>`).join('');
    return`<div class="compra-card">
      <div class="compra-head">
        <div><div class="compra-title">📥 ${c.proveedor}</div><div class="compra-sub">${ds}${c.notas?' · '+c.notas:''} · <span style="color:${c.actualizaStock===false?'var(--warning)':'var(--success)'}">stock ${c.actualizaStock===false?'sin cambios':'actualizado'}</span></div></div>
        <div style="text-align:right">
          <div class="compra-monto">$${fmt(Math.round(c.total||0))}</div>
          <button class="btn btn-outline btn-sm" onclick="openEditCompraModal('${c.id}')" style="font-size:.7rem;margin-right:4px">✏️</button>
          <button class="btn-ghost btn" onclick="delCompra('${c.id}')" style="font-size:.7rem;margin-top:4px">🗑 Eliminar</button>
        </div>
      </div>
      <div class="compra-items-list">${items}</div>
    </div>`;
  }).join('');
}

window.delCompra=async function(id){
  const ok=await confirm2('¿Eliminar compra?','El stock NO se revierte automáticamente.'); if(!ok)return;
  try{await deleteDoc(doc(db,'compras',id));toast('Compra eliminada');await loadCompras();}catch(e){toast('Error: '+e.message,'error');}
}

window.openEditCompraModal=function(id){
  const c=state.comprasData.find(x=>x.id===id); if(!c)return;
  document.getElementById('ec-id').value=id;
  document.getElementById('ec-proveedor').value=c.proveedor||'';
  document.getElementById('ec-notas').value=c.notas||'';
  document.getElementById('ec-fecha').value=fechaAInput(c.fecha);
  document.getElementById('edit-compra-modal').classList.add('open');
}
window.closeEditCompraModal=function(){ document.getElementById('edit-compra-modal').classList.remove('open'); }
window.saveEditCompra=async function(){
  const id=document.getElementById('ec-id').value;
  const proveedor=document.getElementById('ec-proveedor').value.trim();
  const notas=document.getElementById('ec-notas').value.trim();
  const fechaStr=document.getElementById('ec-fecha').value;
  if(!fechaStr){toast('Ingresá la fecha.','error');return;}
  const btn=document.getElementById('ec-save-btn'); btn.disabled=true; btn.textContent='Guardando...';
  try{
    await updateDoc(doc(db,'compras',id),{proveedor:proveedor||'Sin especificar',notas,fecha:new Date(fechaStr+'T12:00:00').getTime()});
    toast('Compra actualizada ✓','success');
    await loadCompras();
    closeEditCompraModal();
  }catch(e){toast('Error: '+e.message,'error');}
  finally{btn.disabled=false;btn.textContent='Guardar';}
}


document.getElementById('edit-compra-modal').addEventListener('click',e=>{if(e.target===e.currentTarget)closeEditCompraModal();});

import { state } from './state.js';
import { db, collection, doc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, getDocs, writeBatch, increment, getDoc, limit } from './firebase-config.js';

window.populateCategoryFilter = function() {
  const cats = [...new Set(state.stockData.map(p=>p.cat))].sort();
  const key  = cats.join(',');
  if(key===state.lastCatList) return;
  state.lastCatList=key;
  const sel=document.getElementById('s-cat'), cur=sel.value;
  sel.innerHTML='<option value="">Todas las categorías</option>';
  cats.forEach(c=>{ const o=document.createElement('option'); o.value=c; o.textContent=c; if(c===cur)o.selected=true; sel.appendChild(o); });
}
window.updateStockKPIs = function(){
  const total=state.stockData.reduce((a,p)=>a+p.qty,0);
  const valorInv=state.stockData.filter(p=>p.pcosto&&p.qty>0).reduce((a,p)=>a+p.pcosto*p.qty,0);
  document.getElementById('k-total').textContent=total;
  document.getElementById('k-prods').textContent=state.stockData.length;
  document.getElementById('k-sinprecio').textContent=state.stockData.filter(p=>!p.pventa).length;
  document.getElementById('k-sincosto').textContent=state.stockData.filter(p=>!p.pcosto).length;
  document.getElementById('kpi-sincosto').style.outline=state.filtroSinCosto?'2px solid var(--danger)':'none';
  document.getElementById('k-liq').textContent=state.stockData.filter(p=>p.modelo.toLowerCase().includes('liquidación')).reduce((a,p)=>a+p.qty,0);
  // F#1: valor del inventario
  const kVal=document.getElementById('k-valor');
  if(kVal) kVal.textContent=valorInv?'$'+fmt(Math.round(valorInv)):'—';
}
window.renderStock = function() {
  const q    = (document.getElementById('s-search')?.value||'').toLowerCase();
  const cat  = document.getElementById('s-cat')?.value||'';
  const sort = document.getElementById('s-sort')?.value||'cat';
  let filtered = state.stockData.filter(p=>{ const txt=[p.cat,p.modelo,p.color||'',p.talle].join(' ').toLowerCase(); return(!q||txt.includes(q))&&(!cat||p.cat===cat)&&(!state.filtroSinCosto||!p.pcosto); });
  filtered.sort((a,b)=>{
    if(sort==='cat') return a.cat.localeCompare(b.cat)||a.modelo.localeCompare(b.modelo);
    if(sort==='qty-asc') return a.qty-b.qty; if(sort==='qty-desc') return b.qty-a.qty;
    if(sort==='precio-asc') return(a.pventa||0)-(b.pventa||0); if(sort==='precio-desc') return(b.pventa||0)-(a.pventa||0);
    return 0;
  });
  updateStockKPIs();
  const renderKey = filtered.map(p=>`${p.id}:${p.qty}:${p.pventa}:${p.pcosto}:${p.pmayorista}:${p.pcurva}`).join('|')+'|'+q+'|'+cat+'|'+sort+'|'+state.filtroSinCosto;
  if(!state.inventarioMode && renderKey === state.lastStockRenderKey) return;
  state.lastStockRenderKey = renderKey;

  const tbody=document.getElementById('stock-tbody');
  tbody.innerHTML=filtered.length?filtered.map(p=>{
    const {badge,label}=getBadge(p);
    const qtyCell=state.inventarioMode
      ? `<td><input type="number" value="${state.inventarioCounts[p.id]??p.qty}" min="0" onchange="setInventarioCant('${p.id}',this.value)" style="width:70px;text-align:center;${(state.inventarioCounts[p.id]!==undefined&&state.inventarioCounts[p.id]!==p.qty)?'background:rgba(212,168,67,.15);border-color:var(--accent)':''}"></td>`
      : `<td><div class="qty-ctrl"><button class="qty-btn" onclick="adjustQty('${p.id}',-1)">−</button><span class="qty-val" style="color:${p.qty===0?'var(--danger)':p.qty<=1?'var(--warning)':'var(--text)'}">${p.qty}</span><button class="qty-btn" onclick="adjustQty('${p.id}',1)">+</button></div></td>`;
    return`<tr${p.pcosto?'':' style="box-shadow:inset 3px 0 0 var(--danger)"'}>
      <td><span style="font-size:.75rem;color:var(--muted)">${p.cat}</span></td>
      <td><strong style="font-size:.86rem">${p.modelo}</strong>${p.notas?`<div style="font-size:.68rem;color:var(--warning);margin-top:2px">📝 ${p.notas}</div>`:''}</td>
      <td>${p.color||'<span style="color:var(--muted)">—</span>'}</td>
      <td><strong>${p.talle}</strong></td>
      ${qtyCell}
      <td>${p.pcosto?'$'+fmt(p.pcosto):'<span style="color:var(--danger);font-size:.72rem;font-weight:600;white-space:nowrap">⚠ Sin costo</span>'}</td>
      <td>${p.pmayorista?'<span style="color:var(--blue)">$'+fmt(p.pmayorista)+'</span>':'<span style="color:var(--muted)">—</span>'}</td>
      <td>${p.pcurva?'<span style="color:var(--teal)">$'+fmt(p.pcurva)+'</span>':'<span style="color:var(--muted)">—</span>'}</td>
      <td>${p.pventa?'$'+fmt(p.pventa):'<span style="color:var(--muted)">—</span>'}</td>
      <td><span class="badge ${badge}">${label}</span></td>
      <td>${state.inventarioMode?`<span style="font-size:.72rem;color:${state.inventarioCounts[p.id]!==undefined&&state.inventarioCounts[p.id]!==p.qty?'var(--accent)':'var(--muted)'}">${state.inventarioCounts[p.id]!==undefined&&state.inventarioCounts[p.id]!==p.qty?`era ${p.qty}`:''}</span>`:`<button class="btn btn-outline btn-sm" onclick="openProductModal('${p.id}')">✏️ Editar</button>`}</td>
    </tr>`; }).join(''):`<tr><td colspan="11"><div class="empty"><div class="empty-icon">📦</div><p>No hay productos</p></div></td></tr>`;

  const cards=document.getElementById('stock-cards');
  cards.innerHTML=filtered.length?filtered.map(p=>{
    const {badge,label}=getBadge(p);
    const qtyMobile=state.inventarioMode
      ? `<input type="number" value="${state.inventarioCounts[p.id]??p.qty}" min="0" onchange="setInventarioCant('${p.id}',this.value)" style="width:60px;text-align:center">`
      : `<div class="qty-ctrl"><button class="qty-btn" onclick="adjustQty('${p.id}',-1)">−</button><span class="qty-val" style="color:${p.qty===0?'var(--danger)':p.qty<=1?'var(--warning)':'var(--text)'}">${p.qty}</span><button class="qty-btn" onclick="adjustQty('${p.id}',1)">+</button></div>`;
    const chip=(txt,color)=>`<span style="font-size:.74rem;color:var(--muted);white-space:nowrap">${txt} <strong style="color:${color}">`;
    return`<div class="stock-card"${p.pcosto?'':' style="border-left:3px solid var(--danger)"'}>
      <div class="stock-card-head"><div><div class="stock-card-title">${p.modelo}</div><div class="stock-card-sub">${p.cat}${p.color?' · '+p.color:''} · T.${p.talle}${p.notas?' · 📝 '+p.notas:''}</div></div><span class="badge ${badge}">${label}</span></div>
      <div style="display:flex;flex-wrap:wrap;gap:6px 14px;margin-top:8px">
        ${p.pcosto?`${chip('Costo','var(--text2)')}$${fmt(p.pcosto)}</strong></span>`:'<span style="font-size:.74rem;font-weight:600;color:var(--danger)">⚠ Sin costo</span>'}
        ${p.pmayorista?`${chip('May','var(--blue)')}$${fmt(p.pmayorista)}</strong></span>`:''}
        ${p.pcurva?`${chip('Curva','var(--teal)')}$${fmt(p.pcurva)}</strong></span>`:''}
        ${p.pventa?`${chip('Menor','var(--accent)')}$${fmt(p.pventa)}</strong></span>`:''}
      </div>
      <div class="stock-card-row">
        <div style="display:flex;gap:14px;align-items:center">
          ${qtyMobile}
        </div>
        ${state.inventarioMode?'':`<button class="btn btn-outline btn-sm" onclick="openProductModal('${p.id}')">✏️ Editar</button>`}
      </div>
    </div>`; }).join(''):`<div class="empty"><div class="empty-icon">📦</div><p>No hay productos</p></div>`;
}
window.adjustQty = async function(id, delta) {
  const prod = state.stockData.find(p=>p.id===id);
  if(!prod){ toast('Producto no encontrado.','error'); return; }
  const n = prod.qty + delta;
  if(n<0){ toast('El stock no puede ser negativo.','error'); return; }
  try{ await updateDoc(doc(db,'stock',id),{qty:n}); }catch(e){toast('Error al actualizar.','error');}
}
window.getBadge = function(p){
  const isLiq=p.modelo.toLowerCase().includes('liquidación');
  // Calcular unidades reservadas para este producto
  const reservadas=state.reservasData.filter(r=>r.prodId===p.id&&r.estado!=='cancelada').reduce((a,r)=>a+(r.cant||1),0);
  if(p.qty===0) return{badge:'b-out',label:'Sin stock'};
  if(isLiq)     return{badge:'b-liq',label:'Liquidación'};
  if(reservadas>0) return{badge:'b-reservado',label:`🔖 ${reservadas} reservada${reservadas!==1?'s':''}`};
  if(p.qty<=1)  return{badge:'b-low',label:'Última unidad'};
  return{badge:'b-ok',label:'En stock'};
}
window.onSearchInput=function(){
  const v=document.getElementById('s-search').value;
  document.getElementById('search-clear-btn').classList.toggle('visible',v.length>0);
  renderStock();
}
window.clearSearch=function(){
  document.getElementById('s-search').value='';
  document.getElementById('search-clear-btn').classList.remove('visible');
  renderStock();
}
window.openProductModal=function(id){
  const p=id?state.stockData.find(x=>x.id===id):null;
  state.currentEditId=id||null;
  document.getElementById('prod-modal-title').textContent=p?'Editar Producto':'Agregar Producto';
  document.getElementById('pm-id').value=id||'';
  document.getElementById('pm-cat').value=p?.cat||'';
  document.getElementById('pm-modelo').value=p?.modelo||'';
  document.getElementById('pm-color').value=p?.color||'';
  document.getElementById('pm-talle').value=p?.talle||'';
  document.getElementById('pm-qty').value=p?.qty??1;
  document.getElementById('pm-pventa').value=p?.pventa||'';
  document.getElementById('pm-pmayorista').value=p?.pmayorista||'';
  document.getElementById('pm-pcurva').value=p?.pcurva||'';
  document.getElementById('pm-pcosto').value=p?.pcosto||'';
  document.getElementById('pm-notas').value=p?.notas||''; // F#3
  // F#4: mostrar historial de precio de costo
  const histEl=document.getElementById('pm-hist-costo');
  if(p?.historialCosto?.length){
    const entries=p.historialCosto.slice(-5).reverse();
    histEl.innerHTML='Historial: '+entries.map(h=>`$${fmt(h.precio)} (${new Date(h.fecha).toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'2-digit'})})`).join(' → ');
  } else { histEl.textContent=''; }
  document.getElementById('pm-del-btn').style.display=p?'inline-flex':'none';
  document.getElementById('prod-modal').classList.add('open');
}
window.closeProdModal=function(){
  document.getElementById('prod-modal').classList.remove('open');
  document.getElementById('ac-cat').classList.remove('open');
  state.currentEditId=null;
}
window.saveProduct=async function(){
  const cat=document.getElementById('pm-cat').value.trim();
  const modelo=document.getElementById('pm-modelo').value.trim();
  const talle=document.getElementById('pm-talle').value.trim();
  if(!cat||!modelo||!talle){toast('Completá categoría, modelo y talle.','error');return;}
  const pventa=parseFloat(document.getElementById('pm-pventa').value)||null;
  const pcosto=parseFloat(document.getElementById('pm-pcosto').value)||null;
  const pmayorista=parseFloat(document.getElementById('pm-pmayorista').value)||null;
  const pcurva=parseFloat(document.getElementById('pm-pcurva').value)||null;
  if(!pcosto||pcosto<=0){toast('El precio de costo es obligatorio.','error');document.getElementById('pm-pcosto').focus();return;}
  if([pventa,pmayorista,pcurva].some(v=>v!==null&&v<0)){toast('Los precios no pueden ser negativos.','error');return;}
  const avisos=precioAvisos({pcosto,pmayorista,pcurva,pventa});
  const data={cat,modelo,color:document.getElementById('pm-color').value.trim(),talle,
    qty:parseInt(document.getElementById('pm-qty').value)||0,
    pventa,pcosto,pmayorista,pcurva,
    notas:document.getElementById('pm-notas').value.trim()||null // F#3
  };
  const btn=document.getElementById('pm-save-btn'); btn.disabled=true; btn.textContent='Guardando...';
  try{
    const id=document.getElementById('pm-id').value;
    if(id){await updateDoc(doc(db,'stock',id),data);toast('Producto actualizado ✓'+avisos,'success');}
    else{await addDoc(collection(db,'stock'),{...data,createdAt:Date.now()});toast('Producto agregado ✓'+avisos,'success');}
    closeProdModal();
  }catch(e){toast('Error: '+e.message,'error');}
  finally{btn.disabled=false;btn.textContent='Guardar';}
}
window.precioAvisos=function({pcosto,pmayorista,pcurva,pventa}){
  const faltan=[['Mayorista',pmayorista],['Curva',pcurva],['Menor',pventa]].filter(([,v])=>!v).map(([n])=>n);
  const bajos=[['Mayorista',pmayorista],['Curva',pcurva],['Menor',pventa]].filter(([,v])=>v&&v<=pcosto).map(([n])=>n);
  let msg='';
  if(faltan.length) msg+=` · Faltan: ${faltan.join(', ')}`;
  if(bajos.length) msg+=` · ⚠ ${bajos.join(', ')} no supera el costo`;
  return msg;
}
window.toggleFiltroSinCosto=function(){
  state.filtroSinCosto=!state.filtroSinCosto;
  renderStock();
}
window.delProductFromModal=async function(){
  const id=document.getElementById('pm-id').value; if(!id)return;
  const ok=await confirm2('¿Eliminar producto?','Esta acción no se puede deshacer.'); if(!ok)return;
  const btn=document.getElementById('pm-del-btn'); btn.disabled=true; btn.textContent='Eliminando...';
  try{await deleteDoc(doc(db,'stock',id));toast('Producto eliminado');closeProdModal();}
  catch(e){toast('Error: '+e.message,'error');btn.disabled=false;btn.textContent='🗑 Eliminar';}
}
window.exportCSV=function(){
  const rows=[['Categoría','Modelo','Color','Talle','Tipo','Unidades','Ingresos','Costos','Ganancia','Margen%']];
  const grupos={};
  // Ventas normales
  state.ventasData.forEach(v=>{
    const k=`${v.cat}||${v.modelo}||${v.color||''}||${v.talle}||${v.tipo||'minorista'}`;
    if(!grupos[k])grupos[k]={cat:v.cat,modelo:v.modelo,color:v.color||'',talle:v.talle,tipo:v.tipo||'minorista',unid:0,ing:0,cos:0};
    grupos[k].unid+=v.cant; grupos[k].ing+=v.pventa*v.cant;
    if(v.pcosto)grupos[k].cos+=v.pcosto*v.cant;
  });
  // Bug #2 fix: incluir cuotas en el CSV
  state.cuotasData.forEach(c=>{
    const ingCobrado=Array.isArray(c.cuotas)?c.cuotas.filter(q=>q.pagada).reduce((a,q)=>a+q.monto,0):0;
    const k=`${c.cat}||${c.modelo}||${c.color||''}||${c.talle}||cuotas`;
    if(!grupos[k])grupos[k]={cat:c.cat,modelo:c.modelo,color:c.color||'',talle:c.talle,tipo:'cuotas',unid:0,ing:0,cos:0};
    grupos[k].unid+=1; grupos[k].ing+=ingCobrado;
    if(c.pcosto)grupos[k].cos+=c.pcosto;
  });
  Object.values(grupos).sort((a,b)=>b.ing-a.ing).forEach(r=>{
    const gan=r.ing-r.cos; const m=r.cos?Math.round((r.ing-r.cos)/r.ing*100):'';
    rows.push([r.cat,r.modelo,r.color,r.talle,r.tipo,r.unid,Math.round(r.ing),Math.round(r.cos),Math.round(gan),m]);
  });
  const csv=rows.map(r=>r.map(v=>`"${v}"`).join(',')).join('\n');
  const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=`stockmgr-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  URL.revokeObjectURL(url); toast('CSV exportado ✓','success');
}

window.exportStockCSV=function(){
  if(!state.stockData.length){toast('No hay productos para exportar.','error');return;}
  const rows=[['Categoría','Modelo','Color','Talle','Cantidad','Precio costo','Precio mayorista','Precio curva','Precio menor','Notas']];
  [...state.stockData]
    .sort((a,b)=>a.cat.localeCompare(b.cat)||a.modelo.localeCompare(b.modelo)||String(a.talle).localeCompare(String(b.talle)))
    .forEach(p=>rows.push([p.cat,p.modelo,p.color||'',p.talle,p.qty,p.pcosto??'',p.pmayorista??'',p.pcurva??'',p.pventa??'',p.notas||'']));
  const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob=new Blob(['﻿'+csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=`stock-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  URL.revokeObjectURL(url); toast('Stock exportado ✓','success');
}

// F#1: Dashboard diario — se actualiza cada vez que cambian ventas o stock
window.toggleInventarioMode=function(){
  state.inventarioMode=!state.inventarioMode;
  state.inventarioCounts={};
  const btn=document.getElementById('btn-inventario');
  if(state.inventarioMode){
    btn.textContent='✓ Confirmar conteo';
    btn.style.background='var(--success)';
    btn.style.color='#fff';
    toast('Modo inventario activado — ingresá la cantidad real de cada producto','');
  } else {
    btn.textContent='📋 Toma de inventario';
    btn.style.background='';
    btn.style.color='';
  }
  renderStock();
}
window.setInventarioCant=function(id,val){
  state.inventarioCounts[id]=parseInt(val)||0;
}
window.confirmarInventario=async function(){
  const diffs=Object.entries(state.inventarioCounts).filter(([id,cant])=>{
    const p=state.stockData.find(x=>x.id===id);
    return p&&p.qty!==cant;
  });
  if(!diffs.length){ toast('Sin diferencias — el conteo coincide con el sistema ✓','success'); toggleInventarioMode(); return; }
  const ok=await confirm2(`Aplicar ${diffs.length} correcciones`,`Se ajustarán ${diffs.length} producto${diffs.length!==1?'s':''} según el conteo físico.`,'Aplicar','var(--success)');
  if(!ok) return;
  try{
    const batch=writeBatch(db);
    diffs.forEach(([id,cant])=>batch.update(doc(db,'stock',id),{qty:cant}));
    await batch.commit();
    toast(`${diffs.length} producto${diffs.length!==1?'s':''} ajustado${diffs.length!==1?'s':''}  ✓`,'success');
    state.inventarioMode=false; state.inventarioCounts={};
    document.getElementById('btn-inventario').textContent='📋 Toma de inventario';
    document.getElementById('btn-inventario').style.background='';
  }catch(e){ toast('Error: '+e.message,'error'); }
}

// Bug #19: Alerta proactiva de stock bajo
window.checkStockBajo = function(){
  if(state.stockBajoAlertado) return; // solo una vez por sesión
  const sinStock=state.stockData.filter(p=>p.qty===0).length;
  const ultimaUnidad=state.stockData.filter(p=>p.qty===1).length;
  if(sinStock>0||ultimaUnidad>0){
    state.stockBajoAlertado=true;
    const msgs=[];
    if(sinStock>0) msgs.push(`${sinStock} producto${sinStock>1?'s':''} sin stock`);
    if(ultimaUnidad>0) msgs.push(`${ultimaUnidad} con última unidad`);
    toast(`⚠️ Stock bajo: ${msgs.join(' · ')}. Revisá la tab Stock.`,'error');
  }
}

// ══════════════════════════════════════════
// RESERVAS
// ══════════════════════════════════════════
window.openCargaMasivaModal=function(){
  // Limpiar estado
  state.tallesSeleccionados={};
  document.getElementById('cm2-cat').value='';
  document.getElementById('cm2-modelo').value='';
  document.getElementById('cm2-color').value='';
  document.getElementById('cm2-pventa').value='';
  document.getElementById('cm2-pmayorista').value='';
  document.getElementById('cm2-pcurva').value='';
  document.getElementById('cm2-pcosto').value='';
  document.querySelectorAll('.talle-chip').forEach(c=>c.classList.remove('selected'));
  document.getElementById('cm2-talles-config').style.display='none';
  document.getElementById('cm2-resumen').textContent='Seleccioná al menos un talle';
  document.getElementById('carga-masiva-modal').classList.add('open');
}
window.closeCargaMasivaModal=function(){
  document.getElementById('carga-masiva-modal').classList.remove('open');
}
window.toggleTalle=function(chip){
  const talle=chip.dataset.talle;
  if(chip.classList.contains('selected')){
    chip.classList.remove('selected');
    delete state.tallesSeleccionados[talle];
  } else {
    chip.classList.add('selected');
    state.tallesSeleccionados[talle]=1;
  }
  renderTallesRows();
}
window.renderTallesRows = function(){
  const keys=Object.keys(state.tallesSeleccionados);
  const config=document.getElementById('cm2-talles-config');
  const rows=document.getElementById('cm2-talles-rows');
  if(!keys.length){ config.style.display='none'; document.getElementById('cm2-resumen').textContent='Seleccioná al menos un talle'; return; }
  config.style.display='block';
  const tallesOrder=['XS','S','M','L','XL','XXL','XXXL','36','38','40','42','44','46','48','50'];
  const sorted=keys.sort((a,b)=>tallesOrder.indexOf(a)-tallesOrder.indexOf(b));
  rows.innerHTML=sorted.map(t=>`
    <div class="talle-chip-row active">
      <span style="font-weight:600;font-size:.9rem">Talle ${t}</span>
      <input type="number" value="${state.tallesSeleccionados[t]||1}" min="1" style="width:60px;text-align:center" onchange="state.tallesSeleccionados['${t}']=parseInt(this.value)||1;updateCm2Resumen()">
      <span style="font-size:.78rem;color:var(--muted)">unid.</span>
    </div>`).join('');
  updateCm2Resumen();
}
window.updateCm2Resumen = function(){
  const total=Object.values(state.tallesSeleccionados).reduce((a,b)=>a+b,0);
  const n=Object.keys(state.tallesSeleccionados).length;
  document.getElementById('cm2-resumen').textContent=`${n} talle${n!==1?'s':''} · ${total} unidad${total!==1?'es':''}`;
}
window.saveCargaMasiva=async function(){
  const cat=document.getElementById('cm2-cat').value.trim();
  const modelo=document.getElementById('cm2-modelo').value.trim();
  const color=document.getElementById('cm2-color').value.trim();
  const pventa=parseFloat(document.getElementById('cm2-pventa').value)||null;
  const pmayorista=parseFloat(document.getElementById('cm2-pmayorista').value)||null;
  const pcurva=parseFloat(document.getElementById('cm2-pcurva').value)||null;
  const pcosto=parseFloat(document.getElementById('cm2-pcosto').value)||null;
  if(!cat||!modelo){ toast('Completá categoría y modelo.','error'); return; }
  if(!pcosto||pcosto<=0){ toast('El precio de costo es obligatorio.','error'); document.getElementById('cm2-pcosto').focus(); return; }
  if([pventa,pmayorista,pcurva].some(v=>v!==null&&v<0)){ toast('Los precios no pueden ser negativos.','error'); return; }
  const keys=Object.keys(state.tallesSeleccionados);
  if(!keys.length){ toast('Seleccioná al menos un talle.','error'); return; }
  const btn=document.getElementById('cm2-save-btn'); btn.disabled=true; btn.textContent='Guardando...';
  try{
    const batch=writeBatch(db);
    for(const talle of keys){
      const qty=state.tallesSeleccionados[talle]||1;
      // Verificar si ya existe ese talle en stock para sumar en lugar de duplicar
      const existe=state.stockData.find(p=>p.cat===cat&&p.modelo===modelo&&(p.color||'')===(color||'')&&p.talle===talle);
      if(existe){
        const upd={qty:existe.qty+qty};
        if(pventa) upd.pventa=pventa;
        if(pmayorista) upd.pmayorista=pmayorista;
        if(pcurva) upd.pcurva=pcurva;
        if(pcosto) upd.pcosto=pcosto;
        batch.update(doc(db,'stock',existe.id),upd);
      } else {
        const ref=doc(collection(db,'stock'));
        batch.set(ref,{cat,modelo,color,talle,qty,pventa,pmayorista,pcurva,pcosto,notas:null,createdAt:Date.now()});
      }
    }
    await batch.commit();
    const total=Object.values(state.tallesSeleccionados).reduce((a,b)=>a+b,0);
    toast(`${keys.length} talles guardados — ${total} unidades ✓`+precioAvisos({pcosto,pmayorista,pcurva,pventa}),'success');
    closeCargaMasivaModal();
  }catch(e){ toast('Error: '+e.message,'error'); }
  finally{ btn.disabled=false; btn.textContent='Guardar todos'; }
}

document.getElementById('prod-modal').addEventListener('click',e=>{if(e.target===e.currentTarget)closeProdModal();});
document.getElementById('carga-masiva-modal').addEventListener('click',e=>{if(e.target===e.currentTarget)closeCargaMasivaModal();});

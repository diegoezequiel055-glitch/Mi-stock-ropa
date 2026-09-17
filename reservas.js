import { state } from './state.js';
import { db, collection, doc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, getDocs, writeBatch, increment, getDoc, limit } from './firebase-config.js';

window.renderReservasKPI = function(){
  const now=Date.now();
  const hoy=new Date().toDateString();
  const activas=state.reservasData.filter(r=>r.estado!=='cancelada');
  const vencidas=activas.filter(r=>r.vencimiento<now).length;
  const hoyCount=activas.filter(r=>new Date(r.vencimiento).toDateString()===hoy).length;
  const unidades=activas.reduce((a,r)=>a+(r.cant||1),0);
  document.getElementById('rk-activas').textContent=activas.length;
  document.getElementById('rk-vencidas').textContent=vencidas;
  document.getElementById('rk-hoy').textContent=hoyCount;
  document.getElementById('rk-unidades').textContent=unidades;
}
window.renderReservas=function(){
  const now=Date.now();
  const list=document.getElementById('reservas-list');
  const activas=state.reservasData.filter(r=>r.estado!=='cancelada')
    .sort((a,b)=>a.vencimiento-b.vencimiento);
  if(!activas.length){
    list.innerHTML=`<div class="empty"><div class="empty-icon">🔖</div><p>No hay reservas activas. Tocá "+ Nueva reserva" para crear una.</p></div>`;
    return;
  }
  const hoy=new Date().toDateString();
  const en3dias=Date.now()+3*24*60*60*1000;
  list.innerHTML=activas.map(r=>{
    const venc=new Date(r.vencimiento);
    const vencStr=venc.toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric'});
    const isVencida=r.vencimiento<now;
    const isHoy=venc.toDateString()===hoy;
    const isProxima=!isVencida&&r.vencimiento<=en3dias;
    const cardClass=isVencida?'vencida':isHoy||isProxima?'proxima':'';
    const estadoBadge=isVencida
      ?'<span class="badge b-vencido">⚠ Vencida</span>'
      :isHoy?'<span class="badge b-proximo">⏰ Vence hoy</span>'
      :isProxima?'<span class="badge b-proximo">⏰ Próxima</span>'
      :'<span class="badge b-reservado">🔖 Activa</span>';
    return`<div class="reserva-card ${cardClass}">
      <div class="reserva-info">
        <div class="reserva-cliente">👤 ${r.cliente} ${estadoBadge}</div>
        <div class="reserva-prod">${r.cat} — ${r.modelo}${r.color?' ('+r.color+')':''} · T.${r.talle} · ${r.cant} unidad${r.cant!==1?'es':''}</div>
        <div class="reserva-fecha" style="color:${isVencida?'var(--danger)':isProxima?'var(--warning)':'var(--muted)'}">
          Vence: ${vencStr}${r.sena?` · Seña: $${fmt(r.sena)}`:''}${r.notas?' · '+r.notas:''}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
        <button class="btn btn-gold btn-sm" onclick="confirmarVentaReserva('${r.id}')" style="font-size:.72rem;white-space:nowrap">✓ Vender</button>
        <button class="btn btn-outline btn-sm" onclick="openReservaModal('${r.id}')" style="font-size:.72rem">✏️</button>
        <button class="btn-ghost btn" onclick="cancelarReserva('${r.id}')">🗑</button>
      </div>
    </div>`;
  }).join('');
}
window.updateReservasTabBadge = function(){
  const now=Date.now();
  const vencidas=state.reservasData.filter(r=>r.estado!=='cancelada'&&r.vencimiento<now).length;
  const proximas=state.reservasData.filter(r=>r.estado!=='cancelada'&&r.vencimiento>=now&&r.vencimiento<=now+3*24*60*60*1000).length;
  const count=vencidas+proximas;
  document.querySelectorAll('.tab').forEach(t=>{
    if(t.getAttribute('onclick')?.includes('reservas')){
      t.innerHTML=count
        ?`🔖 Reservas <span style="background:${vencidas?'var(--danger)':'var(--warning)'};color:#fff;border-radius:10px;padding:1px 6px;font-size:.65rem;margin-left:2px">${count}</span>`
        :'🔖 Reservas';
    }
  });
}
window.openReservaModal=function(id){
  const r=id?state.reservasData.find(x=>x.id===id):null;
  document.getElementById('reserva-modal-title').textContent=r?'✏️ Editar reserva':'🔖 Nueva reserva';
  document.getElementById('rm-id').value=id||'';
  document.getElementById('rm-prod-id').value=r?.prodId||'';
  document.getElementById('rm-cliente').value=r?.cliente||'';
  document.getElementById('rm-cant').value=r?.cant||1;
  document.getElementById('rm-sena').value=r?.sena||'';
  document.getElementById('rm-notas').value=r?.notas||'';
  document.getElementById('rm-del-btn').style.display=r?'inline-flex':'none';
  // Set vencimiento default: 7 días desde hoy
  const def=r?new Date(r.vencimiento):new Date(Date.now()+7*24*60*60*1000);
  document.getElementById('rm-vencimiento').value=def.toISOString().slice(0,10);
  // Si es edición, mostrar el producto
  const preview=document.getElementById('rm-preview');
  if(r){
    document.getElementById('rm-preview-data').innerHTML=`
      <div class="prod-preview-item"><span>Producto:</span> ${r.cat} — ${r.modelo}${r.color?' ('+r.color+')':''} T.${r.talle}</div>`;
    preview.classList.add('visible');
  } else {
    preview.classList.remove('visible');
    document.getElementById('rm-search').value='';
  }
  document.getElementById('reserva-modal').classList.add('open');
}
window.closeReservaModal=function(){
  document.getElementById('reserva-modal').classList.remove('open');
  document.getElementById('rm-results').classList.remove('open');
}
window.reservaSearchFilter=function(){
  const q=document.getElementById('rm-search').value.toLowerCase().trim();
  const results=document.getElementById('rm-results');
  if(!q){results.classList.remove('open');return;}
  const matches=state.stockData.filter(p=>p.qty>0)
    .filter(p=>[p.cat,p.modelo,p.color||'',p.talle].join(' ').toLowerCase().includes(q))
    .slice(0,8);
  results.innerHTML=matches.length?matches.map(p=>`<div class="vs-item" onmousedown="selectReservaProd('${p.id}')">
    <div class="vs-item-title">${p.modelo}${p.color?' — '+p.color:''}</div>
    <div class="vs-item-sub"><span>${p.cat}</span><span>T.${p.talle}</span><span style="color:${p.qty<=1?'var(--warning)':'var(--success)'}">x${p.qty} disp.</span></div>
  </div>`).join(''):`<div class="vs-item"><div class="vs-item-title" style="color:var(--muted)">Sin resultados</div></div>`;
  results.classList.add('open');
}
window.selectReservaProd=function(id){
  const p=state.stockData.find(x=>x.id===id); if(!p)return;
  document.getElementById('rm-prod-id').value=id;
  document.getElementById('rm-search').value='';
  document.getElementById('rm-results').classList.remove('open');
  document.getElementById('rm-preview-data').innerHTML=`
    <div class="prod-preview-item"><span>Categoría:</span> ${p.cat}</div>
    <div class="prod-preview-item"><span>Talle:</span> ${p.talle}</div>
    <div class="prod-preview-item"><span>Stock disponible:</span> <strong style="color:${p.qty<=1?'var(--warning)':'var(--success)'}">${p.qty} ud.</strong></div>
    ${p.pventa?`<div class="prod-preview-item"><span>Precio:</span> $${fmt(p.pventa)}</div>`:''}`;
  document.getElementById('rm-preview').classList.add('visible');
  document.getElementById('rm-cant').max=p.qty;
}
window.saveReserva=async function(){
  const id=document.getElementById('rm-id').value;
  const prodId=document.getElementById('rm-prod-id').value;
  const cliente=document.getElementById('rm-cliente').value.trim();
  const cant=parseInt(document.getElementById('rm-cant').value)||1;
  const vencStr=document.getElementById('rm-vencimiento').value;
  const sena=parseFloat(document.getElementById('rm-sena').value)||null;
  const notas=document.getElementById('rm-notas').value.trim();
  if(!prodId){toast('Seleccioná un producto.','error');return;}
  if(!cliente){toast('Ingresá el nombre del cliente.','error');return;}
  if(!vencStr){toast('Ingresá la fecha de vencimiento.','error');return;}
  const prod=state.stockData.find(p=>p.id===prodId);
  if(!prod){toast('Producto no encontrado.','error');return;}
  if(cant>prod.qty){toast(`Solo hay ${prod.qty} unidades disponibles.`,'error');return;}
  const btn=document.getElementById('rm-save-btn'); btn.disabled=true; btn.textContent='Guardando...';
  try{
    const data={
      prodId,cat:prod.cat,modelo:prod.modelo,color:prod.color||'',talle:prod.talle,
      cliente,cant,sena,notas,
      vencimiento:new Date(vencStr+'T23:59:59').getTime(),
      estado:'activa',createdAt:id?undefined:Date.now()
    };
    if(id) await updateDoc(doc(db,'reservas',id),data);
    else await addDoc(collection(db,'reservas'),{...data,createdAt:Date.now()});
    toast(id?'Reserva actualizada ✓':'Reserva creada ✓','success');
    closeReservaModal();
  }catch(e){toast('Error: '+e.message,'error');}
  finally{btn.disabled=false;btn.textContent='Guardar reserva';}
}
window.delReservaFromModal=async function(){
  const id=document.getElementById('rm-id').value; if(!id)return;
  const ok=await confirm2('¿Eliminar reserva?','El stock no se modifica.'); if(!ok)return;
  try{
    await deleteDoc(doc(db,'reservas',id));
    toast('Reserva eliminada');
    closeReservaModal();
  }catch(e){toast('Error: '+e.message,'error');}
}
window.cancelarReserva=async function(id){
  const ok=await confirm2('¿Cancelar reserva?','Se liberarán las unidades reservadas.'); if(!ok)return;
  try{ await deleteDoc(doc(db,'reservas',id)); toast('Reserva cancelada'); }
  catch(e){ toast('Error: '+e.message,'error'); }
}
// Confirmar venta desde reserva: abre tab ventas con el producto pre-seleccionado
window.confirmarVentaReserva=async function(id){
  const r=state.reservasData.find(x=>x.id===id); if(!r)return;
  // Eliminar la reserva y llevar al usuario a registrar la venta
  await deleteDoc(doc(db,'reservas',id));
  showTab('ventas', document.querySelector('[onclick*="ventas"]'));
  setTipoVenta('minorista');
  // Pre-seleccionar el producto
  setTimeout(()=>{
    const catSel=document.getElementById('v-cat');
    if(catSel){ catSel.value=r.cat; fillProductosByCat(); }
    setTimeout(()=>{
      const prodSel=document.getElementById('v-prod');
      if(prodSel){ prodSel.value=r.prodId; fillVentaPrecio(); }
      document.getElementById('v-cant').value=r.cant;
    },100);
  },200);
  toast(`Reserva de ${r.cliente} liberada — completá la venta ✓`,'success');
}

// ══════════════════════════════════════════
// ══════════════════════════════════════════
document.getElementById('reserva-modal').addEventListener('click',e=>{if(e.target===e.currentTarget)closeReservaModal();});

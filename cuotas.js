import { state } from './state.js';
import { db, collection, doc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, getDocs, writeBatch, increment, getDoc, limit } from './firebase-config.js';

window.cuotaSearchFilter=function(){
  const q=document.getElementById('cuo-search').value.toLowerCase().trim();
  const results=document.getElementById('cuo-results');
  if(!q){results.classList.remove('open');return;}
  const matches=state.stockData.filter(p=>p.qty>0).filter(p=>[p.cat,p.modelo,p.color||'',p.talle].join(' ').toLowerCase().includes(q)).slice(0,8);
  results.innerHTML=matches.length?matches.map(p=>`<div class="vs-item" onmousedown="selectCuotaProduct('${p.id}')">
    <div class="vs-item-title">${p.modelo}${p.color?' — '+p.color:''}</div>
    <div class="vs-item-sub"><span>${p.cat}</span><span>T.${p.talle}</span><span style="color:${p.qty<=1?'var(--warning)':'var(--success)'}">x${p.qty}</span>${p.pventa?`<span style="color:var(--accent)">$${fmt(p.pventa)}</span>`:''}</div>
  </div>`).join(''):`<div class="vs-item"><div class="vs-item-title" style="color:var(--muted)">Sin resultados</div></div>`;
  results.classList.add('open');
}
window.fillCuotaProductos=function(){
  const cat=document.getElementById('cuo-cat').value;
  const sel=document.getElementById('cuo-prod');
  sel.innerHTML='<option value="">Seleccionar producto...</option>';
  if(!cat)return;
  state.stockData.filter(p=>p.cat===cat&&p.qty>0).forEach(p=>{
    const o=document.createElement('option'); o.value=p.id;
    o.textContent=`${p.modelo}${p.color?' ('+p.color+')':''} — T.${p.talle} [x${p.qty}]`;
    sel.appendChild(o);
  });
  document.getElementById('cuo-total').value='';
  document.getElementById('cuo-preview').classList.remove('visible');
}
window.fillCuotaPrecios=function(){
  const id=document.getElementById('cuo-prod').value;
  if(!id){document.getElementById('cuo-preview').classList.remove('visible');return;}
  const p=state.stockData.find(x=>x.id===id); if(!p)return;
  if(p.pventa&&!document.getElementById('cuo-total').value) document.getElementById('cuo-total').value=p.pventa;
  if(p.pcosto&&!document.getElementById('cuo-costo').value) document.getElementById('cuo-costo').value=p.pcosto;
  // Show preview in cuotas panel
  const data=document.getElementById('cuo-preview-data');
  data.innerHTML=`
    <div class="prod-preview-item"><span>Cat:</span> ${p.cat}</div>
    <div class="prod-preview-item"><span>Talle:</span> ${p.talle}</div>
    <div class="prod-preview-item"><span>Stock:</span> <strong style="color:${p.qty<=1?'var(--warning)':'var(--success)'}">${p.qty} ud.</strong></div>
    ${p.pventa?`<div class="prod-preview-item"><span>P.Venta:</span> <strong>$${fmt(p.pventa)}</strong></div>`:''}
    ${p.pcosto?`<div class="prod-preview-item"><span>Costo:</span> $${fmt(p.pcosto)}</div>`:''}`;
  document.getElementById('cuo-preview').classList.add('visible');
  calcCuotas();
}
window.selectCuotaProduct=function(id){
  const p=state.stockData.find(x=>x.id===id); if(!p)return;
  document.getElementById('cuo-cat').value=p.cat; fillCuotaProductos();
  document.getElementById('cuo-prod').value=p.id; fillCuotaPrecios();
  document.getElementById('cuo-search').value='';
  document.getElementById('cuo-results').classList.remove('open');
  document.getElementById('cuo-cliente').focus();
}
window.calcCuotas=function(){
  const total=parseFloat(document.getElementById('cuo-total').value)||0;
  const n=parseInt(document.getElementById('cuo-ncuotas').value)||3;
  const costo=parseFloat(document.getElementById('cuo-costo').value)||0;
  const calc=document.getElementById('cuo-calc');
  if(!total){calc.style.display='none';return;}
  // Bug #1 fix: última cuota absorbe el redondeo para que el total sea exacto
  const montoCuota=Math.ceil(total/n);
  const ultimaCuota=total-(montoCuota*(n-1));
  const ganProyectada=costo?total-costo:null;
  calc.style.display='block';
  // Mostrar total real (no n*montoCuota que puede estar inflado)
  const desglose=ultimaCuota!==montoCuota
    ? `${n-1} × $${fmt(montoCuota)} + 1 × $${fmt(Math.max(0,ultimaCuota))}`
    : `${n} × $${fmt(montoCuota)}`;
  calc.innerHTML=`💳 <strong>${desglose}</strong> = $${fmt(total)} total`+
    (ganProyectada!==null?` · Ganancia proyectada: <strong style="color:${ganProyectada>=0?'var(--success)':'var(--danger)'}">$${fmt(Math.round(ganProyectada))}</strong>`:'');
}
window.registrarCuota=async function(){
  const prodId=document.getElementById('cuo-prod').value;
  const cliente=document.getElementById('cuo-cliente').value.trim();
  const total=parseFloat(document.getElementById('cuo-total').value);
  const costo=parseFloat(document.getElementById('cuo-costo').value)||null;
  const n=parseInt(document.getElementById('cuo-ncuotas').value)||3;
  const fecha1Str=document.getElementById('cuo-fecha1').value;
  if(!prodId){toast('Seleccioná un producto.','error');return;}
  if(!cliente){toast('Ingresá el nombre del cliente.','error');return;}
  if(!total||total<=0){toast('El precio total debe ser mayor a 0.','error');return;}
  // Bug #6 fix: evitar cuota negativa si el monto es menor que la cantidad de cuotas
  if(total < n){toast(`El monto $${fmt(total)} es menor que ${n} cuotas. Reducí las cuotas o aumentá el monto.`,'error');return;}
  if(!fecha1Str){toast('Ingresá la fecha de la primera cuota.','error');return;}
  const prod=state.stockData.find(p=>p.id===prodId);
  if(!prod||prod.qty<1){toast('Sin stock disponible.','error');return;}
  const btn=document.getElementById('btn-registrar-cuota'); btn.disabled=true; btn.textContent='Registrando...';
  try{
    // Generar array de cuotas con vencimientos mensuales
    const montoCuota=Math.ceil(total/n);
    const cuotas=[];
    const fecha1=new Date(fecha1Str+'T12:00:00');
    for(let i=0;i<n;i++){
      const venc=new Date(fecha1);
      venc.setMonth(venc.getMonth()+i);
      cuotas.push({nro:i+1,monto:i<n-1?montoCuota:total-(montoCuota*(n-1)),vencimiento:venc.getTime(),pagada:false,fechaPago:null});
    }
    const batch=writeBatch(db);
    // Descontar stock
    batch.update(doc(db,'stock',prodId),{qty:prod.qty-1});
    if(costo&&!prod.pcosto) batch.update(doc(db,'stock',prodId),{pcosto:costo});
    // Crear plan de cuotas
    batch.set(doc(collection(db,'cuotas')),{
      prodId,cat:prod.cat,modelo:prod.modelo,color:prod.color||'',talle:prod.talle,
      cliente,totalVenta:total,pcosto:costo,cuotas,
      estado:'pendiente', // pendiente | parcial | cobrado
      createdAt:Date.now()
    });
    await batch.commit();
    // Limpiar form
    document.getElementById('cuo-cat').value='';
    document.getElementById('cuo-prod').innerHTML='<option value="">Primero elegí categoría</option>';
    document.getElementById('cuo-total').value='';
    document.getElementById('cuo-costo').value='';
    document.getElementById('cuo-search').value='';
    document.getElementById('cuo-cliente').value='';
    document.getElementById('cuo-preview').classList.remove('visible');
    document.getElementById('cuo-calc').style.display='none';
    toast(`Venta en ${n} cuotas registrada para ${cliente} ✓`,'success');
  }catch(e){toast('Error: '+e.message,'error');}
  finally{btn.disabled=false;btn.textContent='💳 Registrar venta en cuotas';}
}

window.setCobrosFilter=function(f,btn){
  state.cobrosFilter=f;
  document.querySelectorAll('#tab-cobros .date-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active'); renderCobros();
}
window.renderCobrosKPI = function(){
  const now=Date.now();
  let pendiente=0,cobrado=0,vencido=0,activos=0;
  state.cuotasData.forEach(c=>{
    if(!Array.isArray(c.cuotas)) return;
    const cobradas=c.cuotas.filter(q=>q.pagada);
    const pendientes=c.cuotas.filter(q=>!q.pagada);
    cobrado+=cobradas.reduce((a,q)=>a+q.monto,0);
    pendiente+=pendientes.reduce((a,q)=>a+q.monto,0);
    vencido+=pendientes.filter(q=>q.vencimiento<now).reduce((a,q)=>a+q.monto,0);
    if(c.estado!=='cobrado') activos++;
  });
  document.getElementById('co-pendiente').textContent='$'+fmt(Math.round(pendiente));
  document.getElementById('co-cobrado').textContent='$'+fmt(Math.round(cobrado));
  document.getElementById('co-vencido').textContent='$'+fmt(Math.round(vencido));
  document.getElementById('co-activos').textContent=activos;
}
window.renderCobros=function(){
  const now=Date.now();
  const hoy=new Date(); hoy.setHours(0,0,0,0);
  const en7dias=new Date(hoy); en7dias.setDate(en7dias.getDate()+7);
  let filtered=state.cuotasData;
  if(state.cobrosFilter==='activos') filtered=state.cuotasData.filter(c=>c.estado!=='cobrado');
  else if(state.cobrosFilter==='vencidos') filtered=state.cuotasData.filter(c=>Array.isArray(c.cuotas)&&c.cuotas.some(q=>!q.pagada&&q.vencimiento<now));
  const list=document.getElementById('cobros-list');
  if(!filtered.length){list.innerHTML=`<div class="empty"><div class="empty-icon">💳</div><p>${state.cobrosFilter==='activos'?'No hay planes de cuotas activos':'No hay resultados'}</p></div>`;return;}
  list.innerHTML=filtered.map(c=>{
    if(!Array.isArray(c.cuotas)||!c.cuotas.length) return ''; // protección contra datos corruptos
    const pendientes=c.cuotas.filter(q=>!q.pagada);
    const tieneVencidas=pendientes.some(q=>q.vencimiento<now);
    const tieneProximas=pendientes.some(q=>q.vencimiento>=now&&q.vencimiento<en7dias.getTime());
    const cardClass=c.estado==='cobrado'?'cobrada':tieneVencidas?'vencida':tieneProximas?'proxima':'al-dia';
    const estadoBadge=c.estado==='cobrado'?'<span class="badge b-cobrado">✓ Cobrado</span>':
      tieneVencidas?'<span class="badge b-vencido">⚠ Vencido</span>':
      tieneProximas?'<span class="badge b-proximo">⏰ Próximo</span>':
      '<span class="badge b-cuota">💳 Al día</span>';
    const pagadas=c.cuotas.filter(q=>q.pagada).length;
    const totalCuotas=c.cuotas.length;
    const montoPagado=c.cuotas.filter(q=>q.pagada).reduce((a,q)=>a+q.monto,0);
    // Bug #15 fix: dots más grandes (44px) para tap preciso en mobile
    // Bug #20 fix: no poner datos sensibles en title (no funciona en mobile táctil)
    const dots=c.cuotas.map((q,idx)=>{
      const cls=q.pagada?'pagada':q.vencimiento<now?'vencida-dot':'pendiente';
      const label=q.pagada?'✓':q.vencimiento<now?'!':q.nro;
      const onclick=q.pagada?`desmarcarCuota('${c.id}',${idx})`:`marcarCuota('${c.id}',${idx})`;
      return`<div class="cuota-dot ${cls}" onclick="${onclick}">${label}</div>`;
    }).join('');
    // Bug #16 fix: mostrar próxima cuota pendiente de forma visible
    const proxima=c.cuotas.find(q=>!q.pagada);
    const proximaHTML=proxima&&c.estado!=='cobrado'
      ? `<div style="font-size:.75rem;color:var(--text2);margin-bottom:8px">📅 Próxima: <strong>$${fmt(proxima.monto)}</strong> · ${new Date(proxima.vencimiento).toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric'})}</div>`
      : '';
    return`<div class="cuota-card ${cardClass}">
      <div class="cuota-head">
        <div>
          <div class="cuota-cliente">👤 ${c.cliente} ${estadoBadge}</div>
          <div class="cuota-prod">${c.cat} — ${c.modelo}${c.color?' ('+c.color+')':''} · T.${c.talle}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-family:'Cormorant Garamond',serif;font-size:1.1rem;color:var(--orange)">$${fmt(Math.round(c.totalVenta))}</div>
          <div style="font-size:.72rem;color:var(--muted)">${pagadas}/${totalCuotas} cuotas · $${fmt(Math.round(montoPagado))} cobrado</div>
        </div>
      </div>
      <div class="cuota-progress">${dots}</div>
      ${proximaHTML}
      <div class="cuota-footer">
        <div style="font-size:.75rem;color:var(--muted)">Tocá un círculo para marcar cuota cobrada</div>
        <div style="display:flex;gap:6px">
          <button class="btn btn-outline btn-sm" onclick="openCuotaModal('${c.id}')" style="font-size:.7rem">✏️ Editar</button>
          <button class="btn-ghost btn" onclick="delCuota('${c.id}','${c.prodId}',${c.estado!=='cobrado'})" style="font-size:.72rem">🗑</button>
        </div>
      </div>
    </div>`;
  }).join('');
}
window.marcarCuota=async function(cuotaId,idx){
  const c=state.cuotasData.find(x=>x.id===cuotaId); if(!c)return;
  const nuevasCuotas=[...c.cuotas];
  nuevasCuotas[idx]={...nuevasCuotas[idx],pagada:true,fechaPago:Date.now()};
  const todasPagadas=nuevasCuotas.every(q=>q.pagada);
  const algunaPagada=nuevasCuotas.some(q=>q.pagada);
  const nuevoEstado=todasPagadas?'cobrado':algunaPagada?'parcial':'pendiente';
  try{
    await updateDoc(doc(db,'cuotas',cuotaId),{cuotas:nuevasCuotas,estado:nuevoEstado});
    if(todasPagadas) toast(`✓ Plan de ${c.cliente} cobrado completamente!`,'success');
    else toast(`Cuota ${idx+1} marcada como cobrada ✓`,'success');
  }catch(e){toast('Error: '+e.message,'error');}
}
window.desmarcarCuota=async function(cuotaId,idx){
  const c=state.cuotasData.find(x=>x.id===cuotaId); if(!c)return;
  const ok=await confirm2('¿Desmarcar cuota?','Se marcará como no cobrada.','Desmarcar','var(--warning)'); if(!ok)return;
  const nuevasCuotas=[...c.cuotas];
  nuevasCuotas[idx]={...nuevasCuotas[idx],pagada:false,fechaPago:null};
  const algunaPagada=nuevasCuotas.some(q=>q.pagada);
  try{
    await updateDoc(doc(db,'cuotas',cuotaId),{cuotas:nuevasCuotas,estado:algunaPagada?'parcial':'pendiente'});
    toast('Cuota desmarcada','success');
  }catch(e){toast('Error: '+e.message,'error');}
}
window.openCuotaModal=function(id){
  const c=state.cuotasData.find(x=>x.id===id); if(!c)return;
  document.getElementById('cm-id').value=id;
  document.getElementById('cm-cliente').value=c.cliente||'';
  document.getElementById('cm-total').value=c.totalVenta||'';
  document.getElementById('cm-costo').value=c.pcosto||'';
  document.getElementById('cuota-modal').classList.add('open');
}
window.closeCuotaModal=function(){
  document.getElementById('cuota-modal').classList.remove('open');
}
window.saveCuotaEdit=async function(){
  const id=document.getElementById('cm-id').value;
  const cliente=document.getElementById('cm-cliente').value.trim();
  const total=parseFloat(document.getElementById('cm-total').value)||null;
  const costo=parseFloat(document.getElementById('cm-costo').value)||null;
  if(!cliente){toast('Ingresá el nombre del cliente.','error');return;}
  const btn=document.getElementById('cm-save-btn'); btn.disabled=true; btn.textContent='Guardando...';
  try{
    const updates={cliente};
    if(total) updates.totalVenta=total;
    if(costo!==null) updates.pcosto=costo;
    await updateDoc(doc(db,'cuotas',id),updates);
    toast('Plan actualizado ✓','success');
    closeCuotaModal();
  }catch(e){toast('Error: '+e.message,'error');}
  finally{btn.disabled=false;btn.textContent='Guardar';}
}
document.getElementById('cuota-modal').addEventListener('click',e=>{if(e.target===e.currentTarget)closeCuotaModal();});
window.delCuota=async function(id,prodId,reponerStock){
  const msg=reponerStock?'Se repone 1 unidad al stock.':'El plan ya estaba cobrado, no se repone stock.';
  const ok=await confirm2('¿Eliminar plan de cuotas?',msg); if(!ok)return;
  try{
    const batch=writeBatch(db);
    batch.delete(doc(db,'cuotas',id));
    // Bug #2 fix: validar que prodId sea un string válido, no "undefined"
    if(reponerStock && prodId && prodId !== 'undefined' && prodId !== ''){
      const s=await getDoc(doc(db,'stock',prodId));
      if(s.exists()) batch.update(doc(db,'stock',prodId),{qty:increment(1)});
    }
    await batch.commit(); toast('Plan eliminado y stock repuesto ✓','success');
  }catch(e){toast('Error: '+e.message,'error');}
}

window.updateCobrosTabBadge = function(){
  const vencidas=state.cuotasData.filter(c=>Array.isArray(c.cuotas)&&c.cuotas.some(q=>!q.pagada&&q.vencimiento<Date.now())).length;
  const tabs=document.querySelectorAll('.tab');
  tabs.forEach(t=>{
    if(t.textContent.includes('Cobros')||t.getAttribute('onclick')?.includes('cobros')){
      t.innerHTML=vencidas?`💳 Cobros <span style="background:var(--danger);color:#fff;border-radius:10px;padding:1px 6px;font-size:.65rem;margin-left:2px">${vencidas}</span>`:'💳 Cobros';
    }
  });
}

// UX#3: limpiar búsqueda historial ventas

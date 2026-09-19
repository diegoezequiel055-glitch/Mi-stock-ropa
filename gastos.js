import { state } from './state.js';
import { db, collection, doc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, getDocs, writeBatch, increment, getDoc, limit } from './firebase-config.js';

window.loadGastos = async function(){
  try{
    const snap=await getDocs(query(collection(db,'gastos'),orderBy('fecha','desc')));
    state.gastosData=snap.docs.map(d=>({id:d.id,...d.data()}));
    renderGastosKPI(); dbRefresh();
    if(document.getElementById('tab-gastos').classList.contains('active')) renderGastos();
  }catch(e){ console.error('Error cargando gastos:',e); }
}
window.updateGaSubcats=function(){
  const cat=document.getElementById('ga-cat').value;
  const sub=document.getElementById('ga-sub');
  const optsNegocio=[
    ['publicidad','Publicidad / Ads'],['envios','Envíos / Logística'],
    ['packaging','Packaging'],['plataformas','Plataformas / Apps'],
    ['impuestos','Impuestos / Tasas'],['otros','Otros']
  ];
  const optsPersonal=[
    ['retiro','Retiro de ganancias'],['comida','Comida / Salidas'],
    ['transporte','Transporte'],['otros','Otros']
  ];
  const opts=cat==='negocio'?optsNegocio:optsPersonal;
  sub.innerHTML=opts.map(([v,l])=>`<option value="${v}">${l}</option>`).join('');
}

window.guardarGasto=async function(){
  const desc=document.getElementById('ga-desc').value.trim();
  const monto=parseFloat(document.getElementById('ga-monto').value);
  const cat=document.getElementById('ga-cat').value;
  const sub=document.getElementById('ga-sub').value;
  const fechaStr=document.getElementById('ga-fecha').value;
  if(!desc){toast('Ingresá una descripción.','error');return;}
  if(!monto||monto<=0){toast('El monto debe ser mayor a 0.','error');return;}
  if(!fechaStr){toast('Ingresá la fecha.','error');return;}
  const fecha=new Date(fechaStr+'T12:00:00').getTime();
  const btn=document.getElementById('btn-guardar-gasto'); btn.disabled=true; btn.textContent='Guardando...';
  try{
    await addDoc(collection(db,'gastos'),{desc,monto,cat,sub,fecha,createdAt:Date.now()});
    document.getElementById('ga-desc').value='';
    document.getElementById('ga-monto').value='';
    document.getElementById('ga-fecha').value=hoyISO();
    toast('Gasto registrado ✓','success');
    await loadGastos();
  }catch(e){toast('Error: '+e.message,'error');}
  finally{btn.disabled=false;btn.textContent='+ Registrar gasto';}
}

window.setGastoFilter=function(f,btn){
  state.gastoFilter=f;
  document.querySelectorAll('#tab-gastos .date-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active'); renderGastos();
}

window.renderGastosKPI = function(){
  const now=new Date();
  const totalTodos=state.gastosData.reduce((a,g)=>a+g.monto,0);
  const totalNeg=state.gastosData.filter(g=>g.cat==='negocio').reduce((a,g)=>a+g.monto,0);
  const totalPer=state.gastosData.filter(g=>g.cat==='personal').reduce((a,g)=>a+g.monto,0);
  const totalMes=state.gastosData.filter(g=>{const d=new Date(g.fecha);return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();}).reduce((a,g)=>a+g.monto,0);
  document.getElementById('gk-total').textContent='$'+fmt(Math.round(totalTodos));
  document.getElementById('gk-neg').textContent='$'+fmt(Math.round(totalNeg));
  document.getElementById('gk-per').textContent='$'+fmt(Math.round(totalPer));
  document.getElementById('gk-mes').textContent='$'+fmt(Math.round(totalMes));
}

window.renderGastos=function(){
  const now=new Date();
  const filtered=state.gastosData.filter(g=>{
    const d=new Date(g.fecha);
    if(state.gastoFilter==='month') return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear();
    if(state.gastoFilter==='3m'){const s=new Date(now);s.setMonth(s.getMonth()-3);return d>=s;}
    return true;
  });
  const list=document.getElementById('gastos-list');
  if(!filtered.length){list.innerHTML=`<div class="empty"><div class="empty-icon">💸</div><p>No hay gastos en este período</p></div>`;return;}
  const subLabels={publicidad:'Publicidad',envios:'Envíos',packaging:'Packaging',plataformas:'Plataformas',impuestos:'Impuestos',retiro:'Retiro',otros:'Otros'};
  const catIcons={negocio:'🏢',personal:'👤'};
  list.innerHTML=filtered.map(g=>{
    const d=new Date(g.fecha);
    const ds=d.toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric'});
    return`<div class="gasto-card">
      <div class="gasto-cat-icon">${catIcons[g.cat]||'💸'}</div>
      <div class="gasto-info">
        <div class="gasto-desc">${g.desc}</div>
        <div class="gasto-meta"><span class="badge ${g.cat==='negocio'?'cat-neg':'cat-per'}" style="padding:2px 6px;font-size:.65rem">${g.cat==='negocio'?'Negocio':'Personal'}</span> · ${subLabels[g.sub]||g.sub} · ${ds}</div>
      </div>
      <div class="gasto-monto">$${fmt(g.monto)}</div>
      <button class="btn btn-outline btn-sm" onclick="openEditGastoModal('${g.id}')" style="font-size:.7rem">✏️</button>
      <button class="btn-ghost btn" onclick="delGasto('${g.id}')">🗑</button>
    </div>`;
  }).join('');
}

window.delGasto=async function(id){
  const ok=await confirm2('¿Eliminar gasto?','Esta acción no se puede deshacer.'); if(!ok)return;
  try{await deleteDoc(doc(db,'gastos',id));toast('Gasto eliminado');await loadGastos();}catch(e){toast('Error: '+e.message,'error');}
}

window.updateEgSubcats=function(){
  const cat=document.getElementById('eg-cat').value;
  const sub=document.getElementById('eg-sub');
  const optsNegocio=[['publicidad','Publicidad / Ads'],['envios','Envíos / Logística'],['packaging','Packaging'],['plataformas','Plataformas / Apps'],['impuestos','Impuestos / Tasas'],['otros','Otros']];
  const optsPersonal=[['retiro','Retiro de ganancias'],['comida','Comida / Salidas'],['transporte','Transporte'],['otros','Otros']];
  sub.innerHTML=(cat==='negocio'?optsNegocio:optsPersonal).map(([v,l])=>`<option value="${v}">${l}</option>`).join('');
}
window.openEditGastoModal=function(id){
  const g=state.gastosData.find(x=>x.id===id); if(!g)return;
  document.getElementById('eg-id').value=id;
  document.getElementById('eg-desc').value=g.desc||'';
  document.getElementById('eg-monto').value=g.monto||'';
  document.getElementById('eg-cat').value=g.cat||'negocio';
  updateEgSubcats();
  document.getElementById('eg-sub').value=g.sub||'otros';
  document.getElementById('eg-fecha').value=fechaAInput(g.fecha);
  document.getElementById('edit-gasto-modal').classList.add('open');
}
window.closeEditGastoModal=function(){ document.getElementById('edit-gasto-modal').classList.remove('open'); }
window.saveEditGasto=async function(){
  const id=document.getElementById('eg-id').value;
  const desc=document.getElementById('eg-desc').value.trim();
  const monto=parseFloat(document.getElementById('eg-monto').value);
  const cat=document.getElementById('eg-cat').value;
  const sub=document.getElementById('eg-sub').value;
  const fechaStr=document.getElementById('eg-fecha').value;
  if(!desc||!monto||!fechaStr){toast('Completá todos los campos.','error');return;}
  const btn=document.getElementById('eg-save-btn'); btn.disabled=true; btn.textContent='Guardando...';
  try{
    await updateDoc(doc(db,'gastos',id),{desc,monto,cat,sub,fecha:new Date(fechaStr+'T12:00:00').getTime()});
    toast('Gasto actualizado ✓','success');
    await loadGastos();
    closeEditGastoModal();
  }catch(e){toast('Error: '+e.message,'error');}
  finally{btn.disabled=false;btn.textContent='Guardar';}
}

// ══════════════════════════════════════════
// EDITAR COMPRA
// ══════════════════════════════════════════
document.getElementById('edit-gasto-modal').addEventListener('click',e=>{if(e.target===e.currentTarget)closeEditGastoModal();});

import { state } from './state.js';
import { db, collection, doc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, getDocs, writeBatch, increment, getDoc, limit } from './firebase-config.js';

window.acFilter=function(inputId,listId){
  const val=document.getElementById(inputId).value.toLowerCase();
  const cats=[...new Set(state.stockData.map(p=>p.cat))].sort();
  const matches=val?cats.filter(c=>c.toLowerCase().includes(val)):cats;
  const list=document.getElementById(listId);
  if(!matches.length){list.classList.remove('open');return;}
  list.innerHTML=matches.map(c=>`<div class="ac-item" data-val="${c.replace(/"/g,'&quot;')}" data-input="${inputId}" data-list="${listId}" onmousedown="acSelectFromEl(this)">${c}</div>`).join('');
  list.classList.add('open');
}
window.acSelectFromEl=function(el){
  document.getElementById(el.dataset.input).value=el.dataset.val;
  document.getElementById(el.dataset.list).classList.remove('open');
}
document.addEventListener('click',e=>{
  if(!e.target.closest('.autocomplete-wrap')) document.querySelectorAll('.autocomplete-list').forEach(l=>l.classList.remove('open'));
  if(!e.target.closest('.venta-search-wrap')&&!e.target.closest('#cp-search')&&!e.target.closest('#uv-search')&&!e.target.closest('#rm-search'))
    document.querySelectorAll('.venta-search-results').forEach(r=>r.classList.remove('open'));
});
window.toast=function(msg,type=''){
  const t=document.getElementById('toast');
  t.textContent=msg; t.className='toast'+(type?' '+type:'');
  void t.offsetWidth; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),2800);
}
window.confirm2=function(title,msg,okLabel='Eliminar',okColor='var(--danger)'){
  return new Promise(resolve=>{
    state.confirmCb=resolve;
    document.getElementById('confirm-title').textContent=title;
    document.getElementById('confirm-msg').textContent=msg;
    const btn=document.getElementById('confirm-ok-btn'); btn.textContent=okLabel; btn.style.background=okColor;
    document.getElementById('confirm-overlay').classList.add('open');
  });
}
window.confirmResolve=function(val){
  document.getElementById('confirm-overlay').classList.remove('open');
  if(state.confirmCb){state.confirmCb(val);state.confirmCb=null;}
}
window.fmt = function(n){return Number(n).toLocaleString('es-AR');}

// Fechas en hora local (no UTC): entre las 21:00 y las 24:00 de Argentina, UTC ya es "mañana".
window.fechaAInput=function(ms){ const d=new Date(ms); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
window.hoyISO=function(){ return fechaAInput(Date.now()); }
// Devuelve el momento a guardar: si es hoy, la hora actual; si es otro día, el mediodía de ese día.
window.fechaDesdeInput=function(str){ if(!str||str===hoyISO()) return Date.now(); return new Date(str+'T12:00:00').getTime(); }

// Historial de precios: cada campo de precio guarda sus últimos 12 cambios, con fecha.
window.HISTORIAL_CAMPOS={pcosto:'historialCosto',pmayorista:'historialMayorista',pcurva:'historialCurva',pventa:'historialMenor'};
// prodActual: el producto tal como está antes del cambio (null si es nuevo). cambios: los valores nuevos a guardar.
// Devuelve solo los campos de historial que corresponde actualizar (agregar a un updateDoc/set junto con "cambios").
window.agregarHistorial=function(prodActual,cambios,fecha=Date.now()){
  const extra={};
  for(const campo in window.HISTORIAL_CAMPOS){
    if(!(campo in cambios))continue;
    const nuevo=cambios[campo];
    if(!(nuevo>0)||nuevo===prodActual?.[campo])continue; // sin valor o sin cambio real
    const key=window.HISTORIAL_CAMPOS[campo];
    extra[key]=[...(prodActual?.[key]||[]),{precio:nuevo,fecha}].slice(-12);
  }
  return extra;
}

import { state } from './state.js';

window.renderResumenDia = function(){
  const now=new Date();
  const hoy=now.toDateString();
  const ventasHoy=state.ventasData.filter(v=>new Date(v.fecha).toDateString()===hoy);
  const cuotasHoy=state.cuotasData.filter(c=>new Date(c.createdAt).toDateString()===hoy);
  const ingHoy=ventasHoy.reduce((a,v)=>a+v.pventa*v.cant,0)+cuotasHoy.reduce((a,c)=>a+c.totalVenta,0);
  const ganHoy=ventasHoy.filter(v=>v.pcosto).reduce((a,v)=>a+(v.pventa-v.pcosto)*v.cant,0);
  // Cuotas que vencen hoy o mañana
  const manana=new Date(now); manana.setDate(manana.getDate()+1);
  const vencenProx=state.cuotasData.filter(c=>Array.isArray(c.cuotas)&&c.cuotas.some(q=>!q.pagada&&(new Date(q.vencimiento).toDateString()===hoy||new Date(q.vencimiento).toDateString()===manana.toDateString()))).length;
  const vencidas=state.cuotasData.filter(c=>Array.isArray(c.cuotas)&&c.cuotas.some(q=>!q.pagada&&q.vencimiento<now.getTime())).length;
  const grid=document.getElementById('dashboard-grid');
  const dash=document.getElementById('dashboard-diario');
  if(!ventasHoy.length&&!cuotasHoy.length&&!vencidas&&!vencenProx){ dash.style.display='none'; return; }
  dash.style.display='block';
  grid.innerHTML=`
    ${ventasHoy.length||cuotasHoy.length?`<div style="background:var(--success-dim);border-radius:8px;padding:12px"><div style="font-size:1.3rem;font-family:'Cormorant Garamond',serif;color:var(--success)">$${fmt(Math.round(ingHoy))}</div><div style="font-size:.7rem;color:var(--muted);margin-top:2px">${ventasHoy.length+cuotasHoy.length} venta${ventasHoy.length+cuotasHoy.length!==1?'s':''} hoy</div></div>`:''}
    ${ganHoy?`<div style="background:var(--accent-dim);border-radius:8px;padding:12px"><div style="font-size:1.3rem;font-family:'Cormorant Garamond',serif;color:var(--accent)">$${fmt(Math.round(ganHoy))}</div><div style="font-size:.7rem;color:var(--muted);margin-top:2px">Ganancia hoy</div></div>`:''}
    ${vencidas?`<div style="background:var(--danger-dim);border-radius:8px;padding:12px;cursor:pointer" onclick="showTab('cobros',null)"><div style="font-size:1.3rem;font-family:'Cormorant Garamond',serif;color:var(--danger)">${vencidas}</div><div style="font-size:.7rem;color:var(--muted);margin-top:2px">Cuota${vencidas!==1?'s':''} vencida${vencidas!==1?'s':''} ⚠️</div></div>`:''}
    ${vencenProx&&!vencidas?`<div style="background:var(--warning-dim);border-radius:8px;padding:12px;cursor:pointer" onclick="showTab('cobros',null)"><div style="font-size:1.3rem;font-family:'Cormorant Garamond',serif;color:var(--warning)">${vencenProx}</div><div style="font-size:.7rem;color:var(--muted);margin-top:2px">Cuota${vencenProx!==1?'s':''} próxima${vencenProx!==1?'s':''}</div></div>`:''}
  `;
  // UX#2: actualizar badge en tab Cobros
  updateCobrosTabBadge();
}

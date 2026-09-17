import { state } from './state.js';
import { db, collection, doc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, getDocs, writeBatch, increment, getDoc, limit } from './firebase-config.js';

window.buildMesOptions = function(){
  const sel=document.getElementById('g-mes-sel'); if(!sel)return;
  const meses=new Set();
  [...state.ventasData,...state.cuotasData,...state.comprasData,...state.gastosData].forEach(item=>{
    const d=new Date(item.fecha||item.createdAt||0);
    meses.add(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
  });
  const sorted=[...meses].sort().reverse();
  // Bug #5 fix: preservar la selección actual del usuario
  const prevVal=sel.value;
  sel.innerHTML=sorted.map(m=>{
    const [y,mo]=m.split('-');
    const nombre=new Date(parseInt(y),parseInt(mo)-1,1).toLocaleDateString('es-AR',{month:'long',year:'numeric'});
    return`<option value="${m}">${nombre}</option>`;
  }).join('');
  // Restaurar valor anterior si sigue siendo válido, si no usar el más reciente
  if(prevVal&&sorted.includes(prevVal)) sel.value=prevVal;
  else if(sorted[0]) sel.value=sorted[0];
}
window.renderFlujoCaja=function(){
  const sel=document.getElementById('g-mes-sel');
  if(!sel||!sel.value){return;}
  const [y,mo]=sel.value.split('-').map(Number);
  const desde=new Date(y,mo-1,1).getTime();
  const hasta=new Date(y,mo,1).getTime();
  const enPeriodo=ts=>ts>=desde&&ts<hasta;
  const ingVentas=state.ventasData.filter(v=>enPeriodo(v.fecha)).reduce((a,v)=>a+v.pventa*v.cant,0);
  // Bug #1 fix: usar fechaPago de cada cuota individual, no createdAt del plan completo
  const ingCuotas=state.cuotasData.flatMap(c=>Array.isArray(c.cuotas)?c.cuotas:[])
    .filter(q=>q.pagada&&enPeriodo(q.fechaPago))
    .reduce((a,q)=>a+q.monto,0);
  const egrCompras=state.comprasData.filter(c=>enPeriodo(c.fecha)).reduce((a,c)=>a+(c.total||0),0);
  const egrGastos=state.gastosData.filter(g=>enPeriodo(g.fecha)).reduce((a,g)=>a+g.monto,0);
  const totalIng=ingVentas+ingCuotas;
  const totalEgr=egrCompras+egrGastos;
  const saldo=totalIng-totalEgr;
  const body=document.getElementById('flujo-caja-body');
  body.innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px">
      <div style="background:var(--success-dim);border-radius:var(--radius);padding:16px">
        <div style="font-size:.7rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Ingresos</div>
        <div style="font-family:'Cormorant Garamond',serif;font-size:1.6rem;color:var(--success)">$${fmt(Math.round(totalIng))}</div>
        <div style="font-size:.75rem;color:var(--muted);margin-top:6px">
          Ventas: $${fmt(Math.round(ingVentas))} · Cuotas: $${fmt(Math.round(ingCuotas))}
        </div>
      </div>
      <div style="background:var(--danger-dim);border-radius:var(--radius);padding:16px">
        <div style="font-size:.7rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Egresos</div>
        <div style="font-family:'Cormorant Garamond',serif;font-size:1.6rem;color:var(--danger)">$${fmt(Math.round(totalEgr))}</div>
        <div style="font-size:.75rem;color:var(--muted);margin-top:6px">
          Compras: $${fmt(Math.round(egrCompras))} · Gastos: $${fmt(Math.round(egrGastos))}
        </div>
      </div>
    </div>
    <div style="background:var(--surface2);border-radius:var(--radius);padding:16px;display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:.8rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px">Saldo neto del mes</div>
      <div style="font-family:'Cormorant Garamond',serif;font-size:1.8rem;color:${saldo>=0?'var(--success)':'var(--danger)'}">
        ${saldo>=0?'+':''}$${fmt(Math.round(saldo))}
      </div>
    </div>`;
}
window.renderGanancias=function(){
  // Bug #11 fix: agrupar por producto (sin tipo) para no duplicar filas
  // El tipo se muestra como desglose dentro de cada fila
  const grupos={};
  let totalIng=0,totalCos=0,margenSum=0,margenCount=0;
  state.ventasData.forEach(v=>{
    totalIng+=v.pventa*v.cant;
    if(v.pcosto){totalCos+=v.pcosto*v.cant;margenSum+=(v.pventa-v.pcosto)/v.pventa*100;margenCount++;}
    const k=`${v.cat}||${v.modelo}||${v.color||''}||${v.talle}`;
    if(!grupos[k])grupos[k]={cat:v.cat,modelo:v.modelo,color:v.color||'',talle:v.talle,unid:0,ing:0,cos:0,tipos:{}};
    grupos[k].unid+=v.cant; grupos[k].ing+=v.pventa*v.cant;
    if(v.pcosto)grupos[k].cos+=v.pcosto*v.cant;
    const t=v.tipo||'minorista';
    if(!grupos[k].tipos[t])grupos[k].tipos[t]={unid:0,ing:0};
    grupos[k].tipos[t].unid+=v.cant; grupos[k].tipos[t].ing+=v.pventa*v.cant;
  });
  // Incluir cuotas cobradas en ingresos — Bug #3 fix: prorratear el costo según lo cobrado
  state.cuotasData.forEach(c=>{
    const ingCobrado=c.cuotas.filter(q=>q.pagada).reduce((a,q)=>a+q.monto,0);
    if(!ingCobrado)return;
    // Prorratear el costo según la proporción cobrada del total
    const proporcion = c.totalVenta > 0 ? ingCobrado / c.totalVenta : 0;
    const costoProporcionado = c.pcosto ? c.pcosto * proporcion : 0;
    if(costoProporcionado>0){
      totalCos+=costoProporcionado;
      // Solo contar margen si el plan está cobrado completamente (para evitar distorsión)
      if(c.estado==='cobrado'&&c.pcosto){margenSum+=(c.totalVenta-c.pcosto)/c.totalVenta*100;margenCount++;}
    }
    totalIng+=ingCobrado;
    const k=`${c.cat}||${c.modelo}||${c.color||''}||${c.talle}`;
    if(!grupos[k])grupos[k]={cat:c.cat,modelo:c.modelo,color:c.color||'',talle:c.talle,unid:0,ing:0,cos:0,tipos:{}};
    grupos[k].unid+=1; grupos[k].ing+=ingCobrado;
    if(costoProporcionado>0)grupos[k].cos+=costoProporcionado;
    if(!grupos[k].tipos['cuotas'])grupos[k].tipos['cuotas']={unid:0,ing:0};
    grupos[k].tipos['cuotas'].unid+=1; grupos[k].tipos['cuotas'].ing+=ingCobrado;
  });
  const totalGasNeg=state.gastosData.filter(g=>g.cat==='negocio').reduce((a,g)=>a+g.monto,0);
  const ganNeta=(totalIng-totalCos)-totalGasNeg;
  const margen=margenCount?margenSum/margenCount:0;
  document.getElementById('g-ing').textContent='$'+fmt(Math.round(totalIng));
  document.getElementById('g-cos').textContent='$'+fmt(Math.round(totalCos));
  document.getElementById('g-gas').textContent='$'+fmt(Math.round(totalGasNeg));
  document.getElementById('g-gan').textContent='$'+fmt(Math.round(ganNeta));
  document.getElementById('g-mar').textContent=Math.round(margen)+'%';
  const rows=Object.values(grupos).sort((a,b)=>b.ing-a.ing);
  const maxIng=rows[0]?.ing||1;
  const tbody=document.getElementById('gan-tbody');
  if(!rows.length){tbody.innerHTML=`<tr><td colspan="7"><div class="empty"><div class="empty-icon">📊</div><p>Registrá ventas para ver ganancias</p></div></td></tr>`;return;}
  tbody.innerHTML=rows.map(r=>{
    const gan=r.ing-r.cos;
    const m=r.cos?Math.round((r.ing-r.cos)/r.ing*100):null;
    const pct=r.ing/maxIng*100;
    const mc=m>30?'var(--success)':m>10?'var(--warning)':'var(--danger)';
    // Desglose de tipos si hay más de uno
    const tiposKeys=Object.keys(r.tipos);
    const tiposHTML=tiposKeys.length>1?tiposKeys.map(t=>{
      const badge=t==='mayorista'?'b-may':t==='curva'?'b-cur':t==='cuotas'?'b-cuota':'b-ok';
      return`<span class="badge ${badge}" style="font-size:.6rem">${t}: ${r.tipos[t].unid}u</span>`;
    }).join(' '):(tiposKeys[0]==='mayorista'?'<span class="badge b-may" style="font-size:.6rem">Mayorista</span>':tiposKeys[0]==='curva'?'<span class="badge b-cur" style="font-size:.6rem">Curva</span>':tiposKeys[0]==='cuotas'?'<span class="badge b-cuota" style="font-size:.6rem">Cuotas</span>':'<span class="badge b-ok" style="font-size:.6rem">Minorista</span>');
    return`<tr>
      <td><strong style="font-size:.85rem">${r.cat}</strong><span style="color:var(--muted)"> — ${r.modelo}${r.color?' ('+r.color+')':''} T.${r.talle}</span><div class="g-bar"><div class="g-bar-fill" style="width:${pct}%"></div></div></td>
      <td>${tiposHTML}</td>
      <td>${r.unid}</td>
      <td>$${fmt(Math.round(r.ing))}</td>
      <td>${r.cos?'$'+fmt(Math.round(r.cos)):'<span style="color:var(--muted)">—</span>'}</td>
      <td style="color:${gan>=0?'var(--success)':'var(--danger)'}">$${fmt(Math.round(gan))}</td>
      <td>${m!==null?`<strong style="color:${mc}">${m}%</strong>`:'<span style="color:var(--muted)">—</span>'}</td>
    </tr>`;
  }).join('');
}

window.renderDashboard = function(){
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

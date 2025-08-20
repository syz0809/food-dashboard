/* ============ 数据（示例，可替换为接口） ============ */
const MATERIALS = [
  // id, name, cat, vendor, stock, safety, leadDays, sales14(14天)
  {id:'m1', name:'羊肉块(kg)', cat:'肉类', vendor:'新牧场', stock:18, safety:20, lead:2, sales14:[7,7,7,9,10,8,7,7,7,8,10,11,12,13]},
  {id:'m2', name:'洋葱(kg)',   cat:'蔬菜', vendor:'西域果蔬', stock:12, safety:18, lead:2, sales14:[8,8,9,9,10,9,8,8,9,9,10,11,12,12]},
  {id:'m3', name:'孜然(kg)',   cat:'调味', vendor:'疆味调料', stock:5,  safety:10, lead:5, sales14:[3,3,3,4,4,3,3,3,3,4,4,4,5,5]},
  {id:'m4', name:'汽水(箱)',   cat:'饮品', vendor:'清泉饮品', stock:9,  safety:12, lead:3, sales14:[2,2,3,3,3,3,2,2,3,3,4,4,5,6]},
  {id:'m5', name:'羊骨(kg)',   cat:'肉类', vendor:'新牧场', stock:8,  safety:12, lead:4, sales14:[4,4,4,5,5,5,4,4,4,5,5,6,7,7]},
];

const CATS = ['全部','主食','肉类','蔬菜','调味','饮品'];
const VENDORS = ['全部','新牧场','西域果蔬','疆味调料','清泉饮品'];

/* ============ 状态 ============ */
let selCat = '全部';
let selVendor = '全部';
let safetyLevel = 'all'; // all | low | mid | high
let q = '';
const PO = []; // {id, qty, name, vendor, stock, safety, need7, lead}

/* ============ DOM ============ */
const $ = s=>document.querySelector(s);
const catBar = $('#catBar'), vendorBar = $('#vendorBar'), safetySeg = $('#safetySeg');
const qBox = $('#q'), datePicker = $('#datePicker'), syncBtn = $('#syncBtn');

const matList = $('#matList');
const fcLine = $('#fcLine'); // 总预测折线

const kpiSuggest = $('#kpiSuggest');
const kpiGap = $('#kpiGap');
const kpiLead = $('#kpiLead');

const poList = $('#poList');
const btnGenPO = $('#btnGenPO'), btnClearPO = $('#btnClearPO');

/* 浮窗 */
const md = $('#md');
const mdTitle = $('#mdTitle'), mdClose = $('#mdClose'), mdCancel = $('#mdCancel'), mdAdd = $('#mdAdd');
const mdName = $('#mdName'), mdVendor = $('#mdVendor'), mdCat = $('#mdCat');
const mdStock = $('#mdStock'), mdSafety = $('#mdSafety'), mdLead = $('#mdLead');
const mdAdvice = $('#mdAdvice'), mdSales7 = $('#mdSales7');
const mdSales7Line = $('#mdSales7Line'), mdFc14 = $('#mdFc14');
let currentMat = null;

/* ============ 工具 ============ */
function drawLine(cvs, series, labels){
  const ctx=cvs.getContext('2d'), dpr=window.devicePixelRatio||1;
  const W=cvs.clientWidth, H=cvs.clientHeight;
  if(!W || !H) return; // 隐藏时不画
  cvs.width=W*dpr; cvs.height=H*dpr; ctx.scale(dpr,dpr); ctx.clearRect(0,0,W,H);

  const padL=42,padR=14,padT=18,padB=24,CW=W-padL-padR,CH=H-padT-padB;
  const max=Math.max(...series), min=Math.min(...series), rng=Math.max(1,max-min);
  const step=CW/(series.length-1);

  ctx.strokeStyle='#eee'; ctx.fillStyle='#999'; ctx.font='12px Inter';
  for(let i=0;i<=4;i++){
    const y=padT+CH-CH*(i/4);
    ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(W-padR,y); ctx.stroke();
  }

  ctx.textAlign='center'; ctx.fillStyle='#aaa';
  if(labels) labels.forEach((t,i)=> ctx.fillText(t, padL+i*step, H-6));

  ctx.beginPath();
  series.forEach((v,i)=>{
    const x=padL+i*step;
    const y=padT+CH*(1-(v-min)/rng);
    i?ctx.lineTo(x,y):ctx.moveTo(x,y);
  });
  ctx.lineWidth=3; ctx.strokeStyle='#ff6b00'; ctx.stroke();

  const grd=ctx.createLinearGradient(0,padT,0,padT+CH);
  grd.addColorStop(0,'rgba(255,107,0,.25)'); grd.addColorStop(1,'rgba(255,107,0,0)');
  const lastX=padL+(series.length-1)*step;
  ctx.lineTo(lastX,padT+CH); ctx.lineTo(padL,padT+CH); ctx.closePath(); ctx.fillStyle=grd; ctx.fill();
}

/* 生成“最近 n 天”的真实日期标签（按右上角 datePicker 为“今天”） */
function labelsFor(n){
  const end = $('#datePicker')?.value ? new Date($('#datePicker').value) : new Date();
  const arr=[];
  for(let i=n-1; i>=0; i--){
    const d=new Date(end); d.setDate(d.getDate()-i);
    arr.push(`${d.getMonth()+1}/${d.getDate()}`);
  }
  return arr;
}

/* 7天需求（简化：取 sales14 的后7天和） */
function need7(mat){ return mat.sales14.slice(-7).reduce((a,b)=>a+b,0); }
/* 建议采购 = max( 7日需求 + 安全库存 - 现库存, 0 ) */
function suggestQty(mat){ return Math.max(need7(mat) + mat.safety - mat.stock, 0); }

/* ============ 渲染 ============ */
function renderBars(){
  catBar.innerHTML = CATS.map(c=>`<button class="pill ${c===selCat?'on':''}" data-cat="${c}">${c}</button>`).join('');
  vendorBar.innerHTML = VENDORS.map(v=>`<button class="pill ${v===selVendor?'on':''}" data-v="${v}">${v}</button>`).join('');
}

function renderMats(){
  const list = MATERIALS.filter(m=>{
    const catOk = selCat==='全部' || m.cat===selCat;
    const venOk = selVendor==='全部' || m.vendor===selVendor;
    const qOk = !q || (m.name+m.vendor+m.cat).includes(q);
    const level = m.safety>=20?'high':m.safety>=12?'mid':'low';
    const safeOk = safetyLevel==='all' || safetyLevel===level;
    return catOk && venOk && qOk && safeOk;
  });

  matList.innerHTML = list.map(m=>`
    <div class="mat" data-id="${m.id}">
      <div>
        <div class="name">${m.name}</div>
        <div class="meta">${m.cat} · ${m.vendor}</div>
      </div>
      <div class="stock">库存 ${m.stock} / 安全 ${m.safety}</div>
      <div class="btns">
        <button class="btn btn-inline" data-act="view">查看预测</button>
        <button class="btn" data-act="quickAdd">快速加入</button>
      </div>
    </div>
  `).join('');

  renderForecastCard(list);
}

function renderForecastCard(list){
  // 汇总 14 天预测：各物料逐日求和
  const days = 14;
  const agg = Array(days).fill(0);
  list.forEach(m => m.sales14.forEach((v,i)=> agg[i]+=v));

  // 使用真实日期标签
  const labels = labelsFor(days);
  drawLine(fcLine, agg, labels);

  // KPI
  const suggest = list.reduce((s,m)=> s + suggestQty(m), 0);
  const gap = list.reduce((s,m)=> s + Math.max(m.safety - m.stock, 0), 0);
  const leadAvg = list.length ? Math.round(list.reduce((s,m)=>s+m.lead,0)/list.length) : 0;
  kpiSuggest.textContent = suggest;
  kpiGap.textContent = gap;
  kpiLead.textContent = leadAvg;

  // 缺口 Top3（把中间卡片下部填满）
  const top3 = list
    .map(m => ({ name:m.name, gap:Math.max(m.safety - m.stock, 0) }))
    .sort((a,b)=>b.gap-a.gap)
    .slice(0,3);

  const maxGap = Math.max(1, ...top3.map(x=>x.gap));
  const gapList = $('#gapList');
  gapList.innerHTML = top3.length
    ? top3.map(x=>`
        <li class="gap-item">
          <span>${x.name}</span>
          <span class="bar"><i style="width:${Math.round(x.gap/maxGap*100)}%"></i></span>
          <span class="qty">${x.gap}</span>
        </li>
      `).join('')
    : `<li class="muted">暂无缺口</li>`;
}


function renderPO(){
  poList.innerHTML = PO.length ? PO.map(x=>`
    <div class="po-row">
      <span>${x.name}</span>
      <span>${x.vendor}</span>
      <span>${x.stock}</span>
      <span>${x.safety}</span>
      <span>${x.need7}</span>
      <span>${x.lead}</span>
      <span class="qty">${x.qty}</span>
    </div>
  `).join('') : `<div class="muted" style="padding:12px">未选择物料</div>`;
}

/* ============ 交互 ============ */
catBar.addEventListener('click', e=>{
  const b=e.target.closest('.pill'); if(!b) return;
  selCat = b.dataset.cat;
  renderBars(); renderMats();
});
vendorBar.addEventListener('click', e=>{
  const b=e.target.closest('.pill'); if(!b) return;
  selVendor = b.dataset.v;
  renderBars(); renderMats();
});
safetySeg.addEventListener('click', e=>{
  const b=e.target.closest('button'); if(!b) return;
  safetyLevel = b.dataset.level;
  [...safetySeg.children].forEach(x=>x.classList.toggle('on',x===b));
  renderMats();
});
qBox && qBox.addEventListener('input', ()=>{ q=(qBox.value||'').trim(); renderMats(); });

matList.addEventListener('click', e=>{
  const actBtn = e.target.closest('button[data-act]');
  if(!actBtn) return;
  const id = e.target.closest('.mat').dataset.id;
  const m = MATERIALS.find(x=>x.id===id);
  if(!m) return;

  if(actBtn.dataset.act==='view'){
    openMd(m);
  }else if(actBtn.dataset.act==='quickAdd'){
    PO.push({
      id:m.id, name:m.name, vendor:m.vendor, stock:m.stock, safety:m.safety,
      need7:need7(m), lead:m.lead, qty:suggestQty(m)
    });
    renderPO();
  }
});

/* 浮窗相关 */
function openMd(m){
  currentMat = m;
  mdTitle.textContent = `预测详情 · ${m.name}`;
  mdName.textContent = m.name;
  mdVendor.textContent = m.vendor;
  mdCat.textContent = m.cat;
  mdStock.textContent = m.stock;
  mdSafety.textContent = m.safety;
  mdLead.textContent = m.lead;

  // AI 建议
  const adv=[];
  if(m.stock < m.safety) adv.push('库存低于安全线，建议尽快补货');
  if(m.lead>=4) adv.push('到货周期偏长，建议提前下单');
  if(adv.length===0) adv.push('库存与需求平衡，按周补货即可');
  mdAdvice.innerHTML = adv.map(s=>`<li>${s}</li>`).join('');

  // 最近 7 天销量
  const last7 = m.sales14.slice(-7);
  mdSales7.textContent = last7.join(' / ');

  md.classList.remove('hide');

  // 等浮窗显示后再绘图，避免宽高为 0
  requestAnimationFrame(()=>{
    requestAnimationFrame(()=>{
      drawLine(mdSales7Line, last7, labelsFor(7));
    drawLine(mdFc14, m.sales14, labelsFor(14));
    });
  });
}
mdClose.onclick = mdCancel.onclick = ()=> md.classList.add('hide');
mdAdd.onclick = ()=>{
  if(!currentMat) return;
  PO.push({
    id:currentMat.id, name:currentMat.name, vendor:currentMat.vendor,
    stock:currentMat.stock, safety:currentMat.safety, need7:need7(currentMat),
    lead:currentMat.lead, qty:suggestQty(currentMat)
  });
  md.classList.add('hide');
  renderPO();
};

btnClearPO.onclick = ()=>{ PO.length=0; renderPO(); };
btnGenPO.onclick = ()=>{
  if(!PO.length) return alert('先加入待采购项');
  alert('已生成采购单（示例）');
};

/* ============ 初始化 ============ */
function init(){
  const today = new Date(); $('#datePicker').value=today.toISOString().slice(0,10);
  renderBars();
  renderMats();
  renderPO();
  window.addEventListener('resize', ()=> renderMats());
}
init();

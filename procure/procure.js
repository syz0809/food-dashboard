// ============ 数据（示例，可替换为接口） ============
const MATERIALS = [
  {id:'m1', name:'羊肉块(kg)', cat:'肉类', vendor:'新牧场', stock:18, safety:20, lead:2, sales14:[7,7,7,9,10,8,7,7,7,8,10,11,12,13]},
  {id:'m2', name:'洋葱(kg)',   cat:'蔬菜', vendor:'西域果蔬', stock:12, safety:18, lead:2, sales14:[8,8,9,9,10,9,8,8,9,9,10,11,12,12]},
  {id:'m3', name:'孜然(kg)',   cat:'调味', vendor:'疆味调料', stock:5,  safety:10, lead:5, sales14:[3,3,3,4,4,3,3,3,3,4,4,4,5,5]},
  {id:'m4', name:'汽水(箱)',   cat:'饮品', vendor:'清泉饮品', stock:9,  safety:12, lead:3, sales14:[2,2,3,3,3,3,2,2,3,3,4,4,5,6]},
  {id:'m5', name:'羊骨(kg)',   cat:'肉类', vendor:'新牧场', stock:8,  safety:12, lead:4, sales14:[4,4,4,5,5,5,4,4,4,5,5,6,7,7]},
];
const CATS = ['全部','主食','肉类','蔬菜','调味','饮品'];
const VENDORS = ['全部','新牧场','西域果蔬','疆味调料','清泉饮品'];

// ============ 状态 ============
let selCat = '全部';
let selVendor = '全部';
let safetyLevel = 'all'; // all | low | mid | high
let q = '';
const PO = new Map(); // id -> item

// ============ DOM ============
const $ = s=>document.querySelector(s);
const catBar = $('#catBar'), vendorBar = $('#vendorBar'), safetySeg = $('#safetySeg');
const qBox = $('#q'), datePicker = $('#datePicker'), syncBtn = $('#syncBtn');
const matList = $('#matList');
const fcLine = $('#fcLine'); // 汇总预测折线
const kpiSuggest = $('#kpiSuggest');
const kpiGap = $('#kpiGap');
const kpiLead = $('#kpiLead');
const poList = $('#poList');
const poFoot = $('#poFoot');
const btnGenPO = $('#btnGenPO'), btnClearPO = $('#btnClearPO');
const toast = $('#toast');

// 浮窗
const md = $('#md');
const mdTitle = $('#mdTitle'), mdClose = $('#mdClose'), mdCancel = $('#mdCancel'), mdAdd = $('#mdAdd');
const mdName = $('#mdName'), mdVendor = $('#mdVendor'), mdCat = $('#mdCat');
const mdStock = $('#mdStock'), mdSafety = $('#mdSafety'), mdLead = $('#mdLead');
const mdAdvice = $('#mdAdvice'), mdSales7 = $('#mdSales7');
const mdSales7Line = $('#mdSales7Line'), mdFc14 = $('#mdFc14');
let currentMat = null;

// ============ 工具 ============
const debounce=(fn,wait=200)=>{let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),wait)}};
const norm = s => (s||'').toLowerCase().replace(/\s+/g,'');

function drawLine(cvs, series, labels){
  const ctx=cvs.getContext('2d'), dpr=window.devicePixelRatio||1;
  const W=cvs.clientWidth, H=cvs.clientHeight;
  if(!W || !H) return; // 隐藏时不画
  cvs.width=W*dpr; cvs.height=H*dpr; ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,W,H);

  const padL=42,padR=14,padT=18,padB=26,CW=W-padL-padR,CH=H-padT-padB;
  const max=Math.max(...series), min=Math.min(...series), rng=Math.max(1,max-min);
  const step= series.length>1 ? CW/(series.length-1) : CW;

  // 网格
  ctx.strokeStyle='#eee'; ctx.fillStyle='#999'; ctx.font='12px Inter,system-ui';
  for(let i=0;i<=4;i++){ const y=padT+CH-CH*(i/4); ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(W-padR,y); ctx.stroke(); }

  // x 轴标签
  ctx.textAlign='center'; ctx.fillStyle='#aaa';
  if(labels) labels.forEach((t,i)=> ctx.fillText(t, padL+i*step, H-6));

  // 折线
  ctx.beginPath();
  series.forEach((v,i)=>{ const x=padL+i*step, y=padT+CH*(1-(v-min)/rng); i?ctx.lineTo(x,y):ctx.moveTo(x,y); });
  ctx.lineWidth=3; ctx.strokeStyle='#ff6b00'; ctx.stroke();

  // 面积渐变
  const grd=ctx.createLinearGradient(0,padT,0,padT+CH);
  grd.addColorStop(0,'rgba(255,107,0,.25)'); grd.addColorStop(1,'rgba(255,107,0,0)');
  const lastX=padL+(series.length-1)*step; ctx.lineTo(lastX,padT+CH); ctx.lineTo(padL,padT+CH); ctx.closePath(); ctx.fillStyle=grd; ctx.fill();
}

function need7(m){ return m.sales14.slice(-7).reduce((a,b)=>a+b,0); }
function suggestQty(m){ return Math.max(need7(m) + m.safety - m.stock, 0); }
function safetyLevelOf(m){ return m.safety>=20? 'high' : m.safety>=12? 'mid' : 'low'; }

function showToast(msg){
  if(!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(()=> toast.classList.remove('show'), 1600);
}

// ============ 渲染 ============
function renderBars(){
  catBar.innerHTML = CATS.map(c=>`<button class="pill ${c===selCat?'on':''}" data-cat="${c}" type="button">${c}</button>`).join('');
  vendorBar.innerHTML = VENDORS.map(v=>`<button class="pill ${v===selVendor?'on':''}" data-v="${v}" type="button">${v}</button>`).join('');
}

function filterList(){
  const qq = norm(q);
  return MATERIALS.filter(m=>{
    const catOk = selCat==='全部' || m.cat===selCat;
    const venOk = selVendor==='全部' || m.vendor===selVendor;
    const qOk = !qq || norm(m.name+m.vendor+m.cat).includes(qq);
    const lvl = safetyLevelOf(m);
    const safeOk = safetyLevel==='all' || safetyLevel===lvl;
    return catOk && venOk && qOk && safeOk;
  });
}

function renderMats(){
  const list = filterList();
  if(!list.length){
    matList.innerHTML = `<div class="muted" style="padding:12px">没有匹配的物料</div>`;
  }else{
    matList.innerHTML = list.map(m=>{
      const lvl = safetyLevelOf(m);
      const badgeTxt = lvl==='high'?'高':(lvl==='mid'?'中':'低');
      return `
      <div class="mat" data-id="${m.id}">
        <!-- 左列：标题与副标题 -->
        <div class="mat__left">
          <div class="mat__title">
            ${m.name}
            <span class="badge ${lvl}">安全:${badgeTxt}</span>
          </div>
          <div class="mat__meta">${m.cat} · ${m.vendor}</div>
        </div>

        <!-- 中列：主数据，两行布局 -->
        <div class="mat__stats">
          <div class="stock-line">
            <span class="stock">库存 <b>${m.stock}</b></span>
            <span class="slash">/</span>
            <span class="safe">安全 <b>${m.safety}</b></span>
          </div>
          <div class="lead-line">到货周期 <b>${m.lead} 天</b></div>
        </div>

        <!-- 右列：操作 -->
        <div class="mat__actions">
          <button class="btn btn-inline" data-act="view" type="button">查看预测</button>
          <button class="btn" data-act="quickAdd" type="button">快速加入</button>
        </div>
      </div>`;
    }).join('');
  }
  renderForecastCard(list);
}

function renderForecastCard(list){
  const days=14, agg=Array(days).fill(0);
  list.forEach(m=> m.sales14.forEach((v,i)=> agg[i]+=v));
  const labels = Array.from({length:days}, (_,i)=> i===days-1? '今' : `-${days-1-i}`);
  drawLine(fcLine, agg, labels);

  const suggest = list.reduce((s,m)=> s + suggestQty(m), 0);
  const gap = list.reduce((s,m)=> s + Math.max(m.safety - m.stock, 0), 0);
  const leadAvg = list.length ? Math.round(list.reduce((s,m)=>s+m.lead,0)/list.length) : 0;
  kpiSuggest.textContent = suggest;
  kpiGap.textContent = gap;
  kpiLead.textContent = leadAvg;
}

function renderPO(){
  const rows = [...PO.values()];
  if(!rows.length){
    poList.innerHTML = `<div class="muted" style="padding:12px">未选择物料</div>`;
    poFoot.innerHTML = '';
    return;
  }
  poList.innerHTML = rows.map(x=>`
    <div class="po-row" data-id="${x.id}">
      <span>${x.name}</span>
      <span>${x.vendor}</span>
      <span>${x.stock}</span>
      <span>${x.safety}</span>
      <span>${x.need7}</span>
      <span>${x.lead}</span>
      <span class="qty"><input type="number" min="0" step="1" value="${x.qty}" aria-label="建议采购数量"/></span>
      <span><button class="btn rm" data-act="rm" type="button">移除</button></span>
    </div>
  `).join('');

  const totalQty = rows.reduce((s,r)=>s+Number(r.qty||0),0);
  const vendorSet = new Set(rows.map(r=>r.vendor));
  poFoot.innerHTML = `<div>共 ${rows.length} 项 · 建议总数 <b>${totalQty}</b></div><div>涉及供应商：${[...vendorSet].join('、')}</div>`;
}

// ============ 交互 ============
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

qBox && qBox.addEventListener('input', debounce(()=>{
  q=(qBox.value||'').trim();
  renderMats();
}, 200));

matList.addEventListener('click', e=>{
  const actBtn = e.target.closest('button[data-act]');
  if(!actBtn) return;
  const id = e.target.closest('.mat').dataset.id;
  const m = MATERIALS.find(x=>x.id===id);
  if(!m) return;

  if(actBtn.dataset.act==='view'){
    openMd(m);
  }else if(actBtn.dataset.act==='quickAdd'){
    const existed = PO.get(m.id);
    const qty = suggestQty(m);
    if(existed){
      existed.qty = qty; // 覆盖最新建议（避免无限累加）
      PO.set(m.id, existed);
      showToast('已更新建议数量');
    }else{
      PO.set(m.id, {
        id:m.id, name:m.name, vendor:m.vendor, stock:m.stock, safety:m.safety,
        need7:need7(m), lead:m.lead, qty
      });
      showToast('已加入待采购');
    }
    renderPO();
  }
});

// PO 列表交互（数量修改/移除）
poList.addEventListener('input', e=>{
  const row = e.target.closest('.po-row'); if(!row) return;
  const id = row.dataset.id;
  if(e.target.matches('.qty input')){
    const v = Math.max(0, Number(e.target.value||0));
    const item = PO.get(id); if(!item) return;
    item.qty = v;
    PO.set(id, item);
  }
});
poList.addEventListener('click', e=>{
  const btn = e.target.closest('button[data-act="rm"]'); if(!btn) return;
  const row = e.target.closest('.po-row'); if(!row) return;
  const id = row.dataset.id;
  PO.delete(id);
  renderPO();
});

btnClearPO.onclick = ()=>{ PO.clear(); renderPO(); showToast('已清空待采购'); };
btnGenPO.onclick = ()=>{
  if(!PO.size) return alert('先加入待采购项');
  const rows = [...PO.values()];
  // 这里可换成真实导出/提交逻辑
  const msg = rows.map(r=>`${r.name}（${r.vendor}）×${r.qty}`).join('\n');
  alert('示例：已生成采购单\n\n'+msg);
};

// 浮窗相关
function openMd(m){
  currentMat = m;
  mdTitle.textContent = `预测详情 · ${m.name}`;
  mdName.textContent = m.name;
  mdVendor.textContent = m.vendor;
  mdCat.textContent = m.cat;
  mdStock.textContent = m.stock;
  mdSafety.textContent = m.safety;
  mdLead.textContent = m.lead;

  const adv=[];
  if(m.stock < m.safety) adv.push('库存低于安全线，建议尽快补货');
  if(m.lead>=4) adv.push('到货周期偏长，建议提前下单');
  if(adv.length===0) adv.push('库存与需求平衡，按周补货即可');
  mdAdvice.innerHTML = adv.map(s=>`<li>${s}</li>`).join('');

  const last7 = m.sales14.slice(-7);
  mdSales7.textContent = last7.join(' / ');

  md.classList.remove('hide');

  // 等浮窗显示后再绘图，避免宽高为 0
  requestAnimationFrame(()=>{
    requestAnimationFrame(()=>{
      drawLine(mdSales7Line, last7, ['-6','-5','-4','-3','-2','-1','今']);
      drawLine(mdFc14, m.sales14, ['-13','-12','-11','-10','-9','-8','-7','-6','-5','-4','-3','-2','-1','今']);
    });
  });
}
mdClose.onclick = mdCancel.onclick = ()=> md.classList.add('hide');
mdAdd.onclick = ()=>{
  if(!currentMat) return;
  const m = currentMat;
  const qty = suggestQty(m);
  const existed = PO.get(m.id);
  if(existed){
    existed.qty = qty;
    PO.set(m.id, existed);
    showToast('已更新建议数量');
  }else{
    PO.set(m.id, {
      id:m.id, name:m.name, vendor:m.vendor,
      stock:m.stock, safety:m.safety, need7:need7(m),
      lead:m.lead, qty
    });
    showToast('已加入待采购');
  }
  md.classList.add('hide');
  renderPO();
};

// 同步按钮（示例）
syncBtn && (syncBtn.onclick = ()=>{
  showToast('已与服务器同步（示例）');
});

// 初始化
function init(){
  const today = new Date(); datePicker && (datePicker.value = today.toISOString().slice(0,10));
  renderBars();
  renderMats();
  renderPO();
  window.addEventListener('resize', ()=> renderMats());
}
init();

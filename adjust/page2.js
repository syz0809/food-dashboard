/* =========================================================
   菜品调整页（静态演示 / 可无缝接接口）
   - 所有图表零依赖（原生 Canvas）
   - 数据、筛选、浮窗、待办、图表全在此文件
   - 若接接口：替换“数据区”常量，最后调用 refreshAll()
========================================================= */

/* ===================== 数据区（可替换） ===================== */

// 平台（用于饼图与“平台”筛选）
const PLATFORMS = [
  { id:'meituan',     name:'美团',     logo:'../assets/logo-meituan.png',  share:32 },
  { id:'eleme',       name:'饿了么',   logo:'../assets/logo-eleme.png',    share:24 },
  { id:'dianping',    name:'大众点评', logo:'../assets/logo-dianping.png', share:18 },
  { id:'jd',          name:'京东到家', logo:'../assets/logo-jd.png',       share: 9 },
  { id:'douyin',      name:'抖音',     logo:'../assets/logo-douyin.png',   share: 7 },
  { id:'xiaohongshu', name:'小红书',   logo:'../assets/logo-xhs.png',      share:10 },
];

// 菜品分类
const CATS = ['全部','烤肉','抓饭','拉条子','烤包子','手抓羊肉','饮品'];

// 候选菜品（图片路径按你的 assets 放置）
const DISHES = [
  {name:'烤包子',     cat:'烤包子',   hit:['偏油','加吸油纸'], img:'../assets/dish_kaobaozi.png'},
  {name:'羊肉抓饭',   cat:'抓饭',     hit:['油润','羊肉块大'], img:'../assets/dish_zhuafan.png'},
  {name:'新疆拉条子', cat:'拉条子',   hit:['偏咸','加清汤'],   img:'../assets/dish_latiaozhi.png'},
  {name:'招牌烤肉串', cat:'烤肉',     hit:['外焦里嫩'],       img:'../assets/dish_kaorou.png'},
  {name:'手抓羊肉',   cat:'手抓羊肉', hit:['等待长','预分单'], img:'../assets/dish_shouzhuayangrou.png'},
  {name:'酸奶疙瘩',   cat:'饮品',     hit:['解腻'],           img:'../assets/dish_yingliao.png'},
];

// 近期评价（演示数据）
const REVIEWS = [
  {user:'A*明', plat:'meituan',     dish:'招牌烤肉串', cat:'烤肉',   score:5, text:'外焦里嫩，很鲜！', ts:'12:01', pos:true},
  {user:'小七',  plat:'xiaohongshu', dish:'新疆拉条子', cat:'拉条子', score:3, text:'今天偏咸了点。', ts:'11:52', pos:false},
  {user:'酒窝',  plat:'eleme',       dish:'羊肉抓饭',   cat:'抓饭',   score:5, text:'米饭油润不腻，羊肉块大', ts:'11:30', pos:true},
  {user:'Joy',   plat:'dianping',    dish:'烤包子',     cat:'烤包子', score:3, text:'皮酥馅香，就是有点油。', ts:'10:48', pos:false},
  {user:'Q**',   plat:'douyin',      dish:'酸奶疙瘩',   cat:'饮品',   score:5, text:'解腻，配烤肉绝配', ts:'10:21', pos:true},
  {user:'YUKI',  plat:'jd',          dish:'手抓羊肉',   cat:'手抓羊肉', score:2, text:'等待时间长，肉有点柴。', ts:'09:58', pos:false},
];

// 差评热词/趋势（演示）
const BAD_TREND = [130, 150, 140, 175, 210, 195, 185]; // 七日热词量
const NEG_7     = [12, 16, 13, 18, 21, 20, 17];        // 七日差评条数

// 近 14 天销量（演示）
const SALES14 = {
  '烤包子':       [38,40,41,42,44,46,48,49,50,52,53,55,56,57],
  '羊肉抓饭':     [58,59,60,61,63,64,65,66,67,68,69,70,71,73],
  '新疆拉条子':   [40,41,42,43,44,45,46,48,49,51,53,54,55,57],
  '招牌烤肉串':   [80,81,82,83,85,86,88,90,92,93,95,96,97,99],
  '手抓羊肉':     [25,26,27,28,29,31,32,33,34,34,35,35,36,37],
  '酸奶疙瘩':     [20,21,22,22,23,24,24,25,26,27,27,28,29,30],
};


/* ===================== 状态与 DOM ===================== */

// 状态
let selPlats = new Set(PLATFORMS.map(p=>p.id)); // 平台默认全选
let selCat = '全部';                             // 分类
let sent = 'all';                                // 情绪 all/pos/neg
let scoreMin = 1, scoreMax = 5;                  // 评分区间
let searchText = '';                             // 顶部搜索

const ADJUSTED = {}; // {dish:{salt,spice,note,time}}
const TODO = [];     // [{id,name,info,done:false}]

// DOM 缓存
const $ = s => document.querySelector(s);
const platBar = $('#platBar'), catBar = $('#catBar'), sentSeg = $('#sentSeg');
const q = $('#q'), d = $('#d');
const scoreMinEl = $('#scoreMin'), scoreMaxEl = $('#scoreMax');
const rangeText = $('#rangeText'), rangeText2 = $('#rangeText2');

const dishList = $('#dishList'), issues = $('#issues');
const badTrend = $('#badTrend'), negLine = $('#negLine'), pie = $('#pie');
const todo = $('#todo');

const modal = $('#modal'), mdTitle = $('#mdTitle'),
      mdSalt = $('#mdSalt'), mdSpice = $('#mdSpice'), mdNote = $('#mdNote'),
      mdSug = $('#mdSug'), mdGoodCnt = $('#mdGoodCnt'), mdBadCnt = $('#mdBadCnt'),
      mdLastReview = $('#mdLastReview'), mdSales7 = $('#mdSales7'),
      mdSalesLine = $('#mdSalesLine'), mdAdvice = $('#mdAdvice');
const mdSave = $('#mdSave'), mdCancel = $('#mdCancel'), mdClose = $('#mdClose');


/* ===================== 工具函数 ===================== */

// 评分星
function stars(n){ return '★'.repeat(n)+'<span class="muted">'+'★'.repeat(5-n)+'</span>'; }

// 计数（受平台筛选影响）
function countPos(name){ return REVIEWS.filter(r=>r.dish===name && r.pos && selPlats.has(r.plat)).length }
function countNeg(name){ return REVIEWS.filter(r=>r.dish===name && !r.pos && selPlats.has(r.plat)).length }

// 根据日期选择器 #d 生成日期标签
function getEndDateFromPicker(){
  const ipt = document.getElementById('d');
  if (!ipt || !ipt.value) return new Date();
  const [y,m,dd] = ipt.value.split('-').map(Number);
  return new Date(y, m-1, dd);
}
function lastNDates(endDate = new Date(), n = 14){
  const labels = [];
  for(let i = n-1; i >= 0; i--){
    const d = new Date(endDate);
    d.setDate(d.getDate() - i);
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    labels.push(`${mm}-${dd}`);
  }
  return labels;
}


/* ===================== 图表（原生 Canvas） ===================== */

// 折线
function drawLine(cvs, series, labels=['-6','-5','-4','-3','-2','-1','今天']){
  if(!cvs) return;
  const ctx=cvs.getContext('2d'), W=cvs.clientWidth,H=cvs.clientHeight,dpr=window.devicePixelRatio||1;
  cvs.width=W*dpr; cvs.height=H*dpr; ctx.scale(dpr,dpr); ctx.clearRect(0,0,W,H);
  const padL=46,padR=14,padT=18,padB=26,CW=W-padL-padR,CH=H-padT-padB;
  const max=Math.max(...series), min=Math.min(...series), rng=Math.max(1,max-min), step=CW/(series.length-1);
  ctx.strokeStyle='#eee'; ctx.fillStyle='#999'; ctx.font='12px Inter';
  // Y 轴网格 + 刻度
  for(let i=0;i<=4;i++){
    const y=padT+CH-CH*(i/4);
    ctx.beginPath();ctx.moveTo(padL,y);ctx.lineTo(W-padR,y);ctx.stroke();
    ctx.fillText(Math.round(min+rng*i/4),8,y+4);
  }
  // X 轴刻度
  ctx.textAlign='center'; ctx.fillStyle='#aaa';
  labels.forEach((t,i)=>ctx.fillText(t,padL+i*step,H-8));

  // 折线
  ctx.beginPath();
  series.forEach((v,i)=>{ const x=padL+i*step,y=padT+CH*(1-(v-min)/rng); i?ctx.lineTo(x,y):ctx.moveTo(x,y); });
  ctx.lineWidth=3; ctx.strokeStyle='#ff6b00'; ctx.stroke();

  // 面积
  const lastX=padL+(series.length-1)*step;
  const grd=ctx.createLinearGradient(0,padT,0,padT+CH);
  grd.addColorStop(0,'rgba(255,107,0,.25)'); grd.addColorStop(1,'rgba(255,107,0,0)');
  ctx.lineTo(lastX,padT+CH); ctx.lineTo(padL,padT+CH); ctx.closePath(); ctx.fillStyle=grd; ctx.fill();
}

// 等到 canvas 有尺寸再绘图（避免 clientWidth=0）
function drawLineSafe(canvasIdOrEl, series, labels){
  const cvs = typeof canvasIdOrEl === 'string' ? document.getElementById(canvasIdOrEl) : canvasIdOrEl;
  if (!cvs) return;
  const paint = () => {
    if (cvs.clientWidth > 0 && cvs.clientHeight > 0) {
      drawLine(cvs, series, labels);
    } else {
      requestAnimationFrame(paint);
    }
  };
  requestAnimationFrame(paint);
}

// 饼图（左图例、右饼）
function drawPie(cvs, shares, labels){
  if(!cvs) return;
  const ctx = cvs.getContext('2d');
  const W=cvs.clientWidth,H=cvs.clientHeight,dpr=window.devicePixelRatio||1;
  cvs.width=W*dpr; cvs.height=H*dpr; ctx.scale(dpr,dpr); ctx.clearRect(0,0,W,H);
  const legendPad = 140;
  const cx = legendPad + (W-legendPad)/2, cy=H/2;
  const r  = Math.min((W-legendPad)/2 - 10, cy - 10);
  const colors=['#ffcc00','#3ec6ff','#ff6b6b','#ff4444','#000','#ff2442'];
  let start=-Math.PI/2;
  shares.forEach((v,i)=>{
    const rad=v/100*Math.PI*2;
    ctx.beginPath();ctx.moveTo(cx,cy);
    ctx.fillStyle=colors[i%colors.length];
    ctx.arc(cx,cy,r,start,start+rad,false); ctx.closePath(); ctx.fill();
    start+=rad;
  });
  ctx.font='14px Inter';
  labels.forEach((t,i)=>{
    const y=22+i*22;
    ctx.fillStyle=colors[i%colors.length]; ctx.fillRect(12,y-10,12,12);
    ctx.fillStyle='#555'; ctx.fillText(t, 30, y);
  });
}


/* ===================== 渲染：筛选条 ===================== */

function renderPlatBar(){
  platBar.innerHTML='';
  PLATFORMS.forEach(p=>{
    const el=document.createElement('button');
    el.className='pill'+(selPlats.has(p.id)?' on':'');
    el.innerHTML=`<img class="ico" src="${p.logo}" alt="" onerror="this.style.display='none'"><span>${p.name}</span>`;
    el.onclick=()=>{
      // 可取消选择
      selPlats.has(p.id) ? selPlats.delete(p.id) : selPlats.add(p.id);
      renderPlatBar(); refreshAll();
    };
    platBar.appendChild(el);
  });
  // 全选 / 清空
  const allBtn = document.getElementById('platAll');
  const noneBtn= document.getElementById('platNone');
  if (allBtn) allBtn.onclick  = ()=>{ selPlats = new Set(PLATFORMS.map(p=>p.id)); renderPlatBar(); refreshAll(); };
  if (noneBtn) noneBtn.onclick = ()=>{ selPlats = new Set(); renderPlatBar(); refreshAll(); };
}

function renderCatBar(){
  catBar.innerHTML='';
  CATS.forEach(c=>{
    const el=document.createElement('button');
    el.className='pill'+(selCat===c?' on':'');
    el.textContent=c;
    el.onclick=()=>{
      // 再点取消（回到“全部”）；“全部”本身始终可选
      selCat = (selCat===c && c!=='全部') ? '全部' : c;
      renderCatBar(); refreshAll();
    };
    catBar.appendChild(el);
  });
}


/* ===================== 渲染：列表 / 右侧面板 ===================== */

function renderDishList(){
  // 命中排序：先按评论命中，再按名称
  const hitSet = new Set(
    REVIEWS.filter(r =>
      (selPlats.has(r.plat)) &&
      (selCat==='全部'||r.cat===selCat) &&
      (sent==='all'||(sent==='pos'?r.pos:!r.pos)) &&
      r.score>=scoreMin && r.score<=scoreMax &&
      (!searchText || (r.text+r.dish).includes(searchText))
    ).map(r=>r.dish)
  );

  const cand = DISHES.filter(d =>
    (selCat==='全部'||d.cat===selCat) &&
    (!searchText || d.name.includes(searchText) || d.hit.join(',').includes(searchText))
  ).sort((a,b)=> (hitSet.has(b.name)?1:0) - (hitSet.has(a.name)?1:0) || a.name.localeCompare(b.name,'zh-CN'));

  dishList.innerHTML = cand.map(d=>`
    <div class="dish-card ${ADJUSTED[d.name]?'adjusted':''}" data-name="${d.name}">
      <img src="${d.img}" alt="${d.name}" style="width:100%;height:140px;object-fit:cover;border-radius:12px"
           onerror="this.onerror=null;this.src='https://picsum.photos/seed/'+encodeURIComponent('${d.name}')+'/600/400'">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <b>${d.name}</b>
        <span class="badge">已调整</span>
      </div>
      <div class="muted">分类 ${d.cat} · 关联：${d.hit.join('、')}</div>
      <div class="kpi"><span>好评/差评</span><b>${countPos(d.name)}/${countNeg(d.name)}</b></div>
    </div>
  `).join('');
}

function renderIssues(){
  const items = [
    {title:'拉条子偏咸',   suggest:'减盐 10% + 提供清汤',     delta:'+8条',  level:'中'},
    {title:'出餐慢（晚餐）', suggest:'高峰预分单 + 简化流程',   delta:'+12条', level:'高'},
    {title:'烤包子偏油',   suggest:'加吸油纸 / 控油 5%',     delta:'+3条',  level:'低'},
  ];
  issues.innerHTML = items.map(i=>`
    <div class="review" style="grid-template-columns:1fr auto;align-items:center">
      <div><b>${i.title}</b><div class="muted">${i.suggest}</div></div>
      <div><span class="tag">${i.level}</span> <span class="tag">${i.delta}</span></div>
    </div>
  `).join('');
}

function renderTodo(){
  if(!TODO.length){ todo.innerHTML = `<div class="muted">暂无</div>`; return; }
  todo.innerHTML = TODO.map(t=>`
    <div class="review" data-id="${t.id}" style="grid-template-columns:1fr auto;align-items:center">
      <div>
        <b>${t.name}</b>
        <div class="muted">减盐 ${t.info.salt}% · 辣度 ${t.info.spice} · ${t.info.note||'—'}</div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-inline" data-act="done">${t.done?'已完成':'完成'}</button>
        <button class="btn btn-inline" data-act="del">删除</button>
      </div>
    </div>
  `).join('');
}


/* ===================== 浮窗：打开与填充 ===================== */

function openModal(name){
  // 标题
  mdTitle.textContent = `调整配方 · ${name}`;

  // KPI / 最近评价
  const posCnt = countPos(name);
  const negCnt = countNeg(name);
  mdGoodCnt.textContent = posCnt;
  mdBadCnt.textContent  = negCnt;

  const revs = REVIEWS.filter(r=>r.dish===name && selPlats.has(r.plat));
  const last = revs[revs.length-1];
  mdLastReview.textContent = last
    ? `${last.user}：${last.text}（${last.pos?'好评':'差评'} · ${last.ts}）`
    : '—';

  // 表单回填（-50~+50）
  mdSalt.value  = ADJUSTED[name]?.salt ?? 0;
  mdSpice.value = ADJUSTED[name]?.spice ?? '不变';
  mdNote.value  = ADJUSTED[name]?.note  ?? '';

  // 系统建议（基于命中/品类）
  const d = DISHES.find(x=>x.name===name);
  const suggests=[];
  if(d?.hit?.some(h=>/咸/.test(h))) suggests.push('减盐 10% + 提供清汤');
  if(d?.hit?.some(h=>/油/.test(h))) suggests.push('控油 5% + 放吸油纸');
  if(/(羊肉|烤肉)/.test(name))      suggests.push('晚高峰预分单');
  if(!suggests.length) suggests.push('维持现配方，观察 7 天');
  mdSug.innerHTML = suggests.map(s=>`<li>${s}</li>`).join('');

  // AI 建议（简版规则）
  const ai = [];
  if (negCnt === 0 && posCnt > 0) ai.push('总体口碑良好，保持现配方并关注备料节奏。');
  if (negCnt > 0 && posCnt/Math.max(1,negCnt) < 1.2) ai.push('好评/差评比偏低，针对差评关键词进行定向优化。');
  ai.push('若销量近 3 天上升，可考虑首页曝光 + 捆绑饮品提升客单。');
  mdAdvice.innerHTML = ai.map(s=>`<li>${s}</li>`).join('');

  // —— 先打开浮窗，确保 canvas 有尺寸（关键顺序）——
  modal.classList.remove('hide');

  // 销量：14 天趋势 + 最近 7 天文本，日期标签跟随 #d
  const end = getEndDateFromPicker();          // 选中日期或今天
  const labels14 = lastNDates(end, 14);        // 14 个 MM-DD 标签
  const series14 = SALES14[name] || Array(14).fill(0);

  drawLineSafe(mdSalesLine, series14, labels14);

  const last7 = series14.slice(-7);
  const labels7 = labels14.slice(-7);
  mdSales7.textContent = `${labels7[0]} ~ ${labels7[6]}：${last7.join(' / ')}`;

  // 当前正在编辑的菜名
  editingDish = name;
}


/* ===================== 事件绑定 ===================== */

// 情绪切换（单选）
sentSeg.addEventListener('click', e=>{
  const b=e.target.closest('button'); if(!b) return;
  sent=b.dataset.sent;
  [...sentSeg.children].forEach(x=>x.classList.toggle('on',x===b));
  refreshAll();
});

// 搜索与评分区间
[q, scoreMinEl, scoreMaxEl].forEach(el=> el && el.addEventListener('input', ()=>{
  searchText=(q.value||'').trim();
  scoreMin=+scoreMinEl.value; scoreMax=+scoreMaxEl.value;
  if(scoreMin>scoreMax){ const t=scoreMin; scoreMin=scoreMax; scoreMax=t; scoreMinEl.value=scoreMin; scoreMaxEl.value=scoreMax; }
  rangeText.textContent = `${scoreMin}–${scoreMax}`;
  rangeText2.textContent = `${scoreMin}–${scoreMax}`;
  renderDishList();
}));

// 日期变化 → 若浮窗打开，重画销量趋势
if (d) d.addEventListener('change', ()=>{
  if (!modal.classList.contains('hide') && editingDish){
    const series14 = SALES14[editingDish] || Array(14).fill(0);
    const labels14 = lastNDates(getEndDateFromPicker(), 14);
    drawLineSafe(mdSalesLine, series14, labels14);
    const last7 = series14.slice(-7), labels7 = labels14.slice(-7);
    mdSales7.textContent = `${labels7[0]} ~ ${labels7[6]}：${last7.join(' / ')}`;
  }
});

// 列表点击 → 打开浮窗
document.addEventListener('click', e=>{
  const card = e.target.closest('.dish-card');
  if(card){ openModal(card.dataset.name); }
});

// 弹窗按钮
mdClose.onclick = mdCancel.onclick = ()=> modal.classList.add('hide');

mdSave.onclick = ()=>{
  // 校验 -50~+50
  let salt = parseInt(mdSalt.value, 10);
  if(Number.isNaN(salt)) salt = 0;
  if(salt < -50 || salt > 50){ alert('减盐幅度需在 -50% ~ +50%'); return; }

  const info = {
    salt,
    spice: mdSpice.value,
    note : mdNote.value.trim(),
    time : new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})
  };
  ADJUSTED[editingDish] = info;

  // 待办（存在未完成项则覆盖，不存在则新增）
  const idx = TODO.findIndex(t=>t.name===editingDish && !t.done);
  if(idx>-1) TODO[idx].info = info;
  else       TODO.push({id:Date.now()+Math.random(), name:editingDish, info, done:false});

  modal.classList.add('hide');
  renderDishList();
  renderTodo();
};

// 待办操作（完成 / 删除）
todo.addEventListener('click', e=>{
  const row = e.target.closest('.review'); if(!row) return;
  const id = row.dataset.id;
  const act = e.target.dataset.act;
  const i = TODO.findIndex(t=>String(t.id)===String(id));
  if(i<0) return;
  if(act==='done'){ TODO[i].done = !TODO[i].done; }
  if(act==='del'){ TODO.splice(i,1); }
  renderTodo();
});


/* ===================== 初始化与刷新 ===================== */

function refreshAll(){
  renderDishList();
  renderIssues();
  drawLine(negLine, NEG_7); // 近7日差评
  drawLine(badTrend, BAD_TREND); // 差评热词趋势
  drawPie(pie, PLATFORMS.map(p=>p.share), PLATFORMS.map(p=>`${p.name} ${p.share}%`)); // 平台占比
  renderTodo();
}

function init(){
  // 日期默认今天
  const today = new Date();
  if (d) d.value = today.toISOString().slice(0,10);

  renderPlatBar();
  renderCatBar();

  // 初始评分文本
  rangeText.textContent='1–5';
  rangeText2.textContent='1–5';

  refreshAll();
}
init();

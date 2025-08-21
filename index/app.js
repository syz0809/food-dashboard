/* =========================================================
   菜品云台 · 业务脚本（静态演示版 / 可无缝接入接口）
========================================================= */

// 防止某些极端环境 devicePixelRatio 未定义
window.devicePixelRatio = window.devicePixelRatio || 1;

window.addEventListener('DOMContentLoaded', () => {

  /* ======================== 数据区（可直接替换） ======================== */
  const PLATFORMS = [
    {id:'meituan',  name:'美团',       icon:'MT',  cls:'mt',   share:32, score:4.7, orders:820,  trend:+6},
    {id:'eleme',    name:'饿了么',     icon:'e',   cls:'elm',  share:24, score:4.6, orders:630,  trend:+3},
    {id:'dianping', name:'大众点评',   icon:'评',  cls:'dazhong', share:18, score:4.8, orders:430, trend:+1},
    {id:'jd',       name:'京东到家',   icon:'京',  cls:'jd',   share:9,  score:4.4, orders:150,  trend:-2},
    {id:'douyin',   name:'抖音',       icon:'抖',  cls:'dy',   share:7,  score:4.5, orders:120,  trend:+4},
    {id:'xiaohongshu', name:'小红书',  icon:'小',  cls:'xhs',  share:10, score:4.3, orders:180,  trend:+2},
  ];

  const KEYWORDS = [
    {word:'烤肉多汁',  pos:true,  weight:94},
    {word:'拉条子偏咸',pos:false, weight:71},
    {word:'分量足',    pos:true,  weight:86},
    {word:'出餐慢',    pos:false, weight:43},
    {word:'抓饭软糯',  pos:true,  weight:67},
    {word:'环境干净',  pos:true,  weight:58},
    {word:'烤包子偏油',pos:false, weight:39},
    {word:'服务热情',  pos:true,  weight:61},
  ];

  const REVIEWS = [
    {user:'A*明', plat:'美团', platId:'meituan',   dish:'招牌烤肉串', cat:'烤肉',   score:5, text:'肉质新鲜，外焦里嫩，必点！', time:'12:01', pos:true},
    {user:'小七',  plat:'小红书', platId:'xiaohongshu', dish:'新疆拉条子', cat:'拉条子', score:3, text:'味道还行，就是今天偏咸了点。', time:'11:52', pos:false},
    {user:'酒窝',  plat:'饿了么', platId:'eleme',     dish:'羊肉抓饭',   cat:'抓饭',   score:5, text:'米饭油润不腻，羊肉块大，太满足。', time:'11:30', pos:true},
    {user:'Joy',   plat:'大众点评', platId:'dianping',  dish:'烤包子',     cat:'烤包子', score:4, text:'皮酥馅香，就是有点油。',       time:'10:48', pos:true},
    {user:'Q**',   plat:'抖音', platId:'douyin',     dish:'酸奶疙瘩',   cat:'饮品',   score:5, text:'很解腻，搭烤肉绝配～',         time:'10:21', pos:true},
    {user:'YUKI',  plat:'京东到家', platId:'jd',        dish:'手抓羊肉',   cat:'手抓羊肉', score:2, text:'肉有点柴，等待时间长。',        time:'09:58', pos:false},
  ];

  const DISHES = [
    {name:'烤包子', price:3.9, rating:4.9, img:'../assets/dish_kaobaozi.png'},
    {name:'羊肉抓饭', price:27, rating:4.8, img:'../assets/dish_zhuafan.png'},
    {name:'新疆拉条子', price:26, rating:4.6, img:'../assets/dish_latiaozhi.png'}
];

  const HIST_DAILY = [420, 480, 515, 500, 560, 590, 610];   // 默认趋势
  const GOOD_RATE  = 0.86;

  // 折线图坐标标签
  const TREND_LABELS = ['近7天','-5','-4','-3','-2','-1','今天'];

  // 每个关键词的趋势（演示数据）
  const KEYWORD_TRENDS = {
    '烤肉多汁':     [320, 380, 420, 460, 430, 510, 560],
    '拉条子偏咸':   [80,  120, 140, 130, 110, 160, 190],
    '分量足':       [260, 300, 340, 360, 350, 390, 420],
    '出餐慢':       [100, 120, 160, 150, 140, 170, 180],
    '抓饭软糯':     [180, 200, 240, 260, 250, 300, 320],
    '环境干净':     [160, 190, 210, 220, 210, 250, 270],
    '烤包子偏油':   [60,  70,  80,  85,  90,  95,  110],
    '服务热情':     [140, 160, 190, 210, 230, 260, 300]
  };

  /* === 关键词匹配规则（防止点词后评论全空） === */
  const KEYWORD_FILTERS = {
    '烤肉多汁':   { any: ['多汁','鲜','外焦里嫩'], dishes: ['烤肉','烤肉串'] },
    '拉条子偏咸': { any: ['偏咸','咸'], dishes: ['拉条子'] },
    '分量足':     { any: ['分量','量大','块大'], dishes: [] },
    '出餐慢':     { any: ['出餐慢','等待时间长','等太久','慢'], dishes: [] },
    '抓饭软糯':   { any: ['软','糯','油润','不腻'], dishes: ['抓饭'] },
    '环境干净':   { any: ['干净','卫生'], dishes: [] },
    '烤包子偏油': { any: ['油','偏油','油腻'], dishes: ['烤包子'] },
    '服务热情':   { any: ['服务','热情','态度好'], dishes: [] }
  };
  function matchByKeyword(r, kw){
    if(!kw) return true;
    const rule = KEYWORD_FILTERS[kw];
    if(!rule) return r.text.includes(kw) || r.dish.includes(kw);
    if((rule.any||[]).some(t => r.text.includes(t))) return true;
    if((rule.dishes||[]).some(d => r.dish.includes(d) || r.cat.includes(d))) return true;
    return false;
  }

  /* ======================== DOM 获取 ======================== */
  const $ = id => document.getElementById(id);
  const platformGrid = $('platformGrid');
  const keywordBox   = $('keywordBox');
  const reviewsBox   = $('reviews');
  const dishGrid     = $('dishGrid');
  const reviewHint   = $('reviewHint');
  const datePicker   = $('datePicker');
  const searchBox    = $('searchBox');
  const alerts       = $('alerts');
  const categoryBar  = $('categoryBar');

  if (!platformGrid || !keywordBox || !reviewsBox || !dishGrid || !reviewHint) {
    console.error('[渲染中止] DOM 容器未找到。');
    return;
  }

  /* ======================== 交互状态 ======================== */
  let activePlatforms = new Set(PLATFORMS.map(p=>p.id));
  let activeCategory = '全部';
  let activeKeyword = null;

  /* ======================== 小工具 ======================== */
  function stars(n){ return '★'.repeat(n) + '<span class="muted">' + '★'.repeat(5-n) + '</span>'; }

  /* ======================== 渲染函数 ======================== */
  function renderPlatforms(){
    platformGrid.innerHTML = '';
    PLATFORMS.forEach(p=>{
      const active = activePlatforms.has(p.id);
      const el = document.createElement('div');
      el.className = 'plat';
      el.style.opacity = active ? 1 : 0.45;
      el.innerHTML = `
        <div class="icon ${p.cls}">${p.icon}</div>
        <div>
          <div style="font-weight:800">${p.name}</div>
          <div class="meta">评分 <b class="score">${p.score.toFixed(1)}</b> · 近7日订单 ${p.orders}</div>
        </div>
        <div class="trend ${p.trend>=0 ? 'up' : 'down'}">${p.trend>=0 ? '▲' : '▼'} ${Math.abs(p.trend)}%</div>
      `;
      el.onclick = ()=>{
        if (active) activePlatforms.delete(p.id); else activePlatforms.add(p.id);
        renderPlatforms(); refreshAll();
      };
      platformGrid.appendChild(el);
    });
  }

  function renderKpis(){
    const filtered = REVIEWS.filter(r =>
      activePlatforms.has(r.platId) &&
      (activeCategory === '全部' || r.cat === activeCategory)
    );
    const total = filtered.length;
    $('kpiTotal').textContent = total;
    $('kpiTotalDelta').textContent = '+6%';
    $('kpiGood').textContent = Math.round(GOOD_RATE * 100) + '%';
    $('goodBar').style.width = (GOOD_RATE * 100) + '%';
    const avgScore = (filtered.reduce((s,r)=>s + r.score, 0) / (total || 1)).toFixed(1);
    $('kpiScore').textContent = avgScore;
  }

  function renderKeywords(){
    keywordBox.innerHTML = '';
    KEYWORDS.forEach(k=>{
      const el = document.createElement('div');
      el.className = 'pill keyword' + (activeKeyword===k.word?' active':'');
      el.textContent = k.word;
      el.title = '权重 ' + k.weight;
      el.onclick = ()=>{
        activeKeyword = (activeKeyword===k.word? null : k.word);
        const series = activeKeyword && KEYWORD_TRENDS[activeKeyword] ? KEYWORD_TRENDS[activeKeyword] : HIST_DAILY;
        drawLine('trend', series);
        renderReviews();
      };
      keywordBox.appendChild(el);
    });
    const seriesInit = activeKeyword && KEYWORD_TRENDS[activeKeyword] ? KEYWORD_TRENDS[activeKeyword] : HIST_DAILY;
    drawLine('trend', seriesInit);
  }

  function renderReviews(){
    const kw = (searchBox?.value || '').trim();
    const list = REVIEWS
      .filter(r => activePlatforms.has(r.platId))
      .filter(r => activeCategory === '全部' || r.cat === activeCategory)
      .filter(r => matchByKeyword(r, activeKeyword))
      .filter(r => !kw || (r.text + r.dish + r.user).includes(kw));

    reviewsBox.innerHTML = list.map(r => `
      <div class="review">
        <div class="avatar">${r.user.slice(0,1)}</div>
        <div class="content">
          <div><b>${r.user}</b> <span class="platform-mark">· ${r.plat} · ${r.time}</span></div>
          <div class="muted" style="margin:2px 0 6px">${r.dish} <span class="tag">${r.cat}</span></div>
          <div>${r.text}</div>
        </div>
        <div style="text-align:right">
          <div class="star" title="评分">${stars(r.score)}</div>
          <div class="tag" style="margin-top:6px; ${r.pos ? 'background:#eaffea;color:#0a7f28' : 'background:#ffe8e8;color:#b42318'}">${r.pos ? '好评' : '差评'}</div>
        </div>
      </div>
    `).join('');

    reviewHint.textContent =
      `显示 ${activePlatforms.size === PLATFORMS.length ? '全部平台' : ('已选'+activePlatforms.size+'个平台')} · ${activeCategory}`;
  }

  function renderDishes(){
    dishGrid.innerHTML = DISHES.map(d => `
      <div class="dish">
        <img src="${d.img}" alt="${d.name}"
          onerror="this.onerror=null;this.src='https://picsum.photos/seed/'+encodeURIComponent('${d.name}')+'/600/400';"/>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="font-weight:800">${d.name}</div>
          <div class="price">¥${d.price}</div>
        </div>
        <div class="muted">评分 ${d.rating} · 月售 ${Math.floor(Math.random()*500 + 300)}</div>
        <button class="btn" style="width:max-content">查看相关评价</button>
      </div>
    `).join('');
  }

  // 菜品卡按钮：过滤评论并滚动
  document.getElementById('dishGrid').addEventListener('click', (e)=>{
    const btn = e.target.closest('button'); if(!btn) return;
    const card = e.target.closest('.dish'); if(!card) return;
    const name = card.querySelector('div[style*="font-weight:800"]').textContent.trim();
    const sb = document.getElementById('searchBox'); if(sb){ sb.value = name; }
    activeKeyword = null; document.querySelectorAll('.keyword').forEach(k=>k.classList.remove('active'));
    renderReviews();
    document.getElementById('reviews').scrollIntoView({behavior:'smooth', block:'start'});
  });

  function renderAlerts(){
    const items = [
      {title:'拉条子偏咸',   level:'中', suggest:'减盐 10% + 提供清汤',         plat:'小红书/大众点评', delta:'+8条'},
      {title:'出餐慢（晚餐）', level:'高', suggest:'高峰预分单 + 简化出菜流程', plat:'美团/饿了么',   delta:'+12条'},
      {title:'烤包子偏油',   level:'低', suggest:'控油 5% / 加吸油纸',          plat:'多平台',       delta:'+3条'},
    ];
    alerts.innerHTML = items.map(i => `
      <div class="review" style="grid-template-columns:1fr auto;align-items:center">
        <div>
          <b>${i.title}</b>
          <div class="muted">${i.plat} · 建议：${i.suggest}</div>
        </div>
        <div>
          <span class="tag" style="background:${i.level==='高'?'#ffe8e8':i.level==='中'?'#fff5d1':'#e8f8ff'};color:${i.level==='高'?'#b42318':i.level==='中'?'#8a5d00':'#0b6b99'}">级别：${i.level}</span>
          <span class="tag" style="margin-left:6px">${i.delta}</span>
        </div>
      </div>
    `).join('');
  }

  /* ======================== 图表 ======================== */
  function drawLine(canvasId, series){
    const cvs = document.getElementById(canvasId);
    if(!cvs) return;
    const parent = cvs.parentElement;

    let tip = parent.querySelector('.line-tooltip');
    if(!tip){
      tip = document.createElement('div');
      tip.className = 'line-tooltip';
      tip.style.display = 'none';
      parent.style.position = 'relative';
      parent.appendChild(tip);
    }

    const ctx = cvs.getContext('2d');
    const W = cvs.clientWidth, H = cvs.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    cvs.width = W * dpr; cvs.height = H * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0,0,W,H);

    const padL = 52, padR = 18, padT = 28, padB = 34;  // 调整后的留白
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;

    const max = Math.max(...series), min = Math.min(...series);
    const rng = Math.max(1, max - min);
    const xStep = chartW / (series.length - 1);

    // 网格 + Y 轴刻度
    ctx.strokeStyle = '#eee'; ctx.lineWidth = 1;
    ctx.fillStyle = '#999'; ctx.font = '12px Inter';
    const yLines = 4;
    for(let i=0;i<=yLines;i++){
      const y = padT + chartH - chartH * (i/yLines);
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
      const val = Math.round(min + rng * i / yLines);
      ctx.fillText(val.toString(), 10, y+4);
    }
    // X 轴刻度
    ctx.textAlign = 'center'; ctx.fillStyle = '#aaa';
    for(let i=0;i<series.length;i++){
      const x = padL + i * xStep;
      ctx.fillText(TREND_LABELS[i] || (i+1), x, H - 10);
    }

    // 折线 + 区域
    ctx.beginPath();
    series.forEach((v,i)=>{
      const x = padL + i * xStep;
      const y = padT + chartH * (1 - (v - min) / rng);
      i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y);
    });
    ctx.lineWidth = 3; ctx.strokeStyle = '#ff6b00'; ctx.stroke();

    const lastX = padL + (series.length-1)*xStep;
    const grd = ctx.createLinearGradient(0, padT, 0, padT+chartH);
    grd.addColorStop(0,'rgba(255,107,0,.25)'); grd.addColorStop(1,'rgba(255,107,0,0)');
    ctx.lineTo(lastX, padT+chartH); ctx.lineTo(padL, padT+chartH); ctx.closePath();
    ctx.fillStyle = grd; ctx.fill();

    // 数据点 + 两端标签
    ctx.fillStyle = '#ff6b00'; ctx.strokeStyle='#fff';
    series.forEach((v,i)=>{
      const x = padL + i * xStep;
      const y = padT + chartH * (1 - (v - min) / rng);
      ctx.beginPath(); ctx.arc(x,y,3.5,0,Math.PI*2); ctx.fill(); ctx.stroke();
      if(i===0 || i===series.length-1){
        ctx.fillStyle = '#555'; ctx.fillText(String(v), x, y-8); ctx.fillStyle='#ff6b00';
      }
    });

    // 悬浮提示
    cvs.onmousemove = e=>{
      const rect = cvs.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const idx = Math.round((mx - padL) / xStep);
      if(idx < 0 || idx >= series.length){ tip.style.display='none'; return; }
      const x = padL + idx * xStep;
      const y = padT + chartH * (1 - (series[idx] - min) / rng);
      if(Math.abs(mx - x) < 20){
        tip.style.display='block';
        tip.textContent = `${TREND_LABELS[idx] || ''}：${series[idx]}`;
        tip.style.left = `${x}px`;
        tip.style.top  = `${y}px`;
      }else{
        tip.style.display='none';
      }
    };
    cvs.onmouseleave = ()=> tip.style.display='none';
  }

  function drawPie(canvasId, shares){
    const cvs = document.getElementById(canvasId);
    if(!cvs) return;
    const ctx = cvs.getContext('2d');

    const W = cvs.clientWidth, H = cvs.clientHeight;
    cvs.width  = W * devicePixelRatio;
    cvs.height = H * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);
    ctx.clearRect(0,0,W,H);

    const legendPad = 140; // 左侧给图例的空间
    const cx = legendPad + (W - legendPad) / 2;
    const cy = H / 2;
    const r  = Math.min((W - legendPad) / 2 - 10, cy - 10);

    const colors=['#ffcc00','#3ec6ff','#ff6b6b','#ff4444','#000','#ff2442'];

    let start= -Math.PI/2;
    shares.forEach((v,i)=>{
      const rad = v/100 * Math.PI*2;
      ctx.beginPath(); ctx.moveTo(cx,cy);
      ctx.fillStyle = colors[i%colors.length];
      ctx.arc(cx,cy,r,start,start+rad,false); ctx.closePath(); ctx.fill();
      start += rad;
    });

    const labels = PLATFORMS.map(p=>`${p.name} ${p.share}%`);
    ctx.font = '14px Inter';
    labels.forEach((t,i)=>{
      const y = 22 + i*22;
      ctx.fillStyle = colors[i%colors.length];
      ctx.fillRect(12, y-10, 12, 12);
      ctx.fillStyle = '#555';
      ctx.fillText(t, 30, y);
    });
  }

  /* ======================== 事件绑定 ======================== */
  if (categoryBar) {
    categoryBar.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip');
      if (!chip) return;
      document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeCategory = chip.dataset.cat;
      refreshAll();
    });
  }

  if (searchBox) {
    searchBox.addEventListener('input', () => renderReviews());
  }

  if (datePicker) {
    const today = new Date();
    datePicker.value = today.toISOString().slice(0,10);
  }

  /* ======================== 刷新与初始化 ======================== */
  function refreshAll(){
    renderKpis();
    renderReviews();
    const series = activeKeyword && KEYWORD_TRENDS[activeKeyword] ? KEYWORD_TRENDS[activeKeyword] : HIST_DAILY;
    drawLine('trend', series);
    drawPie('pie', PLATFORMS.map(p => p.share));
  }

  function init(){
    renderPlatforms();
    renderKeywords();
    renderDishes();
    renderAlerts();
    refreshAll();
  }

  init();
});
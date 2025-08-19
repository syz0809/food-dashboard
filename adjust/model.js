/* modal.js — 菜品浮窗组件
   使用：在页面内引入本文件后，调用 openDishModal({name, category, tags, sales:[]})
*/
(function(){
  // ---------- 注入样式 ----------
  const css = `
  .md-mask{position:fixed;inset:0;background:rgba(0,0,0,.35);display:none;z-index:99}
  .md{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);
      width:min(860px,92vw);background:#fff;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.2);overflow:hidden}
  .md-hd{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid #f2f2f2}
  .md-title{font-weight:800}
  .md-x{border:none;background:#fff;border-radius:8px;padding:6px;cursor:pointer}
  .md-tabs{display:flex;gap:8px;padding:10px 12px;border-bottom:1px solid #f2f2f2}
  .md-tabs button{border:none;background:#f5f5f5;padding:8px 14px;border-radius:999px;cursor:pointer;font-weight:800}
  .md-tabs button.on{background:#ffe8e1;color:#a33}
  .md-bd{padding:14px 16px;max-height:60vh;overflow:auto}
  .md-row{display:grid;gap:6px;margin-bottom:10px}
  .md-row input,.md-row select{padding:8px 10px;border:1px solid #eee;border-radius:8px}
  .md-sug{margin:0;padding-left:18px}
  .md-ft{display:flex;justify-content:flex-end;gap:8px;padding:12px 16px;border-top:1px solid #f2f2f2}
  .btn{background:#eee;border:none;border-radius:999px;padding:8px 14px;cursor:pointer}
  .btn-primary{background:#ffcc00}
  #md-sales{width:100%;height:300px}
  .md-sub{color:#888;margin-left:6px}
  `;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  // ---------- 注入 DOM ----------
  const mask = document.createElement('div');
  mask.className = 'md-mask';
  mask.innerHTML = `
    <div class="md" role="dialog" aria-modal="true" aria-labelledby="md-title">
      <div class="md-hd">
        <div class="md-title" id="md-title">菜品</div>
        <button class="md-x" id="md-close">✕</button>
      </div>

      <div class="md-tabs" id="md-tabs">
        <button data-tab="adjust" class="on">调整</button>
        <button data-tab="recommend">推荐</button>
        <button data-tab="sales">销量</button>
      </div>

      <div class="md-bd">
        <!-- 调整 -->
        <section data-view="adjust">
          <div class="md-row"><label>减盐（%）<span class="md-sub">偏咸时建议 5–10%</span></label><input id="md-salt" type="number" min="0" max="50" step="1" value="10"></div>
          <div class="md-row"><label>辣度</label>
            <select id="md-spice"><option>不变</option><option>微辣</option><option>中辣</option><option>重辣</option></select>
          </div>
          <div class="md-row"><label>出餐备注</label><input id="md-note" placeholder="如：高峰期预分单/加清汤/吸油纸"></div>
          <div class="md-row"><label>系统建议</label><ul id="md-sug" class="md-sug"></ul></div>
        </section>

        <!-- 推荐 -->
        <section data-view="recommend" style="display:none">
          <div class="md-row"><b>近期口碑要点</b>
            <ul class="md-sug" id="md-rec">
              <!-- 自动填入：根据 tags 生成 -->
            </ul>
          </div>
        </section>

        <!-- 销量 -->
        <section data-view="sales" style="display:none">
          <div id="md-sales"></div>
        </section>
      </div>

      <div class="md-ft">
        <button class="btn" id="md-cancel">取消</button>
        <button class="btn btn-primary" id="md-save">保存调整</button>
      </div>
    </div>
  `;
  document.body.appendChild(mask);

  // ---------- 状态 ----------
  let currentDish = null;    // {name, category, tags[], sales[]}
  const saved = {};          // {name: {salt, spice, note}}

  // ---------- 帮助函数 ----------
  function showTab(tab){
    mask.querySelectorAll('[data-view]').forEach(v=>v.style.display = (v.getAttribute('data-view')===tab?'block':'none'));
    mask.querySelectorAll('#md-tabs button').forEach(b=>b.classList.toggle('on', b.dataset.tab===tab));
    if(tab==='sales') drawSales();
  }
  function drawSales(){
    const dom = document.getElementById('md-sales');
    if(!dom) return;
    const chart = echarts.init(dom);
    const series = currentDish?.sales || [];
    chart.setOption({
      grid:{left:40,right:16,top:20,bottom:26},
      xAxis:{type:'category',data:['-6','-5','-4','-3','-2','-1','今天']},
      yAxis:{type:'value'},
      series:[{type:'line',smooth:true, areaStyle:{}, data:series}]
    });
  }

  function computeSuggest(tags){
    const s=[];
    if(tags.some(t=>/咸/.test(t))) s.push('减盐 5–10% + 提供清汤');
    if(tags.some(t=>/油/.test(t))) s.push('控油 5% + 吸油纸');
    if(tags.some(t=>/等待|慢/.test(t))) s.push('高峰期预分单 + 简化出菜流程');
    return s.length ? s : ['维持当前配方，观察 7 天'];
  }

  // ---------- 事件 ----------
  mask.addEventListener('click', e=>{ if(e.target===mask) closeDishModal(); });
  document.getElementById('md-close').onclick = closeDishModal;
  document.getElementById('md-cancel').onclick = closeDishModal;

  // Tab 切换
  document.getElementById('md-tabs').addEventListener('click', e=>{
    const b=e.target.closest('button'); if(!b) return;
    showTab(b.dataset.tab);
  });

  // 保存
  document.getElementById('md-save').onclick = ()=>{
    const salt = +document.getElementById('md-salt').value || 0;
    const spice= document.getElementById('md-spice').value;
    const note = (document.getElementById('md-note').value||'').trim();
    saved[currentDish.name] = {salt, spice, note, time:new Date().toLocaleTimeString('zh-CN', {hour:'2-digit', minute:'2-digit'})};
    closeDishModal();
    // 你可以在这里触发“右侧待办面板”的追加
    console.log('已保存：', currentDish.name, saved[currentDish.name]);
  };

  // ---------- 对外 API ----------
  window.openDishModal = function(dish){
    currentDish = dish || {name:'未命名', category:'', tags:[], sales:[]};
    mask.style.display='block';
    document.getElementById('md-title').textContent = `${currentDish.name} · ${currentDish.category||''}`;

    // 建议 & 推荐
    const sug = computeSuggest(currentDish.tags);
    document.getElementById('md-sug').innerHTML = sug.map(s=>`<li>${s}</li>`).join('');
    document.getElementById('md-rec').innerHTML = (currentDish.tags||[]).map(t=>`<li>近期用户关注：<b>${t}</b></li>`).join('') || '<li>暂无</li>';

    // 还原保存的值
    const keep = saved[currentDish.name] || {};
    document.getElementById('md-salt').value = keep.salt ?? 10;
    document.getElementById('md-spice').value= keep.spice ?? '不变';
    document.getElementById('md-note').value = keep.note ?? '';

    showTab('adjust'); // 默认打开“调整”
  };
  window.closeDishModal = function(){ mask.style.display='none'; };
})();

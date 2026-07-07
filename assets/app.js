/* 研芽 · 应用逻辑 */
(()=>{
const $ = (s,el=document)=>el.querySelector(s);
const $$= (s,el=document)=>[...el.querySelectorAll(s)];
const esc = s => (s+'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ---------- 数据存储 ---------- */
const STORE_KEY='yanya.v1';
let state = load();
function defaultState(){
  return {
    onboarded:false,
    planStart:null,        // 用户启动计划的那天(YYYY-MM-DD)
    tasks:{},               // 'YYYY-MM-DD' -> {idx:true}
    dayDone:{},             // 'dayN' -> true
    diary:{},               // 'YYYY-MM-DD' -> {mood,text}
    weekly:{},              // 'rN-item' -> true  (周复盘自查 N 0-4)
    weeklyReport:{},        // 'rN' -> text
    reviewProgress:{},      // 'rN' -> checked count (derived)
    pomo:{total:0, last:null},// 番茄完成数 + 上次日期
    streak:0,
    lastCheckDate:null
  };
}
function load(){
  try{
    const s = JSON.parse(localStorage.getItem(STORE_KEY));
    if(!s) return defaultState();
    return Object.assign(defaultState(), s, {
      tasks:s.tasks||{}, dayDone:s.dayDone||{}, diary:s.diary||{},
      weekly:s.weekly||{}, weeklyReport:s.weeklyReport||{}, pomo:s.pomo||defaultState().pomo
    });
  }catch(e){return defaultState()}
}
function save(){localStorage.setItem(STORE_KEY, JSON.stringify(state));}
function todayStr(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}

/* ---------- 计划日期对齐 ---------- */
function ensureStart(){
  if(!state.planStart){
    state.planStart = PLAN.meta.startDate;
    save();
  }
}
function dayDateStr(dn){ // 第N天对应的日期 YYYY-MM-DD
  ensureStart();
  const start = new Date(state.planStart+'T00:00:00');
  start.setDate(start.getDate()+dn-1);
  const y=start.getFullYear(),m=String(start.getMonth()+1).padStart(2,'0'),dd=String(start.getDate()).padStart(2,'0');
  return `${y}-${m}-${dd}`;
}
function currentDay(){ // 今天对应第几天 (1..30，超范围夹紧并标记)
  ensureStart();
  const start = new Date(state.planStart+'T00:00:00');
  const diff = Math.floor((new Date(new Date().toDateString())-new Date(start.toDateString()))/86400000)+1;
  return diff;
}

/* ---------- 引导 ---------- */
function startOnboard(){
  state.onboarded=true;
  if(!state.planStart) state.planStart = PLAN.meta.startDate;
  save();
  $('#view-onboard').classList.add('hidden');
  $('#shell').classList.remove('hidden');
  renderAll();
  confetti();
}

/* ---------- 视图切换 ---------- */
let curView='home';
function switchView(v){
  curView=v;
  $$('.view').forEach(x=>x.classList.remove('active'));
  $('#view-'+v).classList.add('active');
  $$('.tab').forEach(t=>t.classList.toggle('active', t.dataset.view===v));
  $('#page-container').scrollTop=0; window.scrollTo(0,0);
  render(v);
  // 打卡 tab 高亮时按钮变绿
  $('.check-tab .chk').textContent = (v==='check')?'✓':'✓';
  // 隐藏fab在打卡页避免遮挡
  $('#pomo-fab').style.opacity = (v==='check')?'0':'1';
  $('#pomo-fab').style.pointerEvents=(v==='check')?'none':'auto';
}

/* ============================================================
   渲染：首页
============================================================ */
function renderHome(){
  const cd = currentDay();
  const todayKey = todayStr();
  const within = cd>=1 && cd<=30;
  const dayN = within?cd:(cd<1?1:30); // 引用索引
  const day = PLAN.days[dayN-1];

  // 今日任务完成进度
  const tasksDone = state.tasks[todayKey]||{};
  const total = PLAN.schedule.length;
  const done = Object.values(tasksDone).filter(Boolean).length;
  const pct = Math.round(done/total*100);

  // 连续打卡（以 dayDone 为准）
  recomputeStreak();

  // 倒计时：到 Day30
  const end = new Date(dayDateStr(30)+'T00:00:00');
  const now = new Date(new Date().toDateString());
  const left = Math.max(0, Math.round((end-now)/86400000));

  const name = '亲爱的';
  const quote = PLAN.quotes[new Date().getDate() % PLAN.quotes.length];

  $('#view-home').innerHTML = `
    <div class="ph">
      <div class="ph-row">
        <div>
          <div class="ph-hey">${greeting()}，${esc(name)} 👋</div>
          <div class="ph-name">研芽计划</div>
          <div class="ph-date">${fmtCN(new Date())} · ${within?`第 ${cd} / 30 天`:'计划已收尾，迈向 8 月强化 🌸'}</div>
        </div>
        <div class="home-emoji" style="font-size:34px;animation:bob 3.6s ease-in-out infinite">🌷</div>
      </div>
    </div>

    <div class="home-hero">
      <div style="position:relative;z-index:2">
        <span class="emo">${within?'📅':'🌟'}</span>
        <h2>${within?`Day ${cd} · ${day.date}`:'30 天已完成'}</h2>
        <p>${within?esc(day.s333):'恭喜你完整走完一轮夯实期，记得保持每周节奏，向 8 月强化衔接 🚀'}</p>
        <div class="progress-ring-wrap" style="margin-top:18px">
          <div class="ring">
            ${ringSVG(pct/100)}
            <div class="num"><b>${pct}%</b><span>今日完成</span></div>
          </div>
          <div class="ring-info">
            <div class="l">已坚持</div>
            <div class="v">${state.streak} 天</div>
            <span class="streak-pill"><span class="flame">🔥</span> 连续打卡</span>
          </div>
        </div>
        <div class="countdown">
          <div class="cd-cell"><b>${left}</b><span>距收官 (天)</span></div>
          <div class="cd-cell"><b>${cntDoneDays()}</b><span>已搞定天数</span></div>
          <div class="cd-cell"><b>${state.pomo.total}</b><span>番茄 🍅</span></div>
        </div>
      </div>
    </div>

    <div class="card today-accept">
      <div id="ta-ring-${dayN}" class="ta-ring" style="--p:${dayAcceptPct(dayN)}%"><div>${day.review?'🌤️':'🎯'}</div></div>
      <div class="ta-info">
        <div class="tt">今日验收 · ${within?`Day ${cd}`:`Day ${dayN}`}</div>
        <div class="dd">${esc(day.accept)}</div>
        <button class="btn-ghost" style="margin-top:10px" onclick="switchView('check')">去今日打卡 →</button>
      </div>
    </div>

    <div class="card quote-card">
      <div class="qmark">"</div>
      <p>${esc(quote)}</p>
      <div class="q-from">— 今日小语</div>
    </div>

    <div style="margin:14px 18px 6px">
      <div class="sec-title"><span class="dot"></span>快捷入口</div>
    </div>
    <div class="card" style="background:transparent;backdrop-filter:none;border:none;box-shadow:none;padding:0;margin:0 18px 0">
      <div class="quick-grid">
        <button class="qg-item" onclick="switchView('plan')"><span class="ico">📅</span><span>30天计划</span></button>
        <button class="qg-item" onclick="switchView('check')"><span class="ico">✅</span><span>今日打卡</span></button>
        <button class="qg-item" onclick="switchView('review')"><span class="ico">📝</span><span>复盘自查</span></button>
        <button class="qg-item" onclick="openPomodoro()"><span class="ico">🍅</span><span>专注番茄</span></button>
        <button class="qg-item" onclick="openDiary()"><span class="ico">📔</span><span>心情日记</span></button>
        <button class="qg-item" onclick="openMethods()"><span class="ico">💡</span><span>学习方法</span></button>
        <button class="qg-item" onclick="openSchedule()"><span class="ico">⏰</span><span>日程表</span></button>
        <button class="qg-item" onclick="switchView('me')"><span class="ico">🌷</span><span>我的</span></button>
      </div>
    </div>

    <div style="height:14px"></div>
  `;
  // 动画启动ring
  requestAnimationFrame(()=>{
    animateRing(pct/100);
    animateTA(dayN);
  });
}
function greeting(){
  const h=new Date().getHours();
  if(h<6)return'夜深啦';if(h<11)return'早安';if(h<14)return'中午好';if(h<18)return'下午好';if(h<22)return'晚上好';return'夜安';
}
function fmtCN(d){return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日 ${'日一二三四五六'[d.getDay()]}`;}

function ringSVG(p){
  const r=46,c=2*Math.PI*r;
  return `<svg width="104" height="104" viewBox="0 0 104 104">
    <circle class="track" cx="52" cy="52" r="${r}"/>
    <circle class="bar" id="home-ring-bar" cx="52" cy="52" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${c}"/>
  </svg>`;
}
function animateRing(p){
  const bar=$('#home-ring-bar'); if(!bar)return;
  const r=46,c=2*Math.PI*r;
  bar.style.strokeDashoffset = c*(1-Math.max(0,Math.min(1,p)));
}
function cntDoneDays(){return Object.values(state.dayDone).filter(Boolean).length;}
function dayAcceptPct(dn){return state.dayDone['day'+dn]?100:0}
function animateTA(dn){
  const el=$('#ta-ring-'+dn); if(!el)return;
  let p=0;const target=dayAcceptPct(dn);
  const t=setInterval(()=>{p+=5;if(p>=target){p=target;clearInterval(t)}el.style.setProperty('--p',p+'%')},20);
}
function recomputeStreak(){
  // 连续打卡：今天完成则计入；今天未完成不中断（从昨天往前数连续）
  let s=0;let d=currentDay();
  if(d>=1 && d<=30){ if(state.dayDone['day'+d]) s++; d--; }
  else if(d<1){ return; } // 计划未开始
  else { d=30; } // 已收官，从最后一天往前数
  while(d>=1){ if(state.dayDone['day'+d]) s++; else break; d--; }
  state.streak=s;
}

/* ============================================================
   渲染：30天计划
============================================================ */
let curGroup=0;
function renderPlan(){
  $('#view-plan').innerHTML = `
    <div class="ph">
      <div class="sec-title"><span class="dot"></span>30 天详细计划</div>
      <div class="sec-sub">${esc(PLAN.meta.rhythm)} · 共 5 组</div>
    </div>
    <div class="group-tabs" id="group-tabs">
      ${PLAN.groups.map((g,i)=>`<button class="gt ${i===curGroup?'active':''}" onclick="setGroup(${i})"><b>${g.range}</b>${esc(g.name)}</button>`).join('')}
    </div>
    <div class="group-banner">
      <h3>${esc(PLAN.groups[curGroup].name)}</h3>
      <p>${esc(PLAN.groups[curGroup].theme)}</p>
    </div>
    <div class="day-list" id="day-list"></div>
  `;
  renderDayList();
  // 滚到当前组激活项
  const act=$('.gt.active'); if(act) act.scrollIntoView({inline:'center',block:'nearest'});
}
function setGroup(i){curGroup=i;renderPlan();}
function renderDayList(){
  const list=$('#day-list'); if(!list)return;
  const days = PLAN.days.filter(d=>d.g===curGroup);
  list.innerHTML = days.map(d=>{
    const done = state.dayDone['day'+d.d];
    return `<div class="day-card ${done?'done':''}" onclick="openDay(${d.d})">
      <div class="day-num"><b>${d.d}</b><span>DAY</span></div>
      <div class="day-info">
        <div class="dt">${esc(d.date)}</div>
        <div class="dttl">${esc(d.accept)}</div>
        <div class="da">${done?'✓ 已完成':'待完成'}</div>
      </div>
      <div class="day-tag ${d.review?'review':''}"><span>${d.review?'复盘':'学习'}</span></div>
      <div class="day-chk">${done?'✓':''}</div>
    </div>`;
  }).join('');
}

function openDay(dn){
  const d=PLAN.days[dn-1];
  const done = state.dayDone['day'+dn];
  $('#modal-mask').classList.remove('hidden');
  const m=$('#day-modal');
  m.innerHTML = `
    <button class="modal-close" onclick="closeModal()">×</button>
    <div class="modal-grip"></div>
    <div class="modal-head">
      <div class="mn"><b>${d.d}</b><span>DAY</span></div>
      <div>
        <div class="mt">${esc(d.date)} · ${PLAN.groups[d.g].name}</div>
        <div class="mtt">${d.review?'轻量复盘日':'今日学习'}</div>
      </div>
    </div>
    <div class="md-tag">📚 333 教育综合</div>
    <div class="md-block s333"><div class="lb">今日要点</div><div class="tx">${esc(d.s333)}</div></div>
    <div class="md-tag">🧩 826 语文课程与教学论</div>
    <div class="md-block s826"><div class="lb">今日要点</div><div class="tx">${esc(d.s826)}</div></div>
    <div class="md-tag">🌐 英语 / 政治</div>
    <div class="md-block seng"><div class="lb">今日要点</div><div class="tx">${esc(d.eng)}</div></div>
    <div class="md-tag">🎯 今日验收</div>
    <div class="md-block sacc"><div class="lb">交付物</div><div class="tx">${esc(d.accept)}</div></div>
    <div class="md-tip">💡 ${d.review?'这是复盘日，节奏放轻，按"周日轻量复盘模板"进行，写本周周报。':'记得每章留下"框架、易混点、可套材料"三样东西，当晚 D+1 主动回忆一次。'}</div>
    <div class="accept-row">
      <div class="ar-em">${done?'✅':'🎀'}</div>
      <div class="ar-tx"><div class="ar-lb">当日交付</div><div class="ar-val">${done?'今日已搞定，奖励自己一小会儿 🎁':'完成后点击下方"标记今日完成"'}</div></div>
    </div>
    <button class="mdtoggle ${done?'done':''}" onclick="toggleDayDone(${dn})">
      ${done?'✅ 当日已标记完成，再点取消':'✏️ 标记当日完成（获得连续打卡 🔥）'}
    </button>
    <div style="height:24px"></div>
  `;
  m.classList.remove('hidden');
}
function toggleDayDone(dn){
  const key='day'+dn;
  if(state.dayDone[key]){state.dayDone[key]=false; toast('已取消，继续加油～');}
  else{
    state.dayDone[key]=true;
    toast('🎉 今日交付完成！连续打卡 +1','success');
    confetti();
    // 额外：把今日对应日期任务自动全勾（若引用同一天）
  }
  save(); recomputeStreak();
  closeModal();
  render(curView);
}

/* ============================================================
   渲染：今日打卡
============================================================ */
function renderCheck(){
  const key=todayStr();
  const tasks=state.tasks[key]||{};
  const total=PLAN.schedule.length;
  const done=Object.values(tasks).filter(Boolean).length;
  const pct=Math.round(done/total*100);
  $('#view-check').innerHTML=`
    <div class="check-hero">
      <div class="ci">
        <h2>${esc(fmtCN(new Date()))}</h2>
        <div class="cd">${currentDay()>=1&&currentDay()<=30?`对应 Day ${currentDay()} · ${esc(PLAN.days[currentDay()-1].date)}`:'计划已收尾，保持节奏哦'}</div>
      </div>
    </div>
    <div class="check-progress">
      <div class="cp-top"><div class="lab">今日完成进度</div><div class="pct">${pct}%</div></div>
      <div class="cp-bar"><div class="cp-fill" id="cp-fill"></div></div>
      <div class="cp-stat">${done} / ${total} 项 ${pct===100?'· 真棒，今天的你闪闪发光 ✨':''}</div>
    </div>
    ${pct===100?allDoneCard():''}
    ${PLAN.schedule.map((s,i)=>taskCard(s,i,tasks[i])).join('')}
    <div style="height:14px"></div>
  `;
  requestAnimationFrame(()=>{ $('#cp-fill').style.width=pct+'%'; });
  // note区域
  $$('.ti-note textarea').forEach(ta=>{
    ta.addEventListener('input',e=>{
      const idx=e.target.dataset.idx;
      state.tasks[key]=state.tasks[key]||{};
      // note kept but here simply task state; notes minimal handled inline
    });
  });
}
function taskCard(s,i,checked){
  return `<div class="task-item ${checked?'done':''}" data-i="${i}">
    <div class="ti-chk" onclick="toggleTask(${i})">
      <svg viewBox="0 0 24 24"><polyline points="4 12 10 18 20 6"/></svg>
    </div>
    <div class="ti-body">
      <div class="ti-time">${esc(s.time)}</div>
      <div class="ti-task">${esc(s.task)}</div>
      <div class="ti-req">${esc(s.req)}</div>
    </div>
  </div>`;
}
function toggleTask(i){
  const key=todayStr();
  state.tasks[key]=state.tasks[key]||{};
  state.tasks[key][i]=!state.tasks[key][i];
  const row=$(`#view-check .task-item[data-i="${i}"]`);
  row.classList.toggle('done',state.tasks[key][i]);
  if(state.tasks[key][i]) tinyConfetti(row);
  // 更新进度
  const total=PLAN.schedule.length;
  const done=Object.values(state.tasks[key]).filter(Boolean).length;
  const pct=Math.round(done/total*100);
  $('#cp-fill').style.width=pct+'%';
  $('.cp-top .pct').textContent=pct+'%';
  $('.cp-stat').textContent=`${done} / ${total} 项 ${pct===100?'· 真棒，今天的你闪闪发光 ✨':''}`;
  // 全部完成时插卡并撒花
  if(done===total){
    if(!$('.all-done-card')){
      const cp=$('.check-progress'); cp.insertAdjacentHTML('afterend',allDoneCard());
    }
    confetti();
    // 若当日还没标记 dayDone，自动标记当天（推算对应 day）
    const cd=currentDay();
    if(cd>=1&&cd<=30&&!state.dayDone['day'+cd]){state.dayDone['day'+cd]=true;toast('全部完成！连续打卡 +1 🔥','success');recomputeStreak();}
  }else if(pct<100){
    const ad=$('.all-done-card'); if(ad) ad.remove();
  }
  save();
}
function allDoneCard(){
  const reward=PLAN.rewards[new Date().getDate()%PLAN.rewards.length];
  return `<div class="all-done-card">
    <div class="em">🎉</div>
    <h3>今天的交付全部搞定啦！</h3>
    <p>给自己一个小奖励：${esc(reward)}</p>
    <button class="btn-soft" onclick="switchView('review')">写几句复盘 →</button>
  </div>`;
}

/* ============================================================
   渲染：复盘
============================================================ */
let revTab=0; // 0 自查清单, 1 周日模板, 2 周报复写
function renderReview(){
  $('#view-review').innerHTML=`
    <div class="ph">
      <div class="sec-title"><span class="dot"></span>复盘与自查</div>
      <div class="sec-sub">只写事实和下一步，不自责 🌷</div>
    </div>
    <div class="rev-tabs">
      <div class="rev-tab ${revTab===0?'active':''}" onclick="setRevTab(0)">每周自查清单</div>
      <div class="rev-tab ${revTab===1?'active':''}" onclick="setRevTab(1)">周日复盘模板</div>
      <div class="rev-tab ${revTab===2?'active':''}" onclick="setRevTab(2)">本周周报</div>
    </div>
    <div id="rev-body"></div>
  `;
  renderRevBody();
}
function setRevTab(i){revTab=i;renderReview();}
function renderRevBody(){
  const b=$('#rev-body'); if(!b)return;
  if(revTab===0) b.innerHTML=checklistGrid();
  else if(revTab===1) b.innerHTML=reviewTemplateView();
  else b.innerHTML=weeklyReportView();
}
function checklistGrid(){
  const weeks=['第1周','第2周','第3周','第4周','收官'];
  let head=`<div class="cl-week"><div class="cl-h first">检查项</div>${weeks.map((w,i)=>`<div class="cl-h">${w}</div>`).join('')}</div>`;
  let body=PLAN.weeklyChecklist.map((it,ri)=>{
    let cells=`<div class="cl-c first">${esc(it.item)}</div>`;
    for(let w=0;w<5;w++){
      const key=`r${w}-i${ri}`; const ck=state.weekly[key];
      cells+=`<div class="cl-c day-col ${ck?'checked':''}" onclick="toggleCheck(${w},${ri})">${ck?'✓':'○'}</div>`;
    }
    return `<div class="cl-week">${cells}</div>`;
  }).join('');
  return `<div class="card" style="margin:14px 18px 6px;padding:8px 14px;font-size:12px;color:var(--muted);background:transparent;box-shadow:none;border:none">
    点格子切换"已完成 / 未做"。每条自查贯穿 5 周，帮你看到坚持的轨迹 ✨</div>
    <div class="checklist-grid">${head}${body}</div>`;
}
function toggleCheck(w,ri){
  const k=`r${w}-i${ri}`;
  state.weekly[k]=!state.weekly[k]; save();
  renderRevBody();
  if(state.weekly[k]) toast('打卡一格，又稳了一点 🌷');
}
function reviewTemplateView(){
  const items=PLAN.reviewTemplate.map(r=>`<div class="rev-block">
    <div class="rb-time">${esc(r.time)}</div>
    <div class="rb-body"><div class="rb-task">${esc(r.task)}</div><div class="rb-line">合格线：${esc(r.line)}</div></div>
  </div>`).join('');
  return `<div class="card" style="margin:14px 18px 6px;padding:8px 14px;font-size:12px;color:var(--muted);background:transparent;box-shadow:none;border:none">
    周日用来恢复 + 整理，不补课、不加量。按节奏走，不自责 🎁</div>${items}`;
}
function weeklyReportView(){
  // 5 周
  let html=`<div class="card" style="margin:14px 18px 6px;padding:8px 14px;font-size:12px;color:var(--muted);background:transparent;box-shadow:none;border:none">
    每周写一段"完成率 / 卡点 / 下周调整"，回看自己的成长轨迹 📈</div>`;
  for(let w=0;w<5;w++){
    const k='r'+w;
    html+=`<div class="rw-input">
      <h4>第 ${w+1} 周${w===4?'（收官）':''} 周报</h4>
      <textarea placeholder="完成率：&#10;卡点：&#10;下周调整：" data-rw="${w}">${esc(state.weeklyReport[k]||'')}</textarea>
      <button class="btn-primary rw-save" onclick="saveReport(${w})">保存</button>
    </div>`;
  }
  $$(`.rw-input textarea`) ; // bind after insert below
  setTimeout(()=>{
    $$('.rw-input textarea').forEach(ta=>{
      ta.addEventListener('input',e=>{
        const idx=e.target.dataset.rw;
        state.weeklyReport['r'+idx]=e.target.value;
      });
    });
  },0);
  return html;
}
function saveReport(w){
  save();
  toast('周报已保存 🌷','success');
}

/* ============================================================
   渲染：我的
============================================================ */
function renderMe(){
  $('#view-me').innerHTML=`
    <div class="me-hero">
      <div class="me-av">🌷</div>
      <div class="me-name">研芽小小助手</div>
      <div class="me-sub">${esc(PLAN.meta.school)} · ${esc(PLAN.meta.major)} · ${esc(PLAN.meta.majorCode)}</div>
    </div>
    <div class="me-stat">
      <div class="s"><b>${state.streak}</b><span>连续打卡(天)</span></div>
      <div class="s"><b>${cntDoneDays()}</b><span>已搞定天数</span></div>
      <div class="s"><b>${state.pomo.total}</b><span>番茄专注数</span></div>
    </div>
    <div class="me-menu">
      <div class="me-mi" onclick="openMethods()"><div class="mi-ico">💡</div><div class="mi-tt">学习方法库<span>把"看过"改成"拿分"</span></div><div class="mi-arr">›</div></div>
      <div class="me-mi" onclick="openSchedule()"><div class="mi-ico">⏰</div><div class="mi-tt">每日时间表<span>周一至周六节奏</span></div><div class="mi-arr">›</div></div>
      <div class="me-mi" onclick="openPomodoro()"><div class="mi-ico">🍅</div><div class="mi-tt">专注番茄钟<span>25 分钟 · 5 分钟</span></div><div class="mi-arr">›</div></div>
      <div class="me-mi" onclick="openDiary()"><div class="mi-ico">📔</div><div class="mi-tt">心情日记<span>记录今天的元宇宙</span></div><div class="mi-arr">›</div></div>
      <div class="me-mi" onclick="openSubjects()"><div class="mi-ico">🎯</div><div class="mi-tt">四科目标与交付<span>核心目标 · 验收标准</span></div><div class="mi-arr">›</div></div>
      <div class="me-mi" onclick="openAugust()"><div class="mi-ico">🚀</div><div class="mi-tt">8月强化期衔接<span>结束后怎么走</span></div><div class="mi-arr">›</div></div>
      <div class="me-mi" onclick="openRefs()"><div class="mi-ico">📚</div><div class="mi-tt">资料依据与来源<span>核对口径</span></div><div class="mi-arr">›</div></div>
      <div class="me-mi" onclick="openAbout()"><div class="mi-ico">🌸</div><div class="mi-tt">关于研芽<span>为备考中的你而做</span></div><div class="mi-arr">›</div></div>
      <div class="me-mi" onclick="resetData()"><div class="mi-ico">🧹</div><div class="mi-tt">重置数据<span>清除本机所有记录</span></div><div class="mi-arr">›</div></div>
    </div>
    <div style="padding:18px 22px;color:var(--muted);font-size:11px;line-height:1.7">
      ${esc(PLAN.meta.note)}
    </div>
    <div style="height:14px"></div>
  `;
}

/* ---------- 弹层页：方法/日程/科目/8月/来源/关于/日记 ---------- */
function sheetHTML(title, inner, sub='研芽 · 小助手'){
  return `<button class="modal-close" onclick="closeModal()">×</button>
    <div class="modal-grip"></div>
    <div class="modal-head"><div class="mn" style="font-size:24px;font-family:inherit">🌸</div>
      <div><div class="mt">${esc(sub)}</div><div class="mtt">${esc(title)}</div></div></div>
    ${inner}
    <div style="height:26px"></div>`;
}
function openMethods(){
  const inner = `<div class="md-tag">💡 关键方法</div>${PLAN.methods.map(m=>`
    <div class="method-card" onclick="this.classList.toggle('open')">
      <div class="mh"><div class="mi">${m.icon}</div><div class="mn">${esc(m.title)}</div><div class="mx">⌄</div></div>
      <div class="method-body">
        <div class="ms">${m.steps.map(s=>`<span>${esc(s)}</span>`).join('')}</div>
        <div class="mtip">${esc(m.tip)}</div>
      </div>
    </div>`).join('')}`;
  showModal(inner);
}
function openSchedule(){
  const inner=PLAN.schedule.map(s=>`<div class="rev-block"><div class="rb-time">${esc(s.time)}</div><div class="rb-body"><div class="rb-task">${esc(s.task)}</div><div class="rb-line">${esc(s.req)}</div></div></div>`).join('');
  showModal(inner,'每日时间表 · 周一至周六');
}
function openSubjects(){
  const inner=PLAN.subjectGoals.map(s=>`<div class="md-block" style="margin:0 22px 12px;box-shadow:var(--shadow-sm)">
    <div class="lb">${esc(s.subj)}</div>
    <div class="tx"><b>核心目标：</b>${esc(s.goal)}</div>
    <div class="tx"><b>每天最低交付：</b>${esc(s.deliver)}</div>
    <div class="tx"><b>阶段验收：</b>${esc(s.accept)}</div>
  </div>`).join('');
  showModal(inner,'四科目标与交付');
}
function openAugust(){
  const inner=`<div class="md-tag">🚀 8月强化期衔接</div>${PLAN.august.map(a=>`<div class="md-block" style="margin:0 22px 12px"><div class="lb">${esc(a.subj)}</div><div class="tx">${esc(a.plan)}</div></div>`).join('')}`;
  showModal(inner);
}
function openRefs(){
  const inner=`<div class="md-tag">📚 资料依据与核对来源</div><div class="ref-list">${PLAN.references.map(r=>`<div class="ref-item"><div class="ri-s">${esc(r.src)}</div><div class="ri-t">${esc(r.t)}</div><a href="${esc(r.url)}" target="_blank">${esc(r.url)}</a></div>`).join('')}</div>`;
  showModal(inner);
}
function openAbout(){
  const inner=`<div style="padding:0 22px 8px;font-size:13px;line-height:1.9;color:var(--ink2)">
    <p>🌱 <b>研芽</b>，是为一心想上岸的你而做的 30 天陪伴 App。</p>
    <p>每天给自己一个"可被检查的交付"，比焦虑远方更重要。</p>
    <p>计划来自「${esc(PLAN.meta.school)} · ${esc(PLAN.meta.major)}」30 天基础夯实计划（优化执行版），采用「6 学 1 复盘」节奏。</p>
    <p>所有打卡数据仅保存在你的手机，不上传任何服务器，请安心记录 ✨</p>
    <p style="margin-top:14px;color:var(--muted);font-size:12px">建议教你的女朋友把它"添加到主屏幕"作为 App 使用，体验更佳 📲</p>
  </div>`;
  showModal(inner,'关于研芽');
}

/* 心情日记 */
function openDiary(){
  const key=todayStr();
  const cur=state.diary[key]||{mood:0,text:''};
  const moods=['😴','🥲','😐','🙂','🥰'];
  const inner=`<div class="md-tag">📔 今日心情</div>
    <div style="padding:0 22px 12px;display:flex;justify-content:space-between">
      ${moods.map((m,i)=>`<button class="pomo-states ps ${cur.mood===i+1?'active':''}" style="font-size:22px;padding:12px 18px" onclick="setMood(${i+1})">${m}</button>`).join('')}
    </div>
    <div class="rw-input" style="margin:0 22px 4px">
      <textarea id="diary-text" placeholder="今天发生了什么、感受如何、学到了什么…" style="min-height:130px">${esc(cur.text||'')}</textarea>
      <button class="btn-primary" style="margin-top:10px" onclick="saveDiary()">保存今日日记</button>
    </div>
    <div class="md-tag">📖 历史记录</div>
    <div id="diary-history" style="padding:0 22px"></div>`;
  showModal(inner,'心情日记');
  setTimeout(renderDiaryHistory,0);
  setTimeout(()=>{
    const ta=$('#diary-text'); if(ta) ta.addEventListener('input',e=>{
      state.diary[key]=state.diary[key]||{mood:0};
      state.diary[key].text=e.target.value;
    });
  },0);
}
function setMood(i){
  const key=todayStr();
  state.diary[key]=state.diary[key]||{mood:0,text:''};
  state.diary[key].mood=i; save();
  const btns=$$('.pomo-states.ps');
  // refresh modal mood
  openDiary();
}
function saveDiary(){save();toast('日记已保存 📔','success');}
function renderDiaryHistory(){
  const box=$('#diary-history'); if(!box)return;
  const keys=Object.keys(state.diary).sort().reverse();
  if(!keys.length){box.innerHTML=`<div class="empty">还没有历史日记，今天就开始吧 🌱</div>`;return;}
  box.innerHTML=keys.slice(0,30).map(k=>{
    const d=state.diary[k]; if(!d||(d.mood===0&&!d.text))return '';
    const moods=['','😴','🥲','😐','🙂','🥰'];
    return `<div class="md-block" style="margin:0 0 10px"><div class="lb">${k} ${moods[d.mood]||''}</div><div class="tx">${esc(d.text||'(无文字)')}</div></div>`;
  }).join('');
}

/* ---------- 番茄钟 ---------- */
let pomoTimer=null, pomoRemain=0, pomoMode='focus'; // focus/break
const POMO_FOCUS=25*60, POMO_BREAK=5*60;
function openPomodoro(){
  const m=$('#pomo-modal');
  m.innerHTML=`<button class="modal-close" onclick="closeModal()">×</button>
    <div class="modal-grip"></div>
    <div style="text-align:center;padding:18px 22px 6px">
      <div style="font-size:15px;color:var(--ink);font-weight:700">专注番茄钟 🍅</div>
      <div style="font-size:12px;color:var(--muted);margin-top:4px">25 分钟专注 · 5 分钟休息</div>
    </div>
    <div class="pomo-wrap">
      <div class="pomo-states">
        <div class="ps active" id="pm-focus" onclick="switchPomoMode('focus')">专注 25'</div>
        <div class="ps" id="pm-break" onclick="switchPomoMode('break')">休息 5'</div>
      </div>
      <div class="pomo-dial">
        <svg width="220" height="220" viewBox="0 0 220 220">
          <defs><linearGradient id="pg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb6cf"/><stop offset="1" stop-color="#ffc9b6"/></linearGradient></defs>
          <circle class="podo-track" cx="110" cy="110" r="96"/>
          <circle class="podo-bar" id="podo-bar" cx="110" cy="110" r="96" stroke-dasharray="${2*Math.PI*96}" stroke-dashoffset="0"/>
        </svg>
        <div class="pomo-time"><b id="pomo-disp">25:00</b><span id="pomo-state-text">准备好就开始专注</span></div>
      </div>
      <div class="pomo-btns">
        <button class="pbtn primary" id="pomo-start" onclick="pomoToggle()">开始 ▶</button>
        <button class="pbtn" onclick="pomoReset()">重置</button>
      </div>
      <div class="pomo-tag">🍅 已完成 <b style="color:var(--pink-deep)">${state.pomo.total}</b> 个番茄 · 长时间后记得起来走走</div>
    </div><div style="height:24px"></div>`;
  $('#modal-mask').classList.remove('hidden');
  m.classList.remove('hidden');
  pomoMode='focus';pomoRemain=0;pomoTimer&&clearInterval(pomoTimer);pomoTimer=null;
  setPomoDisp(POMO_FOCUS);
  setPodoRing(1);
}
function switchPomoMode(md){
  if(pomoTimer){toast('计时进行中，先暂停再切换～');return;}
  pomoMode=md;
  $('#pm-focus').classList.toggle('active',md==='focus');
  $('#pm-break').classList.toggle('active',md==='break');
  $('#pomo-state-text').textContent=md==='focus'?'准备好就开始专注':'歇会儿，深呼吸～';
  setPomoDisp(md==='focus'?POMO_FOCUS:POMO_BREAK);
  setPodoRing(1);
}
function pomoToggle(){
  if(pomoTimer){clearInterval(pomoTimer);pomoTimer=null;$('#pomo-start').textContent='继续 ▶';return;}
  if(pomoRemain<=0) pomoRemain=pomoMode==='focus'?POMO_FOCUS:POMO_BREAK;
  $('#pomo-start').textContent='暂停 ⏸';
  pomoTimer=setInterval(()=>{
    pomoRemain--;
    setPomoDisp(pomoRemain);
    const total=pomoMode==='focus'?POMO_FOCUS:POMO_BREAK;
    setPodoRing(pomoRemain/total);
    if(pomoRemain<=0){
      clearInterval(pomoTimer);pomoTimer=null;
      if(pomoMode==='focus'){
        state.pomo.total++;state.pomo.last=todayStr();save();
        toast('🍅 一个番茄完成，休息 5 分钟吧！','success');
        confetti();
        switchPomoMode('break');setPomoDisp(POMO_BREAK);setPodoRing(1);
        $('#pomo-start').textContent='开始休息 ▶';
      }else{
        toast('休息结束，继续战斗 💪');
        switchPomoMode('focus');setPomoDisp(POMO_FOCUS);setPodoRing(1);
        $('#pomo-start').textContent='开始专注 ▶';
      }
    }
  },1000);
}
function pomoReset(){pomoTimer&&clearInterval(pomoTimer);pomoTimer=null;pomoRemain=0;
  const t=pomoMode==='focus'?POMO_FOCUS:POMO_BREAK;setPomoDisp(t);setPodoRing(1);$('#pomo-start').textContent='开始 ▶';}
function setPomoDisp(s){
  const el=$('#pomo-disp');if(!el||s<0)return;
  const m=Math.floor(s/60),ss=s%60;
  el.textContent=String(m).padStart(2,'0')+':'+String(ss).padStart(2,'0');
}
function setPodoRing(p){const bar=$('#podo-bar');if(!bar)return;const r=96,c=2*Math.PI*r;bar.style.strokeDashoffset=c*(1-Math.max(0,Math.min(1,p)));}

/* ---------- Modal 通用 ---------- */
function showModal(inner){
  const m=$('#day-modal');
  m.innerHTML=`<button class="modal-close" onclick="closeModal()">×</button>`+inner;
  $('#modal-mask').classList.remove('hidden');
  m.classList.remove('hidden');
}
function closeModal(e){
  if(e && e.target.id!=='modal-mask') return;
  $('#modal-mask').classList.add('hidden');
  $('#day-modal').classList.add('hidden');
  $('#pomo-modal').classList.add('hidden');
  if(pomoTimer){clearInterval(pomoTimer);pomoTimer=null;}
}

/* ---------- 重置 ---------- */
function resetData(){
  if(!confirm('真的要清空所有打卡和日记吗？此操作不可撤销哦～')) return;
  localStorage.removeItem(STORE_KEY);
  state=defaultState();
  toast('已重置，重新出发 🌱');
  renderAll();
}

/* ---------- 撒花 confetti ---------- */
const cvs=()=>$('#confetti');let ctxRef=null;
function confetti(){
  const c=cvs();if(!c)return;
  c.width=innerWidth;c.height=innerHeight;
  const ctx=c.getContext('2d');ctxRef=ctx;
  const colors=['#ffb6cf','#ffc9b6','#c8b6ff','#b8e6d4','#fff','#ffd29c'];
  const emoji=['🌸','🎀','✨','💕','🍓'];
  let parts=[];
  for(let i=0;i<70;i++){
    parts.push({x:innerWidth/2+(Math.random()-.5)*120,y:innerHeight*0.38,
      vx:(Math.random()-.5)*8,vy:Math.random()*-12-4,
      g:0.32,size:Math.random()*6+4,
      color:colors[i%colors.length],rot:Math.random()*6,s:Math.random()*.2,
      life:1,shape:Math.random()<.18?'e':'r',em:emoji[i%emoji.length]});
  }
  let frame=0;
  function loop(){
    ctx.clearRect(0,0,c.width,c.height);frame++;
    parts.forEach(p=>{
      p.vy+=p.g;p.x+=p.vx;p.y+=p.vy;p.vx*=.99;p.rot+=p.s;p.life-=.006;
      ctx.save();ctx.globalAlpha=Math.max(0,p.life);ctx.translate(p.x,p.y);ctx.rotate(p.rot);
      if(p.shape==='r'){ctx.fillStyle=p.color;ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size*1.6);}
      else{ctx.font=(p.size*4)+'px serif';ctx.fillText(p.em,-p.size*2,p.size*2);}
      ctx.restore();
    });
    parts=parts.filter(p=>p.life>0&&p.y<c.height+40);
    if(parts.length&&frame<400)requestAnimationFrame(loop);else ctx.clearRect(0,0,c.width,c.height);
  }
  loop();
}
function tinyConfetti(el){
  // 局部微动画
  if(!el)return;
  const r=el.getBoundingClientRect();
  const c=cvs();if(!c)return;c.width=innerWidth;c.height=innerHeight;
  const ctx=c.getContext('2d');
  const colors=['#ffb6cf','#ffc9b6','#c8b6ff','#b8e6d4'];
  let parts=[];
  for(let i=0;i<16;i++){parts.push({x:r.left+r.width/2,y:r.top+r.height/2,
    vx:(Math.random()-.5)*6,vy:Math.random()*-6-2,g:.25,size:Math.random()*5+3,color:colors[i%colors.length],life:1});}
  let f=0;
  function loop(){ctx.clearRect(0,0,c.width,c.height);f++;parts.forEach(p=>{p.vy+=p.g;p.x+=p.vx;p.y+=p.vy;p.life-=.02;
    ctx.globalAlpha=Math.max(0,p.life);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,7);ctx.fill();});
    parts=parts.filter(p=>p.life>0);if(parts.length&&f<120)requestAnimationFrame(loop);else ctx.clearRect(0,0,c.width,c.height);}
  loop();
}

/* ---------- Toast ---------- */
let toastT=null;
function toast(msg,kind){
  const t=$('#toast');t.textContent=msg;t.className='toast'+(kind?' '+kind:'');
  t.classList.remove('hidden');
  clearTimeout(toastT);toastT=setTimeout(()=>t.classList.add('hidden'),1900);
}

/* ---------- 渲染分发 ---------- */
function render(v){v=v||curView;
  if(v==='home')renderHome();
  else if(v==='plan')renderPlan();
  else if(v==='check')renderCheck();
  else if(v==='review')renderReview();
  else if(v==='me')renderMe();
}
function renderAll(){render('home');render('plan');render('check');render('review');render('me');}

/* ---------- 暴露 ---------- */
window.startOnboard=startOnboard;
window.switchView=switchView;
window.setGroup=setGroup;window.openDay=openDay;window.toggleDayDone=toggleDayDone;
window.toggleTask=toggleTask;window.setRevTab=setRevTab;window.toggleCheck=toggleCheck;
window.saveReport=saveReport;window.openMethods=openMethods;window.openSchedule=openSchedule;
window.openSubjects=openSubjects;window.openAugust=openAugust;window.openRefs=openRefs;window.openAbout=openAbout;
window.openDiary=openDiary;window.setMood=setMood;window.saveDiary=saveDiary;
window.openPomodoro=openPomodoro;window.switchPomoMode=switchPomoMode;window.pomoToggle=pomoToggle;window.pomoReset=pomoReset;
window.closeModal=closeModal;window.resetData=resetData;

/* ---------- 启动 ---------- */
if(state.onboarded){
  $('#view-onboard').classList.add('hidden');
  $('#shell').classList.remove('hidden');
  ensureStart();
  renderAll();
  switchView('home');
}else{
  $('#view-onboard').classList.remove('hidden');
  $('#shell').classList.add('hidden');
}

/* 修复 setPomoDisp 字符串拼接 bug 的稳定版本（覆盖上面定义） */
window._setPomoDisp=setPomoDisp;
})();
/* ---------- state (เก็บในเครื่องเท่านั้น) ---------- */
const KEY = 'f1sg.v1';
const DEF = { done: {}, pack: {}, notes: {}, sim: null, day: null, sun: '', geoOn: false,
  money: { cardType: '', rate: '26.25', cardTHB: '3000', cashTHB: '1000', cardSGD: '', cashSGD: '', est: {}, tx: [] } };
let S = (() => { try { const j = JSON.parse(localStorage.getItem(KEY) || '{}'); return { ...DEF, ...j, money: { ...DEF.money, ...(j.money || {}) } }; } catch (e) { return JSON.parse(JSON.stringify(DEF)); } })();
let storeOk = true;
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); storeOk = true; } catch (e) { storeOk = false; } };

const $ = (q, el) => (el || document).querySelector(q);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- time (Asia/Singapore เสมอ) ---------- */
const ts = (date, hm) => Date.parse(`${date}T${hm}:00+08:00`);
const now = () => (S.sim != null ? S.sim : Date.now());
const fmt = (ms, tz, o) => new Intl.DateTimeFormat('th-TH', { timeZone: tz, hour12: false, ...o }).format(ms);
const hm = (ms, tz) => fmt(ms, tz || 'Asia/Singapore', { hour: '2-digit', minute: '2-digit' });
const dayStr = ms => fmt(ms, 'Asia/Singapore', { weekday: 'long', day: 'numeric', month: 'short' });
const sgDate = ms => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore' }).format(ms);

const EVS = [];
DAYS.forEach(d => d.items.forEach((it, i) => { it._d = d; it._i = i; if (it.t === 'ev' && it.s) { it._S = ts(d.date, it.s); it._E = ts(d.date, it.endOfficial || it.e); EVS.push(it); } }));
EVS.sort((a, b) => a._S - b._S);
const TRIP_S = EVS[0]._S, TRIP_E = EVS[EVS.length - 1]._E;
const byId = {}; DAYS.forEach(d => d.items.forEach(it => byId[it.id] = it)); byId.ret = RETURN_HOTEL;
const routeBefore = ev => { const its = ev._d.items; for (let i = ev._i - 1; i >= 0; i--) { if (its[i].t === 'rt') return its[i]; if (its[i].t === 'ev') return null; } return null; };

/* ---------- small renderers ---------- */
const ST = { ok: ['b-ok', 'ยืนยันทางการ 2026'], tip: ['b-tip', 'คำแนะนำ'], prev: ['b-prev', 'ประสบการณ์ปีก่อน'], unk: ['b-unk', 'ยังไม่ยืนยัน'] };
const badge = st => `<span class="bdg ${ST[st][0]}">${ST[st][1]}</span>`;
const srcs = arr => (arr && arr.length) ? `<div class="src">แหล่งอ้างอิง · ตรวจล่าสุด ${CHECKED}${arr.map(s => `<a href="${s.url}" target="_blank" rel="noopener">${s.st ? badge(s.st) + ' ' : ''}${esc(s.label)} ↗${s.extra ? ` <span class="mut">(${esc(s.extra)})</span>` : ''}</a>`).join('')}</div>` : '';
const ext = (url, label, cls) => `<a class="btn ${cls || ''}" href="${url}" target="_blank" rel="noopener">${label}</a>`;
const act = (a, v, label, cls) => `<button class="btn ${cls || ''}" data-act="${a}" data-v="${v || ''}">${label}</button>`;

function routeCard(r, open) {
  return `<div class="card rt" id="c-${r.id}">
    <div class="row sp"><h3>🚇 ${r.title}</h3>${badge(r.status)}</div>
    <div class="kv">${r.leave ? `ควรออก <span class="time">${r.leave}</span> · ` : ''}ใช้เวลา <b style="color:var(--tx)">${r.total}</b></div>
    <details ${open ? 'open' : ''}><summary>วิธีไปทีละขั้น</summary>
      <div class="mut">${r.from} → ${r.to}</div>
      <div class="grid3"><div><b>เดิน</b>${r.walk}</div><div><b>นั่งรถ</b>${r.ride}</div><div><b>เผื่อคิว/ตรวจบัตร</b>${r.buffer}</div></div>
      <p><b>ทำไมต้องออกเวลานี้:</b> ${r.leaveWhy}</p>
      <p><b>ทางหลัก (เดินน้อย)</b></p><ol>${r.steps.map(s => `<li>${s}</li>`).join('')}</ol>
      ${r.alt ? `<p><b>ทางสำรอง</b></p><ul>${r.alt.map(s => `<li>${s}</li>`).join('')}</ul>` : ''}
      ${r.warn ? `<div class="warn">⚠️ ${r.warn}</div>` : ''}
      <div class="row">${r.maps ? ext(r.maps, '🧭 ' + (r.mapsLabel || 'เปิด Google Maps'), 'sm') : ''}${r.pin ? act('pin', r.pin, '🗺️ ดูบนแผนที่สนาม', 'sm') : ''}</div>
      ${r.maps ? '<div class="mut">Google Maps ต้องใช้อินเทอร์เน็ต และใช้ได้กับทางนอกสนามเท่านั้น</div>' : ''}
      ${srcs(r.src)}
    </details></div>`;
}

function evCard(ev, hl) {
  const dn = !!S.done[ev.id];
  const o = ev.official;
  const differs = o && o.note && !/^ตรงกับแพลน/.test(o.note);
  return `<div class="card ${hl ? 'hl' : ''} ${dn ? 'done' : ''}" id="c-${ev.id}">
    <div class="row" style="align-items:flex-start;flex-wrap:nowrap">
      <button class="chk ${dn ? 'on' : ''}" data-act="done" data-v="${ev.id}" aria-label="ทำแล้ว">✓</button>
      <div style="flex:1;min-width:0">
        <div class="time">${ev.plan}</div>
        <h3 class="ttl">${ev.icon || ''} ${ev.title}</h3>
        <div class="mut">${ev.place || ''}</div>
        <div style="margin-top:4px">${badge(ev.status)}</div>
      </div>
    </div>
    ${o ? `<div class="${differs ? 'warn diff' : 'off'}"><b>เวลาตามแพลนเดิม:</b> ${ev.plan}<br><b>เวลาทางการล่าสุด:</b> ${o.time}${o.note ? `<br>${differs ? '⚠️ ' : ''}${o.note}` : ''}</div>` : ''}
    ${ev.overlap ? `<div class="warn">⚠️ ${ev.overlap}</div>` : ''}
    ${(ev.detail || ev.links || ev.src || ev.maps || ev.spot || ev.pin || ev.ret) ? `<details><summary>รายละเอียด</summary>
      ${ev.detail ? `<p>${ev.detail}</p>` : ''}
      <div class="row">${(ev.links || []).map(l => ext(l.url, l.label, 'sm')).join('')}${ev.maps ? ext(ev.maps, '🧭 ' + (ev.mapsLabel || 'เปิด Google Maps'), 'sm') : ''}${ev.spot ? act('spot', ev.spot, '👀 ดูมุมวิว', 'sm') : ''}${ev.pin ? act('pin', ev.pin, '🗺️ ดูบนแผนที่สนาม', 'sm') : ''}${ev.ret ? act('sheet', 'ret', '🏨 วิธีกลับโรงแรม', 'sm pri') : ''}</div>
      ${srcs(ev.src)}</details>` : ''}
  </div>`;
}
const restCard = r => `<div class="card rest"><div class="row sp"><h3>🧃 ${r.title}</h3>${badge(r.status)}</div><p>${r.detail}</p>${srcs(r.src)}</div>`;


/* ---------- ตำแหน่งของฉัน (คำนวณในเครื่องเท่านั้น) ---------- */
const geo = { pos: null, err: '', wid: null, busy: false };
const dist = (a, b) => { const R = 6371000, r = x => x * Math.PI / 180, dl = r(b[0] - a[0]), dn = r(b[1] - a[1]); const h = Math.sin(dl / 2) ** 2 + Math.cos(r(a[0])) * Math.cos(r(b[0])) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const dtxt = m => m >= 1000 ? (m / 1000).toFixed(m >= 10000 ? 0 : 1) + ' กม.' : Math.round(m / 10) * 10 + ' ม.';
const evLoc = ev => { if (!ev) return null; if (ev.id === 'd3-race' || ev.id === 'd3-parade' || ev.id === 'd3-anthem') return S.sun === 'A' ? LOCS.t13 : S.sun === 'B' ? LOCS.memorial : null; return LOCS[EVLOC[ev.id]] || null; };
function startGeo() {
  if (!('geolocation' in navigator)) { geo.err = 'เบราว์เซอร์นี้อ่านตำแหน่งไม่ได้'; drawGeo(); return; }
  if (geo.wid != null) navigator.geolocation.clearWatch(geo.wid);
  geo.busy = true; geo.err = ''; drawGeo();
  geo.wid = navigator.geolocation.watchPosition(p => { geo.busy = false; geo.err = ''; geo.pos = { p: [p.coords.latitude, p.coords.longitude], acc: p.coords.accuracy, t: p.timestamp }; drawGeo(); },
    e => { geo.busy = false; geo.err = e.code === 1 ? 'ยังไม่ได้อนุญาตให้ใช้ตำแหน่ง — เปิดสิทธิ์ตำแหน่งของเว็บนี้ในการตั้งค่าเบราว์เซอร์แล้วกดใหม่' : 'หาตำแหน่งไม่ได้ตอนนี้ (สัญญาณ GPS อ่อน หรืออยู่ในอาคาร/ใต้ดิน) ลองใหม่อีกครั้ง'; if (e.code === 1) { S.geoOn = false; save(); } drawGeo(); },
    { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 });
}
function stopGeo() { if (geo.wid != null) navigator.geolocation.clearWatch(geo.wid); geo.wid = null; geo.pos = null; geo.busy = false; geo.err = ''; S.geoOn = false; save(); drawGeo(); }
function geoHtml() {
  if (!S.geoOn && !geo.pos) return `<div class="card"><h3>📍 ตำแหน่งของฉัน</h3><p class="mut">กดเพื่อให้เว็บอ่านตำแหน่งแล้วเทียบกับแพลนว่าตอนนี้อยู่ที่ไหน ห่างจุดหมายถัดไปเท่าไร ตำแหน่งใช้คำนวณในเครื่องนี้เท่านั้น ไม่ถูกส่งหรือบันทึกไว้ที่ไหน</p>${geo.err ? `<div class="warn">⚠️ ${geo.err}</div>` : ''}<div class="row">${act('geo', '', '📍 ใช้ตำแหน่งของฉัน', 'pri')}</div></div>`;
  if (!geo.pos) return `<div class="card"><h3>📍 ตำแหน่งของฉัน</h3>${geo.err ? `<div class="warn">⚠️ ${geo.err}</div>` : '<p>⏳ กำลังหาตำแหน่ง…</p>'}<div class="row">${act('geo', '', 'ลองใหม่', 'sm')}${act('geooff', '', 'ปิดการใช้ตำแหน่ง', 'sm')}</div></div>`;
  const me = geo.pos.p, t = now();
  const near = Object.values(LOCS).map(l => ({ l, d: dist(me, l.p) })).sort((x, y) => x.d - y.d)[0];
  const inSG = dist(me, LOCS.padang.p) < 60000;
  const cur = EVS.filter(e => e._S <= t && t < e._E), next = EVS.find(e => e._S > t);
  let h = `<div class="card"><div class="row sp"><h3>📍 ตำแหน่งของฉัน</h3><span class="pill">±${Math.round(geo.pos.acc)} ม. · ${hm(geo.pos.t)}</span></div>`;
  h += `<div class="big" style="font-size:1.2rem">${near.d < 150 + geo.pos.acc ? 'อยู่ที่' : 'ใกล้'} ${near.l.n}</div><div class="mut">ห่างราว ${dtxt(near.d)}${near.l.a ? ' (พิกัดจุดนี้เป็นค่าประมาณ)' : ''}</div>`;
  if (S.sim != null) h += `<div class="warn">🧪 กำลังใช้เวลาทดลอง แต่ตำแหน่งเป็นตำแหน่งจริงตอนนี้</div>`;
  if (!inSG) h += `<div class="off">ยังไม่ได้อยู่ในสิงคโปร์ (ห่าง Padang ราว ${dtxt(dist(me, LOCS.padang.p))}) การเทียบเวลาเดินจะเริ่มเมื่อถึงสิงคโปร์</div>`;
  else {
    cur.forEach(e => { const L = evLoc(e); if (!L) return; const d = dist(me, L.p); h += d < 120 + geo.pos.acc ? `<div class="off">✅ ตรงกับแพลนตอนนี้: ${e.icon} ${e.title} ที่ ${L.n}</div>` : `<div class="warn">ตามแพลนตอนนี้คือ ${e.icon} <b>${e.title}</b> ที่ ${L.n} — คุณอยู่ห่างราว ${dtxt(d)}</div>`; });
    if (next) {
      const L = evLoc(next), mins = Math.round((next._S - t) / 60000), rt = routeBefore(next);
      if (!L) h += `<div class="mut" style="margin-top:6px">ถัดไป ${next.icon} ${next.title} — ยังไม่ได้ระบุสถานที่${next.id.startsWith('d3-') ? ' (เลือก A/B ในหน้า “จุดดู F1” ก่อน)' : ''} จึงเทียบระยะไม่ได้</div>`;
      else if (mins <= 720) {
        const d = dist(me, L.p);
        if (d < 150 + geo.pos.acc) h += `<div class="off">✅ ถึงจุดหมายถัดไปแล้ว: ${next.icon} ${next.title} (${L.n}) เริ่ม ${next.s}</div>`;
        else if (d <= 1500) {
          const w = Math.ceil(d * 1.4 / 70);
          let mmv = rt && rt.mm; if (rt && rt.id === 'd3-r3' && S.sun === 'A') mmv = [30, 45];
          const usePlan = mmv && d > 400 && mmv[0] > w, eff = usePlan ? mmv[0] : w, slack = mins - eff;
          const tight = usePlan && mins < mmv[1] && slack >= 0;
          h += `<div class="${slack >= 15 && !tight ? 'off' : 'warn' + (slack < 0 ? ' diff' : '')}">ถึง <b>${L.n}</b> ราว ${dtxt(d)} (เส้นตรง) · เดินเส้นตรงประมาณ ${w} นาที${usePlan ? ` · แต่แพลนประเมินช่วงนี้ <b>${mmv[0]}–${mmv[1]} นาที</b> (รวมทางอ้อม คิว และคนแน่น) ให้ยึดตัวเลขนี้` : ''} · ${next.title} เริ่มในอีก ${mins} นาที<br><b>${slack < 0 ? `น่าจะถึงหลังเริ่มราว ${-slack} นาทีขึ้นไป` : tight ? 'ควรออกเดี๋ยวนี้ ถ้าคนแน่นอาจพลาดช่วงต้น' : slack >= 15 ? `มีเวลาเหลือราว ${slack} นาที` : 'ควรออกเดินเดี๋ยวนี้'}</b></div>`;
        } else {
          let s = `ถึง <b>${L.n}</b> ราว ${dtxt(d)} (เส้นตรง) ไกลเกินเดิน`;
          if (rt) { const lv = rt.leave ? Math.round((ts(next._d.date, rt.leave) - t) / 60000) : null; s += ` · เส้นทางในแพลนใช้ ${rt.total}` + (lv != null ? ` · ${lv > 0 ? `ควรออกในอีก ${lv} นาที (${rt.leave})` : `<b>เลยเวลาออก ${rt.leave} มาแล้ว ${-lv} นาที</b>`}` : ''); }
          h += `<div class="${rt && rt.leave && ts(next._d.date, rt.leave) < t ? 'warn diff' : 'off'}">${s}</div>`;
        }
      }
    }
    h += `<p class="mut">เวลาเดินคิดจากระยะเส้นตรง ×1.4 ที่ความเร็วเดินปกติ ไม่ได้นับรั้ว ทางลอด คิวตรวจกระเป๋า หรือคนแน่น ในสนามจริงมักนานกว่านี้ ไม่รับประกันว่าทัน</p>`;
  }
  return h + `<div class="row">${act('geo', '', '🔄 อัปเดตตำแหน่ง', 'sm')}${act('geooff', '', 'ปิดการใช้ตำแหน่ง', 'sm')}</div></div>`;
}
function drawGeo() { const e = document.getElementById('geo'); if (e) e.innerHTML = geoHtml(); }

/* ---------- หน้า ตอนนี้ / ถัดไป ---------- */
function renderNow() {
  const t = now();
  const cur = EVS.filter(e => e._S <= t && t < e._E);
  const next = EVS.find(e => e._S > t);
  const rt = next ? routeBefore(next) : null;
  const nextSpot = EVS.find(e => e._E > t && e.spot);
  const mins = next ? Math.round((next._S - t) / 60000) : 0;
  const away = mins >= 1440 ? `อีก ${Math.floor(mins / 1440)} วัน ${Math.floor(mins % 1440 / 60)} ชม.` : mins >= 60 ? `อีก ${Math.floor(mins / 60)} ชม. ${mins % 60} นาที` : `อีก ${mins} นาที`;
  let leaveHtml = '';
  if (rt && rt.leave) {
    const L = ts(next._d.date, rt.leave), d = Math.round((L - t) / 60000);
    leaveHtml = `<div class="kv">ควรออก <span class="time" style="font-size:1.25rem">${rt.leave}</span> <span class="mut">${d > 0 ? (d >= 60 ? `(อีก ${Math.floor(d / 60)} ชม. ${d % 60} นาที)` : `(อีก ${d} นาที)`) : '(ถึงเวลาออกแล้ว)'}</span></div><div class="mut">ใช้เวลา ${rt.total}</div>`;
  }
  const phase = t < TRIP_S ? 'ยังไม่ถึงวันเดินทาง' : t > TRIP_E ? 'จบทริปแล้ว 🏁' : '';
  $('#p-now').innerHTML = `
    ${S.sim != null ? `<div class="warn">🧪 โหมดทดลองเวลา — ไม่ใช่เวลาจริง ${act('simreset', '', 'กลับเวลาจริง', 'sm')}</div>` : ''}
    <div class="row sp" style="margin-top:4px"><div><div class="mut">เวลาสิงคโปร์ · ${dayStr(t)}</div><div class="big time">${hm(t)}</div></div>
      <div class="mut" style="text-align:right">เวลาไทย<br>${hm(t, 'Asia/Bangkok')}</div></div>
    ${phase ? `<div class="card"><b>${phase}</b><div class="mut">ลองเลือกวัน/เวลาด้านล่างเพื่อดูว่าหน้านี้จะแสดงอะไรระหว่างทริป</div></div>` : ''}
    <div class="card"><div class="mut">ตอนนี้</div>
      ${cur.length ? cur.map(e => `<div class="big">${e.icon} ${e.title}</div><div class="mut">${e.plan} · ${e.place}</div>`).join('<hr style="border-color:var(--line)">') : `<div class="big">${t < TRIP_S || t > TRIP_E ? '—' : 'ช่วงว่าง / กำลังเดินทาง'}</div>`}
      ${cur.length > 1 ? '<div class="warn">⚠️ สองกิจกรรมซ้อนเวลากันตามแพลนเดิม</div>' : ''}
    </div>
    ${next ? `<div class="card hl"><div class="row sp"><div class="mut">ถัดไป · ${next._d.label}</div><span class="pill">${away}</span></div>
      <div class="big">${next.icon} ${next.title}</div>
      <div><span class="time">${next.plan}</span></div><div class="mut">${next.place}</div>
      ${next.official && !/^ตรงกับแพลน/.test(next.official.note || '') ? `<div class="warn diff">⚠️ ทางการล่าสุด: ${next.official.time}</div>` : ''}
      ${leaveHtml}
      <div class="row" style="margin-top:10px">
        ${rt ? act('sheet', rt.id, '🚇 ดูวิธีไป', 'pri') : act('goplan', next.id, '🗓️ ดูในแพลน', 'pri')}
        ${nextSpot ? act('spot', nextSpot.spot, '👀 ดูมุมวิว') : ''}
      </div></div>` : ''}
    <div class="row">${act('sheet', 'ret', '🏨 กลับโรงแรม')}${next ? act('goplan', next.id, '🗓️ แพลนทั้งวัน') : act('page', 'plan', '🗓️ แพลนทั้งวัน')}</div>
    <div id="geo">${geoHtml()}</div>
    <details><summary>ทดลองเลือกวัน/เวลา</summary>
      <div class="row">${[['2026-10-09T19:05', 'ศ. 19:05'], ['2026-10-10T14:20', 'ส. 14:20'], ['2026-10-10T20:45', 'ส. 20:45'], ['2026-10-11T21:30', 'อา. 21:30'], ['2026-10-12T13:00', 'จ. 13:00']].map(p => act('sim', p[0], p[1], 'sm')).join('')}</div>
      <label>วันและเวลา (เวลาสิงคโปร์)</label><input type="datetime-local" id="simdt" value="${sgDate(t)}T${hm(t)}">
      <div class="row" style="margin-top:8px">${act('simset', '', 'ใช้เวลานี้', 'sm')}${act('simreset', '', 'กลับเวลาจริง', 'sm')}</div>
    </details>
    <p class="mut">การ์ด “ตอนนี้ / ถัดไป” คิดจากเวลาในแพลน ส่วนตำแหน่งจะอ่านก็ต่อเมื่อคุณกดอนุญาตเท่านั้น</p>
    <p class="mut" id="offl"></p>`;
  offlineLine();
}

/* ---------- หน้า แพลน ---------- */
function curDay() { if (S.day) return S.day; const d = sgDate(now()); const m = DAYS.find(x => x.date === d); return m ? m.id : 'd1'; }
function renderPlan() {
  const id = curDay(), d = DAYS.find(x => x.id === id), t = now();
  const nextId = (EVS.find(e => e._S > t) || {}).id;
  $('#p-plan').innerHTML = `<div class="tabs">${DAYS.map(x => `<button class="btn ${x.id === id ? 'on' : ''}" data-act="day" data-v="${x.id}">${x.tab}</button>`).join('')}</div>
    <h2 style="margin-top:4px">${d.label}</h2><div class="mut">${d.title}</div>
    <div class="mut" style="margin-top:6px">${Object.keys(ST).map(k => badge(k)).join(' ')}</div>
    ${d.items.map(it => it.t === 'rt' ? routeCard(it) : it.t === 'rest' ? restCard(it) : evCard(it, it.id === nextId)).join('')}`;
}

/* ---------- ภาพ ---------- */
function imgBox(sp) {
  if (!sp.img) return `<div class="imgbox"><div class="fb">🖼️ ${sp.noImg}<br><span class="mut">ถ่ายเองวันเสาร์แล้วกด “เพิ่มภาพจากเครื่อง” ด้านล่างได้</span></div></div>`;
  const i = sp.img;
  return `<div class="imgbox" data-img="${sp.id}"><div class="ld">⏳ กำลังโหลดภาพ…</div>
    <img alt="${esc(i.cap)}" src="${i.url}" style="display:none" data-act="zoom" data-v="${i.url}"
      onload="this.style.display='block';this.previousElementSibling.style.display='none'"
      onerror="this.style.display='none';this.previousElementSibling.innerHTML='🖼️ โหลดภาพไม่ได้ (อาจไม่มีสัญญาณ หรือเว็บต้นทางไม่อนุญาต)<br><b>วิวที่เห็น:</b> ${esc(i.cap)}'">
    </div>
    <div class="mut">📷 ภาพปี ${i.year} · เครดิต ${i.credit} · ${i.cap} <b>ไม่ใช่ภาพปี 2026</b></div>
    <div class="row" style="margin-top:6px">${i.page ? ext(i.page, i.pageLabel || 'เปิดโพสต์ต้นฉบับ ↗', 'sm pri') : ''}${ext(i.url, 'เปิดภาพต้นฉบับ ↗', 'sm')}</div>`;
}
let idb;
const db = () => idb || (idb = new Promise((res, rej) => { const r = indexedDB.open('f1sg', 1); r.onupgradeneeded = () => r.result.createObjectStore('photos', { keyPath: 'id', autoIncrement: true }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }));
const idbReq = (mode, fn) => db().then(d => new Promise((res, rej) => { const st = d.transaction('photos', mode).objectStore('photos'); const q = fn(st); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }));
async function loadThumbs() {
  let all = []; try { all = await idbReq('readonly', s => s.getAll()); } catch (e) { }
  document.querySelectorAll('[data-thumbs]').forEach(el => {
    const mine = all.filter(p => p.spot === el.dataset.thumbs);
    el.innerHTML = mine.map(p => { const u = URL.createObjectURL(p.blob); return `<div><img src="${u}" data-act="zoom" data-v="${u}" alt="ภาพของฉัน"><button data-act="delphoto" data-v="${p.id}" aria-label="ลบ">×</button></div>`; }).join('');
  });
}

/* ---------- หน้า จุดดู F1 ---------- */
let fz = 0, fm = '';
function renderSpots() {
  const list = SPOTS.filter(s => (!fz || s.zone === fz) && (!fm || s.tags.includes(fm)));
  $('#p-spots').innerHTML = `<h2>จุดดู F1 สำหรับ Premier Walkabout</h2>
    <p class="mut">Premier Walkabout ไม่มีที่นั่งจอง ทุกแท่นมาก่อนได้ก่อน และไม่รับประกันตำแหน่งหรือมุมมอง รายการนี้เป็นจุดตั้งต้นให้เทียบ ไม่ได้จัดอันดับ</p>
    <div class="card"><h3>🏆 วันอาทิตย์: เลือก A หรือ B</h3>
      <table><tr><th></th><th>A · โค้ง 1–3</th><th>B · Memorial / Zone 4</th></tr>
      <tr><td>เน้น</td><td>มุมเรซ</td><td>เดินน้อย ต่อคอนเสิร์ต</td></tr>
      <tr><td>เดินไป Padang</td><td>30–45 นาทีขึ้นไป</td><td>8–15 นาที</td></tr>
      <tr><td>ทัน LANA 22:25</td><td>ถ้าเรซจบ 22:00 น่าจะถึง 22:35–22:50 หรือช้ากว่า <b>พลาดต้นโชว์ 10–25 นาทีขึ้นไป</b></td><td>น่าจะทันเริ่ม ถ้าออกทันทีหลังธงตาหมากรุก</td></tr>
      <tr><td>อยากทันเพลงแรก</td><td>ออกราว 21:40 = พลาดท้ายเรซราว 20 นาที</td><td>ไม่ต้องออกก่อน</td></tr>
      <tr><td>กลับโรงแรม</td><td>ไกล ต้องข้ามมา Zone 4 หรือออก Gate 1</td><td>ใกล้ Gate 3A/3B</td></tr></table>
      <p class="mut">เวลาเดินข้ามโซนเป็นตัวเลขจากผู้ชมปีก่อน ทางการไม่ได้ระบุ · เรซอาจจบก่อน 22:00 ได้ถ้าไม่มีเซฟตี้คาร์ ${badge('prev')}</p>
      <label>ฉันเลือกสำหรับวันอาทิตย์</label>
      <select data-bind="sun"><option value="">ยังไม่เลือก</option><option value="A">A · โค้ง 1–3</option><option value="B">B · Memorial / Zone 4</option></select>
      <label>โน้ตวันเสาร์: ชอบมุมไหน เพราะอะไร</label><textarea data-note="sat" placeholder="เช่น โค้ง 1–3 เห็นรถเยอะแต่คนแน่น…">${esc(S.notes.sat || '')}</textarea>
    </div>
    <div class="row">${[[0, 'ทุก Zone'], [1, 'Zone 1'], [4, 'Zone 4']].map(z => `<button class="btn sm ${fz === z[0] ? 'on' : ''}" data-act="fz" data-v="${z[0]}">${z[1]}</button>`).join('')}</div>
    <div class="row" style="margin-top:6px">${[['', 'ทั้งหมด'], ['race', 'เน้นมุมเรซ'], ['easy', 'เน้นเดินน้อย / ต่อคอนเสิร์ต']].map(z => `<button class="btn sm ${fm === z[0] ? 'on' : ''}" data-act="fm" data-v="${z[0]}">${z[1]}</button>`).join('')}</div>
    ${list.map(sp => `<div class="card" id="s-${sp.id}"><div class="row sp"><h3>${sp.name}</h3><span class="pill">Zone ${sp.zone}</span></div>
      <div class="mut">ใช้กับ: ${sp.uses}</div>
      ${imgBox(sp)}
      <div class="kv"><b>เห็นรถช่วงไหน:</b> ${sp.sees}</div>
      <div class="kv"><b>ความใกล้รถ:</b> ${sp.near}</div>
      <div class="kv"><b>สิ่งที่บัง:</b> ${sp.block}</div>
      <div class="kv"><b>จอ:</b> ${sp.screen} ${badge('unk')}</div>
      <details><summary>ข้อดี ข้อจำกัด และทางเลือก</summary>
        <div class="kv"><b>ความแออัด:</b> ${sp.crowd}</div>
        <div class="kv"><b>ข้อดี:</b> ${sp.pros}</div><div class="kv"><b>ข้อจำกัด:</b> ${sp.cons}</div>
        <div class="kv"><b>เดินไปกิจกรรมถัดไป:</b> ${sp.next}</div>
        <div class="kv"><b>ถ้าแท่นเต็ม:</b> ${sp.full}</div><div class="kv"><b>พัก/ยืนดู:</b> ${sp.rest}</div>
        ${srcs(sp.src)}</details>
      <div class="thumbs" data-thumbs="${sp.id}"></div>
      <div class="row" style="margin-top:8px">${act('pin', sp.pin, '🗺️ ดูบนแผนที่', 'sm')}<label class="btn sm" style="margin:0;color:var(--tx)">📷 เพิ่มภาพจากเครื่อง<input type="file" accept="image/*" data-photo="${sp.id}" style="display:none"></label></div>
      <label>โน้ตของฉัน</label><textarea data-note="spot-${sp.id}" placeholder="มุมนี้เป็นยังไง…">${esc(S.notes['spot-' + sp.id] || '')}</textarea>
    </div>`).join('')}
    <h2>ภาพจากทางการ (หน้าบัตร 2026)</h2>
    <p class="mut">ภาพประกอบที่ Singapore GP ใช้บนหน้าขายบัตร Premier Walkabout และ Zone 4 Walkabout ปี 2026 · ทางการ<b>ไม่ได้บอกปีที่ถ่ายและตำแหน่งของแต่ละภาพ</b> และเป็นภาพโปรโมตที่เลือกมุมดีมาแล้ว ใช้ดูบรรยากาศ ความสูงของแท่น และความหนาแน่นของคน ${badge('unk')}</p>
    ${GALLERY.filter(g => !fz || g.z === fz).map(g => `<div class="card"><div class="row sp"><span class="pill">${g.z === 1 ? 'หน้าบัตร Premier Walkabout' : 'หน้าบัตร Zone 4 Walkabout'}</span></div>
      <div class="imgbox"><div class="ld">⏳ กำลังโหลดภาพ…</div><img alt="${esc(g.cap)}" src="${g.url}" style="display:none" data-act="zoom" data-v="${g.url}" onload="this.style.display='block';this.previousElementSibling.style.display='none'" onerror="this.style.display='none';this.previousElementSibling.innerHTML='🖼️ โหลดภาพไม่ได้ (อาจไม่มีสัญญาณ)'"></div>
      <div class="mut">${g.cap}</div><div class="row" style="margin-top:6px">${ext(g.url, 'เปิดภาพต้นฉบับ ↗', 'sm')}</div></div>`).join('')}
    ${srcs([{ ...SRC.offPW, st: 'ok' }, { ...SRC.offZ4, st: 'ok' }])}
    <p class="mut">ภาพและโน้ตที่เพิ่มเองเก็บอยู่ในเครื่องนี้เท่านั้น ไม่ถูกส่งไปที่ไหน</p>`;
  const sel = $('[data-bind="sun"]'); if (sel) sel.value = S.sun || '';
  loadThumbs();
}

/* ---------- หน้า แผนที่ ---------- */
let zoom = 1, selPin = '', pk = '';
const PK = { gate: '🚪', stage: '🎤', view: '👁️' };
function renderMap() {
  const pins = PINS.filter(p => !pk || p.k === pk);
  const sp = PINS.find(p => p.id === selPin);
  $('#p-map').innerHTML = `<h2>แผนที่สนามทางการ 2026</h2>
    <p class="mut">ฉบับล่าสุดที่พบ: ข้อมูล ณ 10 ก.ย. 2026 (ตรวจ ${CHECKED}) · แผนที่ไม่ได้วาดตามสัดส่วนจริง · หมุดเป็นตำแหน่งโดยประมาณ อ่านจากป้ายบนแผนที่เอง</p>
    <div class="row">${act('zo', '', '➖', 'sm')}${act('zf', '', 'พอดีจอ', 'sm')}${act('zi', '', '➕', 'sm')}${ext(MAP_IMG, 'เปิดต้นฉบับ ↗', 'sm')}</div>
    <div class="row" style="margin:6px 0">${[['', 'ทั้งหมด'], ['gate', '🚪 Gate'], ['stage', '🎤 เวที'], ['view', '👁️ จุดดูรถ']].map(z => `<button class="btn sm ${pk === z[0] ? 'on' : ''}" data-act="pk" data-v="${z[0]}">${z[1]}</button>`).join('')}</div>
    <div class="mapwrap" id="mw"><div class="mapin" id="mi" style="width:${zoom * 100}%">
      <img id="mapimg" src="${MAP_IMG}" alt="แผนที่สนาม" onerror="document.getElementById('mapfail').style.display='block';this.style.display='none'">
      ${pins.map(p => `<button class="pin ${p.id === selPin ? 'sel' : ''}" style="left:${p.x}%;top:${p.y}%" data-act="pin" data-v="${p.id}" aria-label="${esc(p.name)}">${p.ic || PK[p.k]}</button>`).join('')}
    </div></div>
    <div class="warn" id="mapfail" style="display:none">โหลดภาพแผนที่ไม่ได้ (ต้องใช้อินเทอร์เน็ตในครั้งแรก) ใช้รายการ Gate และคำอธิบายด้านล่างแทนได้</div>
    ${sp ? `<div class="card hl"><h3>📍 ${sp.name}</h3><div>${sp.info}</div></div>` : ''}
    <h2>เลือกตำแหน่ง</h2>
    <div class="row">${PINS.map(p => `<button class="btn sm ${p.id === selPin ? 'on' : ''}" data-act="pin" data-v="${p.id}">${p.ic || PK[p.k]} ${p.name}</button>`).join('')}</div>
    <h2>Gate และสถานีที่ใกล้ที่สุด ${badge('ok')}</h2>
    <div class="card"><table>${GATES_TEXT.map(g => `<tr><td><b>${g[0]}</b><br>${g[1]}</td></tr>`).join('')}</table>
      <p class="mut">Premier Walkabout เข้าได้ทุกประตูผู้ชม · ประตูที่บัตรแนะนำ: 1, 3A, 6, 7, 8</p>${srcs([SRC.lta, SRC.pwGuide, SRC.pwTicket, SRC.z4Guide])}</div>
    <h2>อ่านแผนที่ให้ออก</h2>
    <div class="card"><ul>
      <li><b>Zone 1 (เหลือง)</b> — พิท โค้ง 1–5 Wharf Stage · <b>Zone 2 (ม่วง)</b> — Flyer โค้ง 16–17 · <b>Zone 3 (ชมพู)</b> — ทางผ่านริม Raffles Avenue · <b>Zone 4 (เขียว)</b> — Padang, Esplanade, โค้ง 7–15</li>
      <li>สัญลักษณ์ <b>รูปตา</b> คือ Walkabout Viewing Platform</li>
      <li><b>Turn 1 Platform</b> และ <b>Empress Platform</b> (ป้ายสีส้มรูปรถเข็น) เป็นแท่นสำหรับผู้ใช้รถเข็น ไม่ใช่แท่นของบัตรนี้</li>
      <li>ฝั่ง Gate 3A/3B (Memorial) กับฝั่ง Padang มีแทร็กคั่น ข้ามด้วย<b>ทางลอด A หรือ B</b> ใกล้โค้ง 8</li>
      <li>เส้นประขาว = ทางเดิน Zone 1 → Zone 4 · เส้นประแดง = ทางเดินบนแทร็กหลังจบกิจกรรมสุดท้ายของวัน (เฉพาะผู้ชม Zone 1–2 เปิดราว 25 นาทีหลังตรวจความปลอดภัย)</li>
      <li>พื้นที่ลายแดง-ดำ = Paddock เข้าไม่ได้</li></ul>${srcs([SRC.map, SRC.trackwalk])}</div>`;
}
function focusPin(id) {
  selPin = id; pk = ''; if (zoom < 2.5) zoom = 2.5; go('map');
  const p = PINS.find(x => x.id === id), mw = $('#mw'), img = $('#mapimg');
  const center = () => { const mi = $('#mi'); mw.scrollLeft = mi.offsetWidth * p.x / 100 - mw.clientWidth / 2; mw.scrollTop = mi.offsetHeight * p.y / 100 - mw.clientHeight / 2; };
  if (p && mw) { if (img.complete && img.naturalWidth) center(); else img.addEventListener('load', center, { once: true }); mw.scrollIntoView({ block: 'start' }); window.scrollBy(0, -80); }
}

/* ---------- หน้า เงิน ---------- */
const CATS = [['transport', '🚇 เดินทาง'], ['food', '🍜 อาหาร'], ['coffee', '☕ กาแฟ'], ['water', '💧 น้ำ'], ['other', '🧾 อื่น ๆ']];
const CARDINFO = {
  '': 'ยังไม่รู้ประเภท Travel Card — เลือกประเภทด้านบนเพื่อดูว่าใช้กับ MRT/รถเมล์อย่างไร',
  bank: 'บัตรธนาคารแบบ contactless ที่ออกนอกสิงคโปร์: แตะเข้า-ออกประตู MRT และรถเมล์ได้เลย ไม่ต้องลงทะเบียน · LTA เก็บค่าธรรมเนียม <b>S$0.60 ต่อวันที่ใช้</b> · ค่าแปลงสกุลเงินขึ้นกับผู้ออกบัตร ให้เช็กกับแอปของบัตร · ใช้บัตรใบเดิมแตะเข้าและออกทุกครั้ง',
  wallet: 'Mobile wallet บนมือถือหรือนาฬิกา: LTA ระบุว่าใช้จ่ายค่าโดยสารได้ · ถ้าบัตรในวอลเล็ตออกนอกสิงคโปร์ น่าจะมีค่าธรรมเนียม S$0.60 ต่อวันเหมือนบัตรจริง (LTA เขียนถึงบัตรธนาคารต่างประเทศ ยังไม่ยืนยันกรณีวอลเล็ต) · แบตหมด = ออกจากสถานีไม่ได้',
  ezlink: 'EZ-Link: ซื้อได้ที่ Passenger Service Centre ในสถานีและ SimplyGo Ticket Office · ต้องเติมเงินเข้าบัตรแยกต่างหาก เงินใน Travel Card ไม่ได้ย้ายมาเอง · ยังไม่ได้ตรวจราคาบัตรและขั้นต่ำการเติมปี 2026',
  stp: 'Singapore Tourist Pass: LTA ระบุเป็นตัวเลือกหนึ่ง · ยังไม่ได้ตรวจราคาและเงื่อนไขปี 2026 ดูลิงก์ LTA ด้านล่าง',
  other: 'ประเภทอื่น: ยังไม่มีข้อมูลยืนยัน ลองแตะที่ประตูสถานีแรก ถ้าไม่ผ่านให้ถาม Passenger Service Centre',
};
const num = v => { const n = parseFloat(String(v).replace(/,/g, '')); return isFinite(n) ? n : null; };
const sgd = n => 'S$' + n.toFixed(2);
function pocket(p) {
  const m = S.money, real = num(m[p + 'SGD']), thb = num(m[p + 'THB']), rate = num(m.rate);
  const spent = m.tx.filter(t => t.p === p).reduce((a, t) => a + t.a, 0), n = m.tx.filter(t => t.p === p).length;
  if (real != null) return { base: real, est: false, spent, n };
  if (thb != null && rate) return { base: thb / rate, est: true, spent, n, thb };
  return { base: null, spent, n };
}
function renderMoney() {
  const m = S.money, pc = pocket('card'), ph = pocket('cash');
  const bal = (x, name) => `<div class="card"><div class="mut">${name}</div>${x.base == null ? '<div class="bal">ยังคำนวณไม่ได้</div><div class="mut">กรอกยอดเงินหรืออัตราแลกเปลี่ยนก่อน</div>' :
    `<div class="bal">${x.est ? '≈ ' : ''}${sgd(x.base - x.spent)}</div><div class="mut">${x.est ? `ประมาณจาก ${x.thb.toLocaleString()} บาท ยังไม่ใช่ยอดจริง` : 'จากยอด SGD จริงที่กรอก'} · หักเฉพาะ ${x.n} รายการที่จดไว้ (${sgd(x.spent)})</div>`}</div>`;
  const act$ = c => m.tx.filter(t => t.c === c).reduce((a, t) => a + t.a, 0);
  $('#p-money').innerHTML = `<h2>เงินและค่าใช้จ่าย</h2>
    <p class="mut">ไม่รวมตั๋วเครื่องบิน โรงแรม และบัตร F1 ที่จ่ายแล้ว · ยอดคงเหลือนับเฉพาะรายการที่จดในหน้านี้</p>
    <div class="two">${bal(pc, '💳 Travel Card')}${bal(ph, '💵 เงินสด')}</div>
    <div class="card"><h3>➕ จดรายจ่าย</h3>
      <div class="two"><div><label>จำนวน (SGD)</label><input id="tx-a" type="number" inputmode="decimal" step="0.01" placeholder="0.00"></div>
      <div><label>หมวด</label><select id="tx-c">${CATS.map(c => `<option value="${c[0]}">${c[1]}</option>`).join('')}</select></div></div>
      <label>จ่ายจาก</label><div class="row"><button class="btn sm on" data-act="txp" data-v="card" id="txp-card">💳 บัตร</button><button class="btn sm" data-act="txp" data-v="cash" id="txp-cash">💵 เงินสด</button></div>
      <label>โน้ต (ไม่บังคับ)</label><input id="tx-n" placeholder="เช่น ข้าวมันไก่">
      <div class="row" style="margin-top:10px">${act('txadd', '', 'บันทึก', 'pri')}</div></div>
    <div class="card"><h3>รายการที่จด (${m.tx.length})</h3>
      ${m.tx.length ? m.tx.slice().reverse().map(t => `<div class="tx"><div><b>${sgd(t.a)}</b> ${t.p === 'card' ? '💳' : '💵'} ${(CATS.find(c => c[0] === t.c) || [, ''])[1]}<div class="mut">${esc(t.n || '')} ${t.d}</div></div><button class="btn sm" data-act="txdel" data-v="${t.id}" style="flex:0">ลบ</button></div>`).join('') : '<div class="mut">ยังไม่มีรายการ</div>'}</div>
    <div class="card"><h3>ประมาณการ เทียบกับ ใช้จริง</h3>
      <table><tr><th>หมวด</th><th>ประมาณการ (SGD)</th><th>ใช้จริง</th></tr>
      ${CATS.map(c => `<tr><td>${c[1]}</td><td><input type="number" inputmode="decimal" data-est="${c[0]}" value="${esc(m.est[c[0]] || '')}" placeholder="—" style="min-height:40px"></td><td>${sgd(act$(c[0]))}</td></tr>`).join('')}
      <tr><td><b>รวม</b></td><td><b>${sgd(CATS.reduce((a, c) => a + (num(m.est[c[0]]) || 0), 0))}</b></td><td><b>${sgd(m.tx.reduce((a, t) => a + t.a, 0))}</b></td></tr></table>
      <p class="mut">ช่องประมาณการเว้นว่างไว้ให้กรอกเอง · ค่า MRT ต่อเที่ยวดูได้จาก Fare Calculator ของ LTA</p>${srcs([SRC.fare])}</div>
    <div class="card"><h3>⚙️ ตั้งค่ากระเป๋าเงิน</h3>
      <label>ประเภท Travel Card</label><select data-m="cardType"><option value="">ยังไม่ระบุ</option><option value="bank">บัตรเดบิต/เครดิต/Travel card แบบ contactless (ออกนอกสิงคโปร์)</option><option value="wallet">Mobile wallet (มือถือ/นาฬิกา)</option><option value="ezlink">EZ-Link</option><option value="stp">Singapore Tourist Pass</option><option value="other">อื่น ๆ</option></select>
      <div class="off">${CARDINFO[m.cardType || '']}</div>
      <div class="two"><div><label>เงินในบัตร (บาท)</label><input type="number" inputmode="decimal" data-m="cardTHB" value="${esc(m.cardTHB)}"></div><div><label>เงินสด (บาท)</label><input type="number" inputmode="decimal" data-m="cashTHB" value="${esc(m.cashTHB)}"></div></div>
      <div class="two"><div><label>ยอดจริงในบัตร (SGD)</label><input type="number" inputmode="decimal" data-m="cardSGD" value="${esc(m.cardSGD)}" placeholder="ยังไม่ทราบ"></div><div><label>เงินสดจริง (SGD)</label><input type="number" inputmode="decimal" data-m="cashSGD" value="${esc(m.cashSGD)}" placeholder="ยังไม่ทราบ"></div></div>
      <label>อัตราแลกเปลี่ยน (บาท ต่อ 1 SGD)</label><input type="number" inputmode="decimal" step="0.01" data-m="rate" value="${esc(m.rate)}">
      <p class="mut">ค่าเริ่มต้น 26.25 มาจากเรตกลาง 4 ต.ค. 2026 (1 บาท ≈ 0.0381 SGD) ${badge('tip')} เรตของบัตรและร้านแลกเงินจริงจะต่างจากนี้ กรอกเรตที่ได้จริงแทนได้ · ถ้ากรอกยอด SGD จริง ระบบจะใช้ยอดนั้นแทนการประมาณ</p>
      ${srcs([SRC.rate, SRC.ltaPay])}</div>
    <div class="card"><h3>💵 ร้านไหนควรพกเงินสด</h3><ul>
      <li><b>Ah Tai Chicken Rice (Maxwell Food Centre)</b> — ยังไม่ยืนยันวิธีจ่าย ร้านในศูนย์อาหารส่วนใหญ่รับเงินสดเป็นหลัก ${badge('unk')}</li>
      <li><b>Ng Kuan Chilli Pan Mee</b> — ยังไม่ยืนยันวิธีจ่าย ${badge('unk')}</li>
      <li><b>วัด</b> — ทำบุญ/ธูปเทียนใช้เงินสด ${badge('tip')}</li>
      <li><b>ร้านในสนาม F1</b> — ยังไม่ได้ตรวจว่าปี 2026 รับเงินสดหรือไม่ ${badge('unk')}</li></ul></div>`;
  const ct = $('[data-m="cardType"]'); if (ct) ct.value = m.cardType || '';
}
let txp = 'card';

/* ---------- หน้า เตรียมตัว ---------- */
function renderTips() {
  $('#p-tips').innerHTML = `<h2>ของที่ต้องเตรียม</h2>
    <div class="card">${PACK.map(p => `<div class="row" style="flex-wrap:nowrap;align-items:flex-start;margin:8px 0"><button class="chk ${S.pack[p[0]] ? 'on' : ''}" data-act="pack" data-v="${p[0]}">✓</button><div><b>${p[1]}</b><div class="mut">${p[2]}</div></div></div>`).join('')}</div>
    <h2>คำแนะนำหน้างาน</h2>
    ${TIPS.map(t => `<div class="card"><div class="row sp"><h3>${t[0]}</h3>${badge(t[2])}</div><p>${t[1]}</p><details><summary>แหล่งอ้างอิง</summary>${srcs(t[3])}</details></div>`).join('')}
    <h2>โน้ตส่วนตัว</h2>
    <div class="card"><textarea data-note="general" placeholder="จดอะไรก็ได้ เก็บในเครื่องนี้เท่านั้น" style="min-height:140px">${esc(S.notes.general || '')}</textarea></div>
    <h2>เกี่ยวกับข้อมูลในเว็บนี้</h2>
    <div class="card"><p>ตรวจข้อมูลล่าสุด: <b>${CHECKED}</b> · เวอร์ชันหน้าเว็บ: ${BUILD}</p>
      <p class="mut" id="offl2"></p>
      <p class="mut">ลิงก์ Google Maps และลิงก์แหล่งอ้างอิงต้องใช้อินเทอร์เน็ต · ภาพแผนที่และภาพมุมวิวจะดูตอนไม่มีสัญญาณได้ก็ต่อเมื่อเคยเปิดดูแล้วอย่างน้อยหนึ่งครั้ง</p>
      <p class="mut">เช็กกิจกรรม โน้ต รายจ่าย และภาพที่เพิ่มเอง เก็บในเบราว์เซอร์ของเครื่องนี้เท่านั้น เปลี่ยนเบราว์เซอร์หรือล้างข้อมูลเว็บแล้วจะหาย</p>
      <div class="row">${act('wipe', '', '🗑️ ล้างข้อมูลในเครื่องนี้', 'sm')}</div></div>`;
  offlineLine();
}
function offlineLine() {
  const ready = 'serviceWorker' in navigator && navigator.serviceWorker.controller;
  const txt = (ready ? '✅ เก็บหน้าเว็บไว้ในเครื่องแล้ว เปิดได้แม้ไม่มีสัญญาณ' : '⏳ ยังไม่ได้เก็บไว้ใช้ออฟไลน์ — เปิดเว็บนี้ตอนมีสัญญาณอีกครั้ง') + ` · ข้อมูลอัปเดตล่าสุด ${BUILD}` + (navigator.onLine ? '' : ' · ตอนนี้ออฟไลน์') + (storeOk ? '' : ' · ⚠️ เบราว์เซอร์นี้บันทึกข้อมูลไม่ได้ (โหมดส่วนตัว?)');
  ['#offl', '#offl2'].forEach(q => { const e = $(q); if (e) e.textContent = txt; });
}

/* ---------- navigation / events ---------- */
const R = { now: renderNow, plan: renderPlan, spots: renderSpots, map: renderMap, money: renderMoney, tips: renderTips };
let page = 'now';
function go(p, keepScroll) {
  page = p; document.querySelectorAll('.page').forEach(e => e.classList.toggle('on', e.id === 'p-' + p));
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.p === p));
  R[p](); if (!keepScroll) window.scrollTo(0, 0);
}
function sheet(id) { const r = byId[id]; $('#sheet .in').innerHTML = routeCard(r, true); $('#sheet').classList.add('on'); }
const closeSheet = () => $('#sheet').classList.remove('on');
function scrollToEl(id) { const e = document.getElementById(id); if (e) { e.scrollIntoView({ block: 'start' }); window.scrollBy(0, -130); const d = e.querySelector('details'); if (d) d.open = true; } }

document.addEventListener('click', async ev => {
  const nb = ev.target.closest('nav button'); if (nb) { if (nb.dataset.p === 'plan') S.day = null; go(nb.dataset.p); return; }
  if (ev.target.closest('#lb')) { $('#lb').classList.remove('on'); return; }
  if (ev.target.id === 'sheet' || ev.target.closest('#sheet .x')) { closeSheet(); return; }
  const b = ev.target.closest('[data-act]'); if (!b) return;
  const a = b.dataset.act, v = b.dataset.v;
  if (a === 'done') { S.done[v] = !S.done[v]; save(); const y = window.scrollY; R[page](); window.scrollTo(0, y); }
  else if (a === 'pack') { S.pack[v] = !S.pack[v]; save(); b.classList.toggle('on'); }
  else if (a === 'day') { S.day = v; go('plan'); }
  else if (a === 'page') go(v);
  else if (a === 'goplan') { S.day = byId[v]._d.id; go('plan'); scrollToEl('c-' + v); }
  else if (a === 'sheet') sheet(v);
  else if (a === 'geo') { S.geoOn = true; save(); startGeo(); }
  else if (a === 'geooff') stopGeo();
  else if (a === 'spot') { closeSheet(); fz = 0; fm = ''; go('spots'); scrollToEl('s-' + v); }
  else if (a === 'pin') { closeSheet(); if (page === 'map' && b.classList.contains('pin')) { selPin = v; const mw = $('#mw'), x = mw.scrollLeft, y = mw.scrollTop, wy = window.scrollY; renderMap(); $('#mw').scrollLeft = x; $('#mw').scrollTop = y; window.scrollTo(0, wy); } else focusPin(v); }
  else if (a === 'zoom') { $('#lb img').src = v; $('#lb').classList.add('on'); }
  else if (a === 'zi' || a === 'zo' || a === 'zf') { zoom = a === 'zf' ? 1 : Math.min(5, Math.max(1, zoom + (a === 'zi' ? .75 : -.75))); $('#mi').style.width = zoom * 100 + '%'; }
  else if (a === 'pk') { pk = v; renderMap(); }
  else if (a === 'fz') { fz = +v; renderSpots(); }
  else if (a === 'fm') { fm = v; renderSpots(); }
  else if (a === 'sim') { S.sim = Date.parse(v + ':00+08:00'); S.day = null; save(); renderNow(); window.scrollTo(0, 0); }
  else if (a === 'simset') { const x = $('#simdt').value; if (x) { S.sim = Date.parse(x.slice(0, 16) + ':00+08:00'); S.day = null; save(); renderNow(); window.scrollTo(0, 0); } }
  else if (a === 'simreset') { S.sim = null; save(); renderNow(); }
  else if (a === 'txp') { txp = v; $('#txp-card').classList.toggle('on', v === 'card'); $('#txp-cash').classList.toggle('on', v === 'cash'); }
  else if (a === 'txadd') { const amt = num($('#tx-a').value); if (!amt || amt <= 0) { $('#tx-a').focus(); return; } S.money.tx.push({ id: Date.now(), a: amt, c: $('#tx-c').value, p: txp, n: $('#tx-n').value.trim(), d: `${dayStr(Date.now())} ${hm(Date.now())}` }); save(); txp = 'card'; renderMoney(); }
  else if (a === 'txdel') { S.money.tx = S.money.tx.filter(t => String(t.id) !== v); save(); renderMoney(); }
  else if (a === 'delphoto') { ev.stopPropagation(); if (confirm('ลบภาพนี้?')) { await idbReq('readwrite', s => s.delete(+v)); loadThumbs(); } }
  else if (a === 'wipe') { if (confirm('ล้างเช็กลิสต์ โน้ต รายจ่าย และภาพที่เพิ่มเองทั้งหมดในเครื่องนี้?')) { localStorage.removeItem(KEY); try { await idbReq('readwrite', s => s.clear()); } catch (e) { } location.reload(); } }
});
document.addEventListener('input', ev => {
  const t = ev.target;
  if (t.dataset.note) { S.notes[t.dataset.note] = t.value; save(); }
  else if (t.dataset.est) { S.money.est[t.dataset.est] = t.value; save(); }
});
document.addEventListener('change', async ev => {
  const t = ev.target;
  if (t.dataset.m) { S.money[t.dataset.m] = t.value; save(); const y = window.scrollY; renderMoney(); window.scrollTo(0, y); }
  else if (t.dataset.est) { const y = window.scrollY; renderMoney(); window.scrollTo(0, y); }
  else if (t.dataset.bind === 'sun') { S.sun = t.value; save(); }
  else if (t.dataset.photo && t.files[0]) { try { await idbReq('readwrite', s => s.add({ spot: t.dataset.photo, blob: t.files[0] })); loadThumbs(); } catch (e) { alert('บันทึกภาพไม่ได้ในเบราว์เซอร์นี้'); } }
});

go('now');
if (S.geoOn) startGeo();
setInterval(() => { if (page === 'now' && !$('details[open]', $('#p-now')) && !$('#sheet').classList.contains('on')) renderNow(); }, 30000);
window.addEventListener('online', offlineLine); window.addEventListener('offline', offlineLine);
if ('serviceWorker' in navigator) { navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready).then(() => setTimeout(offlineLine, 800)); navigator.serviceWorker.addEventListener('controllerchange', offlineLine); }

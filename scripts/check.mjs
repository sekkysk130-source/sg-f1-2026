// ตรวจเวลาทางการ Singapore GP 2026 แล้วเขียน official.json + แจ้งเตือนผ่าน ntfy (ถ้าตั้ง NTFY_TOPIC)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const TOPIC = process.env.NTFY_TOPIC || '';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';
const now = Date.now();
if (now > Date.parse('2026-10-13T00:00:00+08:00')) { console.log('trip over'); process.exit(0); }

// id ในแพลน → แหล่งข้อมูล + เวลาทางการตั้งต้น (ณ 5 ต.ค. 2026)
const EV = {
  'd1-cortis': { t: 'CORTIS', p: 'Padang Stage', d: '2026-10-09', bs: '19:30', be: '20:20', slug: '2026-cortis-r1' },
  'd1-sq': { t: 'F1 Sprint Qualifying', p: '', d: '2026-10-09', bs: '20:30', be: '21:14', f1: 'Sprint Qualifying' },
  'd2-ff': { t: 'F1 Drivers’ Fan Forum', p: 'Wharf Stage (Zone 1)', d: '2026-10-10', bs: '15:10', be: '15:40', slug: '2026-fan-forum-f1-drivers-r2' },
  'd2-sprint': { t: 'F1 Sprint', p: '', d: '2026-10-10', bs: '17:00', be: '17:30', f1: 'Sprint' },
  'd2-zara': { t: 'ZARA LARSSON', p: 'Padang Stage', d: '2026-10-10', bs: '18:45', be: '19:45', slug: '2026-zara-larsson-r1' },
  'd2-hyo': { t: 'HYO', p: 'Waterside', d: '2026-10-10', bs: '20:05', be: '20:50', slug: '2026-hyo-r1' },
  'd2-q': { t: 'F1 Qualifying', p: '', d: '2026-10-10', bs: '21:00', be: '22:00', f1: 'Qualifying' },
  'd2-killers': { t: 'THE KILLERS', p: 'Padang Stage', d: '2026-10-10', bs: '22:30', be: '23:45', slug: '2026-the-killers-r1' },
  'd3-race': { t: 'F1 Singapore Grand Prix', p: '', d: '2026-10-11', bs: '20:00', be: '22:00', f1: 'Race' },
  'd3-lana': { t: 'LANA DEL REY', p: 'Padang Stage', d: '2026-10-11', bs: '22:25', be: '23:55', slug: '2026-lana-del-rey-r1' },
  // ไม่มีแหล่งข้อมูลอัตโนมัติ — ใช้เตือนล่วงหน้าตามเวลาตั้งต้นเท่านั้น
  'd2-flyer': { t: 'Singapore Flyer (เปิด 14:15)', p: 'Zone 2', d: '2026-10-10', bs: '14:15', be: '15:00', fixed: true },
  'd3-porsche': { t: 'Porsche Carrera Cup Asia Race 2', p: '', d: '2026-10-11', bs: '15:40', be: '16:15', fixed: true },
  'd3-parade': { t: 'F1 Drivers’ Parade', p: '', d: '2026-10-11', bs: '18:00', be: '18:30', fixed: true },
};
const add = (hm, m) => { const [h, mi] = hm.split(':').map(Number); const x = ((h * 60 + mi + m) % 1440 + 1440) % 1440; return String(Math.floor(x / 60)).padStart(2, '0') + ':' + String(x % 60).padStart(2, '0'); };
const diff = (a, b) => { const f = x => { const [h, m] = x.split(':').map(Number); return h * 60 + m; }; return f(b) - f(a); };
const sgt = iso => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Singapore', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
const sgDate = iso => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore' }).format(new Date(iso));

const prev = existsSync('official.json') ? JSON.parse(readFileSync('official.json', 'utf8')) : { ev: {}, rem: [], ok: {} };
const out = { checked: new Date(now).toISOString(), ok: { ent: false, f1: false }, ev: {}, rem: prev.rem || [], log: prev.log || [] };
for (const [id, e] of Object.entries(EV)) out.ev[id] = prev.ev[id] ? { ...prev.ev[id] } : { s: e.bs, e: e.be, bs: e.bs, be: e.be };

async function get(url) { const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html,application/json' }, redirect: 'follow', signal: AbortSignal.timeout(25000) }); if (!r.ok) throw new Error(url + ' -> ' + r.status); return r.text(); }

try { // เวทีคอนเสิร์ต / Fan Forum จากเว็บทางการ
  const html = await get('https://singaporegp.sg/en/entertainment/');
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/); if (!m) throw new Error('no next data');
  const rows = {}; (function w(o) { if (Array.isArray(o)) return o.forEach(w); if (o && typeof o === 'object') { if (o.slug && o.start_time && o.end_time && o.date) rows[o.slug] = o; Object.values(o).forEach(w); } })(JSON.parse(m[1]));
  let hit = 0;
  for (const [id, e] of Object.entries(EV)) { if (!e.slug) continue; const r = rows[e.slug]; if (!r) { console.log('missing slug', e.slug); continue; } hit++;
    if (r.date !== e.d) { out.ev[id].note = 'ย้ายวันเป็น ' + r.date; } out.ev[id].s = r.start_time.slice(0, 5); out.ev[id].e = r.end_time.slice(0, 5); }
  out.ok.ent = hit >= 4; console.log('ent ok', hit);
} catch (e) { console.log('ent fail', e.message); }

try { // เซสชัน F1 จาก OpenF1
  const js = JSON.parse(await get('https://api.openf1.org/v1/sessions?year=2026&country_name=Singapore'));
  let hit = 0;
  for (const [id, e] of Object.entries(EV)) { if (!e.f1) continue; const s = js.find(x => x.session_name === e.f1); if (!s || !s.date_start) continue; hit++;
    const st = sgt(s.date_start); if (sgDate(s.date_start) !== e.d) out.ev[id].note = 'ย้ายวันเป็น ' + sgDate(s.date_start);
    out.ev[id].s = st; out.ev[id].e = add(e.be, diff(e.bs, st)); }
  out.ok.f1 = hit >= 3; console.log('f1 ok', hit);
} catch (e) { console.log('f1 fail', e.message); }

const msgs = [];
for (const [id, e] of Object.entries(EV)) { const a = prev.ev[id], b = out.ev[id]; if (a && (a.s !== b.s || a.e !== b.e)) { const line = `${e.t}: ${a.s}–${a.e} → ${b.s}–${b.e}`; msgs.push({ title: '⏰ เวลาทางการเปลี่ยน', body: line + ' · แพลนในเว็บเลื่อนตามให้แล้ว', pr: 'high' }); out.log.push({ at: out.checked, id, from: `${a.s}–${a.e}`, to: `${b.s}–${b.e}` }); } }
// เตือนล่วงหน้า ~30 นาที (รอบตรวจทุก ~10 นาที จึงคลาดได้)
for (const [id, e] of Object.entries(EV)) { const st = Date.parse(`${e.d}T${out.ev[id].s}:00+08:00`), mins = Math.round((st - now) / 60000); if (mins > 0 && mins <= 40 && !out.rem.includes(id)) { out.rem.push(id); msgs.push({ title: `🔔 อีก ~${mins} นาที: ${e.t}`, body: `เริ่ม ${out.ev[id].s}${e.p ? ' · ' + e.p : ''}`, pr: 'default' }); } }
out.log = out.log.slice(-20);

for (const m of msgs) { console.log('notify', m.title, m.body); if (TOPIC) try { await fetch('https://ntfy.sh/' + TOPIC, { method: 'POST', body: m.body, headers: { Title: encodeURIComponent(m.title) === m.title ? m.title : '=?UTF-8?B?' + Buffer.from(m.title).toString('base64') + '?=', Priority: m.pr, Tags: 'checkered_flag', Click: 'https://sekkysk130-source.github.io/sg-f1-2026/' } }); } catch (e) { console.log('ntfy fail', e.message); } }

// เขียนไฟล์เมื่อมีอะไรเปลี่ยน หรือครบ ~50 นาทีจากครั้งก่อน (ให้เว็บรู้ว่าระบบยังตรวจอยู่)
const same = JSON.stringify({ e: prev.ev, r: prev.rem, o: prev.ok }) === JSON.stringify({ e: out.ev, r: out.rem, o: out.ok });
if (!same || !prev.checked || now - Date.parse(prev.checked) > 50 * 60000) { writeFileSync('official.json', JSON.stringify(out, null, 1) + '\n'); console.log('written'); } else console.log('no change');

/* ============================================
   BECCA V2.0 — Weekly Digest Module
   Auto-generated weekly business summary, ready to share via WhatsApp.
   Trigger: configured day & hour each week, manual via dashboard button.
============================================ */
const WeeklyDigest = (() => {

  const CFG_KEY = 'becca_weekly_digest_cfg';
  const LAST_KEY = 'becca_weekly_digest_last_shown';

  const DAYS_ID = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];

  const DEFAULT_CFG = {
    enabled: true,
    dayOfWeek: 1,         // 1 = Monday
    hour: 8,
    ownerPhone: '',
    sections: {
      keuangan: true,
      operasional: true,
      perhatian: true,
      anomali: true,
      top: true,
    },
  };

  function getCfg() {
    try {
      const stored = JSON.parse(localStorage.getItem(CFG_KEY) || '{}');
      return { ...DEFAULT_CFG, ...stored, sections: { ...DEFAULT_CFG.sections, ...(stored.sections || {}) } };
    } catch { return { ...DEFAULT_CFG }; }
  }

  function saveCfg(cfg) {
    localStorage.setItem(CFG_KEY, JSON.stringify(cfg || {}));
  }

  /* ─── DATE HELPERS ─── */
  function _fmtDate(d) {
    return d.toLocaleDateString('id-ID', { day:'2-digit', month:'short' });
  }
  function _fmtDateLong(d) {
    return d.toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' });
  }
  function _isoWeek(d) {
    const x = new Date(d);
    x.setHours(0,0,0,0);
    x.setDate(x.getDate() + 4 - (x.getDay() || 7));
    const y0 = new Date(x.getFullYear(),0,1);
    return Math.ceil((((x - y0) / 86400000) + 1) / 7);
  }
  function _inRange(date, start, end) {
    const t = new Date(date).getTime();
    return Number.isFinite(t) && t >= start && t < end;
  }
  function _rp(n) {
    return Utils.formatRupiah(Math.round(+n||0), true).replace('Rp ', 'Rp ');
  }

  /* ─── DATA AGGREGATION ─── */
  async function _loadData() {
    const safe = (p) => p.then(r => r || []).catch(() => []);
    const [kas, invoices, ap, items, logs, forms, bpDocs] = await Promise.all([
      DB.getCached('kas')         || safe(DB.getKas()),
      DB.getCached('invoices')    || safe(DB.getInvoices()),
      DB.getCached('ap')          || safe(DB.getAP()),
      DB.getCached('inv_products')|| safe(DB.getInventoryItems()),
      DB.getCached('inventory')   || safe(DB.getInventory()),
      DB.getCached('daily_orders')|| (typeof DB.getDailyOrderForms === 'function' ? safe(DB.getDailyOrderForms()) : []),
      DB.getCached('belanja_pasar')|| (typeof DB.getBelanjaPasar === 'function' ? safe(DB.getBelanjaPasar()) : []),
    ]);
    return { kas, invoices, ap, items, logs, forms, bpDocs };
  }

  /* ─── SECTION BUILDERS ─── */
  function _buildKeuangan(data, thisStart, thisEnd, lastStart) {
    const _date = (i) => i.tglInvoice || i.tgl_invoice || i.periodeAkhir || i.tgl || i.created_at;
    const revThis = data.invoices.filter(i => _inRange(_date(i), thisStart.getTime(), thisEnd.getTime()))
      .reduce((s,i) => s + (+i.total||0), 0);
    const revLast = data.invoices.filter(i => _inRange(_date(i), lastStart.getTime(), thisStart.getTime()))
      .reduce((s,i) => s + (+i.total||0), 0);
    const expThis = data.kas.filter(k => k.type !== 'Kas' && _inRange(k.tgl, thisStart.getTime(), thisEnd.getTime()))
      .reduce((s,k) => s + (+k.jumlah||0), 0);
    const profit = revThis - expThis;
    const margin = revThis > 0 ? Math.round((profit / revThis) * 100) : 0;
    const pctChg = revLast > 0 ? Math.round(((revThis - revLast) / revLast) * 100) : null;

    // Saldo kas saat ini (mirror dari localStorage kalau tersedia)
    const saldoLs = parseFloat(localStorage.getItem('becca_kas_balance'));
    const saldo = !isNaN(saldoLs) ? saldoLs : null;

    // Cash flow 7 hari ke depan: invoices yg jatuh tempo & belum lunas
    const next7End = thisEnd.getTime() + 7 * 86400000;
    const inflow7 = data.invoices
      .filter(i => i.status !== 'LUNAS' && i.status !== 'Paid')
      .filter(i => {
        const due = i.tglJatuhTempo || i.tgl_jatuh_tempo || i.tglDue;
        if (!due) return false;
        const t = new Date(due).getTime();
        return t >= thisEnd.getTime() && t <= next7End;
      })
      .reduce((s,i) => s + ((+i.total||0) - (+i.totalTerbayar||0)), 0);

    const lines = [];
    lines.push(`Revenue: ${_rp(revThis)}${pctChg !== null ? ' ' + (pctChg >= 0 ? '▲' : '▼') + ' ' + Math.abs(pctChg) + '%' : ''}`);
    lines.push(`Pengeluaran: ${_rp(expThis)}`);
    lines.push(`Profit estimasi: ${_rp(profit)} (margin ${margin}%)`);
    if (saldo !== null) lines.push(`Saldo Kas Kecil: ${_rp(saldo)}`);
    if (inflow7 > 0) lines.push(`Cash Flow 7 hari: +${_rp(inflow7)} (invoice jatuh tempo)`);
    return { title: '💰 *KEUANGAN*', lines };
  }

  function _buildOperasional(data, thisStart, thisEnd) {
    const startMs = thisStart.getTime(), endMs = thisEnd.getTime();
    const formsThisWk = data.forms.filter(f => _inRange(f.tanggal || f.createdAt, startMs, endMs));
    const formsFinal = formsThisWk.filter(f => f.status === 'final').length;
    const totalPax = formsThisWk.reduce((s,f) => s + (f.items?.reduce((ss,i) => ss + (+i.aktQty||0), 0) || 0), 0);

    const bpThisWk = data.bpDocs.filter(d => d.status === 'selesai' && _inRange(d.createdAt || d.tglDibuat, startMs, endMs));
    const bpValue = bpThisWk.reduce((s,d) => s + ((d.kasItems || d.items || []).reduce((ss,it) => ss + ((+it.aktTotal||0) || ((+it.aktQty||0)*(+it.aktHarga||0))), 0)), 0);
    const bpConfirmed = bpThisWk.filter(d => d.kasStatus === 'confirmed').length;

    const pendingSync = data.forms.filter(f => {
      const t = new Date(f.tanggal || '').getTime();
      if (!Number.isFinite(t) || t > endMs || t < endMs - 7 * 86400000) return false;
      return (f.items||[]).some(it => +it.aktQty > 0) && f.status !== 'synced';
    }).length;

    const lines = [];
    if (totalPax > 0) lines.push(`Total order: ${totalPax.toLocaleString('id-ID')} pax`);
    lines.push(`Form Produksi: ${formsThisWk.length} shift (${formsFinal} final)`);
    if (bpThisWk.length) lines.push(`Belanja Pasar: ${bpThisWk.length} dokumen (${_rp(bpValue)}, ${bpConfirmed} confirmed)`);
    lines.push(pendingSync > 0 ? `⚠ Sync Inventory pending: ${pendingSync} form` : `Sync Inventory: ✓ tidak ada pending`);
    return { title: '🍽️ *OPERASIONAL*', lines };
  }

  function _buildPerhatian(data, now) {
    const lines = [];
    // Invoice overdue >14 hari
    const overdueInvs = data.invoices
      .filter(i => i.status !== 'LUNAS' && i.status !== 'Paid')
      .map(i => {
        const due = i.tglJatuhTempo || i.tgl_jatuh_tempo || i.tglDue;
        if (!due) return null;
        const days = Math.floor((now.getTime() - new Date(due).getTime()) / 86400000);
        if (days < 14) return null;
        return { customer: i.customer, total: (+i.total||0)-(+i.totalTerbayar||0), days };
      })
      .filter(Boolean)
      .sort((a,b) => b.days - a.days)
      .slice(0, 5);
    if (overdueInvs.length) {
      lines.push(`${overdueInvs.length} invoice overdue >14 hari:`);
      overdueInvs.slice(0, 3).forEach(i => lines.push(`  – ${i.customer || '?'} (${_rp(i.total)}, ${i.days} hari)`));
    }

    // AP near due (next 7 days)
    const next7 = now.getTime() + 7 * 86400000;
    const apNearDue = data.ap
      .filter(a => a.status !== 'LUNAS')
      .map(a => {
        const due = a.tglJatuhTempo || a.tgl_jatuh_tempo;
        if (!due) return null;
        const t = new Date(due).getTime();
        if (t < now.getTime() || t > next7) return null;
        return { supplier: a.supplier || a.vendor, total: (+a.total||0), due: due.slice(0,10) };
      })
      .filter(Boolean)
      .sort((a,b) => a.due.localeCompare(b.due))
      .slice(0, 3);
    if (apNearDue.length) {
      lines.push(`${apNearDue.length} AP mendekati jatuh tempo:`);
      apNearDue.forEach(a => lines.push(`  – ${a.supplier || '?'} (${_rp(a.total)}, due ${a.due.split('-').reverse().join('/')})`));
    }

    // Stok menipis
    const lowStock = data.items
      .filter(p => (+(p.balance||p._stok)||0) <= (+p.stokMin||0) && (+p.stokMin > 0))
      .slice(0, 5);
    if (lowStock.length) {
      lines.push(`Stok menipis: ${lowStock.length} item perlu PO (${lowStock.slice(0,5).map(p => p.nama).join(', ')})`);
    }

    if (!lines.length) lines.push('✓ Tidak ada item yang perlu perhatian khusus');
    return { title: '⚠️ *PERLU PERHATIAN*', lines };
  }

  function _buildAnomali(data, thisStart, thisEnd, lastStart) {
    const lines = [];

    // Harga MASUK naik per item (week vs week)
    const startMs = thisStart.getTime(), endMs = thisEnd.getTime(), lastMs = lastStart.getTime();
    const priceChanges = {};
    data.logs.filter(l => l.jenis === 'MASUK' && +l.harga > 0).forEach(l => {
      const t = new Date(l.tgl).getTime();
      const item = l.itemNama || '';
      if (!item) return;
      if (!priceChanges[item]) priceChanges[item] = { thisAvg: [], lastAvg: [] };
      if (t >= startMs && t < endMs) priceChanges[item].thisAvg.push(+l.harga);
      else if (t >= lastMs && t < startMs) priceChanges[item].lastAvg.push(+l.harga);
    });
    const priceAlerts = Object.entries(priceChanges).map(([nama, p]) => {
      if (!p.thisAvg.length || !p.lastAvg.length) return null;
      const a = p.thisAvg.reduce((s,v)=>s+v,0)/p.thisAvg.length;
      const b = p.lastAvg.reduce((s,v)=>s+v,0)/p.lastAvg.length;
      const pct = Math.round(((a - b) / b) * 100);
      if (Math.abs(pct) < 5) return null;
      return { nama, from: b, to: a, pct };
    }).filter(Boolean).sort((a,b) => Math.abs(b.pct) - Math.abs(a.pct)).slice(0, 3);
    priceAlerts.forEach(a => {
      const arrow = a.pct > 0 ? 'naik' : 'turun';
      lines.push(`Harga *${a.nama}* ${arrow} ${Math.abs(a.pct)}% (${_rp(a.from)} → ${_rp(a.to)})`);
    });

    // Customer baru bulan ini
    const newCust = new Set();
    const thisMonth = new Date(thisEnd.getFullYear(), thisEnd.getMonth(), 1).getTime();
    const custFirst = {};
    data.invoices.forEach(i => {
      const nama = (i.customer || '').trim();
      if (!nama) return;
      const t = new Date(i.tglInvoice || i.tgl || 0).getTime();
      if (!Number.isFinite(t)) return;
      if (!custFirst[nama] || t < custFirst[nama]) custFirst[nama] = t;
    });
    Object.entries(custFirst).forEach(([nama, t]) => { if (t >= thisMonth) newCust.add(nama); });
    if (newCust.size) lines.push(`Customer baru: ${[...newCust].slice(0,3).join(', ')}${newCust.size > 3 ? '...' : ''}`);

    // Churn risk
    const ms60 = 60 * 86400000;
    const lastByCust = {};
    data.invoices.forEach(i => {
      const nama = (i.customer || '').trim();
      if (!nama) return;
      const t = new Date(i.tglInvoice || i.tgl || 0).getTime();
      if (!Number.isFinite(t)) return;
      if (!lastByCust[nama] || t > lastByCust[nama]) lastByCust[nama] = t;
    });
    const churn = Object.entries(lastByCust)
      .filter(([_, t]) => endMs - t > ms60 && endMs - t < 2 * ms60)
      .map(([nama, t]) => ({ nama, days: Math.floor((endMs - t) / 86400000) }))
      .sort((a,b) => a.days - b.days)
      .slice(0, 2);
    if (churn.length) lines.push(`Churn risk: ${churn.map(c => `${c.nama} (${c.days}d)`).join(', ')}`);

    if (!lines.length) lines.push('✓ Tidak ada anomali signifikan minggu ini');
    return { title: '📈 *ANOMALI*', lines };
  }

  function _buildTop(data, thisStart, thisEnd) {
    const lines = [];
    const startMs = thisStart.getTime(), endMs = thisEnd.getTime();
    const _date = (i) => i.tglInvoice || i.tgl_invoice || i.periodeAkhir || i.tgl;

    // Top 3 customer by revenue this week
    const custRev = {};
    data.invoices
      .filter(i => _inRange(_date(i), startMs, endMs))
      .forEach(i => {
        const nama = (i.customer || '').trim();
        if (!nama) return;
        custRev[nama] = (custRev[nama] || { total: 0, count: 0 });
        custRev[nama].total += +i.total || 0;
        custRev[nama].count++;
      });
    const top3 = Object.entries(custRev)
      .sort((a,b) => b[1].total - a[1].total)
      .slice(0, 3);
    if (top3.length) {
      lines.push('*Top Customer minggu ini:*');
      top3.forEach(([nama, d], i) => lines.push(`  ${i+1}. ${nama} — ${_rp(d.total)} (${d.count} invoice)`));
    }

    return { title: '🏆 *TOP PERFORMER*', lines };
  }

  /* ─── MESSAGE FORMATTER ─── */
  async function generate(cfgOverride) {
    const cfg = cfgOverride || getCfg();
    const data = await _loadData();

    const now  = new Date(); now.setHours(0,0,0,0);
    const thisEnd = new Date(now); thisEnd.setHours(23,59,59,999);
    const thisStart = new Date(thisEnd); thisStart.setDate(thisStart.getDate() - 6);
    thisStart.setHours(0,0,0,0);
    const lastStart = new Date(thisStart); lastStart.setDate(lastStart.getDate() - 7);

    const sections = [];
    if (cfg.sections.keuangan)    sections.push(_buildKeuangan(data, thisStart, thisEnd, lastStart));
    if (cfg.sections.operasional) sections.push(_buildOperasional(data, thisStart, thisEnd));
    if (cfg.sections.perhatian)   sections.push(_buildPerhatian(data, now));
    if (cfg.sections.anomali)     sections.push(_buildAnomali(data, thisStart, thisEnd, lastStart));
    if (cfg.sections.top)         sections.push(_buildTop(data, thisStart, thisEnd));

    const periodLabel = `${_fmtDate(thisStart)} – ${_fmtDate(thisEnd)} ${thisEnd.getFullYear()}`;
    const wkNum = _isoWeek(thisEnd);
    const SEP = '━━━━━━━━━━━━━━━━━━━';

    let msg = `📊 *Weekly Digest BPS*\n${periodLabel} (Minggu ke-${wkNum})\n\n${SEP}\n\n`;
    sections.forEach(s => {
      msg += `${s.title}\n`;
      s.lines.forEach(l => { msg += `• ${l}\n`; });
      msg += '\n';
    });
    msg += `${SEP}\n🤖 _Auto-generated · BECCA V2.0_\n_Lihat detail: ${location.host || 'becca-catering.vercel.app'}_`;
    return msg;
  }

  /* ─── MODAL ─── */
  async function openModal() {
    const mid = 'wd-modal-' + (Utils.uid?.() || Date.now());
    window._wdMid = mid;

    Modal.open({
      id: mid,
      title: '📊 Weekly Digest',
      size: 'modal-md',
      body: `<div style="text-align:center;padding:32px;color:var(--text-3)">⏳ Menyiapkan ringkasan...</div>`,
      footer: `<button class="btn btn-ghost" onclick="Modal.close('${mid}')">Tutup</button>`,
    });

    let message = '';
    try { message = await generate(); }
    catch (e) {
      const body = document.querySelector(`[data-modal-id="${mid}"] .modal-body`) || document.querySelector(`#${mid} .modal-body`);
      if (body) body.innerHTML = `<div style="padding:24px;color:#ef4444;text-align:center">❌ Gagal generate digest: ${e.message}</div>`;
      return;
    }

    const cfg = getCfg();
    const phone = cfg.ownerPhone || '';

    Modal.close(mid);
    Modal.open({
      id: mid,
      title: '📊 Weekly Digest',
      size: 'modal-md',
      body: `
        <div style="margin-bottom:10px;font-size:11px;color:var(--text-3)">
          Preview pesan yang akan dikirim. Edit teks bebas sebelum kirim.
        </div>
        <textarea id="wd-msg" style="width:100%;min-height:380px;font:12px/1.5 var(--font-mono),monospace;
          padding:12px;border:1px solid var(--border);border-radius:8px;
          background:var(--surface);color:var(--text);resize:vertical;white-space:pre-wrap">${message.replace(/</g,'&lt;')}</textarea>
        <div style="margin-top:10px;display:flex;align-items:center;gap:8px">
          <label style="font-size:12px;color:var(--text-2)">No WA Owner:</label>
          <input id="wd-phone" value="${phone}" placeholder="08xxx atau 628xxx"
            style="flex:1;padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);font-size:12px">
        </div>
        <div style="margin-top:8px;font-size:10px;color:var(--text-3)">
          💡 Bisa kirim ke nomor lain ad-hoc tanpa override config. Kosongkan = pilih kontak saat WA terbuka.
        </div>`,
      footer: `
        <button class="btn btn-ghost" onclick="Modal.close('${mid}')">Tutup</button>
        <button class="btn btn-ghost" onclick="WeeklyDigest._copy()" style="color:var(--primary)">📋 Salin Teks</button>
        <button class="btn btn-primary" onclick="WeeklyDigest._sendWA()" style="background:#25D366;border-color:#25D366">📲 Kirim ke WhatsApp</button>`,
    });
  }

  function _copy() {
    const ta = document.getElementById('wd-msg');
    if (!ta) return;
    ta.select();
    try {
      navigator.clipboard.writeText(ta.value);
      Notify.success('Teks disalin ke clipboard ✓');
    } catch {
      document.execCommand('copy');
      Notify.success('Teks disalin');
    }
  }

  function _sendWA() {
    const ta = document.getElementById('wd-msg');
    const phoneEl = document.getElementById('wd-phone');
    if (!ta) return;
    const msg = ta.value;
    const phone = (phoneEl?.value || '').trim();
    const ok = Utils.waShare ? Utils.waShare(phone, msg) : (() => {
      const url = phone
        ? `https://wa.me/${(Utils.normalizePhone ? Utils.normalizePhone(phone) : phone)}?text=${encodeURIComponent(msg)}`
        : `https://wa.me/?text=${encodeURIComponent(msg)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
      return true;
    })();
    if (ok) {
      // Mark digest as shown today
      localStorage.setItem(LAST_KEY, String(Date.now()));
      if (window._wdMid) Modal.close(window._wdMid);
      Notify.success('WhatsApp terbuka — kirim pesan dari sana');
    } else {
      Notify.error('Gagal buka WhatsApp');
    }
  }

  /* ─── AUTO-TRIGGER (called dari app boot) ─── */
  function shouldTrigger() {
    const cfg = getCfg();
    if (!cfg.enabled) return false;
    const now = new Date();
    if (now.getDay() !== cfg.dayOfWeek) return false;
    if (now.getHours() < cfg.hour) return false;
    const lastShown = +localStorage.getItem(LAST_KEY) || 0;
    const today = new Date(now); today.setHours(0,0,0,0);
    if (lastShown >= today.getTime()) return false;
    return true;
  }

  function checkAndShow() {
    if (!shouldTrigger()) return;
    setTimeout(() => openModal(), 1500); // beri waktu app fully load
  }

  /* ─── SETTINGS UI HELPER ─── */
  function renderSettingsCard() {
    const cfg = getCfg();
    return `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:14px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
          <span style="font-size:18px">📊</span>
          <div style="flex:1">
            <div style="font-weight:700;font-size:13px">Weekly Digest</div>
            <div style="font-size:11px;color:var(--text-3)">Ringkasan mingguan otomatis ke WhatsApp owner</div>
          </div>
          <label style="display:inline-flex;align-items:center;cursor:pointer">
            <input type="checkbox" id="wd-cfg-enabled" ${cfg.enabled?'checked':''}
              onchange="WeeklyDigest._setEnabled(this.checked)"
              style="width:38px;height:22px;cursor:pointer;accent-color:#22c55e">
          </label>
        </div>
        <div id="wd-cfg-detail" style="${cfg.enabled?'':'opacity:.4;pointer-events:none'};display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:8px">
          <div>
            <label style="font-size:11px;color:var(--text-3);font-weight:600;text-transform:uppercase;letter-spacing:.04em">Hari Kirim</label>
            <select id="wd-cfg-day" onchange="WeeklyDigest._setField('dayOfWeek',+this.value)"
              style="width:100%;padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface2);font-size:12px;margin-top:3px">
              ${DAYS_ID.map((d,i) => `<option value="${i}" ${cfg.dayOfWeek===i?'selected':''}>${d}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="font-size:11px;color:var(--text-3);font-weight:600;text-transform:uppercase;letter-spacing:.04em">Jam (24h)</label>
            <select id="wd-cfg-hour" onchange="WeeklyDigest._setField('hour',+this.value)"
              style="width:100%;padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface2);font-size:12px;margin-top:3px">
              ${Array.from({length:24},(_,h) => `<option value="${h}" ${cfg.hour===h?'selected':''}>${String(h).padStart(2,'0')}:00</option>`).join('')}
            </select>
          </div>
          <div style="grid-column:span 2">
            <label style="font-size:11px;color:var(--text-3);font-weight:600;text-transform:uppercase;letter-spacing:.04em">No WA Owner</label>
            <input id="wd-cfg-phone" value="${cfg.ownerPhone||''}" placeholder="08xxx atau 628xxx"
              onblur="WeeklyDigest._setField('ownerPhone',this.value.trim())"
              style="width:100%;padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface2);font-size:12px;margin-top:3px">
          </div>
          <div style="grid-column:span 2">
            <label style="font-size:11px;color:var(--text-3);font-weight:600;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px;display:block">Section yang Ditampilkan</label>
            <div style="display:flex;flex-wrap:wrap;gap:6px">
              ${[
                ['keuangan','💰 Keuangan'],
                ['operasional','🍽️ Operasional'],
                ['perhatian','⚠️ Perlu Perhatian'],
                ['anomali','📈 Anomali'],
                ['top','🏆 Top Performer'],
              ].map(([k,l]) => `
                <label style="display:inline-flex;align-items:center;gap:5px;padding:5px 10px;background:${cfg.sections[k]?'rgba(99,102,241,.1)':'var(--surface2)'};border:1px solid ${cfg.sections[k]?'rgba(99,102,241,.3)':'var(--border)'};border-radius:6px;cursor:pointer;font-size:11px;font-weight:500">
                  <input type="checkbox" ${cfg.sections[k]?'checked':''} onchange="WeeklyDigest._setSection('${k}',this.checked)" style="width:14px;height:14px;cursor:pointer">
                  ${l}
                </label>`).join('')}
            </div>
          </div>
        </div>
        <div style="margin-top:12px;display:flex;gap:8px">
          <button onclick="WeeklyDigest.openModal()" class="btn btn-primary" style="flex:1;padding:8px 14px;font-size:12px">📊 Lihat Digest Sekarang</button>
        </div>
      </div>`;
  }

  function _setEnabled(v) {
    const cfg = getCfg();
    cfg.enabled = !!v;
    saveCfg(cfg);
    const detail = document.getElementById('wd-cfg-detail');
    if (detail) {
      detail.style.opacity = v ? '' : '.4';
      detail.style.pointerEvents = v ? '' : 'none';
    }
  }
  function _setField(key, val) {
    const cfg = getCfg(); cfg[key] = val; saveCfg(cfg);
  }
  function _setSection(key, val) {
    const cfg = getCfg(); cfg.sections[key] = !!val; saveCfg(cfg);
    // Re-render the section card supaya label badge update
    const card = document.getElementById('wd-cfg-detail');
    if (card?.parentElement) {
      const wrap = card.closest('div[style*="border-radius:10px"]');
      if (wrap?.parentElement) {
        const html = renderSettingsCard();
        const tmp = document.createElement('div'); tmp.innerHTML = html;
        wrap.replaceWith(tmp.firstElementChild);
      }
    }
  }

  return { getCfg, saveCfg, generate, openModal, checkAndShow, shouldTrigger,
           renderSettingsCard, _copy, _sendWA, _setEnabled, _setField, _setSection };
})();
window.WeeklyDigest = WeeklyDigest;

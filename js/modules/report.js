/* ============================================
   BECCA V2.0 — Report Module
============================================ */
const ReportModule = (() => {
  // Module-level state for Profitability tab (sort + cached data)
  let _profitData = null;
  let _profitSort = { key: 'ltv', dir: 'desc' };

  async function init() {
    const page = document.getElementById('page-report');
    page.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h2>Laporan</h2>
          <p>Ringkasan laporan operasional BPS</p>
        </div>
      </div>
      <div class="tabs">
        <button class="tab-btn active" data-tab="trend"    onclick="ReportModule.switchTab('trend')">📈 Trend 12 Bulan</button>
        <button class="tab-btn"        data-tab="profit"   onclick="ReportModule.switchTab('profit')">💎 Profitability</button>
        <button class="tab-btn"        data-tab="kas"      onclick="ReportModule.switchTab('kas')">💰 Laporan Kas</button>
        <button class="tab-btn"        data-tab="order"    onclick="ReportModule.switchTab('order')">📋 Laporan Order</button>
        <button class="tab-btn"        data-tab="karyawan" onclick="ReportModule.switchTab('karyawan')">👷 Laporan Karyawan</button>
      </div>
      <div id="rpt-trend"></div>
      <div id="rpt-profit"   class="hidden"></div>
      <div id="rpt-kas"      class="hidden"></div>
      <div id="rpt-order"    class="hidden"></div>
      <div id="rpt-karyawan" class="hidden"></div>
    `;
    switchTab('trend');
  }

  function switchTab(tab) {
    ['trend','profit','kas','order','karyawan'].forEach(t => {
      document.getElementById(`rpt-${t}`)?.classList.toggle('hidden', t !== tab);
      document.querySelector(`[data-tab="${t}"]`)?.classList.toggle('active', t === tab);
    });
    const renders = { trend: renderTrend, profit: renderProfitability, kas: renderKas, order: renderOrder, karyawan: renderKaryawan };
    renders[tab]?.();
  }

  async function renderKas() {
    const [kas, _cfg] = await Promise.all([DB.getKas().catch(()=>[]), DB.getSettings().catch(()=>({}))]);

    // Masuk: kas rows type="Kas" (import Excel / entry manual di tabel utama)
    const totalMasuk  = kas.filter(r=>r.type==='Kas').reduce((s,r) => s+(r.jumlah||0), 0);
    // Keluar: semua kas rows kecuali type="Kas"
    const totalKeluar = kas.filter(r=>r.type!=='Kas').reduce((s,r) => s+(r.jumlah||0), 0);
    // Saldo Awal: ambil dari Supabase settings (sync semua device), fallback localStorage
    const saldoAwal = parseFloat((_cfg && _cfg.saldoAwal) ?? localStorage.getItem('becca_kas_saldo_awal') ?? '0') || 0;
    const saldo = saldoAwal + totalMasuk - totalKeluar;

    // Pengeluaran per kategori — exclude type="Kas" (itu masuk, bukan keluar)
    const byType = {};
    kas.filter(r=>r.type!=='Kas').forEach(r => { byType[r.type] = (byType[r.type]||0) + (r.jumlah||0); });
    const typeRows = Object.entries(byType).sort((a,b) => b[1]-a[1]);

    document.getElementById('rpt-kas').innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:var(--s4);margin-bottom:var(--s5)">
        ${[
          { l:'Saldo Kas Kecil', v: Utils.formatRupiah(saldo),   c: saldo>=0?'var(--success)':'var(--danger)' },
          { l:'Total Masuk',  v: Utils.formatRupiah(totalMasuk), c:'var(--success)' },
          { l:'Total Keluar', v: Utils.formatRupiah(totalKeluar),c:'var(--danger)' },
        ].map(s => `
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:var(--s5)">
            <div style="font-size:11px;color:var(--text-3);margin-bottom:4px;text-transform:uppercase">${s.l}</div>
            <div style="font-size:20px;font-weight:700;color:${s.c};font-family:var(--font-mono)">${s.v}</div>
          </div>
        `).join('')}
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Pengeluaran per Kategori</div></div>
        <table class="table">
          <thead><tr><th>Kategori</th><th class="num">Total</th><th class="num">%</th></tr></thead>
          <tbody>
            ${typeRows.map(([t,v]) => `
              <tr>
                <td>${t}</td>
                <td class="num">${Utils.formatRupiah(v)}</td>
                <td class="num text-muted">${totalKeluar>0?Math.round(v/totalKeluar*100):0}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  async function renderOrder() {
    const orders = await DB.getOrders().catch(() => []);
    const total  = orders.length;
    const real   = orders.filter(o => (o.jenis === 'real orderan' || (o.catatan||'').toLowerCase().includes('real'))).length;
    const est    = orders.filter(o => !(o.jenis === 'real orderan' || (o.catatan||'').toLowerCase().includes('real'))).length;
    const totalPax = orders.reduce((s,o) => s+(parseInt(o.shift1)||0)+(parseInt(o.shift2)||0)+(parseInt(o.shift3)||0), 0);

    document.getElementById('rpt-order').innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:var(--s4);margin-bottom:var(--s5)">
        ${[
          { l:'Total Order',     v: total + ' order',          c:'var(--primary-h)' },
          { l:'Real Orderan',    v: real  + ' order',          c:'var(--success)' },
          { l:'Estimasi',        v: est   + ' order',          c:'var(--warning)' },
          { l:'Total Pax',       v: totalPax.toLocaleString('id') + ' pax', c:'var(--info)' },
        ].map(s => `
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:var(--s5)">
            <div style="font-size:11px;color:var(--text-3);margin-bottom:4px;text-transform:uppercase">${s.l}</div>
            <div style="font-size:22px;font-weight:700;color:${s.c};font-family:var(--font-mono)">${s.v}</div>
          </div>
        `).join('')}
      </div>
    `;
  }

  async function renderKaryawan() {
    const employees = await DB.getEmployees().catch(() => []);
    const ACTIVE_STATS = ['AKTIF','ACTIVE','Active','Tetap','Kontrak','Percobaan','Harian'];
    const active = employees.filter(e => ACTIVE_STATS.includes(e.status));
    const totalGaji   = active.reduce((s,e) => s+(e.gaji||e.gajiPokok||0), 0);
    const totalHutang = active.reduce((s,e) => s+(e.sisaHutang||e.hutang||0), 0);
    const byDiv = {};
    active.forEach(e => { const d=e.divisi||e.departemen||'Lainnya'; byDiv[d]=(byDiv[d]||0)+1; });

    const canFinance = Auth.can('emp_finance', 'view');
    document.getElementById('rpt-karyawan').innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:var(--s4);margin-bottom:var(--s5)">
        ${[
          { l:'Karyawan Aktif',   v: active.length + ' orang',        c:'var(--primary-h)', show: true },
          { l:'Total Gaji/Bulan', v: Utils.formatRupiah(totalGaji),   c:'var(--success)',   show: canFinance },
          { l:'Total Hutang',     v: Utils.formatRupiah(totalHutang), c:'var(--warning)',   show: canFinance },
        ].filter(s => s.show).map(s => `
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:var(--s5)">
            <div style="font-size:11px;color:var(--text-3);margin-bottom:4px;text-transform:uppercase">${s.l}</div>
            <div style="font-size:22px;font-weight:700;color:${s.c};font-family:var(--font-mono)">${s.v}</div>
          </div>
        `).join('')}
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Karyawan per Divisi</div></div>
        <table class="table">
          <thead><tr><th>Divisi</th><th class="num">Jumlah</th></tr></thead>
          <tbody>
            ${Object.entries(byDiv).sort((a,b)=>b[1]-a[1]).map(([d,n]) => `
              <tr><td>${d}</td><td class="num">${n} orang</td></tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  /* ========================================================
     TREND 12 BULAN
     Revenue, Expense, Profit + Cash Flow Projection 30/60/90d
     SVG inline charts (no library)
  ======================================================== */

  // Build last 12 month buckets (YYYY-MM keys, oldest → newest)
  function _last12Months() {
    const now = new Date();
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
      const labels = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];
      months.push({ key, label: labels[d.getMonth()], year: d.getFullYear(), short: labels[d.getMonth()] + " '" + String(d.getFullYear()).slice(-2) });
    }
    return months;
  }

  // Format Rupiah ringkas: 1.5jt, 850rb, etc.
  function _fmtRpShort(n) {
    n = +n || 0;
    const abs = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    if (abs >= 1e9) return sign + (abs/1e9).toFixed(1).replace(/\.0$/,'') + 'M';
    if (abs >= 1e6) return sign + (abs/1e6).toFixed(1).replace(/\.0$/,'') + 'jt';
    if (abs >= 1e3) return sign + (abs/1e3).toFixed(0) + 'rb';
    return sign + abs.toFixed(0);
  }

  // SVG line chart helper. data = array of {label, value, color?}
  function _svgLineChart(series, opts = {}) {
    const W = opts.width || 800;
    const H = opts.height || 240;
    const padL = 56, padR = 16, padT = 16, padB = 32;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;
    if (!series.length || !series[0].data.length) {
      return `<div style="text-align:center;padding:40px;color:var(--text-3);font-size:12px">Belum ada data trend</div>`;
    }
    const labels = series[0].data.map(d => d.label);
    const allVals = series.flatMap(s => s.data.map(d => +d.value || 0));
    const maxV = Math.max(...allVals, 0);
    const minV = Math.min(...allVals, 0);
    const range = (maxV - minV) || 1;
    const xStep = innerW / Math.max(labels.length - 1, 1);
    const yScale = v => padT + innerH - ((v - minV) / range) * innerH;
    const xPos = i => padL + i * xStep;

    // Y-axis grid (5 lines)
    const yTicks = [];
    for (let i = 0; i <= 4; i++) {
      const v = minV + (range * i / 4);
      const y = yScale(v);
      yTicks.push(`<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" stroke="var(--border)" stroke-width="1" stroke-dasharray="${i===0?'':'2,3'}" opacity="0.6"/>
        <text x="${padL-6}" y="${y+3}" text-anchor="end" fill="var(--text-3)" font-size="10" font-family="var(--font-mono)">${_fmtRpShort(v)}</text>`);
    }
    // X-axis labels
    const xLabels = labels.map((lbl, i) => `<text x="${xPos(i)}" y="${H-12}" text-anchor="middle" fill="var(--text-3)" font-size="10">${lbl}</text>`).join('');

    // Line series
    const lines = series.map(s => {
      const points = s.data.map((d, i) => `${xPos(i)},${yScale(+d.value || 0)}`).join(' ');
      const dots = s.data.map((d, i) => {
        const cx = xPos(i), cy = yScale(+d.value || 0);
        return `<circle cx="${cx}" cy="${cy}" r="3.5" fill="${s.color}" stroke="var(--surface)" stroke-width="1.5">
          <title>${s.name}: ${_fmtRpShort(d.value)} (${d.label})</title>
        </circle>`;
      }).join('');
      return `<polyline fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" points="${points}"/>${dots}`;
    }).join('');

    // Legend
    const legend = series.map(s =>
      `<span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;color:var(--text-2);margin-right:14px">
        <span style="display:inline-block;width:14px;height:3px;background:${s.color};border-radius:2px"></span>${s.name}
      </span>`).join('');

    return `<div style="overflow-x:auto"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="width:100%;min-width:600px;height:auto;display:block" role="img" aria-label="Trend chart">
      ${yTicks.join('')}
      ${lines}
      ${xLabels}
    </svg></div>
    <div style="padding:8px 12px;display:flex;flex-wrap:wrap;justify-content:center">${legend}</div>`;
  }

  // SVG stacked bar chart for expense by category. categories = [{name, color, monthlyValues:[v1..v12]}]
  function _svgStackedBar(categories, monthLabels, opts = {}) {
    const W = opts.width || 800;
    const H = opts.height || 240;
    const padL = 56, padR = 16, padT = 16, padB = 32;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;
    const numMonths = monthLabels.length;
    if (!categories.length) return `<div style="text-align:center;padding:40px;color:var(--text-3);font-size:12px">Belum ada data</div>`;

    const totals = monthLabels.map((_, i) => categories.reduce((s, c) => s + (+c.monthlyValues[i] || 0), 0));
    const maxV = Math.max(...totals, 1);
    const xStep = innerW / numMonths;
    const barW = xStep * 0.7;
    const barOffset = (xStep - barW) / 2;

    // Y-axis grid
    const yTicks = [];
    for (let i = 0; i <= 4; i++) {
      const v = maxV * i / 4;
      const y = padT + innerH - (v / maxV) * innerH;
      yTicks.push(`<line x1="${padL}" y1="${y}" x2="${W-padR}" y2="${y}" stroke="var(--border)" stroke-width="1" stroke-dasharray="${i===0?'':'2,3'}" opacity="0.6"/>
        <text x="${padL-6}" y="${y+3}" text-anchor="end" fill="var(--text-3)" font-size="10" font-family="var(--font-mono)">${_fmtRpShort(v)}</text>`);
    }

    // Stacked bars
    let bars = '';
    monthLabels.forEach((_, mi) => {
      let yCursor = padT + innerH;
      categories.forEach(c => {
        const v = +c.monthlyValues[mi] || 0;
        if (v <= 0) return;
        const h = (v / maxV) * innerH;
        yCursor -= h;
        bars += `<rect x="${padL + mi * xStep + barOffset}" y="${yCursor}" width="${barW}" height="${h}" fill="${c.color}" opacity="0.85">
          <title>${c.name}: ${_fmtRpShort(v)} (${monthLabels[mi]})</title>
        </rect>`;
      });
    });

    // X-axis labels
    const xLabels = monthLabels.map((lbl, i) => `<text x="${padL + i * xStep + xStep/2}" y="${H-12}" text-anchor="middle" fill="var(--text-3)" font-size="10">${lbl}</text>`).join('');

    // Legend
    const legend = categories.map(c =>
      `<span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;color:var(--text-2);margin-right:14px">
        <span style="display:inline-block;width:10px;height:10px;background:${c.color};border-radius:2px;opacity:0.85"></span>${c.name}
      </span>`).join('');

    return `<div style="overflow-x:auto"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" style="width:100%;min-width:600px;height:auto;display:block" role="img" aria-label="Stacked bar chart">
      ${yTicks.join('')}
      ${bars}
      ${xLabels}
    </svg></div>
    <div style="padding:8px 12px;display:flex;flex-wrap:wrap;justify-content:center">${legend}</div>`;
  }

  async function renderTrend() {
    const container = document.getElementById('rpt-trend');
    if (!container) return;
    container.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-3)">Memuat trend data...</div>`;

    const [kas, invoices, ap, employees] = await Promise.all([
      DB.getKas().catch(()=>[]),
      DB.getInvoices().catch(()=>[]),
      DB.getAP().catch(()=>[]),
      DB.getEmployees().catch(()=>[]),
    ]);

    const months = _last12Months();
    const monthKeys = months.map(m => m.key);
    const monthLabels = months.map(m => m.short);

    // === REVENUE per bulan (dari invoice — pakai tglInvoice, accrual basis) ===
    const revenue = monthKeys.map(k => 0);
    invoices.forEach(inv => {
      const tgl = inv.tglInvoice || inv.tgl || '';
      const ym = tgl.slice(0,7);
      const idx = monthKeys.indexOf(ym);
      if (idx >= 0) revenue[idx] += +(inv.total || 0);
    });

    // === EXPENSE per bulan (dari kas — type !== 'Kas' = pengeluaran) ===
    const expense = monthKeys.map(k => 0);
    kas.forEach(r => {
      if (r.type === 'Kas') return; // skip kas masuk
      const ym = (r.tgl || '').slice(0,7);
      const idx = monthKeys.indexOf(ym);
      if (idx >= 0) expense[idx] += +(r.jumlah || 0);
    });

    // === PROFIT = revenue − expense ===
    const profit = monthKeys.map((_, i) => revenue[i] - expense[i]);

    // === EXPENSE BY CATEGORY (top 6 + Lain-lain) ===
    const byCatMonth = {}; // cat → [v1..v12]
    kas.forEach(r => {
      if (r.type === 'Kas') return;
      const ym = (r.tgl || '').slice(0,7);
      const idx = monthKeys.indexOf(ym);
      if (idx < 0) return;
      const cat = r.type || 'Lain-lain';
      if (!byCatMonth[cat]) byCatMonth[cat] = monthKeys.map(()=>0);
      byCatMonth[cat][idx] += +(r.jumlah || 0);
    });
    const catTotals = Object.entries(byCatMonth).map(([cat, vals]) => ({
      cat, total: vals.reduce((s,v)=>s+v, 0), vals
    })).sort((a,b)=>b.total-a.total);
    const top6 = catTotals.slice(0, 6);
    const others = catTotals.slice(6);
    const otherSum = monthKeys.map((_, i) => others.reduce((s, c) => s + (c.vals[i] || 0), 0));
    const palette = ['#6366f1','#10b981','#f59e0b','#ef4444','#06b6d4','#ec4899','#8b5cf6'];
    const stackCats = top6.map((c, i) => ({ name: c.cat, color: palette[i], monthlyValues: c.vals }));
    if (others.length) stackCats.push({ name: `Lain-lain (${others.length})`, color: '#94a3b8', monthlyValues: otherSum });

    // === SUMMARY YTD ===
    const totalRev   = revenue.reduce((s,v)=>s+v, 0);
    const totalExp   = expense.reduce((s,v)=>s+v, 0);
    const totalProf  = totalRev - totalExp;
    const profitMargin = totalRev > 0 ? (totalProf / totalRev * 100) : 0;
    // Trend: bulan terakhir vs bulan sebelumnya
    const lastIdx = monthKeys.length - 1;
    const prevIdx = monthKeys.length - 2;
    const revTrend = revenue[prevIdx] > 0 ? ((revenue[lastIdx] - revenue[prevIdx]) / revenue[prevIdx] * 100) : 0;
    const expTrend = expense[prevIdx] > 0 ? ((expense[lastIdx] - expense[prevIdx]) / expense[prevIdx] * 100) : 0;

    // === CASH FLOW PROJECTION 30/60/90 ===
    // Inflow projeksi: invoice belum LUNAS dengan tglBayar dalam window
    // Outflow projeksi: AP belum LUNAS + payroll bulanan (estimasi avg gaji × 30)
    const today = new Date(); today.setHours(0,0,0,0);
    const win30  = new Date(today); win30.setDate(today.getDate() + 30);
    const win60  = new Date(today); win60.setDate(today.getDate() + 60);
    const win90  = new Date(today); win90.setDate(today.getDate() + 90);
    const inWindow = (tglStr, end) => {
      if (!tglStr) return false;
      const d = new Date(tglStr); d.setHours(0,0,0,0);
      return d >= today && d <= end;
    };
    const calcInflow = (end) => {
      let sum = 0;
      invoices.forEach(inv => {
        if (inv.status === 'Paid') return;
        if (!inWindow(inv.tglBayar, end)) return;
        sum += +(inv.sisa || inv.afterPph || inv.total || 0);
      });
      return sum;
    };
    const calcAPOut = (end) => {
      let sum = 0;
      ap.forEach(a => {
        if (String(a.status||'').toUpperCase() === 'LUNAS') return;
        const dueStr = a.tgl_jatuh_tempo || a.tglJatuhTempo || a.tgl_bayar || a.tglBayar || a.tgl_transaksi || a.tgl;
        if (!inWindow(dueStr, end)) return;
        sum += +((a.total||0) - (a.terbayar||0));
      });
      return sum;
    };
    // Payroll estimasi: total gaji aktif × jumlah bulan dalam window (30d=1, 60d=2, 90d=3)
    const ACTIVE = ['AKTIF','ACTIVE','aktif','active','Aktif','Tetap','Kontrak','Percobaan','Harian'];
    const monthlyPayroll = employees
      .filter(e => ACTIVE.includes(e.status))
      .reduce((s,e) => s + +(e.gaji || e.gajiPokok || 0), 0);

    const projection = [
      { label: '30 hari', days: 30, end: win30, mult: 1 },
      { label: '60 hari', days: 60, end: win60, mult: 2 },
      { label: '90 hari', days: 90, end: win90, mult: 3 },
    ].map(p => {
      const inflow  = calcInflow(p.end);
      const apOut   = calcAPOut(p.end);
      const payroll = monthlyPayroll * p.mult;
      const outflow = apOut + payroll;
      const net     = inflow - outflow;
      return { ...p, inflow, apOut, payroll, outflow, net };
    });

    // === RENDER ===
    container.innerHTML = `
      <!-- KPI Cards YTD -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:var(--s3);margin-bottom:var(--s5)">
        ${[
          { l:'Revenue 12 Bulan', v:Utils.formatRupiah(totalRev), trend:revTrend, c:'#10b981' },
          { l:'Expense 12 Bulan', v:Utils.formatRupiah(totalExp), trend:expTrend, c:'#ef4444' },
          { l:'Profit 12 Bulan',  v:Utils.formatRupiah(totalProf),trend:null,     c: totalProf>=0?'#10b981':'#ef4444' },
          { l:'Profit Margin',    v:profitMargin.toFixed(1)+'%', trend:null,     c: profitMargin>=10?'#10b981':profitMargin>=0?'#f59e0b':'#ef4444' },
        ].map(c => `
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:14px 16px">
            <div style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">${c.l}</div>
            <div style="font-size:18px;font-weight:800;color:${c.c};font-family:var(--font-mono)">${c.v}</div>
            ${c.trend !== null && c.trend !== 0 ? `<div style="font-size:10px;margin-top:3px;color:${c.trend>=0?'#10b981':'#ef4444'}">${c.trend>=0?'▲':'▼'} ${Math.abs(c.trend).toFixed(1)}% vs bulan lalu</div>` : '<div style="font-size:10px;margin-top:3px;color:var(--text-3)">YTD</div>'}
          </div>
        `).join('')}
      </div>

      <!-- Revenue + Profit Line Chart -->
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);overflow:hidden;margin-bottom:var(--s4)">
        <div style="padding:12px 18px;border-bottom:1px solid var(--border)">
          <div style="font-size:14px;font-weight:700;color:var(--heading)">📈 Revenue, Expense & Profit — 12 Bulan</div>
          <div style="font-size:11px;color:var(--text-3);margin-top:2px">Revenue dari invoice (accrual). Expense dari kas keluar.</div>
        </div>
        <div style="padding:12px">
          ${_svgLineChart([
            { name: 'Revenue', color: '#10b981', data: revenue.map((v,i) => ({ label: monthLabels[i], value: v })) },
            { name: 'Expense', color: '#ef4444', data: expense.map((v,i) => ({ label: monthLabels[i], value: v })) },
            { name: 'Profit',  color: '#6366f1', data: profit.map((v,i)  => ({ label: monthLabels[i], value: v })) },
          ])}
        </div>
      </div>

      <!-- Expense by Category Stacked Bar -->
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);overflow:hidden;margin-bottom:var(--s4)">
        <div style="padding:12px 18px;border-bottom:1px solid var(--border)">
          <div style="font-size:14px;font-weight:700;color:var(--heading)">📊 Pengeluaran per Kategori — 12 Bulan</div>
          <div style="font-size:11px;color:var(--text-3);margin-top:2px">Top 6 kategori + sisa digabung sebagai Lain-lain.</div>
        </div>
        <div style="padding:12px">
          ${_svgStackedBar(stackCats, monthLabels)}
        </div>
      </div>

      <!-- Cash Flow Projection -->
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);overflow:hidden">
        <div style="padding:12px 18px;border-bottom:1px solid var(--border)">
          <div style="font-size:14px;font-weight:700;color:var(--heading)">💸 Proyeksi Arus Kas — 30/60/90 Hari</div>
          <div style="font-size:11px;color:var(--text-3);margin-top:2px">
            Inflow = invoice belum LUNAS yang jatuh tempo. Outflow = AP + estimasi payroll.
          </div>
        </div>
        <div style="overflow-x:auto">
          <table class="table" style="font-size:13px;table-layout:fixed">
            <colgroup>
              <col style="width:90px"><col><col><col><col><col>
            </colgroup>
            <thead>
              <tr>
                <th>Periode</th>
                <th class="num" style="color:#10b981">Inflow (AR)</th>
                <th class="num" style="color:#ef4444">Outflow AP</th>
                <th class="num" style="color:#f59e0b">Payroll Est.</th>
                <th class="num" style="color:#ef4444">Total Outflow</th>
                <th class="num">Net Position</th>
              </tr>
            </thead>
            <tbody>
              ${projection.map(p => `
                <tr>
                  <td><strong>${p.label}</strong><div style="font-size:10px;color:var(--text-3)">s/d ${p.end.toISOString().slice(0,10).split('-').reverse().join('-')}</div></td>
                  <td class="num" style="font-family:var(--font-mono);color:#10b981">${Utils.formatRupiah(p.inflow)}</td>
                  <td class="num" style="font-family:var(--font-mono);color:var(--text-2)">${Utils.formatRupiah(p.apOut)}</td>
                  <td class="num" style="font-family:var(--font-mono);color:var(--text-2)">${Utils.formatRupiah(p.payroll)}</td>
                  <td class="num" style="font-family:var(--font-mono);color:#ef4444">${Utils.formatRupiah(p.outflow)}</td>
                  <td class="num" style="font-family:var(--font-mono);font-weight:700;color:${p.net>=0?'#10b981':'#ef4444'}">${p.net>=0?'+':''}${Utils.formatRupiah(p.net)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <div style="padding:8px 18px 12px;font-size:11px;color:var(--text-3);background:var(--surface2);border-top:1px solid var(--border)">
          ⚠ Estimasi sederhana. Payroll = total gaji aktif × bulan. Tidak termasuk biaya operasional rutin (sewa, listrik, dll). Pakai sebagai indikasi awal, bukan pengganti cash budget detail.
        </div>
      </div>
    `;
  }

  /* ========================================================
     PROFITABILITY ANALYSIS — Per Customer (LTV, AR, Segmentation)
     Method: Historical LTV (Σ invoice.total all-time per customer)
     Segmentation: RFM-lite based on Last Order Days + LTV percentile
  ======================================================== */

  // Hitung selisih hari antara 2 tanggal (string YYYY-MM-DD)
  function _daysBetween(d1, d2) {
    const a = new Date(d1), b = new Date(d2);
    return Math.floor((b - a) / 86400000);
  }

  function _segmentBadge(seg) {
    const m = {
      vip:      { label:'💎 VIP',     bg:'rgba(16,185,129,.15)', color:'#10b981', border:'rgba(16,185,129,.4)' },
      regular:  { label:'✅ Regular',  bg:'rgba(99,102,241,.12)', color:'#6366f1', border:'rgba(99,102,241,.3)' },
      atrisk:   { label:'⚠ At Risk',  bg:'rgba(245,158,11,.12)', color:'#f59e0b', border:'rgba(245,158,11,.4)' },
      churned:  { label:'💀 Churned', bg:'rgba(239,68,68,.10)',  color:'#ef4444', border:'rgba(239,68,68,.35)' },
    };
    const s = m[seg] || m.regular;
    return `<span style="display:inline-flex;align-items:center;font-size:10px;padding:3px 8px;border-radius:99px;background:${s.bg};color:${s.color};border:1px solid ${s.border};font-weight:700;white-space:nowrap">${s.label}</span>`;
  }

  async function renderProfitability() {
    const container = document.getElementById('rpt-profit');
    if (!container) return;
    container.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-3)">Memuat data profitability...</div>`;

    const [invoices, customers] = await Promise.all([
      DB.getInvoices().catch(()=>[]),
      DB.getCustomers().catch(()=>[]),
    ]);

    if (!invoices.length) {
      container.innerHTML = '<div style="padding:60px;text-align:center;color:var(--text-3)">Belum ada data invoice — analisa profitability butuh history invoice</div>';
      return;
    }

    const today = new Date().toISOString().slice(0,10);

    // === Group invoice per customer ===
    const byCustomer = {};
    invoices.forEach(inv => {
      const name = inv.customer || '(tanpa nama)';
      if (!byCustomer[name]) byCustomer[name] = {
        name,
        invoices: [],
        ltv: 0,
        invoiceCount: 0,
        paidCount: 0,
        arOutstanding: 0,
        lastOrder: '',
        firstOrder: '',
        totalPayDays: 0,
        payDaysCount: 0,
      };
      const c = byCustomer[name];
      c.invoices.push(inv);
      c.invoiceCount++;
      c.ltv += +(inv.total || 0);
      const tgl = inv.tglInvoice || inv.tgl || '';
      if (tgl) {
        if (!c.firstOrder || tgl < c.firstOrder) c.firstOrder = tgl;
        if (!c.lastOrder  || tgl > c.lastOrder)  c.lastOrder  = tgl;
      }
      // Status normalization (legacy: 'Paid'/'Unpaid'/'Overdue', some uses 'LUNAS')
      const isPaid = inv.status === 'Paid' || inv.status === 'LUNAS' || inv.status === 'Lunas';
      if (isPaid) {
        c.paidCount++;
        // Average payment days kalau ada tglTerbayar
        if (inv.tglTerbayar && tgl) {
          const days = _daysBetween(tgl, inv.tglTerbayar);
          if (days >= 0 && days < 365) { c.totalPayDays += days; c.payDaysCount++; }
        }
      } else {
        c.arOutstanding += +(inv.sisa || inv.afterPph || inv.total || 0);
      }
    });

    // Compute derived fields per customer
    const list = Object.values(byCustomer).map(c => {
      const aov = c.invoiceCount > 0 ? c.ltv / c.invoiceCount : 0;
      const lastDays = c.lastOrder ? _daysBetween(c.lastOrder, today) : 9999;
      const avgPayDays = c.payDaysCount > 0 ? Math.round(c.totalPayDays / c.payDaysCount) : null;
      // Lookup customer master
      const master = customers.find(x => x.nama === c.name);
      const tempo = master?.tempo || null;
      return { ...c, aov, lastDays, avgPayDays, tempo };
    });

    // === Compute LTV percentile threshold (top 20% = VIP) ===
    const sortedByLTV = [...list].sort((a,b) => b.ltv - a.ltv);
    const top20Idx = Math.max(0, Math.floor(list.length * 0.2));
    const ltvVipThreshold = sortedByLTV[top20Idx]?.ltv || 0;

    // === Segmentation ===
    list.forEach(c => {
      if (c.lastDays > 60)        c.segment = 'churned';
      else if (c.lastDays > 30)   c.segment = 'atrisk';
      else if (c.ltv >= ltvVipThreshold && ltvVipThreshold > 0) c.segment = 'vip';
      else                        c.segment = 'regular';
    });

    // === KPI summary ===
    const totalLtv      = list.reduce((s,c) => s + c.ltv, 0);
    const totalAR       = list.reduce((s,c) => s + c.arOutstanding, 0);
    const segCount      = { vip:0, regular:0, atrisk:0, churned:0 };
    list.forEach(c => segCount[c.segment]++);
    const activeCount   = segCount.vip + segCount.regular;
    const avgLtv        = activeCount > 0 ? totalLtv / list.length : 0;
    const totalInvoices = list.reduce((s,c)=>s+c.invoiceCount, 0);

    // Cache full data (untuk sort & PDF export tanpa fetch ulang)
    _profitData = { list, totalLtv, totalAR, segCount, avgLtv, totalInvoices, ltvVipThreshold };

    // Sort customers by current sort state
    const sortedList = _sortProfitList(list, _profitSort.key, _profitSort.dir);

    // === RENDER ===
    container.innerHTML = `
      <!-- KPI Cards -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:var(--s3);margin-bottom:var(--s4)">
        ${[
          { l:'Total Customers',  v:list.length+' customer',                                 c:'#6366f1' },
          { l:'Total LTV (Hist)', v:Utils.formatRupiah(totalLtv),                            c:'#10b981' },
          { l:'Avg LTV',          v:Utils.formatRupiah(avgLtv),                              c:'#3b82f6' },
          { l:'AR Outstanding',   v:Utils.formatRupiah(totalAR),                             c:'#ef4444' },
        ].map(c => `
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:14px 16px">
            <div style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px">${c.l}</div>
            <div style="font-size:18px;font-weight:800;color:${c.c};font-family:var(--font-mono)">${c.v}</div>
          </div>
        `).join('')}
      </div>

      <!-- Segmentation breakdown -->
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);overflow:hidden;margin-bottom:var(--s4)">
        <div style="padding:12px 18px;border-bottom:1px solid var(--border)">
          <div style="font-size:14px;font-weight:700;color:var(--heading)">🎯 Customer Segmentation (RFM-Lite)</div>
          <div style="font-size:11px;color:var(--text-3);margin-top:2px">
            Last Order Days + LTV percentile. <strong>VIP</strong>: aktif (≤30d) di top 20% LTV.
            <strong>Regular</strong>: aktif (≤30d). <strong>At Risk</strong>: 30-60 hari tidak order.
            <strong>Churned</strong>: &gt;60 hari tidak order.
          </div>
        </div>
        <div style="padding:14px 18px;display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:var(--s3)">
          ${[
            { seg:'vip',     l:'💎 VIP',      n:segCount.vip,     desc:'Top 20% LTV + aktif',  c:'#10b981' },
            { seg:'regular', l:'✅ Regular',   n:segCount.regular, desc:'Aktif, LTV menengah',  c:'#6366f1' },
            { seg:'atrisk',  l:'⚠ At Risk',   n:segCount.atrisk,  desc:'30-60 hari quiet',     c:'#f59e0b' },
            { seg:'churned', l:'💀 Churned',  n:segCount.churned, desc:'>60 hari, lepas',      c:'#ef4444' },
          ].map(s => `
            <div style="border:1px solid var(--border);border-radius:var(--r-md);padding:12px 14px;border-left:3px solid ${s.c}">
              <div style="font-size:11px;font-weight:700;color:${s.c};margin-bottom:4px">${s.l}</div>
              <div style="font-size:22px;font-weight:800;color:var(--heading);font-family:var(--font-mono)">${s.n}</div>
              <div style="font-size:10px;color:var(--text-3);margin-top:2px">${s.desc}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Top 10 Customers by LTV -->
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);overflow:hidden;margin-bottom:var(--s4)">
        <div style="padding:12px 18px;border-bottom:1px solid var(--border)">
          <div style="font-size:14px;font-weight:700;color:var(--heading)">🏆 Top 10 Customer by LTV</div>
        </div>
        <div style="padding:12px 18px">
          ${sortedList.slice(0, 10).map((c, i) => {
            const pct = totalLtv > 0 ? (c.ltv / sortedList[0].ltv * 100) : 0;
            return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
              <span style="font-size:11px;font-weight:700;color:var(--text-3);width:22px;text-align:right">${i+1}.</span>
              <span style="font-size:13px;font-weight:600;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${c.name}">${c.name}</span>
              ${_segmentBadge(c.segment)}
              <div style="flex:1;max-width:200px;height:6px;background:var(--surface2);border-radius:3px;overflow:hidden">
                <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,#6366f1,#10b981);border-radius:3px"></div>
              </div>
              <span style="font-size:12px;font-family:var(--font-mono);font-weight:600;min-width:120px;text-align:right;color:var(--heading)">${Utils.formatRupiah(c.ltv, true)}</span>
            </div>`;
          }).join('')}
        </div>
      </div>

      <!-- Customer Detail Table -->
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);overflow:hidden">
        <div style="padding:12px 18px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
          <div>
            <div style="font-size:14px;font-weight:700;color:var(--heading)">📋 Detail Per Customer</div>
            <div style="font-size:11px;color:var(--text-3);margin-top:2px">Klik header kolom untuk sort. Hover row untuk highlight.</div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="ReportModule.printProfitability()" title="Cetak laporan profitability">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13" aria-hidden="true"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z"/></svg>
            Print PDF
          </button>
        </div>
        <div id="rpt-profit-table-wrap" style="overflow-x:auto;max-height:600px;overflow-y:auto">
          ${_renderProfitTable(sortedList)}
        </div>
        <div style="padding:8px 18px;font-size:11px;color:var(--text-3);background:var(--surface2);border-top:1px solid var(--border);display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px">
          <span><strong>${list.length}</strong> customer · <strong>${totalInvoices}</strong> invoice all-time</span>
          <span>📌 LTV = total revenue historis. AR = invoice belum lunas. Avg Bayar lebih dari Tempo = bayar telat (merah).</span>
        </div>
      </div>
    `;
  }

  // Sort customer list by key + dir (returns new sorted array, doesn't mutate)
  function _sortProfitList(list, key, dir) {
    const mult = dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      let va, vb;
      switch (key) {
        case 'name':         va = (a.name||'').toLowerCase(); vb = (b.name||'').toLowerCase(); break;
        case 'segment':      { const order = {vip:0,regular:1,atrisk:2,churned:3}; va = order[a.segment]; vb = order[b.segment]; break; }
        case 'invoiceCount': va = a.invoiceCount; vb = b.invoiceCount; break;
        case 'ltv':          va = a.ltv;          vb = b.ltv;          break;
        case 'aov':          va = a.aov;          vb = b.aov;          break;
        case 'arOutstanding':va = a.arOutstanding;vb = b.arOutstanding;break;
        case 'lastDays':     va = a.lastDays;     vb = b.lastDays;     break;
        case 'avgPayDays':   va = a.avgPayDays==null?9999:a.avgPayDays; vb = b.avgPayDays==null?9999:b.avgPayDays; break;
        case 'tempo':        va = a.tempo||9999;  vb = b.tempo||9999;  break;
        default: return 0;
      }
      if (va < vb) return -1 * mult;
      if (va > vb) return  1 * mult;
      return 0;
    });
  }

  // SVG icon for sort indicator
  function _sortIcon(active, dir) {
    if (!active) return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="10" height="10" style="opacity:.3;margin-left:3px;vertical-align:-1px"><path d="M7 10l5-5 5 5M7 14l5 5 5-5"/></svg>`;
    if (dir === 'asc')  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="11" height="11" style="margin-left:3px;vertical-align:-1px;color:var(--primary)"><path d="M7 14l5-5 5 5"/></svg>`;
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="11" height="11" style="margin-left:3px;vertical-align:-1px;color:var(--primary)"><path d="M7 10l5 5 5-5"/></svg>`;
  }

  // Render <thead><tr> + <tbody> for sorted profit list
  function _renderProfitTable(sortedList) {
    const cols = [
      { key: '',             label: '#',              width: '36px',  align: 'left',  sortable: false },
      { key: 'name',         label: 'Customer',       width: '',      align: 'left',  sortable: true  },
      { key: 'segment',      label: 'Segment',        width: '90px',  align: 'left',  sortable: true  },
      { key: 'invoiceCount', label: 'Invoice',        width: '80px',  align: 'right', sortable: true  },
      { key: 'ltv',          label: 'LTV',            width: '120px', align: 'right', sortable: true  },
      { key: 'aov',          label: 'Avg Order',      width: '110px', align: 'right', sortable: true  },
      { key: 'arOutstanding',label: 'AR Outstanding', width: '120px', align: 'right', sortable: true  },
      { key: 'lastDays',     label: 'Last Order',     width: '90px',  align: 'right', sortable: true  },
      { key: 'avgPayDays',   label: 'Avg Bayar',      width: '90px',  align: 'right', sortable: true  },
      { key: 'tempo',        label: 'Tempo',          width: '70px',  align: 'right', sortable: true  },
    ];
    const headers = cols.map(c => {
      const active = _profitSort.key === c.key;
      const numCls = c.align === 'right' ? ' class="num"' : '';
      const widthStyle = c.width ? `width:${c.width};` : '';
      const sortStyle = c.sortable ? 'cursor:pointer;user-select:none' : '';
      const onclick = c.sortable ? `onclick="ReportModule._sortProfit('${c.key}')"` : '';
      const icon = c.sortable ? _sortIcon(active, _profitSort.dir) : '';
      return `<th${numCls} style="${widthStyle}${sortStyle}" ${onclick} title="${c.sortable?'Klik untuk sort':''}">${c.label}${icon}</th>`;
    }).join('');

    const rows = sortedList.map((c, i) => {
      const lastDaysStr = c.lastOrder ? `${c.lastDays}d lalu` : '—';
      const lastColor = c.lastDays <= 30 ? '#10b981' : c.lastDays <= 60 ? '#f59e0b' : '#ef4444';
      const payDaysStr = c.avgPayDays !== null ? `${c.avgPayDays}d` : '—';
      const payColor = c.avgPayDays === null ? 'var(--text-3)' : (c.tempo && c.avgPayDays > c.tempo ? '#ef4444' : '#10b981');
      return `<tr style="cursor:pointer" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''" onclick="ReportModule.openCustomerDetail('${(c.name||'').replace(/'/g,'\\\'')}')" title="Klik untuk detail customer">
        <td style="color:var(--text-3)">${i+1}</td>
        <td style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:240px;color:var(--primary-h)" title="${c.name}">${c.name}</td>
        <td>${_segmentBadge(c.segment)}</td>
        <td class="num" style="font-family:var(--font-mono)">${c.invoiceCount}<div style="font-size:9px;color:var(--text-3)">(${c.paidCount} paid)</div></td>
        <td class="num" style="font-family:var(--font-mono);font-weight:700;color:#10b981">${Utils.formatRupiah(c.ltv, true)}</td>
        <td class="num" style="font-family:var(--font-mono);color:var(--text-2)">${Utils.formatRupiah(c.aov, true)}</td>
        <td class="num" style="font-family:var(--font-mono);color:${c.arOutstanding > 0 ? '#ef4444' : 'var(--text-3)'}">${c.arOutstanding > 0 ? Utils.formatRupiah(c.arOutstanding, true) : '—'}</td>
        <td class="num" style="color:${lastColor};font-family:var(--font-mono)">${lastDaysStr}</td>
        <td class="num" style="color:${payColor};font-family:var(--font-mono)">${payDaysStr}</td>
        <td class="num" style="color:var(--text-3);font-family:var(--font-mono)">${c.tempo ? c.tempo+'d' : '—'}</td>
      </tr>`;
    }).join('');

    return `<table class="table" style="font-size:12px">
      <thead style="position:sticky;top:0;background:var(--surface2);z-index:1"><tr>${headers}</tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  // Public: handler when user clicks sortable column header
  function _sortProfit(key) {
    if (!_profitData) return;
    if (_profitSort.key === key) {
      // Toggle direction
      _profitSort.dir = _profitSort.dir === 'asc' ? 'desc' : 'asc';
    } else {
      _profitSort.key = key;
      // Default direction: numeric/date → desc, name → asc
      _profitSort.dir = (key === 'name') ? 'asc' : 'desc';
    }
    const sortedList = _sortProfitList(_profitData.list, _profitSort.key, _profitSort.dir);
    const wrap = document.getElementById('rpt-profit-table-wrap');
    if (wrap) wrap.innerHTML = _renderProfitTable(sortedList);
  }

  // Public: open detail modal for one customer
  function openCustomerDetail(customerName) {
    if (!_profitData) { Notify.warning('Data belum siap, buka tab Profitability dulu'); return; }
    const c = _profitData.list.find(x => x.name === customerName);
    if (!c) { Notify.error('Customer tidak ditemukan'); return; }

    const fmtRp = (n, compact=false) => Utils.formatRupiah(n, compact);
    const today = new Date().toISOString().slice(0,10);
    const invoices = [...c.invoices].sort((a,b) => (b.tglInvoice||b.tgl||'').localeCompare(a.tglInvoice||a.tgl||''));

    // Lookup customer master untuk info tambahan
    let master = null;
    try {
      const customers = (window.CustomerModule && CustomerModule._cachedCustomers) || [];
      master = customers.find(x => x.nama === customerName);
    } catch {}

    // Timeline: monthly revenue 12 bulan terakhir untuk customer ini
    const months = _last12Months();
    const monthKeys = months.map(m => m.key);
    const monthlyRev = monthKeys.map(() => 0);
    invoices.forEach(inv => {
      const ym = (inv.tglInvoice || inv.tgl || '').slice(0,7);
      const idx = monthKeys.indexOf(ym);
      if (idx >= 0) monthlyRev[idx] += +(inv.total || 0);
    });

    // Stats lain
    const paidInvoices = invoices.filter(i => i.status === 'Paid' || i.status === 'LUNAS' || i.status === 'Lunas');
    const unpaidInvoices = invoices.filter(i => !(i.status === 'Paid' || i.status === 'LUNAS' || i.status === 'Lunas'));
    const ytdRev = monthlyRev.reduce((s,v)=>s+v, 0);
    const customerLifeMonths = c.firstOrder ? Math.max(1, Math.floor(_daysBetween(c.firstOrder, today) / 30)) : 1;
    const monthlyAvg = c.ltv / customerLifeMonths;

    // Last 5 invoices preview
    const recentInv = invoices.slice(0, 8);
    const recentInvHtml = recentInv.length === 0 ? `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-3)">Belum ada invoice</td></tr>` : recentInv.map(inv => {
      const isPaid = inv.status === 'Paid' || inv.status === 'LUNAS' || inv.status === 'Lunas';
      const statusBadge = isPaid
        ? `<span style="background:rgba(16,185,129,.15);color:#10b981;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700">LUNAS</span>`
        : `<span style="background:rgba(239,68,68,.12);color:#ef4444;padding:2px 8px;border-radius:99px;font-size:10px;font-weight:700">BELUM</span>`;
      return `<tr style="cursor:pointer" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''" onclick="if(window.InvoiceModule){Modal.close(window._custDetailMid);InvoiceModule.openInvDetail('${inv.id||inv.invoiceNum}')}">
        <td style="white-space:nowrap;color:var(--text-2)">${(inv.tglInvoice||'').split('-').reverse().join('-')||'-'}</td>
        <td style="font-family:var(--font-mono);font-size:11px">${inv.invoiceNum||'-'}</td>
        <td class="num" style="font-family:var(--font-mono);font-weight:600">${fmtRp(inv.total, true)}</td>
        <td class="num" style="font-family:var(--font-mono);color:${(inv.sisa||0)>0?'#ef4444':'#10b981'}">${(inv.sisa||0)>0?fmtRp(inv.sisa, true):'lunas'}</td>
        <td>${statusBadge}</td>
        <td style="text-align:center;color:var(--text-3);font-size:11px">→</td>
      </tr>`;
    }).join('');

    // Mini bar chart 12 bulan revenue (compact, no line)
    const maxRev = Math.max(...monthlyRev, 1);
    const barChart = `<div style="display:grid;grid-template-columns:repeat(12,1fr);gap:3px;align-items:end;height:60px;padding:8px 0">
      ${monthlyRev.map((v, i) => {
        const h = (v / maxRev) * 100;
        return `<div style="display:flex;flex-direction:column;align-items:center;gap:3px">
          <div style="width:100%;background:linear-gradient(180deg,#6366f1,#8b5cf6);height:${Math.max(h, 2)}%;border-radius:2px 2px 0 0;min-height:2px" title="${months[i].short}: ${fmtRp(v)}"></div>
          <div style="font-size:8px;color:var(--text-3)">${months[i].label.slice(0,3)}</div>
        </div>`;
      }).join('')}
    </div>`;

    const mid = 'cust-detail-' + Date.now();
    window._custDetailMid = mid;

    Modal.open({
      id: mid,
      title: `📊 Detail Customer: ${customerName}`,
      size: 'modal-lg',
      body: `
        <!-- Master info -->
        <div style="background:var(--surface2);padding:12px 14px;border-radius:var(--r-md);margin-bottom:14px;display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;font-size:12px">
          <div><div style="font-size:10px;color:var(--text-3)">SEGMENT</div><div style="margin-top:2px">${_segmentBadge(c.segment)}</div></div>
          <div><div style="font-size:10px;color:var(--text-3)">PIC</div><div style="font-weight:600;margin-top:2px">${master?.pic || '—'}</div></div>
          <div><div style="font-size:10px;color:var(--text-3)">No. HP</div><div style="font-family:var(--font-mono);font-size:11px;margin-top:2px">${master?.noHp || '—'}</div></div>
          <div><div style="font-size:10px;color:var(--text-3)">JENIS</div><div style="margin-top:2px">${master?.jenisPelayanan || '—'}</div></div>
          <div><div style="font-size:10px;color:var(--text-3)">TEMPO</div><div style="font-weight:600;margin-top:2px">${c.tempo ? c.tempo+' hari' : '—'}</div></div>
          <div><div style="font-size:10px;color:var(--text-3)">KOTA</div><div style="margin-top:2px">${master?.kota || '—'}</div></div>
        </div>

        <!-- KPI cards -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-bottom:14px">
          ${[
            { l:'LTV (Historis)',  v:fmtRp(c.ltv),                                 c:'#10b981' },
            { l:'Total Invoice',   v:c.invoiceCount + ` (${c.paidCount} paid)`,    c:'#6366f1' },
            { l:'Avg Order',       v:fmtRp(c.aov, true),                           c:'#3b82f6' },
            { l:'AR Outstanding',  v:c.arOutstanding>0 ? fmtRp(c.arOutstanding) : '—', c: c.arOutstanding>0 ? '#ef4444' : 'var(--text-3)' },
            { l:'Last Order',      v:c.lastOrder ? `${c.lastDays} hari lalu` : '—',c: c.lastDays<=30?'#10b981':c.lastDays<=60?'#f59e0b':'#ef4444' },
            { l:'Avg Bayar',       v:c.avgPayDays!==null ? `${c.avgPayDays} hari` : '—', c: c.avgPayDays===null?'var(--text-3)':(c.tempo&&c.avgPayDays>c.tempo?'#ef4444':'#10b981') },
            { l:'Avg/Bulan',       v:fmtRp(monthlyAvg, true),                      c:'#8b5cf6' },
            { l:'Lifespan',        v:c.firstOrder ? customerLifeMonths+' bulan' : '—', c:'var(--text-2)' },
          ].map(s => `
            <div style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:8px 10px">
              <div style="font-size:9px;color:var(--text-3);text-transform:uppercase;letter-spacing:.04em">${s.l}</div>
              <div style="font-size:13px;font-weight:700;color:${s.c};font-family:var(--font-mono);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${s.v}">${s.v}</div>
            </div>
          `).join('')}
        </div>

        <!-- Mini chart 12 bulan -->
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:10px 14px;margin-bottom:14px">
          <div style="font-size:12px;font-weight:700;color:var(--heading);margin-bottom:4px">📊 Revenue 12 Bulan Terakhir</div>
          <div style="font-size:10px;color:var(--text-3);margin-bottom:4px">Total YTD 12 bulan: <strong style="color:#10b981">${fmtRp(ytdRev)}</strong></div>
          ${barChart}
        </div>

        <!-- Recent invoices -->
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);overflow:hidden">
          <div style="padding:8px 14px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:12px;font-weight:700">📋 Invoice Terbaru (${recentInv.length} dari ${c.invoiceCount})</span>
            <span style="font-size:10px;color:var(--text-3)">Klik baris untuk lihat detail invoice</span>
          </div>
          <div style="overflow-x:auto;max-height:280px;overflow-y:auto">
            <table class="table" style="font-size:11px">
              <thead style="position:sticky;top:0;background:var(--surface2);z-index:1">
                <tr>
                  <th style="width:90px">Tanggal</th>
                  <th>No. Invoice</th>
                  <th class="num" style="width:110px">Total</th>
                  <th class="num" style="width:100px">Sisa</th>
                  <th style="width:75px">Status</th>
                  <th style="width:30px"></th>
                </tr>
              </thead>
              <tbody>${recentInvHtml}</tbody>
            </table>
          </div>
        </div>
      `,
      footer: `
        ${master?.noHp ? `<button class="btn btn-ghost btn-sm" onclick="Utils.waShare('${master.noHp}','Halo ${master.pic||''} - ${customerName},')" title="Buka WhatsApp ke PIC">📱 WA PIC</button>` : ''}
        <button class="btn btn-ghost btn-sm" onclick="Modal.close('${mid}');App.navigate('invoice')">Lihat semua invoice →</button>
        <button class="btn btn-primary btn-sm" onclick="Modal.close('${mid}')">Tutup</button>
      `,
    });
  }

  // Public: print Profitability tab to PDF (new window)
  function printProfitability() {
    if (!_profitData) { Notify.warning('Buka tab Profitability dulu'); return; }
    const { list, totalLtv, totalAR, segCount, avgLtv, totalInvoices } = _profitData;
    const sortedList = _sortProfitList(list, _profitSort.key, _profitSort.dir);
    const printDate = new Date().toLocaleString('id-ID',{day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'});
    const fmtRp = (n, c=true) => Utils.formatRupiah(n, c);

    const rowsHtml = sortedList.map((c, i) => {
      const sel = c.lastOrder ? `${c.lastDays}d lalu` : '—';
      const segLabel = { vip:'VIP', regular:'Regular', atrisk:'At Risk', churned:'Churned' }[c.segment] || '-';
      const segColor = { vip:'#10b981', regular:'#6366f1', atrisk:'#f59e0b', churned:'#dc2626' }[c.segment] || '#666';
      return `<tr>
        <td style="text-align:right">${i+1}</td>
        <td>${c.name}</td>
        <td><span style="display:inline-block;padding:2px 6px;border-radius:3px;background:${segColor}20;color:${segColor};font-size:9px;font-weight:700">${segLabel}</span></td>
        <td style="text-align:right">${c.invoiceCount} (${c.paidCount} paid)</td>
        <td style="text-align:right;font-weight:700;color:#16a34a">${fmtRp(c.ltv, true)}</td>
        <td style="text-align:right">${fmtRp(c.aov, true)}</td>
        <td style="text-align:right;color:${c.arOutstanding>0?'#dc2626':'#999'}">${c.arOutstanding>0?fmtRp(c.arOutstanding, true):'—'}</td>
        <td style="text-align:right">${sel}</td>
        <td style="text-align:right">${c.avgPayDays!==null?c.avgPayDays+'d':'—'}</td>
        <td style="text-align:right">${c.tempo?c.tempo+'d':'—'}</td>
      </tr>`;
    }).join('');

    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><title>Laporan Profitability — Customer LTV</title>
      <style>
        *{margin:0;padding:0;box-sizing:border-box}
        body{font-family:'Inter',Arial,sans-serif;padding:18px;color:#1e293b;font-size:11px}
        h1{font-size:18px;margin-bottom:4px}
        h2{font-size:12px;color:#64748b;font-weight:500;margin-bottom:14px}
        .summary{display:flex;gap:14px;margin:12px 0;padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;flex-wrap:wrap}
        .summary span{font-size:11px}
        .summary strong{font-size:13px;display:block;margin-top:2px}
        .seg{display:flex;gap:10px;margin:10px 0;flex-wrap:wrap}
        .seg .seg-card{flex:1;min-width:120px;padding:8px 10px;border:1px solid #e2e8f0;border-radius:4px;border-left-width:3px}
        .seg .vip{border-left-color:#16a34a}
        .seg .reg{border-left-color:#6366f1}
        .seg .atr{border-left-color:#f59e0b}
        .seg .chu{border-left-color:#dc2626}
        table{width:100%;border-collapse:collapse;margin-top:8px}
        th,td{padding:5px 7px;border:1px solid #e2e8f0;font-size:10px;vertical-align:top}
        th{background:#1e293b;color:#fff;text-transform:uppercase;letter-spacing:.04em;font-size:9px;text-align:left}
        .footer{margin-top:14px;padding-top:8px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;font-size:9px;color:#94a3b8}
        @page{size:landscape;margin:10mm}
        @media print{body{padding:0}}
      </style></head><body>
      <h1>Laporan Profitability — Customer LTV</h1>
      <h2>BECCA Catering · Method: Historical (LTV = Σ revenue all-time per customer)</h2>
      <div class="summary">
        <span>Total Customers: <strong>${list.length}</strong></span>
        <span>Total LTV: <strong style="color:#16a34a">${fmtRp(totalLtv)}</strong></span>
        <span>Avg LTV/customer: <strong>${fmtRp(avgLtv)}</strong></span>
        <span>AR Outstanding: <strong style="color:#dc2626">${fmtRp(totalAR)}</strong></span>
        <span>Total Invoice: <strong>${totalInvoices}</strong></span>
      </div>
      <div class="seg">
        <div class="seg-card vip"><div style="font-size:9px;color:#666">💎 VIP</div><strong style="font-size:14px">${segCount.vip}</strong></div>
        <div class="seg-card reg"><div style="font-size:9px;color:#666">✅ Regular</div><strong style="font-size:14px">${segCount.regular}</strong></div>
        <div class="seg-card atr"><div style="font-size:9px;color:#666">⚠ At Risk</div><strong style="font-size:14px">${segCount.atrisk}</strong></div>
        <div class="seg-card chu"><div style="font-size:9px;color:#666">💀 Churned</div><strong style="font-size:14px">${segCount.churned}</strong></div>
      </div>
      <table>
        <thead><tr>
          <th style="width:30px">#</th>
          <th>Customer</th>
          <th style="width:65px">Segment</th>
          <th style="width:90px;text-align:right">Invoice</th>
          <th style="width:100px;text-align:right">LTV</th>
          <th style="width:90px;text-align:right">Avg Order</th>
          <th style="width:100px;text-align:right">AR Outstanding</th>
          <th style="width:75px;text-align:right">Last Order</th>
          <th style="width:65px;text-align:right">Avg Bayar</th>
          <th style="width:55px;text-align:right">Tempo</th>
        </tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <div class="footer">
        <span>Dicetak: ${printDate}</span>
        <span>Sortir: ${_profitSort.key} ${_profitSort.dir.toUpperCase()} · BECCA V2.0</span>
      </div>
      <script>setTimeout(()=>window.print(),300)<\/script>
      </body></html>`);
    w.document.close();
  }

  return { init, switchTab, _sortProfit, printProfitability, openCustomerDetail };
})();
window.ReportModule = ReportModule;

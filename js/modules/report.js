/* ============================================
   BECCA V2.0 — Report Module
============================================ */
const ReportModule = (() => {
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
        <button class="tab-btn"        data-tab="kas"      onclick="ReportModule.switchTab('kas')">💰 Laporan Kas</button>
        <button class="tab-btn"        data-tab="order"    onclick="ReportModule.switchTab('order')">📋 Laporan Order</button>
        <button class="tab-btn"        data-tab="karyawan" onclick="ReportModule.switchTab('karyawan')">👷 Laporan Karyawan</button>
      </div>
      <div id="rpt-trend"></div>
      <div id="rpt-kas"      class="hidden"></div>
      <div id="rpt-order"    class="hidden"></div>
      <div id="rpt-karyawan" class="hidden"></div>
    `;
    switchTab('trend');
  }

  function switchTab(tab) {
    ['trend','kas','order','karyawan'].forEach(t => {
      document.getElementById(`rpt-${t}`)?.classList.toggle('hidden', t !== tab);
      document.querySelector(`[data-tab="${t}"]`)?.classList.toggle('active', t === tab);
    });
    const renders = { trend: renderTrend, kas: renderKas, order: renderOrder, karyawan: renderKaryawan };
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

  return { init, switchTab };
})();
window.ReportModule = ReportModule;

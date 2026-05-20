/* ============================================
   BECCA V2.0 — AI Assistant (Gemini-powered)
   Floating chat icon di pojok kanan-bawah → modal chat.
   Bisa query data BECCA (kas, inventory, orders, customer, AP, employee)
   via "tool functions" — AI execute function, dapat hasil, jawab user.
============================================ */
const AIAssistant = (() => {
  'use strict';

  const _GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash', 'gemini-2.0-flash-lite'];
  const HISTORY_KEY = 'becca_ai_chat_history';
  const MAX_HISTORY = 50;
  let _history = [];     // [{role:'user'|'assistant', text, time, data?}]
  let _busy = false;

  // ── Lifecycle ──────────────────────────────────────────────
  async function _getApiKey() {
    const settings = await DB.getSettings().catch(() => ({}));
    return settings.geminiApiKey || '';
  }

  function _loadHistory() {
    try { _history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { _history = []; }
  }
  function _saveHistory() {
    try {
      const trimmed = _history.slice(-MAX_HISTORY);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
    } catch {}
  }
  function clearHistory() {
    _history = [];
    _saveHistory();
    _renderMessages();
    Notify.info('Riwayat chat AI dihapus');
  }

  // ── Tool functions: AI can call these to fetch BECCA data ──────
  // Each returns small summary, not full data (cost-aware: keep prompt size small).
  const TOOLS = {
    /**
     * Get kas summary for periode (today / week / month / all).
     * Returns: { totalMasuk, totalKeluar, saldo, transaksiCount, topKategori[] }
     */
    async kas_summary({ periode = 'this-month' } = {}) {
      const kas = await DB.getKas().catch(() => []);
      const cfg = await DB.getSettings().catch(() => ({}));
      const saldoAwal = parseFloat(cfg.saldoAwal) || 0;
      const today = new Date();
      const ymdLocal = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      let fromDate = '';
      if (periode === 'today') fromDate = ymdLocal(today);
      else if (periode === 'week') fromDate = ymdLocal(new Date(today.getTime() - 7 * 86400000));
      else if (periode === 'this-month') fromDate = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-01';
      const filtered = fromDate ? kas.filter(r => (r.tgl || '') >= fromDate) : kas;
      const totalMasuk = filtered.filter(r => r.type === 'Kas').reduce((s, r) => s + (r.jumlah || 0), 0);
      const totalKeluar = filtered.filter(r => r.type !== 'Kas').reduce((s, r) => s + (r.jumlah || 0), 0);
      const byCat = {};
      filtered.filter(r => r.type !== 'Kas').forEach(r => { byCat[r.type || 'Lainnya'] = (byCat[r.type || 'Lainnya'] || 0) + (r.jumlah || 0); });
      const topKategori = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t, v]) => ({ kategori: t, nilai: v }));
      return {
        periode, fromDate, toDate: ymdLocal(today),
        totalMasuk, totalKeluar,
        saldoTotal: saldoAwal + totalMasuk - totalKeluar,
        transaksiCount: filtered.length,
        topKategori,
      };
    },

    /**
     * Get current stock level for items, optionally filter by name search.
     * Returns: list of items with stock info (max 20 to keep response small).
     */
    async inventory_stock({ search = '', lowStockOnly = false } = {}) {
      const items = await DB.getInventoryItems().catch(() => []);
      let filtered = items;
      if (search) {
        const q = search.toLowerCase();
        filtered = items.filter(i => (i.nama || '').toLowerCase().includes(q));
      }
      if (lowStockOnly) {
        filtered = filtered.filter(i => (i._stok || 0) <= (i.stokMin || 0));
      }
      filtered.sort((a, b) => (b._stok || 0) - (a._stok || 0));
      return {
        totalItems: items.length,
        matched: filtered.length,
        items: filtered.slice(0, 20).map(i => ({
          nama: i.nama,
          stok: i._stok || 0,
          satuan: i.satuan || '',
          stokMin: i.stokMin || 0,
          hargaSatuan: i.hargaSatuan || i._weightedAvgPrice || 0,
          status: (i._stok || 0) <= (i.stokMin || 0) ? 'MENIPIS' : 'AMAN',
        })),
      };
    },

    /**
     * Get top customers by total order value or pax.
     */
    async top_customers({ limit = 10, sortBy = 'pax' } = {}) {
      const orders = await DB.getOrders().catch(() => []);
      const byCust = {};
      orders.forEach(o => {
        const name = (o.namaCustomer || o.customer || 'Tidak Diketahui').trim();
        if (!byCust[name]) byCust[name] = { name, count: 0, pax: 0 };
        byCust[name].count++;
        byCust[name].pax += (parseInt(o.shift1) || 0) + (parseInt(o.shift2) || 0) + (parseInt(o.shift3) || 0);
      });
      const sorted = Object.values(byCust).sort((a, b) => (sortBy === 'count' ? b.count - a.count : b.pax - a.pax));
      return {
        totalCustomers: Object.keys(byCust).length,
        totalOrders: orders.length,
        top: sorted.slice(0, limit),
      };
    },

    /**
     * Get AP summary (Account Payable) — unpaid totals per vendor.
     */
    async ap_summary({ status = 'all' } = {}) {
      const ap = await DB.getAP().catch(() => []);
      let filtered = ap;
      if (status === 'unpaid') filtered = ap.filter(r => r.status !== 'LUNAS');
      else if (status === 'paid') filtered = ap.filter(r => r.status === 'LUNAS');
      const byVendor = {};
      filtered.forEach(r => {
        const v = String(r.vendor || r.supplier_nama || r.supplier || '').trim() || 'Tanpa Vendor';
        if (!byVendor[v]) byVendor[v] = { vendor: v, count: 0, total: 0, paid: 0 };
        byVendor[v].count++;
        byVendor[v].total += (r.total || 0);
        if (r.status === 'LUNAS') byVendor[v].paid += (r.total || 0);
      });
      const vendors = Object.values(byVendor).sort((a, b) => (b.total - b.paid) - (a.total - a.paid));
      return {
        totalAP: filtered.length,
        grandTotal: filtered.reduce((s, r) => s + (r.total || 0), 0),
        grandUnpaid: filtered.reduce((s, r) => s + (r.total || 0) - (r.terbayar || 0), 0),
        topVendors: vendors.slice(0, 10).map(v => ({ vendor: v.vendor, total: v.total, sisaHutang: v.total - v.paid })),
      };
    },

    /**
     * Get employee summary — by status, by division.
     */
    async employee_summary() {
      const emps = await DB.getEmployees().catch(() => []);
      const ACTIVE = ['AKTIF', 'ACTIVE', 'Active', 'Tetap', 'Kontrak', 'Percobaan', 'Harian'];
      const active = emps.filter(e => ACTIVE.includes(e.status));
      const totalGaji = active.reduce((s, e) => s + (e.gaji || e.gajiPokok || 0), 0);
      const totalHutang = active.reduce((s, e) => s + (e.sisaHutang || e.hutang || 0), 0);
      const byDiv = {};
      active.forEach(e => { const d = e.divisi || 'Lainnya'; byDiv[d] = (byDiv[d] || 0) + 1; });
      const topHutang = active
        .filter(e => (e.sisaHutang || e.hutang || 0) > 0)
        .sort((a, b) => (b.sisaHutang || b.hutang || 0) - (a.sisaHutang || a.hutang || 0))
        .slice(0, 5)
        .map(e => ({ nama: e.nama, divisi: e.divisi || '-', hutang: e.sisaHutang || e.hutang || 0 }));
      return {
        totalAktif: active.length,
        totalGaji,
        totalHutang,
        perDivisi: Object.entries(byDiv).map(([d, n]) => ({ divisi: d, jumlah: n })),
        topHutang,
      };
    },

    /**
     * Get invoice summary — outstanding AR.
     */
    async invoice_summary({ status = 'all' } = {}) {
      const invs = await DB.getInvoices().catch(() => []);
      let filtered = invs;
      if (status === 'unpaid') filtered = invs.filter(i => i.status !== 'LUNAS' && i.status !== 'PAID');
      const total = filtered.reduce((s, i) => s + (i.total || i.grandTotal || 0), 0);
      const terbayar = filtered.reduce((s, i) => s + (i.terbayar || 0), 0);
      return {
        count: filtered.length,
        grandTotal: total,
        terbayar,
        outstanding: total - terbayar,
      };
    },
  };

  // ── System prompt + tool schema ──────────────────────────
  function _buildSystemPrompt() {
    const userRole = Auth.currentUser()?.role || 'viewer';
    const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return `Kamu adalah BECCA Assistant — AI helper untuk aplikasi manajemen catering BECCA. Hari ini: ${today}. User role: ${userRole}.

Tugasmu: jawab pertanyaan user tentang data operasional dengan ringkas, akurat, dalam Bahasa Indonesia.

TOOLS (selalu pakai kalau user tanya angka):
- kas_summary(periode): kas masuk/keluar. periode: 'today'|'week'|'this-month'|'all'
- inventory_stock(search?, lowStockOnly?): stok inventory
- top_customers(limit?, sortBy?): customer terbesar ('pax'|'count')
- ap_summary(status?): AP vendor ('all'|'unpaid'|'paid')
- employee_summary(): karyawan & hutang
- invoice_summary(status?): invoice ('all'|'unpaid')

CARA PANGGIL TOOL — BALAS DENGAN HANYA JSON BLOCK INI, TANPA TEXT/PREAMBLE APAPUN:
\`\`\`json
{"tool": "nama_function", "args": {"key": "value"}}
\`\`\`

Sistem akan eksekusi, kasih hasilnya ke kamu. Setelah dapat hasil, JAWAB user dengan natural language ringkas + angka konkret.

ATURAN KETAT:
1. ❌ JANGAN tulis kalimat sebelum JSON tool call (NO preamble seperti "Baik, saya akan cek..." atau "Untuk membantu...")
2. ❌ JANGAN tanya konfirmasi periode/tanggal — pakai default sensible: kas/anomali → 'this-month', "minggu ini" → 'week', "hari ini" → 'today'
3. ✅ Klarifikasi HANYA kalau benar-benar ambigu (mis. nama item tidak jelas). Kalau bisa ditebak, langsung tool call.
4. ✅ Format Rupiah: "Rp 1.234.567" (titik) atau compact "Rp 1,2jt" / "Rp 250rb"
5. ✅ Jawaban max 5 kalimat kecuali user minta detail
6. ✅ Untuk pertanyaan umum (bukan data), jawab langsung tanpa tool

CONTOH BENAR:
User: "Berapa stok bawang merah?"
Kamu: \`\`\`json
{"tool":"inventory_stock","args":{"search":"bawang merah"}}
\`\`\`

User: "Cek anomali kas"
Kamu: \`\`\`json
{"tool":"kas_summary","args":{"periode":"this-month"}}
\`\`\`

User: "Kas minggu ini gimana?"
Kamu: \`\`\`json
{"tool":"kas_summary","args":{"periode":"week"}}
\`\`\`

CONTOH SALAH (jangan):
User: "Cek anomali kas"
Kamu: "Untuk cek anomali, saya perlu data kas. Mau periode mana?" ← SALAH, langsung tool call saja

User: "Halo"
Kamu: "Halo! Saya BECCA Assistant. Mau tanya apa? Bisa cek stok, kas, customer, AP, invoice, atau karyawan."`;
  }

  // ── Gemini API call ──────────────────────────────────────
  async function _callGemini(messages) {
    const apiKey = await _getApiKey();
    if (!apiKey) {
      Notify.error('API Key Gemini belum diisi. Buka Settings → Pengaturan Umum.');
      return null;
    }
    // Build content array: system → history → current
    const sys = _buildSystemPrompt();
    const contents = [
      { role: 'user', parts: [{ text: sys }] },
      { role: 'model', parts: [{ text: 'Baik, saya siap membantu.' }] },
      ...messages,
    ];
    // Backoff strategy: lebih agresif untuk free-tier (RPM limit). Total worst case ~15s.
    const RETRY_DELAYS = [0, 4000, 9000]; // ms — exponential-ish
    for (let attempt = 0; attempt < RETRY_DELAYS.length; attempt++) {
      if (attempt > 0) {
        await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt]));
      }
      const model = _GEMINI_MODELS[Math.min(attempt, _GEMINI_MODELS.length - 1)];
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents,
            generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
          }),
        });
        if (res.status === 403 || res.status === 401) {
          Notify.error('API key Gemini tidak valid');
          return null;
        }
        if (res.status === 429) {
          // Rate limit — wait longer, try fallback model
          if (attempt < RETRY_DELAYS.length - 1) continue;
          Notify.error('Quota Gemini habis. Coba lagi 1 menit lagi atau cek limit di Google AI Studio.');
          return null;
        }
        if (res.status === 503 || res.status === 500 || res.status === 404) {
          if (attempt < RETRY_DELAYS.length - 1) continue;
          Notify.error('Gemini sedang down — coba lagi nanti');
          return null;
        }
        if (!res.ok) {
          Notify.error('AI error: ' + res.status);
          return null;
        }
        const data = await res.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
      } catch (e) {
        if (attempt < RETRY_DELAYS.length - 1) continue;
        Notify.error('Gagal menghubungi AI: ' + e.message);
        return null;
      }
    }
    return null;
  }

  // ── Tool dispatch loop ───────────────────────────────────
  // AI may chain multiple tool calls (max 3 hops) before final answer.
  async function _processQuery(userQuery) {
    if (_busy) { Notify.warning('AI masih memproses, tunggu sebentar'); return; }
    _busy = true;
    _setInputDisabled(true);
    _history.push({ role: 'user', text: userQuery, time: Date.now() });
    _saveHistory();
    _renderMessages();
    _showTyping(true);

    try {
      // Build messages from history
      const messages = _history.slice(-20).map(h => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.text }],
      }));

      let aiText = await _callGemini(messages);
      if (!aiText) { _showTyping(false); return; }

      // Try parse as tool call (max 2 hops — reduce API call frequency, save quota)
      let lastToolName = null;
      let lastToolResult = null;
      for (let hop = 0; hop < 2; hop++) {
        const toolCall = _parseToolCall(aiText);
        if (!toolCall) break;
        // Execute tool
        if (typeof TOOLS[toolCall.tool] !== 'function') {
          aiText = `Tool "${toolCall.tool}" tidak tersedia.`;
          break;
        }
        let result;
        try {
          result = await TOOLS[toolCall.tool](toolCall.args || {});
        } catch (e) {
          result = { error: e.message || 'tool execution failed' };
        }
        lastToolName = toolCall.tool;
        lastToolResult = result;
        // Append tool result to conversation, ask AI to format response
        messages.push({ role: 'model', parts: [{ text: aiText }] });
        messages.push({ role: 'user', parts: [{ text: `[TOOL RESULT for ${toolCall.tool}]: ${JSON.stringify(result)}\n\nSekarang jawab user dengan natural language berdasarkan hasil di atas. Format ringkas, Bahasa Indonesia, pakai Rupiah format.` }] });
        const synthText = await _callGemini(messages);
        if (synthText) { aiText = synthText; continue; }
        // Synthesis API failed — fallback: format tool result client-side
        // so user gets at least the raw data instead of blank screen
        aiText = _formatToolResultFallback(lastToolName, lastToolResult);
        break;
      }

      _history.push({ role: 'assistant', text: aiText, time: Date.now() });
      _saveHistory();
      _renderMessages();
    } catch (e) {
      console.error('[AI]', e);
      Notify.error('Error: ' + e.message);
    } finally {
      _showTyping(false);
      _busy = false;
      _setInputDisabled(false);
      document.getElementById('ai-chat-input')?.focus();
    }
  }

  // Client-side fallback formatter: dipakai saat Gemini synthesis call gagal (503/429)
  // setelah tool sudah eksekusi sukses. Minimal user dapat data terstruktur, bukan layar kosong.
  function _formatToolResultFallback(toolName, result) {
    if (!result) return 'AI sedang sibuk — coba lagi sebentar.';
    if (result.error) return `Maaf, gagal ambil data: ${result.error}`;
    const fmt = (n) => 'Rp ' + (n || 0).toLocaleString('id-ID');
    const note = '\n\n_⚠ AI sedang sibuk (503). Data ditampilkan apa adanya tanpa interpretasi._';
    try {
      if (toolName === 'kas_summary') {
        const r = result;
        let txt = `**Ringkasan Kas (${r.periode || 'this-month'}):**\n`;
        txt += `• Masuk: ${fmt(r.totalMasuk)}\n`;
        txt += `• Keluar: ${fmt(r.totalKeluar)}\n`;
        txt += `• Saldo: ${fmt(r.saldo)}\n`;
        txt += `• Transaksi: ${r.transaksiCount || 0}`;
        if (Array.isArray(r.topKategori) && r.topKategori.length) {
          txt += `\n\n**Top Kategori Pengeluaran:**\n`;
          txt += r.topKategori.map((k, i) => `${i + 1}. ${k.kategori}: ${fmt(k.nilai)}`).join('\n');
        }
        return txt + note;
      }
      if (toolName === 'inventory_stock') {
        const items = result.items || result;
        if (!Array.isArray(items) || !items.length) return 'Tidak ada item ditemukan.' + note;
        let txt = `**Stok Inventory** (${items.length} item):\n`;
        txt += items.slice(0, 10).map(it => `• ${it.nama}: ${it.stok || 0} ${it.satuan || ''}${it.lowStock ? ' ⚠ MENIPIS' : ''}`).join('\n');
        if (items.length > 10) txt += `\n_...dan ${items.length - 10} item lainnya_`;
        return txt + note;
      }
      if (toolName === 'top_customers') {
        const list = result.customers || result;
        if (!Array.isArray(list) || !list.length) return 'Tidak ada data customer.' + note;
        let txt = `**Top Customer:**\n`;
        txt += list.slice(0, 10).map((c, i) => `${i + 1}. ${c.nama}: ${c.totalPax || c.count || 0} pax`).join('\n');
        return txt + note;
      }
      if (toolName === 'ap_summary') {
        const r = result;
        let txt = `**Ringkasan AP:**\n`;
        txt += `• Total: ${fmt(r.grandTotal || r.total)}\n`;
        txt += `• Terbayar: ${fmt(r.terbayar)}\n`;
        txt += `• Outstanding: ${fmt(r.outstanding)}\n`;
        txt += `• Vendor count: ${r.vendorCount || (r.byVendor && r.byVendor.length) || 0}`;
        return txt + note;
      }
      if (toolName === 'employee_summary') {
        const r = result;
        let txt = `**Ringkasan Karyawan:**\n`;
        txt += `• Total: ${r.totalKaryawan || r.count || 0} orang\n`;
        if (r.totalHutang != null) txt += `• Total Hutang: ${fmt(r.totalHutang)}\n`;
        if (r.totalGaji != null) txt += `• Total Gaji/Bulan: ${fmt(r.totalGaji)}`;
        return txt + note;
      }
      if (toolName === 'invoice_summary') {
        const r = result;
        let txt = `**Ringkasan Invoice:**\n`;
        txt += `• Total: ${fmt(r.grandTotal || r.total)}\n`;
        txt += `• Terbayar: ${fmt(r.terbayar)}\n`;
        txt += `• Outstanding: ${fmt(r.outstanding)}`;
        return txt + note;
      }
    } catch (e) {
      console.warn('[AI fallback formatter]', e);
    }
    // Generic fallback: just dump JSON
    return '**Data:**\n```\n' + JSON.stringify(result, null, 2).slice(0, 800) + '\n```' + note;
  }

  function _parseToolCall(text) {
    if (!text) return null;
    // Cari JSON block: ```json ... ``` atau plain {...}
    const m = text.match(/```json\s*({[\s\S]+?})\s*```/) || text.match(/^\s*({[\s\S]*?"tool"[\s\S]*?})\s*$/);
    if (!m) return null;
    try {
      const obj = JSON.parse(m[1]);
      if (obj && typeof obj.tool === 'string') return obj;
    } catch {}
    return null;
  }

  // ── UI rendering ─────────────────────────────────────────
  function _renderMessages() {
    const wrap = document.getElementById('ai-chat-messages');
    if (!wrap) return;
    if (_history.length === 0) {
      wrap.innerHTML = `
        <div style="padding:24px 16px;text-align:center;color:var(--text-3)">
          <div style="display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:12px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:16px;font-weight:800;letter-spacing:.04em;margin-bottom:8px">AI</div>
          <div style="font-size:13px;font-weight:600;color:var(--text-2);margin-bottom:6px">Halo! Saya BECCA Assistant</div>
          <div style="font-size:11px;line-height:1.5">Tanya apa saja tentang data BECCA. Contoh:</div>
          <div style="margin-top:12px;display:flex;flex-direction:column;gap:6px;max-width:280px;margin-left:auto;margin-right:auto">
            ${[
              'Berapa stok bawang merah?',
              'Customer top 5 bulan ini',
              'Total kas keluar minggu ini',
              'Item stok menipis ada apa saja?',
              'Vendor mana yang paling banyak hutangnya?',
            ].map(s => `<button onclick="AIAssistant.ask('${s.replace(/'/g, "\\'")}')" style="background:var(--surface2);border:1px solid var(--border);border-radius:14px;padding:7px 12px;font-size:11px;color:var(--text-2);cursor:pointer;text-align:left;transition:all .15s" onmouseover="this.style.background='var(--primary)';this.style.color='#fff';this.style.borderColor='var(--primary)'" onmouseout="this.style.background='var(--surface2)';this.style.color='var(--text-2)';this.style.borderColor='var(--border)'">${s}</button>`).join('')}
          </div>
        </div>`;
      return;
    }
    wrap.innerHTML = _history.map(m => _renderMessage(m)).join('');
    wrap.scrollTop = wrap.scrollHeight;
  }

  function _renderMessage(m) {
    const isUser = m.role === 'user';
    const time = new Date(m.time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    // Format text: bold **text**, line break, simple markdown
    const escaped = (m.text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const formatted = escaped
      .replace(/```json[\s\S]*?```/g, '<span style="color:var(--text-3);font-style:italic;font-size:10px">[memanggil data...]</span>')
      .replace(/```([\s\S]*?)```/g, '<pre style="background:var(--surface2);padding:6px 10px;border-radius:6px;font-size:11px;overflow-x:auto;margin:4px 0">$1</pre>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
    return `
      <div style="display:flex;${isUser ? 'justify-content:flex-end' : ''};margin-bottom:10px">
        <div style="max-width:80%">
          <div style="background:${isUser ? 'var(--primary)' : 'var(--surface2)'};color:${isUser ? '#fff' : 'var(--text)'};
            padding:10px 14px;border-radius:${isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px'};
            font-size:13px;line-height:1.5;word-wrap:break-word">${formatted}</div>
          <div style="font-size:9px;color:var(--text-3);margin-top:3px;${isUser ? 'text-align:right' : ''}">${time}</div>
        </div>
      </div>`;
  }

  function _showTyping(show) {
    let el = document.getElementById('ai-chat-typing');
    if (!el) {
      const wrap = document.getElementById('ai-chat-messages');
      if (!wrap) return;
      el = document.createElement('div');
      el.id = 'ai-chat-typing';
      el.style.cssText = 'padding:8px 14px;display:none';
      el.innerHTML = `<div style="background:var(--surface2);padding:10px 14px;border-radius:16px 16px 16px 4px;display:inline-flex;align-items:center;gap:6px">
        <span class="ai-dot" style="width:6px;height:6px;background:var(--text-3);border-radius:50%;animation:aiDot 1.4s infinite ease-in-out;animation-delay:-0.32s"></span>
        <span class="ai-dot" style="width:6px;height:6px;background:var(--text-3);border-radius:50%;animation:aiDot 1.4s infinite ease-in-out;animation-delay:-0.16s"></span>
        <span class="ai-dot" style="width:6px;height:6px;background:var(--text-3);border-radius:50%;animation:aiDot 1.4s infinite ease-in-out"></span>
      </div>`;
      wrap.appendChild(el);
    }
    el.style.display = show ? '' : 'none';
    if (show) {
      const wrap = document.getElementById('ai-chat-messages');
      if (wrap) wrap.scrollTop = wrap.scrollHeight;
    }
  }

  function _setInputDisabled(disabled) {
    const input = document.getElementById('ai-chat-input');
    const btn = document.getElementById('ai-chat-send');
    if (input) input.disabled = disabled;
    if (btn) btn.disabled = disabled;
  }

  // ── Public API ───────────────────────────────────────────
  function open() {
    _loadHistory();
    Modal.open({
      id: 'ai-assistant',
      title: 'BECCA AI Assistant',
      size: 'modal-lg',
      body: `
        <div id="ai-chat-messages" style="max-height:420px;overflow-y:auto;padding:8px 4px;margin-bottom:12px;border:1px solid var(--border);border-radius:10px;background:var(--surface);min-height:300px"></div>
        <div style="display:flex;gap:8px">
          <input type="text" id="ai-chat-input" class="form-control" placeholder="Tanya apa saja... (Enter untuk kirim)"
            style="flex:1" onkeydown="if(event.key==='Enter'){event.preventDefault();AIAssistant._sendInput()}">
          <button id="ai-chat-send" class="btn btn-primary" onclick="AIAssistant._sendInput()" style="white-space:nowrap">Kirim →</button>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;font-size:10px;color:var(--text-3)">
          <span>Powered by Google Gemini 2.5 Flash · Data lokal BECCA</span>
          <button onclick="AIAssistant.clearHistory()" style="background:transparent;border:none;color:var(--text-3);cursor:pointer;font-size:10px;text-decoration:underline">Hapus riwayat</button>
        </div>
        <style>@keyframes aiDot { 0%,80%,100% { opacity:.3 } 40% { opacity:1 } }</style>
      `,
      footer: '',
      onOpen: () => {
        _renderMessages();
        setTimeout(() => document.getElementById('ai-chat-input')?.focus(), 100);
      },
    });
  }

  function ask(question) {
    if (!document.getElementById('ai-chat-input')) {
      // Open modal first, then ask
      open();
      setTimeout(() => _processQuery(question), 300);
    } else {
      _processQuery(question);
    }
  }

  function _sendInput() {
    const input = document.getElementById('ai-chat-input');
    if (!input) return;
    const q = (input.value || '').trim();
    if (!q) return;
    input.value = '';
    _processQuery(q);
  }

  // ── Floating button (draggable) ──────────────────────────
  const FAB_POS_KEY = 'becca_ai_fab_pos';
  function _loadFabPos() {
    try {
      const raw = localStorage.getItem(FAB_POS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
  function _saveFabPos(pos) {
    try { localStorage.setItem(FAB_POS_KEY, JSON.stringify(pos)); } catch {}
  }
  function _applyFabPos(fab, pos) {
    const size = 52;
    const margin = 8;
    const maxX = window.innerWidth - size - margin;
    const maxY = window.innerHeight - size - margin;
    const x = Math.max(margin, Math.min(maxX, pos.x));
    const y = Math.max(margin, Math.min(maxY, pos.y));
    fab.style.left = x + 'px';
    fab.style.top = y + 'px';
    fab.style.right = 'auto';
    fab.style.bottom = 'auto';
  }
  function _injectFAB() {
    if (document.getElementById('ai-fab')) return;
    const fab = document.createElement('button');
    fab.id = 'ai-fab';
    fab.title = 'AI Assistant (drag untuk pindah, klik untuk buka)';
    fab.innerHTML = 'AI';
    fab.style.cssText = `
      position:fixed;right:18px;bottom:140px;
      width:52px;height:52px;border-radius:50%;border:none;
      background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;
      font-size:16px;font-weight:800;letter-spacing:.03em;cursor:grab;
      box-shadow:0 6px 20px rgba(99,102,241,.4);
      transition:box-shadow .2s;
      z-index:99;
      display:flex;align-items:center;justify-content:center;
      font-family:var(--font,sans-serif);
      touch-action:none;user-select:none;-webkit-user-select:none;
    `;
    document.body.appendChild(fab);

    // Restore saved position (if any)
    const saved = _loadFabPos();
    if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') {
      _applyFabPos(fab, saved);
    }

    // Drag state
    let dragStart = null;   // {x, y, fabX, fabY}
    let didMove = false;
    const DRAG_THRESHOLD = 5; // px — below this counts as click

    const onDown = (e) => {
      const pt = e.touches ? e.touches[0] : e;
      const rect = fab.getBoundingClientRect();
      dragStart = { x: pt.clientX, y: pt.clientY, fabX: rect.left, fabY: rect.top };
      didMove = false;
      fab.style.cursor = 'grabbing';
      fab.style.boxShadow = '0 10px 28px rgba(99,102,241,.6)';
      window.addEventListener('mousemove', onMove, { passive: false });
      window.addEventListener('touchmove', onMove, { passive: false });
      window.addEventListener('mouseup', onUp);
      window.addEventListener('touchend', onUp);
    };
    const onMove = (e) => {
      if (!dragStart) return;
      const pt = e.touches ? e.touches[0] : e;
      const dx = pt.clientX - dragStart.x;
      const dy = pt.clientY - dragStart.y;
      if (!didMove && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
        didMove = true;
      }
      if (didMove) {
        e.preventDefault?.();
        _applyFabPos(fab, { x: dragStart.fabX + dx, y: dragStart.fabY + dy });
      }
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchend', onUp);
      fab.style.cursor = 'grab';
      fab.style.boxShadow = '0 6px 20px rgba(99,102,241,.4)';
      if (didMove) {
        const rect = fab.getBoundingClientRect();
        _saveFabPos({ x: rect.left, y: rect.top });
      }
      dragStart = null;
      // suppress click after drag — handled below via didMove check in onclick
    };
    fab.addEventListener('mousedown', onDown);
    fab.addEventListener('touchstart', onDown, { passive: true });

    fab.onclick = (e) => {
      if (didMove) {
        e.preventDefault();
        e.stopPropagation();
        didMove = false;
        return;
      }
      open();
    };

    // Clamp to viewport on resize (e.g., rotate mobile)
    window.addEventListener('resize', () => {
      const cur = _loadFabPos();
      if (cur) _applyFabPos(fab, cur);
    });
  }

  function init() {
    _loadHistory();
    // Hide for non-logged-in users
    const cu = typeof Auth !== 'undefined' ? Auth.currentUser() : null;
    if (!cu) return;
    _injectFAB();
  }

  return { init, open, ask, clearHistory, _sendInput };
})();
window.AIAssistant = AIAssistant;

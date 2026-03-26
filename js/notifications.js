/* ============================================
   BECCA V2.0 — Notification Center
   Fix: mid variable initialization order
============================================ */
const NotifCenter = {
  _items: [],
  _DISMISS_KEY: 'becca_notif_dismissed',

  _getDismissed() {
    try { return new Set(JSON.parse(sessionStorage.getItem(this._DISMISS_KEY)||'[]')); } catch { return new Set(); }
  },
  _saveDismissed(set) {
    try { sessionStorage.setItem(this._DISMISS_KEY, JSON.stringify([...set])); } catch {}
  },
  _itemKey(item) { return `${item.type}|${item.title}`; },

  clearAll() {
    const dismissed = this._getDismissed();
    this._items.forEach(item => dismissed.add(this._itemKey(item)));
    this._saveDismissed(dismissed);
    this._items = [];
    this._updateBadge();
    if (window._notifModalId) Modal.close(window._notifModalId);
    Notify.success('Notifikasi dibersihkan');
  },

  async refresh() {
    this._items = [];
    const dismissed = this._getDismissed();
    const today = new Date().toISOString().split('T')[0];
    const soon  = new Date(Date.now() + 7*24*60*60*1000).toISOString().split('T')[0];

    try {
      // 1. Stok menipis
      const invItems = await DB.getInventoryItems().catch(()=>[]);
      const invLogs  = await DB.getInventory().catch(()=>[]);
      invItems.forEach(item => {
        const stok = invLogs.filter(l=>l.itemId===item.id).reduce((acc,l)=>{
          if(l.jenis==='MASUK')  return acc+(l.jumlah||0);
          if(l.jenis==='KELUAR') return acc-(l.jumlah||0);
          if(l.jenis==='OPNAME') return l.stokAkhir||acc;
          return acc;
        },0);
        if(stok<=(item.stokMin||0)){
          this._items.push({type:'stok',level:stok<=0?'danger':'warning',icon:'📦',
            title:stok<=0?`Stok Habis: ${item.nama}`:`Stok Menipis: ${item.nama}`,
            desc:`Sisa: ${stok} ${item.satuan||''} (min: ${item.stokMin||0})`,
            action:()=>App.navigate('inventory')});
        }
      });

      // 2. Hutang karyawan
      const employees = await DB.getEmployees().catch(()=>[]);
      employees.filter(e=>e.status==='ACTIVE'&&(e.sisaHutang||0)>0)
        .sort((a,b)=>(b.sisaHutang||0)-(a.sisaHutang||0)).slice(0,5)
        .forEach(e=>{this._items.push({type:'hutang',level:'warning',icon:'💸',
          title:`Hutang: ${e.nama}`,desc:`Sisa hutang: ${Utils.formatRupiah(e.sisaHutang)}`,
          action:()=>App.navigate('employee')});});

      // 3. Invoice jatuh tempo
      const invoices = await DB.getInvoices().catch(()=>[]);
      invoices.filter(inv=>inv.status!=='LUNAS'&&inv.jatuhTempo).forEach(inv=>{
        const isLate=inv.jatuhTempo<today, isSoon=!isLate&&inv.jatuhTempo<=soon;
        if(isLate||isSoon) this._items.push({type:'invoice',level:isLate?'danger':'warning',icon:'🧾',
          title:isLate?`Invoice Terlambat: ${inv.noinv||''}`:`Invoice JT: ${inv.noinv||''}`,
          desc:`${inv.customer||''} · ${inv.jatuhTempo}`,action:()=>App.navigate('invoice')});
      });

      // 4. AP jatuh tempo
      const apList = await DB.getAP().catch(()=>[]);
      apList.filter(ap=>ap.status!=='LUNAS'&&ap.jatuhTempo).forEach(ap=>{
        const isLate=ap.jatuhTempo<today, isSoon=!isLate&&ap.jatuhTempo<=soon;
        if(isLate||isSoon) this._items.push({type:'ap',level:isLate?'danger':'warning',icon:'💳',
          title:isLate?`AP Terlambat: ${ap.supplier||''}`:`AP JT: ${ap.supplier||''}`,
          desc:`${Utils.formatRupiah(ap.total||0)} · ${ap.jatuhTempo}`,action:()=>App.navigate('ap')});
      });

      // 5. Task yang deadline hari ini / terlambat
      const tasks = await DB.getTasks().catch(()=>[]);
      const lateTasks = tasks.filter(t=>t.status!=='done'&&t.deadline&&t.deadline<=today);
      if(lateTasks.length>0) this._items.push({type:'task',level:'warning',icon:'✅',
        title:`${lateTasks.length} Task Deadline Terlewat`,
        desc:lateTasks.slice(0,3).map(t=>t.judul).join(', ')+(lateTasks.length>3?'...':''),
        action:()=>App.navigate('task')});

    } catch(e){ console.error('NotifCenter error:',e); }

    // Filter out dismissed items (session-scoped)
    this._items = this._items.filter(item => !dismissed.has(this._itemKey(item)));
    this._updateBadge();
    return this._items;
  },

  _updateBadge() {
    const badge = document.getElementById('notif-badge');
    if(!badge) return;
    const count = this._items.length;
    if(count>0){
      badge.style.cssText = `display:flex!important;align-items:center;justify-content:center;
        position:absolute;top:4px;right:4px;min-width:16px;height:16px;
        background:var(--danger);border-radius:999px;font-size:8px;font-weight:700;
        color:white;border:1.5px solid var(--surface);padding:0 3px;`;
      badge.textContent = count>9?'9+':count;
    } else {
      badge.style.display = 'none';
      badge.textContent = '';
    }
  },

  async showPanel() {
    await this.refresh();
    const items = this._items;

    /* FIX: Buat mid dulu dengan placeholder footer, lalu isi footer setelah mid terdefinisi */
    const mid = Utils.uid(); Modal.open({ id: mid,
      title : `🔔 Notifikasi ${items.length>0?`(${items.length})`:''}`,
      size  : 'modal-md',
      body  : items.length===0 ? `
        <div class="empty-state" style="height:200px">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <h4>Semua Aman! 🎉</h4>
          <p>Tidak ada notifikasi saat ini</p>
        </div>
      ` : `
        <div style="display:flex;flex-direction:column;gap:var(--s2)">
          ${items.map((item,i)=>`
            <div onclick="NotifCenter._clickItem(${i})"
                 style="display:flex;align-items:flex-start;gap:var(--s3);
                        padding:var(--s3) var(--s4);
                        background:${item.level==='danger'?'rgba(239,68,68,.08)':'rgba(245,158,11,.08)'};
                        border:1px solid ${item.level==='danger'?'rgba(239,68,68,.2)':'rgba(245,158,11,.2)'};
                        border-radius:var(--r-md);cursor:pointer;transition:transform .15s"
                 onmouseover="this.style.transform='translateX(4px)'"
                 onmouseout="this.style.transform=''">
              <span style="font-size:20px;flex-shrink:0">${item.icon}</span>
              <div style="flex:1;min-width:0">
                <div style="font-weight:600;font-size:13px;
                            color:${item.level==='danger'?'var(--danger)':'var(--warning)'};
                            margin-bottom:2px">${item.title}</div>
                <div style="font-size:12px;color:var(--text-3)">${item.desc}</div>
              </div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                   width="14" height="14" style="flex-shrink:0;color:var(--text-3)">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </div>
          `).join('')}
        </div>
      `,
      footer: items.length > 0
        ? `<button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="NotifCenter.clearAll()">Clear All</button>
           <button class="btn btn-ghost" id="notif-close-btn">Tutup</button>`
        : `<button class="btn btn-ghost" id="notif-close-btn">Tutup</button>`,
    });

    const closeBtn = document.getElementById('notif-close-btn');
    if(closeBtn) closeBtn.onclick = () => Modal.close(mid);

    window._notifModalId = mid;
    return mid;
  },

  _clickItem(i) {
    const item = this._items[i];
    if(!item) return;
    if(window._notifModalId) Modal.close(window._notifModalId);
    item.action?.();
  },
};
window.NotifCenter = NotifCenter;

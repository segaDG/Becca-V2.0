/* ============================================
   BECCA V2.0 — Utils Extensions
   Load setelah utils.js — tambahkan metode extra
   ============================================ */

Object.assign(Utils, {

  MONTHS_SHORT: ['Jan','Feb','Mar','Apr','Mei','Jun',
                 'Jul','Ags','Sep','Okt','Nov','Des'],

  /**
   * Form auto-save draft — simpan isi form ke localStorage saat user mengetik,
   * restore otomatis saat form dibuka lagi. Hindari kehilangan input saat
   * modal tidak sengaja tertutup / browser crash / accidentaly refresh.
   *
   * Usage di onOpen modal:
   *   Utils.formDraft.attach('emp-modal', 'employee-add')
   * Setelah submit sukses:
   *   Utils.formDraft.clear('employee-add')
   *
   * Auto-skip: field type file/password tidak disimpan (privacy).
   */
  /**
   * Saved Views / Quick Filters — simpan kombinasi filter dengan nama.
   *
   * Usage di modul kas/inventory/ap:
   *   // Save:  Utils.savedViews.save('kas', 'Belanja Pasar bulan ini', _filter);
   *   // List:  Utils.savedViews.list('kas') → [{name, filter, createdAt}]
   *   // Apply: setFilter, lalu re-render
   *   // Dropdown UI siap pakai:
   *   //   Utils.savedViews.render({moduleKey:'kas', current:_filter, onApply:(f)=>setFilter(f)})
   */
  savedViews: {
    _KEY: 'becca_views_',
    list(moduleKey) {
      try { return JSON.parse(localStorage.getItem(this._KEY + moduleKey) || '[]'); } catch { return []; }
    },
    save(moduleKey, name, filter) {
      if (!name || !filter) return;
      const arr = this.list(moduleKey).filter(v => v.name !== name);
      arr.unshift({ name, filter, createdAt: new Date().toISOString() });
      try { localStorage.setItem(this._KEY + moduleKey, JSON.stringify(arr.slice(0, 20))); } catch {}
    },
    delete(moduleKey, name) {
      const arr = this.list(moduleKey).filter(v => v.name !== name);
      try { localStorage.setItem(this._KEY + moduleKey, JSON.stringify(arr)); } catch {}
    },
    /** Render dropdown button kecil. Return HTML — pasang ke tempat filter bar. */
    renderButton(moduleKey, opts = {}) {
      const id = 'sv-btn-' + moduleKey;
      const views = this.list(moduleKey);
      const hasViews = views.length > 0;
      return `<div style="position:relative;display:inline-block">
        <button id="${id}" onclick="Utils.savedViews._toggleMenu('${moduleKey}', '${opts.onApply||''}', '${opts.getCurrent||''}', '${opts.onAfterApply||''}')" title="Filter tersimpan"
          style="padding:6px 10px;border:1px solid var(--border);border-radius:7px;background:var(--surface2);color:var(--text-2);font-size:12px;cursor:pointer;display:inline-flex;align-items:center;gap:5px${hasViews?';color:var(--primary);background:rgba(99,102,241,.08);border-color:rgba(99,102,241,.3)':''}">
          ⭐ Views${hasViews?` <span style="font-size:10px;color:var(--text-3)">${views.length}</span>`:''}
        </button>
      </div>`;
    },
    _toggleMenu(moduleKey, onApplyFnName, getCurrentFnName, onAfterApplyFnName) {
      document.getElementById('sv-menu')?.remove();
      const btn = document.getElementById('sv-btn-' + moduleKey);
      if (!btn) return;
      const views = this.list(moduleKey);
      const r = btn.getBoundingClientRect();
      const menu = document.createElement('div');
      menu.id = 'sv-menu';
      menu.style.cssText = `position:fixed;z-index:9000;top:${r.bottom+4}px;left:${Math.max(8, r.left - 80)}px;background:var(--surface);border:1px solid var(--border);border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.2);min-width:240px;padding:6px;max-height:340px;overflow-y:auto`;
      let html = '';
      if (views.length) {
        html += views.map((v, i) => `
          <div style="display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:6px;cursor:pointer" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''" onclick="Utils.savedViews._apply('${moduleKey}', ${i}, '${onApplyFnName}', '${onAfterApplyFnName}')">
            <span style="flex:1;font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${Utils.esc(v.name)}</span>
            <button title="Hapus view" onclick="event.stopPropagation();Utils.savedViews._del('${moduleKey}', '${Utils.esc(v.name).replace(/'/g,"\\'")}','${onApplyFnName}','${getCurrentFnName}','${onAfterApplyFnName}')" style="border:none;background:transparent;cursor:pointer;color:var(--text-3);font-size:11px;padding:2px 4px">✕</button>
          </div>`).join('');
        html += '<div style="border-top:1px solid var(--border);margin:4px -6px"></div>';
      } else {
        html += '<div style="padding:10px;font-size:11px;color:var(--text-3);text-align:center">Belum ada view tersimpan</div>';
      }
      html += `<div style="padding:6px 8px;cursor:pointer;border-radius:6px;display:flex;align-items:center;gap:6px;color:var(--primary);font-weight:600;font-size:12px" onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''" onclick="Utils.savedViews._saveCurrent('${moduleKey}', '${getCurrentFnName}', '${onApplyFnName}', '${onAfterApplyFnName}')">
        ➕ Simpan filter saat ini
      </div>`;
      menu.innerHTML = html;
      document.body.appendChild(menu);
      setTimeout(() => {
        const closeOnOutside = (e) => {
          if (!menu.contains(e.target) && e.target !== btn) {
            menu.remove();
            document.removeEventListener('click', closeOnOutside);
          }
        };
        document.addEventListener('click', closeOnOutside);
      }, 0);
    },
    _apply(moduleKey, idx, onApplyFnName, onAfterApplyFnName) {
      const v = this.list(moduleKey)[idx];
      if (!v) return;
      try {
        const fn = onApplyFnName.split('.').reduce((o,k) => o?.[k], window);
        fn?.(v.filter);
        const after = onAfterApplyFnName && onAfterApplyFnName.split('.').reduce((o,k) => o?.[k], window);
        after?.();
      } catch (e) { console.warn('savedViews apply:', e); }
      document.getElementById('sv-menu')?.remove();
      Notify?.success?.('View dimuat: ' + v.name);
    },
    _saveCurrent(moduleKey, getCurrentFnName, onApplyFnName, onAfterApplyFnName) {
      const name = prompt('Nama view (mis. "Bulan Mei TBC"):');
      if (!name) return;
      try {
        const fn = getCurrentFnName.split('.').reduce((o,k) => o?.[k], window);
        const cur = fn?.() || {};
        this.save(moduleKey, name.trim(), cur);
        Notify?.success?.('View disimpan: ' + name.trim());
      } catch (e) { Notify?.error?.('Gagal simpan view', e.message); }
      document.getElementById('sv-menu')?.remove();
    },
    _del(moduleKey, name, onApplyFnName, getCurrentFnName, onAfterApplyFnName) {
      this.delete(moduleKey, name);
      Notify?.info?.('View dihapus: ' + name);
      // Re-open menu dengan list ter-update
      setTimeout(() => this._toggleMenu(moduleKey, onApplyFnName, getCurrentFnName, onAfterApplyFnName), 50);
    },
  },

  /**
   * Bulk Action Bar — floating bar di bawah layar saat ada item dipilih.
   * Infrastruktur generik untuk modul yang mau support bulk operations.
   *
   * Usage:
   *   Utils.bulkActionBar.show({
   *     count: 5,
   *     actions: [
   *       { label:'Hapus', icon:'🗑️', danger:true, onClick:()=>deleteSelected() },
   *       { label:'Export', icon:'⬇', onClick:()=>exportSelected() },
   *     ],
   *     onClear: () => clearSelection(),
   *   });
   *   Utils.bulkActionBar.hide();   // saat selection kosong
   */
  /**
   * Soft-delete dengan undo snackbar — wrap pattern:
   *   1. Hapus item dari array + DB
   *   2. Tampilkan snackbar "X dihapus" dengan tombol Undo (5 detik)
   *   3. Klik Undo → kembalikan item (push back ke array + save DB)
   *
   * Usage di module:
   *   Utils.softDeleteWithUndo({
   *     label: 'Task dihapus',
   *     item: task,
   *     remove: () => { _tasks = _tasks.filter(x => x.id !== task.id); render(); },
   *     restore: () => { _tasks.push(task); render(); },
   *     saveRemove: () => DB.deleteTask(task.id),
   *     saveRestore: () => DB.saveTask(task),
   *   });
   *
   * Memberikan UX undo konsisten lintas modul — user tidak perlu khawatir
   * salah hapus, ada 5 detik untuk batalkan.
   */
  softDeleteWithUndo({ label, item, remove, restore, saveRemove, saveRestore, ms = 5000 }) {
    if (!item) return;
    try { remove?.(); } catch (e) { Notify?.error?.('Gagal hapus', e.message); return; }
    saveRemove?.().catch?.(e => console.warn('softDelete saveRemove:', e));
    if (typeof Notify !== 'undefined' && Notify.undo) {
      Notify.undo(label || 'Item dihapus', () => {
        try { restore?.(); } catch (e) { Notify?.error?.('Gagal restore', e.message); return; }
        saveRestore?.().catch?.(e => console.warn('softDelete saveRestore:', e));
      }, ms);
    }
  },

  /**
   * Onboarding Tour Engine — guided walkthrough dengan highlight + tooltip.
   *
   * Steps: array of { selector?, title, message, position?, action? }
   *   selector — CSS selector elemen untuk di-highlight (opsional;
   *              null = modal di tengah tanpa highlight)
   *   action   — fungsi dipanggil SEBELUM step di-render
   *              (mis. App.navigate('kas') untuk pindah halaman dulu)
   *
   * Snooze: user centang "Jangan tampilkan lagi" → cooldown 15 hari.
   * Trigger ulang manual via Utils.tour.run(id, steps, { force: true }).
   */
  tour: {
    _SEEN_KEY: 'becca_tour_seen_',
    _SNOOZE_MS: 15 * 24 * 60 * 60 * 1000, // 15 hari
    isSnoozed(id) {
      try {
        const until = parseInt(localStorage.getItem(this._SEEN_KEY + id) || '0');
        return until > Date.now();
      } catch { return false; }
    },
    snooze(id, ms = this._SNOOZE_MS) {
      try { localStorage.setItem(this._SEEN_KEY + id, String(Date.now() + ms)); } catch {}
    },
    clearSnooze(id) { try { localStorage.removeItem(this._SEEN_KEY + id); } catch {} },
    run(id, steps, opts = {}) {
      if (!opts.force && this.isSnoozed(id)) return;
      if (!Array.isArray(steps) || !steps.length) return;
      // Inject CSS sekali
      if (!document.getElementById('_tour-css')) {
        const s = document.createElement('style');
        s.id = '_tour-css';
        s.textContent = `
          @keyframes tourPulse{0%,100%{box-shadow:0 0 0 4px rgba(99,102,241,.3)}50%{box-shadow:0 0 0 10px rgba(99,102,241,.5)}}
          @keyframes tourTipIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
          ._tour-dim{position:fixed;background:rgba(0,0,0,.55);z-index:10500;pointer-events:auto}
        `;
        document.head.appendChild(s);
      }
      let idx = 0;
      let snoozeChecked = false;
      const cleanup = () => {
        document.querySelectorAll('._tour-dim, #_tour-spot, #_tour-tip').forEach(el => el.remove());
        if (snoozeChecked) this.snooze(id);
      };
      const render = async () => {
        const step = steps[idx];
        if (!step) { cleanup(); return; }
        if (typeof step.action === 'function') {
          try { await step.action(); } catch {}
          await new Promise(r => setTimeout(r, 300)); // tunggu DOM update
        }
        document.querySelectorAll('._tour-dim, #_tour-spot, #_tour-tip').forEach(el => el.remove());
        const target = step.selector ? document.querySelector(step.selector) : null;
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          await new Promise(r => setTimeout(r, 250));
          const r = target.getBoundingClientRect();
          const pad = 6;
          const t = Math.max(0, r.top - pad), l = Math.max(0, r.left - pad);
          const w = Math.min(window.innerWidth, r.width + pad*2);
          const h = Math.min(window.innerHeight, r.height + pad*2);
          // 4 dimming rectangles around target
          const mk = (s) => { const d = document.createElement('div'); d.className = '_tour-dim'; d.style.cssText = s; document.body.appendChild(d); return d; };
          mk(`top:0;left:0;right:0;height:${t}px`);
          mk(`top:${t}px;left:0;width:${l}px;height:${h}px`);
          mk(`top:${t}px;left:${l+w}px;right:0;height:${h}px`);
          mk(`top:${t+h}px;left:0;right:0;bottom:0`);
          const spot = document.createElement('div');
          spot.id = '_tour-spot';
          spot.style.cssText = `position:fixed;top:${t}px;left:${l}px;width:${w}px;height:${h}px;border:2px solid var(--primary);border-radius:8px;pointer-events:none;z-index:10501;animation:tourPulse 1.6s ease-in-out infinite`;
          document.body.appendChild(spot);
        } else {
          const d = document.createElement('div');
          d.className = '_tour-dim';
          d.style.cssText = 'inset:0';
          document.body.appendChild(d);
        }
        // Tooltip
        const tip = document.createElement('div');
        tip.id = '_tour-tip';
        const r2 = target ? target.getBoundingClientRect() : null;
        const tipW = 320, tipMargin = 16;
        let top, left, transform = '';
        if (r2) {
          // Coba di bawah dulu; fallback ke atas jika tidak muat
          if (r2.bottom + tipMargin + 200 < window.innerHeight) {
            top = r2.bottom + tipMargin;
          } else {
            top = Math.max(12, r2.top - tipMargin - 200);
          }
          left = Math.max(12, Math.min(window.innerWidth - tipW - 12, r2.left));
        } else {
          top = '50%'; left = '50%'; transform = 'translate(-50%, -50%)';
        }
        tip.style.cssText = `position:fixed;z-index:10502;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:14px 16px;box-shadow:0 16px 40px rgba(0,0,0,.35);width:${tipW}px;max-width:calc(100vw - 24px);pointer-events:auto;animation:tourTipIn .22s ease;top:${typeof top==='number'?top+'px':top};left:${typeof left==='number'?left+'px':left};${transform?'transform:'+transform:''}`;
        tip.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <span style="font-size:10px;font-weight:700;color:var(--text-3);letter-spacing:.08em;text-transform:uppercase">Tur · ${idx+1}/${steps.length}</span>
            <button data-act="close" style="background:transparent;border:none;color:var(--text-3);cursor:pointer;font-size:16px;padding:0;line-height:1">✕</button>
          </div>
          <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:6px">${Utils.esc(step.title||'')}</div>
          <div style="font-size:12.5px;color:var(--text-2);line-height:1.55">${step.message||''}</div>
          <label style="display:flex;align-items:center;gap:6px;margin-top:12px;font-size:11px;color:var(--text-3);cursor:pointer;user-select:none">
            <input type="checkbox" data-act="snooze" ${snoozeChecked?'checked':''} style="width:14px;height:14px;cursor:pointer">
            <span>Jangan tampilkan lagi (15 hari)</span>
          </label>
          <div style="display:flex;gap:6px;margin-top:10px;justify-content:flex-end">
            ${idx > 0 ? '<button data-act="prev" style="background:transparent;border:1px solid var(--border);border-radius:7px;padding:7px 12px;font-size:12px;cursor:pointer">← Kembali</button>' : ''}
            ${idx < steps.length - 1
              ? '<button data-act="next" style="background:var(--primary);color:#fff;border:none;border-radius:7px;padding:7px 14px;font-size:12px;font-weight:700;cursor:pointer">Lanjut →</button>'
              : '<button data-act="done" style="background:var(--primary);color:#fff;border:none;border-radius:7px;padding:7px 14px;font-size:12px;font-weight:700;cursor:pointer">Selesai ✓</button>'}
          </div>`;
        document.body.appendChild(tip);
        tip.querySelector('[data-act="snooze"]').addEventListener('change', (e) => { snoozeChecked = e.target.checked; });
        tip.querySelectorAll('button').forEach(btn => btn.addEventListener('click', () => {
          const a = btn.dataset.act;
          if (a === 'next') { idx++; render(); }
          else if (a === 'prev') { idx--; render(); }
          else { cleanup(); }
        }));
      };
      render();
    },
  },

  /**
   * Virtual Scrolling — render hanya baris yang terlihat di viewport
   * (+ buffer atas-bawah). Mengurangi DOM nodes dari ribuan jadi puluhan.
   *
   * Pas untuk: activity log, history pesan, kas log lama (>500 baris).
   *
   * Usage:
   *   Utils.virtualScroll({
   *     container: document.getElementById('log-list'),  // overflow-y:auto
   *     items: arrayOfData,
   *     rowHeight: 40,             // tinggi fixed per row (px)
   *     buffer: 6,                 // jumlah row tambahan di atas/bawah viewport
   *     renderRow: (item, idx) => `<div class="row" style="height:40px">...</div>`,
   *     onMount: (containerEl) => {},  // optional, dipanggil setelah render
   *   });
   *
   * Catatan: ini OPT-IN — tidak diaplikasikan ke kas/inventory yang sudah
   * paginasi server-side. Cocok kalau dataset full di-load ke client.
   */
  virtualScroll({ container, items, rowHeight, buffer = 6, renderRow, onMount }) {
    if (!container || !Array.isArray(items) || !rowHeight || !renderRow) return null;
    const total = items.length;
    const totalHeight = total * rowHeight;
    // Wrapper structure: spacer (full height) + window (absolute, sliding)
    container.innerHTML = `
      <div style="position:relative;height:${totalHeight}px">
        <div data-vs-window style="position:absolute;top:0;left:0;right:0"></div>
      </div>`;
    const winEl = container.querySelector('[data-vs-window]');
    let lastFirst = -1, lastLast = -1;
    const render = () => {
      const scroll = container.scrollTop;
      const viewH = container.clientHeight;
      const first = Math.max(0, Math.floor(scroll / rowHeight) - buffer);
      const last = Math.min(total, Math.ceil((scroll + viewH) / rowHeight) + buffer);
      if (first === lastFirst && last === lastLast) return; // skip jika range sama
      lastFirst = first; lastLast = last;
      let html = '';
      for (let i = first; i < last; i++) html += renderRow(items[i], i);
      winEl.style.transform = `translateY(${first * rowHeight}px)`;
      winEl.innerHTML = html;
    };
    const onScroll = () => requestAnimationFrame(render);
    container.addEventListener('scroll', onScroll, { passive: true });
    render();
    onMount?.(container);
    // Return controller untuk update/dispose
    return {
      update(newItems) {
        items.length = 0; items.push(...newItems);
        const newTotalH = newItems.length * rowHeight;
        container.querySelector('div').style.height = newTotalH + 'px';
        lastFirst = lastLast = -1; render();
      },
      destroy() { container.removeEventListener('scroll', onScroll); container.innerHTML = ''; },
    };
  },

  bulkActionBar: {
    _id: '_becca-bulk-bar',
    show({ count = 0, actions = [], onClear }) {
      this.hide();
      if (count <= 0) return;
      const bar = document.createElement('div');
      bar.id = this._id;
      bar.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(0);z-index:9000;background:#1e293b;color:#f8fafc;border-radius:12px;padding:8px 8px 8px 16px;display:flex;align-items:center;gap:8px;box-shadow:0 12px 28px rgba(0,0,0,.4);animation:bulkBarUp .2s cubic-bezier(.34,1.4,.64,1);max-width:calc(100vw - 24px)`;
      bar.innerHTML = `
        <span style="font-size:13px;font-weight:600">${count} dipilih</span>
        <span style="width:1px;height:18px;background:rgba(248,250,252,.2);margin:0 4px"></span>
        ${actions.map((a,i)=>`<button data-i="${i}" style="background:${a.danger?'#dc2626':'rgba(255,255,255,.12)'};color:#fff;border:none;border-radius:7px;padding:6px 12px;font-size:12px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:5px">${a.icon||''} ${a.label}</button>`).join('')}
        <button id="_bulk-clear" title="Batal pilih" style="background:transparent;border:none;color:rgba(248,250,252,.6);cursor:pointer;font-size:18px;padding:0 4px 0 6px;line-height:1">✕</button>
      `;
      if (!document.getElementById('_bulk-bar-css')) {
        const s = document.createElement('style');
        s.id = '_bulk-bar-css';
        s.textContent = `@keyframes bulkBarUp{from{opacity:0;transform:translateX(-50%) translateY(20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`;
        document.head.appendChild(s);
      }
      document.body.appendChild(bar);
      bar.querySelectorAll('button[data-i]').forEach(btn => {
        btn.onclick = () => { try { actions[+btn.dataset.i]?.onClick?.(); } catch (e) { Notify?.error?.('Aksi gagal', e.message); } };
      });
      bar.querySelector('#_bulk-clear').onclick = () => { onClear?.(); this.hide(); };
    },
    hide() { document.getElementById(this._id)?.remove(); },
    update(count, actions, onClear) { this.show({ count, actions, onClear }); },
  },

  formDraft: {
    _KEY_PREFIX: 'becca_draft_',
    _esc(s) { return (window.CSS?.escape || (x=>String(x).replace(/[^\w-]/g,'\\$&')))(s); },
    // Selector untuk semua input yang punya identifier (name ATAU id)
    _selector: 'input[name], textarea[name], select[name], input[id], textarea[id], select[id]',
    _idOf(inp) { return inp.name || inp.id; },
    attach(modalIdOrEl, key, opts = {}) {
      const el = typeof modalIdOrEl === 'string' ? document.getElementById(modalIdOrEl) : modalIdOrEl;
      if (!el || !key) return;
      const k = this._KEY_PREFIX + key;
      // Restore existing draft (skip kalau field sudah berisi — mode edit jangan ditimpa)
      let saved = null;
      try { saved = JSON.parse(localStorage.getItem(k) || 'null'); } catch {}
      if (saved && typeof saved === 'object') {
        let restored = 0;
        Object.entries(saved).forEach(([name, val]) => {
          const inp = el.querySelector(`[name="${this._esc(name)}"], #${this._esc(name)}`);
          if (!inp) return;
          if (inp.type === 'file' || inp.type === 'password') return;
          if (inp.type === 'checkbox' || inp.type === 'radio') {
            if (!inp.checked) { inp.checked = !!val; restored++; }
          } else if (!inp.value) {
            inp.value = val; restored++;
          }
        });
        if (restored > 0 && opts.notify !== false && typeof Notify !== 'undefined') {
          Notify.info('Draft form dipulihkan', `${restored} field diisi dari sesi sebelumnya`);
        }
      }
      // Debounced save on input
      const save = Utils.debounce(() => {
        const data = {};
        el.querySelectorAll(this._selector).forEach(inp => {
          if (inp.type === 'file' || inp.type === 'password') return;
          const id = this._idOf(inp); if (!id) return;
          if (inp.type === 'checkbox' || inp.type === 'radio') data[id] = inp.checked ? 1 : 0;
          else data[id] = inp.value;
        });
        try { localStorage.setItem(k, JSON.stringify(data)); } catch {}
      }, 500);
      el.addEventListener('input', save);
      el.addEventListener('change', save);
    },
    clear(key) { try { localStorage.removeItem(this._KEY_PREFIX + key); } catch {} },
    list() {
      const out = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(this._KEY_PREFIX)) out.push(k.slice(this._KEY_PREFIX.length));
      }
      return out;
    },
  },

  formatDateInput(d) {
    return Utils.formatDate(d, 'yyyy-mm-dd');
  },

  slugify(str) {
    return String(str).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  },

  toggle(el, show) {
    if (el) el.classList.toggle('hidden', show === undefined ? undefined : !show);
  },

  setHTML(sel, html) {
    const el = typeof sel === 'string' ? document.querySelector(sel) : sel;
    if (el) el.innerHTML = html;
  },

  getFormData(formEl) {
    const data = {};
    const fd = new FormData(formEl);
    fd.forEach((v, k) => { data[k] = v; });
    return data;
  },

  fillForm(formEl, data) {
    Object.entries(data).forEach(([k, v]) => {
      const el = formEl.querySelector(`[name="${k}"]`);
      if (!el) return;
      if (el.type === 'checkbox') el.checked = !!v;
      else el.value = v ?? '';
    });
  },

  validate(data, rules) {
    const errors = {};
    Object.entries(rules).forEach(([field, rule]) => {
      if (rule.required && !data[field]) {
        errors[field] = `${rule.label || field} wajib diisi`;
      }
    });
    return errors;
  },

  sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
  },

  sortBy(arr, key, dir = 'asc') {
    return [...arr].sort((a, b) => {
      const va = a[key]; const vb = b[key];
      if (va < vb) return dir === 'asc' ? -1 : 1;
      if (va > vb) return dir === 'asc' ?  1 : -1;
      return 0;
    });
  },

  parseRupiah(str) {
    return parseInt(String(str).replace(/\D/g, '')) || 0;
  },

  /* ── Searchable combobox ──────────────────────────────────
     initCombo(inputEl, items, { onSelect, frequency })
     items     : string[] | {label, value, ...extra}[]
     frequency : { [value]: number } — higher = shown first
     Returns { destroy() }
  ─────────────────────────────────────────────────────────── */
  initCombo(inputEl, items, { onSelect, frequency } = {}) {
    // Destroy previous combo on same input to prevent DOM leak
    if (inputEl._comboHandle) { inputEl._comboHandle.destroy(); inputEl._comboHandle = null; }

    const norm    = arr => arr.map(i => typeof i === 'string' ? { label: i, value: i } : i);
    const entries = norm(items);
    const freq    = frequency || {};

    const drop = document.createElement('div');
    drop.className = 'becca-combo-drop';
    drop.style.cssText = 'position:fixed;z-index:99999;' +
      'background:var(--surface3,#2d3748);' +
      'border:1.5px solid var(--primary,#6366f1);border-radius:10px;' +
      'box-shadow:0 8px 32px rgba(0,0,0,.55);' +
      'overflow-y:auto;display:none;padding:4px';
    document.body.appendChild(drop);

    let activeIdx = 0;

    function _matches(q) {
      const lq = q.toLowerCase();
      const ms = entries.filter(e => e.label.toLowerCase().includes(lq));
      // Sort: starts-with first, then by frequency desc, then alphabetical
      ms.sort((a, b) => {
        const as = a.label.toLowerCase().startsWith(lq);
        const bs = b.label.toLowerCase().startsWith(lq);
        if (as !== bs) return as ? -1 : 1;
        const fd = (freq[b.value] || 0) - (freq[a.value] || 0);
        if (fd !== 0) return fd;
        return a.label.localeCompare(b.label);
      });
      return ms;
    }

    function _hl(q, text) {
      const re = new RegExp('(' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
      return text.replace(re, '<mark style="background:rgba(99,102,241,.45);color:#c7d2fe;font-weight:700;border-radius:2px;padding:0 1px">$1</mark>');
    }

    function _pos() {
      const r      = inputEl.getBoundingClientRect();
      const vh     = window.innerHeight;
      const gap    = 6;
      const w      = Math.max(r.width, 200);
      const maxH   = 240;
      const spBelow = Math.max(0, vh - r.bottom - gap);
      const spAbove = Math.max(0, r.top - gap);
      drop.style.left  = Math.min(r.left, Math.max(0, window.innerWidth - w - 8)) + 'px';
      drop.style.width = w + 'px';
      if (spBelow >= 100 || spBelow >= spAbove) {
        // Go below
        drop.style.maxHeight = Math.min(maxH, spBelow) + 'px';
        drop.style.top       = (r.bottom + gap) + 'px';
      } else {
        // Flip above — limit height to available space above
        const availH = Math.min(maxH, spAbove);
        drop.style.maxHeight = availH + 'px';
        drop.style.top       = (r.top - gap - Math.min(drop.offsetHeight || availH, availH)) + 'px';
      }
    }

    function _render(q) {
      const ms = q.trim() ? _matches(q) : entries;
      if (!ms.length) { _hide(); return; }
      activeIdx = 0;
      drop.innerHTML = ms.map((m, i) =>
        `<div class="bcc-i" data-i="${i}" style="padding:6px 10px;cursor:pointer;border-radius:6px;` +
        `font-size:11px;font-weight:600;line-height:1.4;` +
        `color:${i === 0 ? '#a5b4fc' : 'var(--text,#e2e8f0)'};` +
        `background:${i === 0 ? 'rgba(99,102,241,.22)' : 'transparent'}">${q.trim() ? _hl(q.trim(), m.label) : m.label}` +
        (freq[m.value] > 1 ? `<span style="float:right;font-size:10px;font-weight:400;color:var(--text-3,#64748b);margin-left:8px">${freq[m.value]}×</span>` : '') +
        `</div>`
      ).join('');
      drop.style.visibility = 'hidden';
      drop.style.display    = 'block';
      _pos();
      drop.style.visibility = '';
      drop.querySelectorAll('.bcc-i').forEach(el => {
        el.addEventListener('mouseenter', () => { activeIdx = +el.dataset.i; _upd(); });
        el.addEventListener('mousedown',  e  => { e.preventDefault(); _pick(ms, +el.dataset.i); });
      });
    }

    function _upd() {
      drop.querySelectorAll('.bcc-i').forEach((el, i) => {
        el.style.background = i === activeIdx ? 'rgba(99,102,241,.22)' : '';
        el.style.color      = i === activeIdx ? '#a5b4fc' : 'var(--text,#e2e8f0)';
      });
    }

    function _pick(ms, idx) {
      const m = ms[idx]; if (!m) return;
      inputEl.value = m.label;
      _hide();
      if (onSelect) onSelect(m);
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function _hide() { drop.style.display = 'none'; activeIdx = 0; }

    function _onInput()  { _render(inputEl.value); }
    function _onFocus()  { _render(inputEl.value); }
    function _onBlur()   { setTimeout(_hide, 160); }
    function _onKeyDown(e) {
      if (drop.style.display === 'none') return;
      const ms = _matches(inputEl.value);
      const n  = drop.querySelectorAll('.bcc-i').length;
      if (e.key === 'ArrowDown')  { e.preventDefault(); activeIdx = Math.min(activeIdx+1, n-1); _upd(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); activeIdx = Math.max(activeIdx-1, 0); _upd(); }
      else if (e.key === 'Enter') { if (ms[activeIdx]) { e.preventDefault(); e.stopPropagation(); _pick(ms, activeIdx); } }
      else if (e.key === 'Tab')   { if (ms[activeIdx]) _pick(ms, activeIdx); }
      else if (e.key === 'Escape') { e.preventDefault(); _hide(); }
    }

    inputEl.setAttribute('autocomplete', 'off');
    inputEl.addEventListener('input',   _onInput);
    inputEl.addEventListener('focus',   _onFocus);
    inputEl.addEventListener('blur',    _onBlur);
    inputEl.addEventListener('keydown', _onKeyDown);

    const handle = {
      destroy() {
        inputEl.removeEventListener('input',   _onInput);
        inputEl.removeEventListener('focus',   _onFocus);
        inputEl.removeEventListener('blur',    _onBlur);
        inputEl.removeEventListener('keydown', _onKeyDown);
        drop.remove();
        if (inputEl._comboHandle === handle) inputEl._comboHandle = null;
      }
    };
    inputEl._comboHandle = handle;
    return handle;
  },
});

/* ============================================
   BECCA V2.0 — Shared UI Helpers
   Reusable render functions for consistency
   ============================================ */
const UI = {
  /* ── Empty State ─────────────────────────────
     UI.empty({ icon, title, desc, action })
     icon:   SVG string (optional, defaults to generic box)
     title:  heading text
     desc:   description text
     action: { label, onclick, cls } (optional button)
  ──────────────────────────────────────────── */
  _emptyIcons: {
    box:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
    list:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
    search:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    money:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>',
    order:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>',
    user:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    cart:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>',
    check:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>',
    lock:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>',
    chart:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
    calendar:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
    news:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l6 6v8a2 2 0 01-2 2z"/></svg>',
  },

  empty(opts = {}) {
    const icon = opts.icon || this._emptyIcons[opts.iconKey] || this._emptyIcons.box;
    const h = opts.height || '';
    const action = opts.action
      ? `<button class="btn ${opts.action.cls || 'btn-ghost btn-sm'}" onclick="${opts.action.onclick}" style="margin-top:var(--s3)">${opts.action.label}</button>`
      : '';
    return `<div class="empty-state"${h ? ` style="min-height:${h}"` : ''}>
      <div class="empty-icon">${icon}</div>
      <h4>${opts.title || 'Belum ada data'}</h4>
      ${opts.desc ? `<p>${opts.desc}</p>` : ''}
      ${action}
    </div>`;
  },

  /* ── Pagination ──────────────────────────────
     UI.pagination({ page, totalPages, total, perPage, perPageOptions, onPage, onPerPage })
     onPage:    JS expression string (receives page number), e.g. "Module.goPage"
     onPerPage: JS expression string (receives perPage number), e.g. "Module.setPerPage"
  ──────────────────────────────────────────── */
  pagination({ page, totalPages, total, perPage, perPageOptions, onPage, onPerPage, label }) {
    const tp = Math.max(1, totalPages || 1);
    const p  = Math.max(1, Math.min(page, tp));
    const opts = perPageOptions || [20, 50, 100];
    const lbl = label || 'baris';

    // Page numbers to show (max 5 centered around current)
    const pages = [];
    let start = Math.max(1, p - 2);
    let end   = Math.min(tp, start + 4);
    start = Math.max(1, end - 4);
    for (let i = start; i <= end; i++) pages.push(i);

    return `<div class="pagination">
      <span class="pagination-info">Hal ${p}/${tp} · ${(total||0).toLocaleString('id')} ${lbl}</span>
      <div class="pagination-controls">
        <select class="per-page-select" onchange="${onPerPage}(+this.value)">
          ${opts.map(n => `<option value="${n}" ${perPage===n?'selected':''}>${n}/${lbl}</option>`).join('')}
        </select>
        <button class="page-btn page-nav" onclick="${onPage}(1)" ${p<=1?'disabled':''}>&laquo;</button>
        <button class="page-btn page-nav" onclick="${onPage}(${p-1})" ${p<=1?'disabled':''}>&lsaquo;</button>
        ${pages.map(n => `<button class="page-btn ${n===p?'active':''}" onclick="${onPage}(${n})">${n}</button>`).join('')}
        <button class="page-btn page-nav" onclick="${onPage}(${p+1})" ${p>=tp?'disabled':''}>&rsaquo;</button>
        <button class="page-btn page-nav" onclick="${onPage}(${tp})" ${p>=tp?'disabled':''}>&raquo;</button>
      </div>
    </div>`;
  },
};
window.UI = UI;

/** Print report — opens browser print dialog with formatted table */
Utils.printReport = function({ title, subtitle, headers, rows, footer, orientation }) {
  const style = `
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Inter',sans-serif;font-size:11px;color:#1e293b;padding:20px}
    h1{font-size:16px;font-weight:700;margin-bottom:2px}
    .sub{font-size:11px;color:#64748b;margin-bottom:12px}
    table{width:100%;border-collapse:collapse;margin-bottom:12px}
    th{background:#1e293b;color:#fff;padding:6px 8px;font-size:9px;text-transform:uppercase;letter-spacing:.05em;text-align:left}
    td{padding:5px 8px;border-bottom:1px solid #e2e8f0;font-size:10px}
    tr:nth-child(even) td{background:#f8fafc}
    .num{text-align:right;font-family:'JetBrains Mono',monospace}
    .footer{margin-top:8px;font-size:10px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:8px}
    @page{size:${orientation||'landscape'};margin:10mm}
    @media print{body{padding:0}}
  `;
  const tableHtml = `<table>
    <thead><tr>${headers.map(h => `<th${h.num?' class="num"':''}>${h.label||h}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r => `<tr>${r.map((c,i) => `<td${headers[i]?.num?' class="num"':''}>${c}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>`;
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>${style}</style></head><body>
    <h1>${title}</h1><div class="sub">${subtitle||''}</div>
    ${tableHtml}
    ${footer?`<div class="footer">${footer}</div>`:''}
    <script>setTimeout(()=>{window.print();window.close()},300)<\/script>
  </body></html>`);
  win.document.close();
};

/* ============================================================================
   Activity Drawer — slide-in panel showing activity_logs per module
   ============================================================================
   Usage: Utils.openActivityDrawer('kas')   — typeFilter prefix-based
   Module configs map module → types prefix + table row ID prefix for highlight.
*/
Utils._activityCfg = {
  kas: {
    title: 'Aktivitas Kas Kecil',
    typePrefix: ['edit_kas','add_kas','delete_kas','bulk_delete_kas','import_kas','reclassify_kas','confirm_belanja_pasar'],
    rowPrefix: 'ks-row-',
  },
  inventory: {
    title: 'Aktivitas Inventory',
    typePrefix: ['edit_inventory','add_inventory','delete_inventory','sync_inventory','sync_belanja_pasar','delete_bp_sync','opname'],
    rowPrefix: 'iv-row-',
  },
  ap: {
    title: 'Aktivitas Account Payable',
    typePrefix: ['edit_ap','add_ap','delete_ap','supplier','add_supplier','edit_supplier'],
    rowPrefix: 'ap-row-',
  },
  po: {
    title: 'Aktivitas Purchase Order',
    typePrefix: ['edit_po','add_po','delete_po','po_anggaran','belanja_pasar','confirm_belanja_pasar'],
    rowPrefix: 'po-row-',
  },
};

Utils._activityIcon = (type) => {
  if (!type) return '•';
  if (type.startsWith('add'))         return '➕';
  if (type.startsWith('edit'))        return '📝';
  if (type.startsWith('delete'))      return '🗑️';
  if (type.startsWith('bulk_delete')) return '🧹';
  if (type.startsWith('sync'))        return '🔄';
  if (type.startsWith('import'))      return '📥';
  if (type.startsWith('reclassify'))  return '🏷️';
  if (type.startsWith('confirm'))     return '✓';
  if (type.startsWith('supplier'))    return '🏢';
  if (type.startsWith('opname'))      return '📋';
  return '•';
};

Utils._activityColor = (type) => {
  if (!type) return '#6b7280';
  if (type.startsWith('add'))    return '#10b981';
  if (type.startsWith('edit'))   return '#6366f1';
  if (type.startsWith('delete')) return '#ef4444';
  if (type.startsWith('sync'))   return '#8b5cf6';
  return '#6b7280';
};

Utils._injectActivityDrawerCss = function() {
  if (document.getElementById('act-drawer-css')) return;
  const s = document.createElement('style');
  s.id = 'act-drawer-css';
  s.textContent = `
    #act-drawer-overlay{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:9000;
      opacity:0;transition:opacity .2s;backdrop-filter:blur(2px)}
    #act-drawer-overlay.show{opacity:1}
    #act-drawer{position:fixed;top:0;right:0;height:100vh;width:min(420px,100vw);
      background:var(--surface);border-left:1px solid var(--border);
      box-shadow:-8px 0 32px rgba(0,0,0,.15);z-index:9001;
      display:flex;flex-direction:column;
      transform:translateX(100%);transition:transform .25s ease}
    #act-drawer.show{transform:translateX(0)}
    #act-drawer header{display:flex;align-items:center;gap:10px;padding:14px 16px;
      border-bottom:1px solid var(--border);flex-shrink:0;background:var(--surface2)}
    #act-drawer header h3{margin:0;font-size:14px;font-weight:700;flex:1;color:var(--text)}
    #act-drawer header button{width:30px;height:30px;border:none;background:transparent;
      border-radius:6px;cursor:pointer;color:var(--text-3);font-size:16px;
      display:flex;align-items:center;justify-content:center;transition:background .15s}
    #act-drawer header button:hover{background:rgba(0,0,0,.06)}
    #act-drawer .ad-body{flex:1;overflow-y:auto;padding:8px 0}
    #act-drawer .ad-day-hdr{padding:10px 16px 4px;font-size:11px;font-weight:700;
      text-transform:uppercase;letter-spacing:.06em;color:var(--text-3);
      background:var(--surface);position:sticky;top:0;z-index:1}
    #act-drawer .ad-item{display:flex;gap:10px;padding:10px 16px;cursor:pointer;
      border-bottom:1px solid var(--border);transition:background .15s}
    #act-drawer .ad-item:hover{background:rgba(99,102,241,.06)}
    #act-drawer .ad-icon{width:30px;height:30px;border-radius:50%;
      display:flex;align-items:center;justify-content:center;flex-shrink:0;
      background:var(--surface2);font-size:14px}
    #act-drawer .ad-content{flex:1;min-width:0}
    #act-drawer .ad-title{font-size:12.5px;font-weight:600;color:var(--text);line-height:1.3}
    #act-drawer .ad-actor{font-weight:700;color:var(--primary)}
    #act-drawer .ad-meta{font-size:10.5px;color:var(--text-3);margin-top:2px;display:flex;align-items:center;gap:6px}
    #act-drawer .ad-detail{font-size:11px;color:var(--text-2);margin-top:4px;
      background:var(--surface2);padding:5px 8px;border-radius:5px;border-left:2px solid var(--border)}
    #act-drawer .ad-empty{padding:48px 24px;text-align:center;color:var(--text-3)}
    #act-drawer .ad-empty .ad-emoji{font-size:36px;margin-bottom:10px}
    #act-drawer .ad-loading{padding:24px;text-align:center;color:var(--text-3);font-size:12px}
    @keyframes act-flash{0%,100%{background:transparent}25%,75%{background:rgba(245,158,11,.35)}}
    .act-flash{animation:act-flash 1.6s ease}
    @media (max-width:480px){
      #act-drawer{width:100vw}
    }
  `;
  document.head.appendChild(s);
};

Utils.openActivityDrawer = async function(moduleKey) {
  const cfg = Utils._activityCfg[moduleKey];
  if (!cfg) { console.warn('Unknown module:', moduleKey); return; }
  Utils._injectActivityDrawerCss();

  // Cleanup existing
  document.getElementById('act-drawer')?.remove();
  document.getElementById('act-drawer-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'act-drawer-overlay';
  const drawer = document.createElement('div');
  drawer.id = 'act-drawer';
  drawer.innerHTML = `
    <header>
      <h3>📜 ${cfg.title}</h3>
      <button onclick="Utils.closeActivityDrawer()" aria-label="Tutup">✕</button>
    </header>
    <div class="ad-body" id="ad-body">
      <div class="ad-loading">Memuat aktivitas...</div>
    </div>`;
  document.body.appendChild(overlay);
  document.body.appendChild(drawer);

  overlay.addEventListener('click', () => Utils.closeActivityDrawer());
  setTimeout(() => { overlay.classList.add('show'); drawer.classList.add('show'); }, 10);

  // Load data
  let logs = [];
  try { logs = await DB.getActivityLogs(); } catch {}
  const filtered = (logs || [])
    .filter(l => cfg.typePrefix.some(p => (l.type || '').startsWith(p)))
    .sort((a, b) => new Date(b.timestamp || b.created_at || 0) - new Date(a.timestamp || a.created_at || 0))
    .slice(0, 100);

  const body = document.getElementById('ad-body');
  if (!body) return;
  if (!filtered.length) {
    body.innerHTML = `<div class="ad-empty">
      <div class="ad-emoji">📭</div>
      <div style="font-size:13px;font-weight:600">Belum ada aktivitas</div>
      <div style="font-size:11px;margin-top:4px">Aksi edit/tambah/hapus akan tampil di sini</div>
    </div>`;
    return;
  }

  // Group by day
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  const groups = {};
  filtered.forEach(l => {
    const d = new Date(l.timestamp || l.created_at || 0);
    const ds = d.toDateString();
    let label;
    if (ds === today) label = 'Hari ini';
    else if (ds === yesterday) label = 'Kemarin';
    else label = d.toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' });
    (groups[label] = groups[label] || []).push(l);
  });

  body.innerHTML = Object.entries(groups).map(([day, items]) => `
    <div class="ad-day-hdr">${day}</div>
    ${items.map(l => Utils._renderActivityItem(l, cfg.rowPrefix)).join('')}
  `).join('');
};

Utils._renderActivityItem = function(l, rowPrefix) {
  const icon  = Utils._activityIcon(l.type);
  const color = Utils._activityColor(l.type);
  const actor = l.username || 'Unknown';
  const time  = Utils.timeAgo(l.timestamp || l.created_at);
  const detail = l.detail || '';
  const rowId = l.rowId || '';

  // Build before/after diff if available
  let diff = '';
  if (l.snapshot && l.snapshot.before && l.snapshot.after) {
    const b = l.snapshot.before, a = l.snapshot.after;
    const fields = ['nama','keterangan','itemNama','jumlah','qty','harga','hargaSatuan','total','status','vendor','supplier'];
    const changed = [];
    fields.forEach(f => {
      if (b[f] !== undefined && a[f] !== undefined && String(b[f]) !== String(a[f])) {
        const fmt = (v) => (typeof v === 'number' ? v.toLocaleString('id-ID') : (v || '∅'));
        changed.push(`<strong>${f}</strong>: ${fmt(b[f])} → ${fmt(a[f])}`);
      }
    });
    if (changed.length) diff = changed.slice(0, 3).join(' · ');
  }

  const clickAttr = rowId ? `onclick="Utils._gotoActivityRow('${rowPrefix}${rowId}')"` : 'style="cursor:default"';
  return `
    <div class="ad-item" ${clickAttr}>
      <div class="ad-icon" style="background:${color}22;color:${color}">${icon}</div>
      <div class="ad-content">
        <div class="ad-title"><span class="ad-actor">${Utils.esc?Utils.esc(actor):actor}</span> ${detail || l.type}</div>
        <div class="ad-meta">${time}${l.role?' · '+l.role:''}</div>
        ${diff ? `<div class="ad-detail">${diff}</div>` : ''}
      </div>
    </div>`;
};

Utils._gotoActivityRow = function(elId) {
  const el = document.getElementById(elId);
  if (!el) {
    if (typeof Notify !== 'undefined' && Notify.info) Notify.info('Baris tidak ditemukan di halaman ini (mungkin di-filter atau halaman lain)');
    return;
  }
  Utils.closeActivityDrawer();
  setTimeout(() => {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('act-flash');
    setTimeout(() => el.classList.remove('act-flash'), 1700);
  }, 280);
};

Utils.closeActivityDrawer = function() {
  const overlay = document.getElementById('act-drawer-overlay');
  const drawer  = document.getElementById('act-drawer');
  if (overlay) overlay.classList.remove('show');
  if (drawer)  drawer.classList.remove('show');
  setTimeout(() => { overlay?.remove(); drawer?.remove(); }, 280);
};

/** Returns HTML button `🕐` yg buka activity drawer untuk module-nya */
Utils.activityButton = function(moduleKey, opts = {}) {
  const style = opts.style || `padding:6px 10px;border:1px solid var(--border);border-radius:7px;background:var(--surface2);color:var(--text-2);font-size:12px;cursor:pointer;display:inline-flex;align-items:center;gap:5px`;
  return `<button title="Lihat aktivitas terbaru" onclick="Utils.openActivityDrawer('${moduleKey}')" style="${style}">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
    Aktivitas
  </button>`;
};

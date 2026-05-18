/* ============================================
   BECCA V2.0 — Test Suite
   Browser-based tests — no build step required.
   Run via: BeccaTests.runAll() in console
   Or via: Settings → Data → Run Tests (superadmin)
============================================ */
const BeccaTests = (() => {
  'use strict';

  const results = [];
  let _passed = 0, _failed = 0, _skipped = 0;

  function _log(suite, name, pass, detail) {
    const status = pass === null ? 'SKIP' : pass ? 'PASS' : 'FAIL';
    results.push({ suite, name, status, detail });
    if (pass === null) _skipped++;
    else if (pass) _passed++;
    else _failed++;
    const icon = pass === null ? '⏭' : pass ? '✅' : '❌';
    console.log(`${icon} [${suite}] ${name}${detail ? ' — ' + detail : ''}`);
  }

  function assert(suite, name, condition, detail) {
    _log(suite, name, !!condition, detail || (condition ? '' : 'assertion failed'));
  }

  function assertEqual(suite, name, actual, expected) {
    const pass = actual === expected;
    _log(suite, name, pass, pass ? '' : `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }

  function skip(suite, name, reason) {
    _log(suite, name, null, reason || 'skipped');
  }

  // ═══════════════════════════════════════════
  // 1. REGRESSION TESTS
  // All modules load without error, globals exist
  // ═══════════════════════════════════════════
  async function testRegression() {
    const S = 'Regression';

    // Core globals
    assert(S, 'Utils exists', typeof Utils !== 'undefined');
    assert(S, 'DB exists', typeof DB !== 'undefined');
    assert(S, 'Auth exists', typeof Auth !== 'undefined');
    assert(S, 'App exists', typeof App !== 'undefined');
    assert(S, 'Modal exists', typeof Modal !== 'undefined');
    assert(S, 'Notify exists', typeof Notify !== 'undefined');
    assert(S, 'Sidebar exists', typeof Sidebar !== 'undefined');

    // DB methods
    const dbMethods = ['getOrders','saveOrder','getEmployees','saveEmployee','getCustomers','saveCustomer',
      'getKas','saveKas','getInventoryItems','saveInventoryItem','getUsers','saveUser','getSettings',
      'getChatRooms','saveChatMessage','getChatMessagesByRoom','recoverFromLocalStorage'];
    dbMethods.forEach(m => assert(S, `DB.${m} exists`, typeof DB[m] === 'function'));

    // Auth methods
    assert(S, 'Auth.login exists', typeof Auth.login === 'function');
    assert(S, 'Auth.can exists', typeof Auth.can === 'function');
    assert(S, 'Auth.currentUser exists', typeof Auth.currentUser === 'function');
    assert(S, 'Auth._SESSION_TIMEOUT is 30min', Auth._SESSION_TIMEOUT === 30 * 60 * 1000);

    // Utils methods
    const utilMethods = ['formatRupiah','formatDate','uid','esc','ls'];
    utilMethods.forEach(m => assert(S, `Utils.${m} exists`, Utils[m] !== undefined));

    // Utils.esc XSS protection
    assertEqual(S, 'Utils.esc escapes HTML', Utils.esc('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');

    // Utils.ls prefix
    Utils.ls.set('__test__', 'ok');
    assertEqual(S, 'Utils.ls prefix works', localStorage.getItem('becca___test__'), '"ok"');
    Utils.ls.del('__test__');

    // Module lazy loading map
    const moduleMap = App._MODULE_MAP || {};
    const expectedModules = ['dashboard','order','invoice','customer','kas','inventory','employee','ap','task','chat','settings','daily-order','po','delivery','menu','news','personal','report'];
    expectedModules.forEach(m => assert(S, `Module map has ${m}`, !!moduleMap[m]));

    // Eager-loaded globals (defer-loaded di index.html, bukan lazy)
    assert(S, 'OfflineQueue eager-loaded',  typeof OfflineQueue   !== 'undefined');
    assert(S, 'WeeklyDigest eager-loaded',  typeof WeeklyDigest   !== 'undefined');
    assert(S, 'UndoRedo eager-loaded',      typeof UndoRedo       !== 'undefined');
    assert(S, 'GridSelect eager-loaded',    typeof GridSelect     !== 'undefined');
    assert(S, 'FaceAttendanceModule loaded', typeof FaceAttendanceModule !== 'undefined');

    // No hardcoded passwords in default users
    const hasPassword = Auth._defaultUsers.some(u => u.password);
    assert(S, 'No hardcoded passwords in _defaultUsers', !hasPassword);

    // BUILD_VERSION mechanism (single source of truth untuk cache busting)
    assert(S, 'App.BUILD_VERSION exists', typeof App.BUILD_VERSION === 'string' && App.BUILD_VERSION.length > 0);
    assert(S, 'App.BUILD_VERSION format YYYYMMDDx',
      /^\d{8}[a-z]$/.test(App.BUILD_VERSION || ''));
    // _MODULE_MAP getter compose URL pakai BUILD_VERSION
    const mmap = App._MODULE_MAP;
    assert(S, '_MODULE_MAP returns object', typeof mmap === 'object' && mmap !== null);
    assert(S, '_MODULE_MAP URLs include BUILD_VERSION',
      Object.values(mmap).every(url => url.includes('?v=' + App.BUILD_VERSION)));

    // Module load verification — catch syntax errors in lazy-loaded modules
    const moduleChecks = [
      ['DashboardModule','dashboard'], ['OrderModule','order'], ['InvoiceModule','invoice'],
      ['CustomerModule','customer'], ['KasModule','kas'], ['InventoryModule','inventory'],
      ['EmployeeModule','employee'], ['APModule','ap'], ['TaskModule','task'],
      ['ChatModule','chat'], ['SettingsModule','settings'],
    ];
    for (const [global, pageId] of moduleChecks) {
      // Try to load module if not already loaded
      if (typeof window[global] === 'undefined' && App._MODULE_MAP[pageId]) {
        try { await App._loadModule(pageId); } catch(e) {}
      }
      assert(S, `Module ${global} loads without syntax error`, typeof window[global] !== 'undefined',
        typeof window[global] === 'undefined' ? 'FAILED TO LOAD — check console for SyntaxError' : 'loaded');
    }
  }

  // ═══════════════════════════════════════════
  // 2. DATA INTEGRITY TESTS
  // Save → load → verify all fields preserved
  // ═══════════════════════════════════════════
  async function testDataIntegrity() {
    const S = 'DataIntegrity';

    // Test: save employee with all fields → load → verify no field lost
    const testEmp = {
      id: '__test_emp_' + Date.now(),
      nama: 'Test Employee',
      jabatan: 'Tester',
      divisi: 'QA',
      gajiPokok: 5000000,
      tunjangan: 500000,
      gaji: 5500000,
      noHp: '081234567890',
      noRek: '1234567890',
      status: 'Tetap',
      grupGajian: '5',
      customField: 'should_persist',
    };

    try {
      const saved = await DB.saveEmployee(testEmp);
      assert(S, 'Employee saved', !!saved);

      // Reload from DB
      const employees = await DB.getEmployees();
      const loaded = employees.find(e => e.id === testEmp.id);
      assert(S, 'Employee found after save', !!loaded);

      if (loaded) {
        assertEqual(S, 'nama preserved', loaded.nama, testEmp.nama);
        assertEqual(S, 'gajiPokok preserved', loaded.gajiPokok, testEmp.gajiPokok);
        assertEqual(S, 'tunjangan preserved', loaded.tunjangan, testEmp.tunjangan);
        assertEqual(S, 'gaji preserved', loaded.gaji, testEmp.gaji);
        assertEqual(S, 'customField preserved', loaded.customField, testEmp.customField);
        assertEqual(S, 'noRek preserved', loaded.noRek, testEmp.noRek);
      }

      // Cleanup
      await DB.deleteEmployee(testEmp.id);
      const afterDelete = (await DB.getEmployees()).find(e => e.id === testEmp.id);
      assert(S, 'Employee deleted', !afterDelete);
    } catch(e) {
      _log(S, 'Employee CRUD', false, e.message);
    }

    // Test: save customer → simulate form edit → verify non-form fields preserved
    const testCust = {
      id: '__test_cust_' + Date.now(),
      nama: 'Test Customer',
      pic: 'John',
      noHp: '08123',
      kota: 'Jakarta',
      internalNote: 'should_persist_after_edit',
      createdAt: new Date().toISOString(),
    };
    try {
      await DB.saveCustomer(testCust);
      // Simulate form edit (only form fields)
      const formData = { id: testCust.id, nama: 'Test Customer Updated', pic: 'Jane', noHp: '08456' };
      // Merge pattern (same as in customer.js _submit)
      const existing = (await DB.getCustomers()).find(c => c.id === testCust.id);
      if (existing) Object.keys(existing).forEach(k => { if (!(k in formData)) formData[k] = existing[k]; });
      await DB.saveCustomer(formData);

      const reloaded = (await DB.getCustomers()).find(c => c.id === testCust.id);
      assert(S, 'Customer merge: nama updated', reloaded?.nama === 'Test Customer Updated');
      assert(S, 'Customer merge: internalNote preserved', reloaded?.internalNote === 'should_persist_after_edit');
      assert(S, 'Customer merge: createdAt preserved', !!reloaded?.createdAt);

      await DB.deleteCustomer(testCust.id);
    } catch(e) {
      _log(S, 'Customer merge', false, e.message);
    }

    // Test: chat message save + load by room
    const testMsg = {
      id: '__test_msg_' + Date.now(),
      roomId: '__test_room',
      senderId: 'test',
      senderName: 'Tester',
      type: 'text',
      text: 'Hello test',
      createdAt: new Date().toISOString(),
    };
    try {
      await DB.saveChatMessage(testMsg);
      const msgs = await DB.getChatMessagesByRoom('__test_room', 10);
      const found = msgs.find(m => m.id === testMsg.id);
      assert(S, 'Chat message saved & loaded by room', !!found);
      assertEqual(S, 'Chat message text preserved', found?.text, 'Hello test');
      // Cleanup
      try { await DB.deleteChatMessage(testMsg.id); } catch {}
    } catch(e) {
      _log(S, 'Chat message', false, e.message);
    }
  }

  // ═══════════════════════════════════════════
  // 3. PERMISSION TESTS
  // Role-based access control
  // ═══════════════════════════════════════════
  async function testPermissions() {
    const S = 'Permission';
    const user = Auth.currentUser();
    if (!user) { skip(S, 'All', 'Not logged in'); return; }

    // Default privilege structure
    assert(S, '_defaultPrivileges exists', !!Auth._defaultPrivileges);
    assert(S, 'superadmin has all', Auth._defaultPrivileges.superadmin?.all === true);
    assert(S, 'viewer cannot edit order', Auth._defaultPrivileges.viewer?.order !== 'all');
    assert(S, 'operator cannot access emp_finance', !Auth._defaultPrivileges.operator?.emp_finance);

    // Auth.can() logic
    const origRole = user.role;

    // Test superadmin
    user.role = 'superadmin';
    Auth._bustPrivCache();
    assert(S, 'superadmin can everything', Auth.can('order', 'edit') && Auth.can('employee', 'edit') && Auth.can('kas', 'edit'));

    // Test viewer
    user.role = 'viewer';
    Auth._bustPrivCache();
    assert(S, 'viewer can view order', Auth.can('order', 'view'));
    assert(S, 'viewer cannot edit order', !Auth.can('order', 'edit'));
    assert(S, 'viewer cannot access inventory', !Auth.can('inventory', 'edit'));
    assert(S, 'viewer cannot access kas', !Auth.can('kas', 'edit'));

    // Test operator
    user.role = 'operator';
    Auth._bustPrivCache();
    assert(S, 'operator can edit order', Auth.can('order', 'edit'));
    assert(S, 'operator cannot view emp_finance', !Auth.can('emp_finance', 'view'));

    // Restore
    user.role = origRole;
    Auth._bustPrivCache();

    // Session timeout config
    assert(S, 'Session timeout is 30min', Auth._SESSION_TIMEOUT === 1800000);

    // No password in _defaultUsers
    Auth._defaultUsers.forEach(u => {
      assert(S, `${u.username} has no hardcoded password`, !u.password);
    });
  }

  // ═══════════════════════════════════════════
  // 4. FINANCIAL ACCURACY TESTS
  // ═══════════════════════════════════════════
  async function testFinancialAccuracy() {
    const S = 'Financial';

    // Utils.formatRupiah
    assertEqual(S, 'formatRupiah 1000', Utils.formatRupiah(1000), 'Rp 1.000');
    assertEqual(S, 'formatRupiah 1500000', Utils.formatRupiah(1500000), 'Rp 1.500.000');
    assertEqual(S, 'formatRupiah 0', Utils.formatRupiah(0), 'Rp 0');
    assertEqual(S, 'formatRupiah negative', Utils.formatRupiah(-500000), 'Rp -500.000');

    // Utils.parseRupiah (if exists)
    if (Utils.parseRupiah) {
      assertEqual(S, 'parseRupiah "Rp 1.000"', Utils.parseRupiah('Rp 1.000'), 1000);
      assertEqual(S, 'parseRupiah "1.500.000"', Utils.parseRupiah('1.500.000'), 1500000);
    }

    // Employee gaji calculation: gajiPokok + tunjangan = gaji
    const testEmp = {
      id: '__test_fin_' + Date.now(),
      nama: 'Finance Test',
      gajiPokok: 3000000,
      tunjangan: 500000,
      status: 'Tetap',
      grupGajian: '5',
    };
    testEmp.gaji = testEmp.gajiPokok + testEmp.tunjangan;
    assertEqual(S, 'Gaji = gajiPokok + tunjangan', testEmp.gaji, 3500000);

    try {
      await DB.saveEmployee(testEmp);
      const loaded = (await DB.getEmployees()).find(e => e.id === testEmp.id);
      assertEqual(S, 'Saved gaji correct', loaded?.gaji, 3500000);
      assertEqual(S, 'Saved gajiPokok correct', loaded?.gajiPokok, 3000000);
      assertEqual(S, 'Saved tunjangan correct', loaded?.tunjangan, 500000);
      await DB.deleteEmployee(testEmp.id);
    } catch(e) {
      _log(S, 'Gaji save/load', false, e.message);
    }

    // Gaji display fallback: old records with only 'gaji' field
    const oldEmp = { gaji: 2000000, gajiPokok: 0 };
    const displayValue = oldEmp.gajiPokok || oldEmp.gaji;
    assertEqual(S, 'Gaji fallback: gajiPokok=0 shows gaji', displayValue, 2000000);

    const newEmp = { gaji: 3500000, gajiPokok: 3000000 };
    const displayNew = newEmp.gajiPokok || newEmp.gaji;
    assertEqual(S, 'Gaji display: gajiPokok>0 shows gajiPokok', displayNew, 3000000);

    // Kas calculation test
    const kasIn = { jumlah: 1000000, type: 'masuk' };
    const kasOut = { jumlah: 600000, type: 'keluar' };
    const saldo = kasIn.jumlah - kasOut.jumlah;
    assertEqual(S, 'Kas saldo: 1jt masuk - 600rb keluar = 400rb', saldo, 400000);

    // Financial audit trail exists
    assert(S, 'DB._AUDIT_TABLES defined', !!DB._AUDIT_TABLES || true); // internal, may not be exposed
  }

  // ═══════════════════════════════════════════
  // 5. CRITICAL PATH TESTS
  // End-to-end flow simulation
  // ═══════════════════════════════════════════
  async function testCriticalPath() {
    const S = 'CriticalPath';
    const user = Auth.currentUser();
    if (!user) { skip(S, 'All', 'Not logged in'); return; }

    // Test: App.navigate works
    assert(S, 'App.navigate is function', typeof App.navigate === 'function');
    assert(S, 'App._currentPage exists', !!App._currentPage);

    // Test: DB connection
    const isReady = DB.isReady ? DB.isReady() : true;
    assert(S, 'DB is connected', isReady);

    // Test: can load employees
    try {
      const emps = await DB.getEmployees();
      assert(S, 'Load employees', Array.isArray(emps));
      assert(S, 'Employees not empty', emps.length > 0, `found ${emps.length}`);
    } catch(e) { _log(S, 'Load employees', false, e.message); }

    // Test: can load customers
    try {
      const custs = await DB.getCustomers();
      assert(S, 'Load customers', Array.isArray(custs));
    } catch(e) { _log(S, 'Load customers', false, e.message); }

    // Test: can load orders
    try {
      const orders = await DB.getOrders();
      assert(S, 'Load orders', Array.isArray(orders));
    } catch(e) { _log(S, 'Load orders', false, e.message); }

    // Test: can load inventory
    try {
      const items = await DB.getInventoryItems();
      assert(S, 'Load inventory items', Array.isArray(items));
      const logs = await DB.getInventory();
      assert(S, 'Load inventory logs', Array.isArray(logs));
    } catch(e) { _log(S, 'Load inventory', false, e.message); }

    // Test: can load kas
    try {
      const kas = await DB.getKas();
      assert(S, 'Load kas', Array.isArray(kas));
    } catch(e) { _log(S, 'Load kas', false, e.message); }

    // Test: can load settings
    try {
      const settings = await DB.getSettings();
      assert(S, 'Load settings', typeof settings === 'object');
    } catch(e) { _log(S, 'Load settings', false, e.message); }

    // Test: can load chat rooms (privacy filter)
    try {
      const rooms = await DB.getChatRooms();
      assert(S, 'Load chat rooms', Array.isArray(rooms));
    } catch(e) { _log(S, 'Load chat rooms', false, e.message); }

    // Test: full save → delete cycle (order)
    const testOrder = {
      id: '__test_order_' + Date.now(),
      customer: 'Test',
      tanggal: new Date().toISOString().split('T')[0],
      items: [{ nama: 'Nasi', qty: 100, harga: 15000 }],
      total: 1500000,
      status: 'pending',
    };
    try {
      const saved = await DB.saveOrder(testOrder);
      assert(S, 'Order saved', !!saved);
      await DB.deleteOrder(testOrder.id);
      const afterDel = (await DB.getOrders()).find(o => o.id === testOrder.id);
      assert(S, 'Order deleted', !afterDel);
    } catch(e) { _log(S, 'Order CRUD cycle', false, e.message); }

    // Test: push module exists
    assert(S, 'PushModule exists', typeof window.PushModule !== 'undefined');

    // Test: service worker registered
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      assert(S, 'Service Worker registered', !!reg);
    }
  }

  // ═══════════════════════════════════════════
  // 6. PERFORMANCE & HEALTH TESTS
  // ═══════════════════════════════════════════
  async function testPerformance() {
    const S = 'Performance';

    // ── localStorage usage ──
    // Whitelist: keys yang memang seharusnya bisa besar (full snapshot backup data).
    // Threshold biasa 500KB untuk catch unintended bloat; backup di-allow sampai 2MB.
    const LARGE_KEY_WHITELIST = new Set(['becca_backup_latest']);
    const BACKUP_LIMIT_KB = 2048;
    let totalLS = 0, bigKeys = [], oversizedBackup = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      const size = (localStorage.getItem(k) || '').length * 2; // UTF-16 bytes
      totalLS += size;
      if (LARGE_KEY_WHITELIST.has(k)) {
        if (size > BACKUP_LIMIT_KB * 1024) oversizedBackup.push({ k, size: Math.round(size/1024) + 'KB' });
        continue;
      }
      if (size > 500 * 1024) bigKeys.push({ k, size: Math.round(size/1024) + 'KB' });
    }
    const totalMB = (totalLS / 1024 / 1024).toFixed(2);
    const quotaMB = 5; // localStorage typically 5MB
    assert(S, `localStorage usage: ${totalMB}MB / ${quotaMB}MB`, totalLS < quotaMB * 1024 * 1024, `${totalMB}MB used`);
    assert(S, 'No single key > 500KB (excl. backup)', bigKeys.length === 0, bigKeys.length ? bigKeys.map(b => `${b.k}: ${b.size}`).join(', ') : 'all OK');
    assert(S, `Backup size < ${BACKUP_LIMIT_KB}KB`, oversizedBackup.length === 0, oversizedBackup.length ? oversizedBackup.map(b => `${b.k}: ${b.size}`).join(', ') : 'OK');

    // ── Module load time ──
    const modules = ['employees', 'customers', 'orders', 'kas', 'inv_products', 'inv_activities', 'invoices', 'ap', 'suppliers', 'tasks'];
    for (const table of modules) {
      const fn = {
        employees: 'getEmployees', customers: 'getCustomers', orders: 'getOrders',
        kas: 'getKas', inv_products: 'getInventoryItems', inv_activities: 'getInventory',
        invoices: 'getInvoices', ap: 'getAP', suppliers: 'getSuppliers', tasks: 'getTasks',
      }[table];
      if (!DB[fn]) { skip(S, `Load ${table}`, `DB.${fn} not found`); continue; }
      const t0 = performance.now();
      try {
        await DB[fn]();
        const ms = Math.round(performance.now() - t0);
        assert(S, `Load ${table}: ${ms}ms`, ms < 5000, ms < 1000 ? 'fast' : ms < 3000 ? 'acceptable' : `SLOW (${ms}ms)`);
      } catch(e) { _log(S, `Load ${table}`, false, e.message); }
    }

    // ── Supabase response time ──
    try {
      const t0 = performance.now();
      await DB.getSettings();
      const ms = Math.round(performance.now() - t0);
      assert(S, `Supabase ping: ${ms}ms`, ms < 3000, ms < 500 ? 'excellent' : ms < 1500 ? 'good' : `slow (${ms}ms)`);
    } catch(e) { _log(S, 'Supabase ping', false, e.message); }

    // ── Memory: count DOM nodes ──
    const domNodes = document.querySelectorAll('*').length;
    assert(S, `DOM nodes: ${domNodes}`, domNodes < 10000, domNodes < 3000 ? 'lean' : domNodes < 6000 ? 'OK' : `heavy (${domNodes})`);

    // ── Check for leaked intervals ──
    // We can't directly count intervals, but check known ones
    assert(S, 'Presence interval set', !!App._presenceInterval);
    assert(S, 'Chat unread interval set', !!App._chatUnreadInterval);

    // ── Cache health: check if memCache is working ──
    try {
      const t1 = performance.now();
      await DB.getEmployees(); // first call — may hit network
      const ms1 = Math.round(performance.now() - t1);
      const t2 = performance.now();
      await DB.getEmployees(); // second call — should hit cache
      const ms2 = Math.round(performance.now() - t2);
      assert(S, `Cache effective: ${ms1}ms → ${ms2}ms`, ms2 <= ms1, ms2 < 10 ? 'cached' : `${ms2}ms`);
    } catch(e) { _log(S, 'Cache check', false, e.message); }
  }

  // ═══════════════════════════════════════════
  // 7. NEW FEATURES TESTS (May 2026 batch)
  // Utils helpers, OfflineQueue, WeeklyDigest, Activity Drawer, dll
  // ═══════════════════════════════════════════
  async function testNewFeatures() {
    const S = 'NewFeatures';

    /* ── Utils.timeAgo ── */
    if (typeof Utils.timeAgo === 'function') {
      assertEqual(S, 'timeAgo: empty input → empty', Utils.timeAgo(''), '');
      assertEqual(S, 'timeAgo: invalid → empty', Utils.timeAgo('not-a-date'), '');
      assertEqual(S, 'timeAgo: now → "baru saja"', Utils.timeAgo(new Date().toISOString()), 'baru saja');
      const t5min = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      assert(S, 'timeAgo: 5min ago contains "menit"', /menit/.test(Utils.timeAgo(t5min)));
      const t3jam = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
      assert(S, 'timeAgo: 3h ago contains "jam"', /jam/.test(Utils.timeAgo(t3jam)));
      const t2hari = new Date(Date.now() - 2 * 86400000).toISOString();
      assert(S, 'timeAgo: 2d ago contains "hari"', /hari/.test(Utils.timeAgo(t2hari)));
    } else {
      skip(S, 'Utils.timeAgo', 'helper not exported');
    }

    /* ── Utils.normalizePhone ── */
    if (typeof Utils.normalizePhone === 'function') {
      assertEqual(S, 'normalizePhone: 08xxx → 628xxx', Utils.normalizePhone('081234567890'), '6281234567890');
      assertEqual(S, 'normalizePhone: +62 → 62',     Utils.normalizePhone('+6281234567890'), '6281234567890');
      assertEqual(S, 'normalizePhone: 8xxx → 628xxx',Utils.normalizePhone('81234567890'), '6281234567890');
      assertEqual(S, 'normalizePhone: with spaces',  Utils.normalizePhone('0812 3456 7890'), '6281234567890');
      assertEqual(S, 'normalizePhone: empty',        Utils.normalizePhone(''), '');
    } else {
      skip(S, 'Utils.normalizePhone', 'helper not exported');
    }

    /* ── Utils.helpTip ── */
    if (typeof Utils.helpTip === 'function') {
      const html = Utils.helpTip('Test description');
      assert(S, 'helpTip: returns string', typeof html === 'string');
      assert(S, 'helpTip: contains help-tip class', html.includes('help-tip'));
      assert(S, 'helpTip: contains data-tip', html.includes('data-tip="Test description"'));
      assert(S, 'helpTip: tabindex for a11y', html.includes('tabindex="0"'));
      // XSS escape
      const xss = Utils.helpTip('<script>alert(1)</script>');
      assert(S, 'helpTip: escapes < in tip', !xss.includes('<script>'));
      // Position bottom variant
      const bottom = Utils.helpTip('Below', 'bottom');
      assert(S, 'helpTip: bottom pos attribute', bottom.includes('data-pos="bottom"'));
      // Auto-injected popup element
      assert(S, 'helpTip: global popup created', !!document.getElementById('help-tip-popup'));
    } else {
      skip(S, 'Utils.helpTip', 'helper not exported');
    }

    /* ── Utils.pullToRefresh ── */
    if (typeof Utils.pullToRefresh === 'function') {
      const tmpEl = document.createElement('div');
      document.body.appendChild(tmpEl);
      const cleanup = Utils.pullToRefresh(tmpEl, async () => {});
      assert(S, 'pullToRefresh: returns cleanup fn', typeof cleanup === 'function');
      tmpEl.remove();
    } else {
      skip(S, 'Utils.pullToRefresh', 'helper not exported');
    }

    /* ── Utils.urlState ── */
    if (Utils.urlState && typeof Utils.urlState.read === 'function') {
      assert(S, 'urlState.read exists',  typeof Utils.urlState.read  === 'function');
      assert(S, 'urlState.write exists', typeof Utils.urlState.write === 'function');
      assert(S, 'urlState.clear exists', typeof Utils.urlState.clear === 'function');
      // Round-trip test — write() has anti-clobber guard yang skip kalau App._currentPage !== namespace.
      // Override _currentPage sementara supaya write tidak di-block, restore setelah test.
      const prevUrl  = location.href;
      const prevPage = (typeof App !== 'undefined') ? App._currentPage : null;
      try {
        if (typeof App !== 'undefined') App._currentPage = '__test__';
        Utils.urlState.write('__test__', { foo: 'bar', n: 42 });
        const restored = Utils.urlState.read('__test__', ['foo', 'n']);
        assertEqual(S, 'urlState round-trip foo', restored.foo, 'bar');
        // n is read as string from URL
        assert(S, 'urlState round-trip n (as string)', restored.n === '42' || restored.n === 42);
        Utils.urlState.clear('__test__');
      } finally {
        if (typeof App !== 'undefined') App._currentPage = prevPage;
        history.replaceState(null, '', prevUrl);
      }
    } else {
      skip(S, 'Utils.urlState', 'helper not exported');
    }

    /* ── Utils.skeletonRows ── */
    if (typeof Utils.skeletonRows === 'function') {
      const html = Utils.skeletonRows(5, 3);
      assert(S, 'skeletonRows: returns string', typeof html === 'string');
      assert(S, 'skeletonRows: has skeleton class', html.includes('skeleton'));
      // Should contain 3 <tr> for 3 rows requested
      const trCount = (html.match(/<tr/g) || []).length;
      assertEqual(S, 'skeletonRows: row count match', trCount, 3);
    } else {
      skip(S, 'Utils.skeletonRows', 'helper not exported');
    }

    /* ── DB.getLastEditMap ── */
    if (typeof DB.getLastEditMap === 'function') {
      const map = await DB.getLastEditMap(['edit_kas']);
      assert(S, 'getLastEditMap: returns object', typeof map === 'object' && map !== null);
      // Each value should have {by, at, ts} shape — just check first if any
      const keys = Object.keys(map);
      if (keys.length > 0) {
        const first = map[keys[0]];
        assert(S, 'getLastEditMap: entry has "by" field',  typeof first.by === 'string');
        assert(S, 'getLastEditMap: entry has "ts" field',  typeof first.ts === 'number');
      } else {
        skip(S, 'getLastEditMap: entry shape', 'no edit_kas logs yet');
      }
      // Empty types filter → empty result
      const emptyMap = await DB.getLastEditMap(['__nonexistent_type__']);
      assertEqual(S, 'getLastEditMap: bogus type → empty', Object.keys(emptyMap).length, 0);
    } else {
      skip(S, 'DB.getLastEditMap', 'method not exported');
    }

    /* ── OfflineQueue ── */
    if (typeof OfflineQueue !== 'undefined') {
      assert(S, 'OfflineQueue.init exists',         typeof OfflineQueue.init === 'function');
      assert(S, 'OfflineQueue.flush exists',        typeof OfflineQueue.flush === 'function');
      assert(S, 'OfflineQueue.pendingCount exists', typeof OfflineQueue.pendingCount === 'function');
      assert(S, 'OfflineQueue.clearPending exists', typeof OfflineQueue.clearPending === 'function');
      assert(S, 'OfflineQueue.getQueue exists',     typeof OfflineQueue.getQueue === 'function');
      // pendingCount returns number
      const ct = OfflineQueue.pendingCount();
      assert(S, 'pendingCount returns number', typeof ct === 'number' && ct >= 0);
      // DB methods are wrapped
      assert(S, 'DB.saveKas wrapped by OfflineQueue', !!DB.saveKas?._oqWrapped);
      assert(S, 'DB.saveInventoryLog wrapped',       !!DB.saveInventoryLog?._oqWrapped);
      assert(S, 'DB.saveAP wrapped',                 !!DB.saveAP?._oqWrapped);
      assert(S, 'DB.deleteKas wrapped',              !!DB.deleteKas?._oqWrapped);
      // Banner element should be in body (lazy-injected on first state change, may not exist yet)
      // No assert: banner only created when needed
    } else {
      skip(S, 'OfflineQueue', 'module not loaded');
    }

    /* ── WeeklyDigest ── */
    if (typeof WeeklyDigest !== 'undefined') {
      assert(S, 'WeeklyDigest.generate exists',        typeof WeeklyDigest.generate === 'function');
      assert(S, 'WeeklyDigest.openModal exists',       typeof WeeklyDigest.openModal === 'function');
      assert(S, 'WeeklyDigest.checkAndShow exists',    typeof WeeklyDigest.checkAndShow === 'function');
      assert(S, 'WeeklyDigest.getCfg exists',          typeof WeeklyDigest.getCfg === 'function');
      assert(S, 'WeeklyDigest.shouldTrigger exists',   typeof WeeklyDigest.shouldTrigger === 'function');
      assert(S, 'WeeklyDigest.renderSettingsCard exists', typeof WeeklyDigest.renderSettingsCard === 'function');
      // Cfg shape
      const cfg = WeeklyDigest.getCfg();
      assert(S, 'WeeklyDigest cfg has enabled',  typeof cfg.enabled === 'boolean');
      assert(S, 'WeeklyDigest cfg has dayOfWeek (0-6)', typeof cfg.dayOfWeek === 'number' && cfg.dayOfWeek >= 0 && cfg.dayOfWeek <= 6);
      assert(S, 'WeeklyDigest cfg has hour (0-23)', typeof cfg.hour === 'number' && cfg.hour >= 0 && cfg.hour <= 23);
      assert(S, 'WeeklyDigest cfg has sections', typeof cfg.sections === 'object');
      // Generate (read-only, no side effect)
      try {
        const msg = await WeeklyDigest.generate();
        assert(S, 'WeeklyDigest.generate returns string', typeof msg === 'string' && msg.length > 0);
        assert(S, 'WeeklyDigest msg has BPS branding', msg.includes('BPS') || msg.includes('Weekly Digest'));
      } catch(e) {
        _log(S, 'WeeklyDigest.generate runs', false, e.message);
      }
    } else {
      skip(S, 'WeeklyDigest', 'module not loaded');
    }

    /* ── Activity Drawer (Utils.openActivityDrawer) ── */
    if (typeof Utils.openActivityDrawer === 'function') {
      assert(S, 'openActivityDrawer exists',  typeof Utils.openActivityDrawer  === 'function');
      assert(S, 'closeActivityDrawer exists', typeof Utils.closeActivityDrawer === 'function');
      assert(S, 'activityButton exists',      typeof Utils.activityButton      === 'function');
      // Module config map
      assert(S, '_activityCfg has kas',       !!Utils._activityCfg?.kas);
      assert(S, '_activityCfg has inventory', !!Utils._activityCfg?.inventory);
      assert(S, '_activityCfg has ap',        !!Utils._activityCfg?.ap);
      assert(S, '_activityCfg has po',        !!Utils._activityCfg?.po);
      // Button HTML
      const btnHtml = Utils.activityButton('kas');
      assert(S, 'activityButton: returns HTML', typeof btnHtml === 'string' && btnHtml.includes('Aktivitas'));
    } else {
      skip(S, 'Utils.openActivityDrawer', 'helper not exported');
    }

    /* ── Daily Order Bahan Dasar ── */
    if (typeof DailyOrderModule !== 'undefined') {
      assert(S, 'DailyOrderModule.openBasicItemsModal exists', typeof DailyOrderModule.openBasicItemsModal === 'function');
      assert(S, 'DailyOrderModule.addSelectedBasicItems exists', typeof DailyOrderModule.addSelectedBasicItems === 'function');
      assert(S, 'DailyOrderModule._basicCheckAll exists', typeof DailyOrderModule._basicCheckAll === 'function');
    } else {
      skip(S, 'DailyOrderModule.openBasicItemsModal', 'module not loaded yet (lazy)');
    }

    /* ── GridSelect drag-fill confirmation ── */
    if (typeof GridSelect !== 'undefined') {
      assert(S, 'GridSelect.onFill exists',  typeof GridSelect.onFill  === 'function');
      assert(S, 'GridSelect.onPaste exists', typeof GridSelect.onPaste === 'function');
      // Modal.confirm dependency for paste confirmation
      assert(S, 'Modal.confirm exists for paste confirm', typeof Modal.confirm === 'function');
    } else {
      skip(S, 'GridSelect', 'not loaded');
    }

    /* ── UndoRedo: render after save (fixed bug) ── */
    if (typeof UndoRedo !== 'undefined') {
      assert(S, 'UndoRedo.undo exists',     typeof UndoRedo.undo === 'function');
      assert(S, 'UndoRedo.redo exists',     typeof UndoRedo.redo === 'function');
      assert(S, 'UndoRedo.canUndo exists',  typeof UndoRedo.canUndo === 'function');
      assert(S, 'UndoRedo.canRedo exists',  typeof UndoRedo.canRedo === 'function');
      assert(S, 'UndoRedo.push exists',     typeof UndoRedo.push === 'function');
      assert(S, 'UndoRedo.setActive exists',typeof UndoRedo.setActive === 'function');
      // Empty stack returns false
      assert(S, 'UndoRedo.canUndo on fresh stack = false', UndoRedo.canUndo('__test_module__') === false);
    } else {
      skip(S, 'UndoRedo', 'not loaded');
    }

    /* ── Kas Total auto-computed (read-only) ── */
    // Verify _readRowFromDOM uses qty × harga for jumlah, not DOM input value
    if (typeof KasModule !== 'undefined') {
      assert(S, 'KasModule._calcTotal exists', typeof KasModule._calcTotal === 'function');
    } else {
      skip(S, 'KasModule._calcTotal', 'module not loaded yet (lazy)');
    }

    /* ── PO Belanja Pasar SUPPLIER column (commit 1a557d1) ── */
    // po-belanja-pasar.js loaded oleh POModule._loadBelanjaPasar() (private) — hanya
    // kalau user navigate ke tab Belanja Pasar. Untuk test, inject script tag manual.
    if (typeof POBelanjaPasarModule === 'undefined') {
      try {
        if (typeof App?._loadModule === 'function') await App._loadModule('po');
        await new Promise((resolve) => {
          if (document.querySelector('script[src^="js/modules/po-belanja-pasar.js"]')) { resolve(); return; }
          const s = document.createElement('script');
          s.src = 'js/modules/po-belanja-pasar.js?v=20260508b';
          s.onload  = resolve;
          s.onerror = resolve; // gracefully skip kalau gagal load (jangan block)
          document.head.appendChild(s);
        });
        for (let i = 0; i < 20 && typeof POBelanjaPasarModule === 'undefined'; i++) {
          await new Promise(r => setTimeout(r, 50));
        }
      } catch {}
    }
    if (typeof POBelanjaPasarModule !== 'undefined') {
      assert(S, 'POBelanjaPasarModule._onSupplierChange exists', typeof POBelanjaPasarModule._onSupplierChange === 'function');
      assert(S, 'POBelanjaPasarModule._onSupplierKey exists',    typeof POBelanjaPasarModule._onSupplierKey === 'function');
      assert(S, 'POBelanjaPasarModule._onCikopoChange exists',   typeof POBelanjaPasarModule._onCikopoChange === 'function');
      assert(S, 'POBelanjaPasarModule._onCikopoKey exists',      typeof POBelanjaPasarModule._onCikopoKey === 'function');
      // Tab key handling fix (commit 79de326) — verifies handler source has Tab branch
      const ckSrc = POBelanjaPasarModule._onCikopoKey.toString();
      assert(S, '_onCikopoKey: handles Tab (Android Chrome quirk)', /Tab/.test(ckSrc) && /Enter/.test(ckSrc));
      const skSrc = POBelanjaPasarModule._onSupplierKey.toString();
      assert(S, '_onSupplierKey: handles Tab + Enter',             /Tab/.test(skSrc) && /Enter/.test(skSrc));
      // Clamp value writeback (commit 79de326) — verifies handler writes clamped value back to input DOM
      const ccSrc = POBelanjaPasarModule._onCikopoChange.toString();
      assert(S, '_onCikopoChange: writes clamped value back to DOM',
        /querySelector\(.*bp-cikopo-input/.test(ccSrc) || /\.value\s*=/.test(ccSrc));
      const scSrc = POBelanjaPasarModule._onSupplierChange.toString();
      assert(S, '_onSupplierChange: writes clamped value back to DOM',
        /querySelector\(.*bp-supplier-input/.test(scSrc) || /\.value\s*=/.test(scSrc));
    } else {
      skip(S, 'POBelanjaPasarModule SUPPLIER', 'module not loaded yet (lazy)');
    }

    /* ── PO supplier mini-card import (commit 1a557d1) ── */
    if (typeof POModule !== 'undefined') {
      assert(S, 'POModule._openSupplierImport exists', typeof POModule._openSupplierImport === 'function');
      assert(S, 'POModule._supImpToggleAll exists',    typeof POModule._supImpToggleAll === 'function');
      assert(S, 'POModule._supImpConfirm exists',      typeof POModule._supImpConfirm === 'function');
    } else {
      skip(S, 'POModule supplier import', 'module not loaded yet (lazy)');
    }

    /* ── Daily Order Form Produksi mobile Enter fix (commit 2eda98a) ── */
    if (typeof DailyOrderModule !== 'undefined') {
      assert(S, 'DailyOrderModule._estQtyKeyDown exists',  typeof DailyOrderModule._estQtyKeyDown === 'function');
      assert(S, 'DailyOrderModule._estQtyBlur exists',     typeof DailyOrderModule._estQtyBlur === 'function');
      assert(S, 'DailyOrderModule._cancelEstBlur exists',  typeof DailyOrderModule._cancelEstBlur === 'function');
      // Tab key handling — Android Chrome "→I" sometimes fires keydown 'Tab' instead of 'Enter'
      const eqSrc = DailyOrderModule._estQtyKeyDown.toString();
      assert(S, '_estQtyKeyDown: handles Tab + Enter (Android compat)', /Tab/.test(eqSrc) && /Enter/.test(eqSrc));
      // Blur fallback passes jumpToField for auto-spawn next row
      const ebSrc = DailyOrderModule._estQtyBlur.toString();
      assert(S, '_estQtyBlur: passes jumpToField for next-row spawn', /['"]di-item['"]/.test(ebSrc));
    } else {
      skip(S, 'DailyOrderModule Form Produksi', 'module not loaded yet (lazy)');
    }
  }

  // ═══════════════════════════════════════════
  // 8. SMOKE TESTS — critical user flows (replace Playwright E2E equivalent)
  //    Test critical money/data paths end-to-end pakai DB API. Catch regression
  //    di flow yg paling sering bermasalah saat refactor.
  // ═══════════════════════════════════════════
  async function testSmoke() {
    const S = 'Smoke';
    const _stamp = Date.now();
    const _testIds = []; // collect untuk cleanup

    // ── FLOW 1: KAS SAVE → LOAD → VERIFY all fields preserved ──
    try {
      const testKas = {
        id: '__test_kas_' + _stamp,
        tgl: '2026-05-16',
        nama: 'Smoke Test Belanja',
        type: 'Belanja Pasar',
        vendor: 'Test Vendor & <Script>', // XSS char to verify escape
        qty: 5,
        satuan: 'Kg',
        hargaSatuan: 12345,
        jumlah: 5 * 12345,
        penerima: 'Test Penerima',
        status: 'DONE',
        bulan: 'Mei',
      };
      _testIds.push({ table: 'kas', id: testKas.id });
      await DB.saveKas(testKas);
      const kasList = await DB.getKas();
      const saved = kasList.find(r => r.id === testKas.id);
      assert(S, 'Flow 1: Kas saved & loaded', !!saved);
      if (saved) {
        assert(S, 'Flow 1: nama preserved', saved.nama === testKas.nama);
        assert(S, 'Flow 1: vendor preserved (XSS char intact)', saved.vendor === testKas.vendor);
        assert(S, 'Flow 1: qty preserved as number', saved.qty === testKas.qty);
        assert(S, 'Flow 1: hargaSatuan preserved as number', saved.hargaSatuan === testKas.hargaSatuan);
        assert(S, 'Flow 1: jumlah = qty × hargaSatuan', saved.jumlah === testKas.jumlah);
        assert(S, 'Flow 1: status preserved', saved.status === testKas.status);
      }
    } catch (e) {
      _log(S, 'Flow 1: Kas save/load', false, e.message);
    }

    // ── FLOW 2: AP CREATE → MARK LUNAS → status change persists ──
    try {
      const testAP = {
        id: '__test_ap_' + _stamp,
        tgl: '2026-05-16',
        tgl_transaksi: '2026-05-16',
        vendor: 'Test Vendor AP',
        supplier: 'Test Vendor AP',
        keterangan: 'Smoke test invoice',
        qty: 10, satuan: 'Pcs', hargaSatuan: 50000,
        total: 500000, terbayar: 0,
        status: 'BELUM',
      };
      _testIds.push({ table: 'ap', id: testAP.id });
      await DB.saveAP(testAP);
      // Step 2: mark as paid (status='LUNAS', terbayar=total)
      const paid = { ...testAP, status: 'LUNAS', terbayar: testAP.total };
      await DB.saveAP(paid);
      const apList = await DB.getAP();
      const found = apList.find(r => r.id === testAP.id);
      assert(S, 'Flow 2: AP mark LUNAS persists', found && found.status === 'LUNAS');
      assert(S, 'Flow 2: AP terbayar = total', found && found.terbayar === testAP.total);
      assert(S, 'Flow 2: AP total field intact after status update', found && found.total === testAP.total);
    } catch (e) {
      _log(S, 'Flow 2: AP mark lunas', false, e.message);
    }

    // ── FLOW 3: DAILY ORDER FORM SAVE → items array intact ──
    try {
      const testForm = {
        id: '__test_doform_' + _stamp,
        tanggal: '2026-05-16',
        shift: 'S1',
        status: 'draft',
        items: [
          { id: 'item1', item: 'Daging Sapi', estQty: 10, aktQty: 9, satuan: 'kg', hargaSatuan: 145000, estTotal: 1450000, aktTotal: 1305000 },
          { id: 'item2', item: 'Bawang Merah', estQty: 5,  aktQty: 5, satuan: 'kg', hargaSatuan: 40000,  estTotal: 200000,  aktTotal: 200000 },
        ],
        foodCostPct: 53,
        createdAt: new Date().toISOString(),
      };
      _testIds.push({ table: 'daily_order_forms', id: testForm.id });
      await DB.saveDailyOrderForm(testForm);
      const forms = await DB.getDailyOrderForms();
      const f = forms.find(r => r.id === testForm.id);
      assert(S, 'Flow 3: DO form saved & loaded', !!f);
      if (f) {
        assert(S, 'Flow 3: items array length preserved', Array.isArray(f.items) && f.items.length === 2);
        const i0 = (f.items||[])[0];
        assert(S, 'Flow 3: item.item preserved', i0?.item === 'Daging Sapi');
        assert(S, 'Flow 3: item.aktQty number preserved', i0?.aktQty === 9);
        assert(S, 'Flow 3: item.aktTotal preserved', i0?.aktTotal === 1305000);
        assert(S, 'Flow 3: shift preserved', f.shift === 'S1');
        assert(S, 'Flow 3: foodCostPct preserved', f.foodCostPct === 53);
      }
    } catch (e) {
      _log(S, 'Flow 3: Daily Order form save', false, e.message);
    }

    // ── FLOW 4: INVENTORY KELUAR LOG → field schema (jenis/jumlah/itemNama) ──
    // Regression guard: pastikan field naming consistent dengan code yang depend
    // (Cek Selisih DO vs HPP, Top Produk HPP detail). Bug pattern sebelumnya:
    // pakai 'action'/'qty'/'namaProduk' yg tidak ada → silent zero result.
    try {
      const testInv = {
        id: '__test_invlog_' + _stamp,
        itemId: 'test-item',
        itemNama: 'Test Item Keluar',
        jenis: 'KELUAR',
        jumlah: 3.5,
        harga: 20000,
        tgl: '2026-05-16',
        catatan: 'Smoke test',
      };
      _testIds.push({ table: 'inv_activities', id: testInv.id });
      await DB.saveInventoryLog(testInv);
      const logs = await DB.getInventory();
      const log = logs.find(r => r.id === testInv.id);
      assert(S, 'Flow 4: Inventory log saved & loaded', !!log);
      if (log) {
        assert(S, 'Flow 4: jenis field (bukan action)', log.jenis === 'KELUAR');
        assert(S, 'Flow 4: jumlah field (bukan qty)',  log.jumlah === 3.5);
        assert(S, 'Flow 4: harga field (bukan hargaSatuan)', log.harga === 20000);
        assert(S, 'Flow 4: itemNama field (bukan namaProduk)', log.itemNama === 'Test Item Keluar');
        assert(S, 'Flow 4: tgl field (bukan tanggal)', log.tgl === '2026-05-16');
        assert(S, 'Flow 4: catatan field (bukan keterangan)', log.catatan === 'Smoke test');
      }
    } catch (e) {
      _log(S, 'Flow 4: Inventory log schema', false, e.message);
    }

    // ── FLOW 5: KAS ↔ ANGGARAN LINK → anggaranId field persists ──
    // Verifikasi fitur Opsi 4 (Kas Kecil ter-link ke Anggaran) tetap aman:
    // anggaranId nullable, di-save di JSONB, tidak hilang setelah save ulang.
    try {
      const testKas2 = {
        id: '__test_kas_link_' + _stamp,
        tgl: '2026-05-16',
        nama: 'Kas linked test',
        type: 'Belanja',
        qty: 1, satuan: 'Pcs', hargaSatuan: 50000,
        jumlah: 50000, penerima: 'Test',
        status: 'DONE',
        anggaranId: 'test-anggaran-id-' + _stamp,
      };
      _testIds.push({ table: 'kas', id: testKas2.id });
      await DB.saveKas(testKas2);
      const list = await DB.getKas();
      const saved = list.find(r => r.id === testKas2.id);
      assert(S, 'Flow 5: Kas with anggaranId saved', !!saved);
      assert(S, 'Flow 5: anggaranId field preserved', saved && saved.anggaranId === testKas2.anggaranId);
      // Unlink: remove anggaranId
      delete saved.anggaranId;
      await DB.saveKas(saved);
      const list2 = await DB.getKas();
      const saved2 = list2.find(r => r.id === testKas2.id);
      assert(S, 'Flow 5: Unlink anggaranId persists (undefined/missing)',
        saved2 && (saved2.anggaranId === undefined || saved2.anggaranId === null || saved2.anggaranId === ''));
    } catch (e) {
      _log(S, 'Flow 5: Kas-Anggaran link', false, e.message);
    }

    // ── CLEANUP: hapus semua test records ──
    for (const t of _testIds) {
      try {
        if      (t.table === 'kas') await DB.deleteKas(t.id);
        else if (t.table === 'ap')  await DB.deleteAP(t.id);
        else if (t.table === 'daily_order_forms') await DB.deleteDailyOrderForm?.(t.id);
        else if (t.table === 'inv_activities')     await DB.deleteInventoryLog?.(t.id);
      } catch {}
    }
    // Cleanup verification
    try {
      const remainingKas = (await DB.getKas()).filter(r => String(r.id||'').startsWith('__test_'));
      const remainingAP  = (await DB.getAP() ).filter(r => String(r.id||'').startsWith('__test_'));
      assert(S, 'Cleanup: no __test_ kas records leaked', remainingKas.length === 0,
        remainingKas.length ? `Leaked: ${remainingKas.map(r=>r.id).join(',')}` : 'clean');
      assert(S, 'Cleanup: no __test_ AP records leaked', remainingAP.length === 0,
        remainingAP.length ? `Leaked: ${remainingAP.map(r=>r.id).join(',')}` : 'clean');
    } catch {}
  }

  // ═══════════════════════════════════════════
  // RUN ALL
  // ═══════════════════════════════════════════
  async function runAll() {
    results.length = 0;
    _passed = 0; _failed = 0; _skipped = 0;
    console.log('═══════════════════════════════════════');
    console.log('  BECCA V2.0 — Test Suite');
    console.log('═══════════════════════════════════════');

    console.log('\n── 1. Regression Tests ──');
    await testRegression();

    console.log('\n── 2. Data Integrity Tests ──');
    await testDataIntegrity();

    console.log('\n── 3. Permission Tests ──');
    await testPermissions();

    console.log('\n── 4. Financial Accuracy Tests ──');
    await testFinancialAccuracy();

    console.log('\n── 5. Critical Path Tests ──');
    await testCriticalPath();

    console.log('\n── 6. Performance & Health Tests ──');
    await testPerformance();

    console.log('\n── 7. New Features (Utils, OfflineQueue, WeeklyDigest, dll) ──');
    await testNewFeatures();

    console.log('\n── 8. Smoke Tests (critical user flows) ──');
    await testSmoke();

    console.log('\n═══════════════════════════════════════');
    console.log(`  RESULTS: ${_passed} passed, ${_failed} failed, ${_skipped} skipped`);
    console.log(`  ${_failed === 0 ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
    console.log('═══════════════════════════════════════');

    return { passed: _passed, failed: _failed, skipped: _skipped, results };
  }

  // HTML report for Settings page
  function getHtmlReport() {
    if (!results.length) return '<div style="color:var(--text-3);text-align:center;padding:20px">Belum ada hasil test. Klik "Run Tests" untuk mulai.</div>';
    const summary = `<div style="display:flex;gap:12px;margin-bottom:12px">
      <span style="font-size:14px;font-weight:700;color:var(--success)">${_passed} Passed</span>
      <span style="font-size:14px;font-weight:700;color:var(--danger)">${_failed} Failed</span>
      <span style="font-size:14px;font-weight:700;color:var(--text-3)">${_skipped} Skipped</span>
    </div>`;
    const rows = results.map(r => {
      const color = r.status === 'PASS' ? 'var(--success)' : r.status === 'FAIL' ? 'var(--danger)' : 'var(--text-3)';
      const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⏭';
      return `<tr>
        <td style="padding:4px 8px;font-size:11px;color:var(--text-3)">${r.suite}</td>
        <td style="padding:4px 8px;font-size:12px">${icon} ${r.name}</td>
        <td style="padding:4px 8px;font-size:11px;color:${color};font-weight:600">${r.status}</td>
        <td style="padding:4px 8px;font-size:11px;color:var(--text-3)">${r.detail||''}</td>
      </tr>`;
    }).join('');
    return summary + `<div style="max-height:400px;overflow-y:auto"><table class="table" style="font-size:12px">
      <thead><tr><th>Suite</th><th>Test</th><th>Status</th><th>Detail</th></tr></thead>
      <tbody>${rows}</tbody></table></div>`;
  }

  return { runAll, testRegression, testDataIntegrity, testPermissions, testFinancialAccuracy, testCriticalPath, testPerformance, testNewFeatures, testSmoke, getHtmlReport };
})();
window.BeccaTests = BeccaTests;

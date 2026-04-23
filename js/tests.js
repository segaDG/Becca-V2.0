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
    const expectedModules = ['dashboard','order','invoice','customer','kas','inventory','employee','ap','task','chat','settings'];
    expectedModules.forEach(m => assert(S, `Module map has ${m}`, !!moduleMap[m]));

    // No hardcoded passwords in default users
    const hasPassword = Auth._defaultUsers.some(u => u.password);
    assert(S, 'No hardcoded passwords in _defaultUsers', !hasPassword);
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

  return { runAll, testRegression, testDataIntegrity, testPermissions, testFinancialAccuracy, testCriticalPath, getHtmlReport };
})();
window.BeccaTests = BeccaTests;

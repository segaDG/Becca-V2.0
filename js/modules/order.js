/* ============================================
   BECCA V2.0 — Order Module (Placeholder)
   File asli dari repo becca-catering perlu
   di-copy ke sini untuk fitur lengkap.
   ============================================ */

const OrderModule = (() => {

  async function init() {
    const page = document.getElementById('page-order');
    page.innerHTML = `
      <div class="page-header">
        <div class="page-header-left">
          <h2>Order Catering</h2>
          <p>Manajemen order masuk</p>
        </div>
      </div>
      <div class="empty-state" style="height:50vh">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
        </svg>
        <h4>Modul Order</h4>
        <p>Copy file <code>order.js</code> dari repo <strong>becca-catering</strong><br>
        ke folder <code>js/modules/</code> di repo <strong>Becca-V2.0</strong></p>
        <br>
        <p style="font-size:12px;color:var(--text-3)">
          github.com/segaDG/becca-catering → js/modules/order.js
        </p>
      </div>
    `;
  }

  return { init };
})();

window.OrderModule = OrderModule;

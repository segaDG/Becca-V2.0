/* ============================================
   BECCA V2.0 — Face Attendance Module
   Absensi via pengenalan wajah (face-api.js)
   Dapat dinonaktifkan via toggle di tab Absensi
============================================ */
const FaceAttendanceModule = (() => {

  const LIB_CDN    = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
  const MODEL_URL  = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights';
  const ENABLED_KEY = 'becca_face_att_on';

  let _state    = 'idle'; // 'idle' | 'loading' | 'ready' | 'error'
  let _errorMsg = '';
  let _stream   = null;
  let _rafId    = null;
  let _matcher  = null;
  let _employees = [];
  let _absensi   = [];
  let _kioskCooldown = {}; // empId → lastRecognizedAt timestamp

  // ---- public state ----
  function isEnabled()    { return localStorage.getItem(ENABLED_KEY) === '1'; }
  function setEnabled(v)  {
    localStorage.setItem(ENABLED_KEY, v ? '1' : '0');
    if (!v) _stopStream();
  }

  // ---- lazy script loader ----
  function _loadScript(src) {
    return new Promise((res, rej) => {
      if (window.faceapi) { res(); return; }
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) { existing.onload = res; return; }
      const s = document.createElement('script');
      s.src = src;
      s.onload = res;
      s.onerror = () => rej(new Error('Gagal mengunduh library face-api.js. Cek koneksi internet.'));
      document.head.appendChild(s);
    });
  }

  // ---- model loading ----
  async function _loadModels() {
    if (_state === 'ready') return;
    if (_state === 'loading') {
      await new Promise(res => {
        const t = setInterval(() => { if (_state !== 'loading') { clearInterval(t); res(); } }, 200);
      });
      if (_state === 'error') throw new Error(_errorMsg);
      return;
    }
    _state = 'loading';
    try {
      await _loadScript(LIB_CDN);
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      _state = 'ready';
      _buildMatcher();
    } catch(e) {
      _state = 'error';
      _errorMsg = e.message;
      throw e;
    }
  }

  // ---- stop camera ----
  function _stopStream() {
    if (_stream) { _stream.getTracks().forEach(t => t.stop()); _stream = null; }
    if (_rafId)  { cancelAnimationFrame(_rafId); _rafId = null; }
  }

  // ---- data ----
  function init(employees, absensi) {
    _employees = employees || [];
    _absensi   = absensi   || [];
    if (_state === 'ready') _buildMatcher();
  }

  function pushAbsensi(rec) { _absensi.push(rec); }

  // ---- build face matcher ----
  function _buildMatcher() {
    if (!window.faceapi) return;
    const labeled = _employees
      .filter(e => e.faceDescriptors?.length)
      .map(e => {
        const descriptors = e.faceDescriptors.map(d => new Float32Array(Object.values(d)));
        return new faceapi.LabeledFaceDescriptors(e.id + '||' + e.nama, descriptors);
      });
    _matcher = labeled.length ? new faceapi.FaceMatcher(labeled, 0.5) : null;
  }

  // ---- draw face box on canvas ----
  function _drawBox(canvas, video, box, color, label) {
    const ctx = canvas.getContext('2d');
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!box) return;
    const sx = canvas.width  / (video.videoWidth  || 640);
    const sy = canvas.height / (video.videoHeight || 480);
    ctx.strokeStyle = color;
    ctx.lineWidth   = 3;
    ctx.shadowBlur  = 8;
    ctx.shadowColor = color;
    ctx.strokeRect(box.x * sx, box.y * sy, box.width * sx, box.height * sy);
    if (label) {
      ctx.fillStyle = color;
      ctx.font      = 'bold 13px sans-serif';
      ctx.fillText(label, box.x * sx, box.y * sy - 6);
    }
  }

  // =========================================================
  //  REGISTRATION — Daftarkan Wajah Karyawan
  // =========================================================
  let _regSamples = [];
  let _regMid     = null;

  async function openRegisterModal(empId) {
    const emp = _employees.find(e => e.id === empId);
    if (!emp) return;
    _regSamples = [];
    _regMid     = Utils.uid();

    Modal.open({
      id: _regMid,
      title: '📷 Daftarkan Wajah — ' + emp.nama,
      body: `
        <div id="fr-status" style="text-align:center;font-size:13px;color:var(--text-3);margin-bottom:8px">
          Memuat model AI... (pertama kali ±10 detik)
        </div>
        <div style="position:relative;border-radius:10px;overflow:hidden;background:#111;aspect-ratio:4/3;max-height:320px">
          <video id="fr-video" autoplay muted playsinline style="width:100%;height:100%;object-fit:cover;transform:scaleX(-1)"></video>
          <canvas id="fr-canvas" style="position:absolute;top:0;left:0;width:100%;height:100%;transform:scaleX(-1)"></canvas>
          <div id="fr-loader" style="position:absolute;inset:0;background:rgba(0,0,0,.75);display:flex;flex-direction:column;align-items:center;justify-content:center;color:white;gap:8px">
            <div style="font-size:28px">🤖</div>
            <div style="font-weight:600">Memuat AI Model...</div>
            <div style="font-size:11px;opacity:.6">Hanya terjadi sekali, proses di-cache browser</div>
          </div>
        </div>
        <div style="margin-top:10px">
          <div style="font-size:11px;color:var(--text-3);margin-bottom:6px">Sampel terkumpul (butuh 5):</div>
          <div id="fr-samples" style="display:flex;gap:6px;min-height:44px;flex-wrap:wrap"></div>
        </div>`,
      footer: `
        <button class="btn btn-ghost" onclick="Modal.close('${_regMid}');FaceAttendanceModule._stopReg()">Batal</button>
        <button class="btn btn-primary" id="fr-btn" disabled onclick="FaceAttendanceModule._captureReg('${empId}')">
          📸 Ambil Sampel <span id="fr-count">(0/5)</span>
        </button>`,
    });

    try {
      await _loadModels();
      _stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      const video = document.getElementById('fr-video');
      if (!video) { _stopStream(); return; }
      video.srcObject = _stream;
      await new Promise(res => { video.onloadedmetadata = res; });
      document.getElementById('fr-loader')?.remove();
      document.getElementById('fr-btn').disabled = false;
      document.getElementById('fr-status').textContent = 'Posisikan wajah di tengah, pastikan pencahayaan cukup';
      _startRegLoop();
    } catch(e) {
      const ldr = document.getElementById('fr-loader');
      if (ldr) ldr.innerHTML = `
        <div style="text-align:center;padding:16px;color:white">
          <div style="font-size:24px;margin-bottom:8px">⚠️</div>
          <div style="font-weight:600;margin-bottom:4px">Gagal memuat sistem</div>
          <div style="font-size:11px;opacity:.7">${e.message}</div>
          <div style="font-size:11px;opacity:.5;margin-top:8px">Fitur dapat dinonaktifkan di tab Absensi</div>
        </div>`;
    }
  }

  function _startRegLoop() {
    const video  = document.getElementById('fr-video');
    const canvas = document.getElementById('fr-canvas');
    if (!video || !canvas) return;

    const detect = async () => {
      if (!document.getElementById('fr-video')) { _stopStream(); return; }
      const r = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320 }))
        .withFaceLandmarks(true)
        .catch(() => null);

      if (r) {
        _drawBox(canvas, video, r.detection.box, '#22c55e');
        const s = document.getElementById('fr-status');
        if (s) s.innerHTML = '<span style="color:var(--success)">✅ Wajah terdeteksi — tekan Ambil Sampel</span>';
      } else {
        _drawBox(canvas, video, null, '');
        const s = document.getElementById('fr-status');
        if (s) s.innerHTML = '<span style="color:var(--warning)">⚠️ Wajah belum terdeteksi, perbaiki posisi...</span>';
      }
      _rafId = requestAnimationFrame(detect);
    };
    detect();
  }

  async function _captureReg(empId) {
    const video = document.getElementById('fr-video');
    if (!video) return;
    const btn = document.getElementById('fr-btn');
    if (btn) btn.disabled = true;

    const r = await faceapi
      .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320 }))
      .withFaceLandmarks(true)
      .withFaceDescriptor()
      .catch(() => null);

    if (!r) {
      Notify.warning('Wajah tidak terdeteksi, coba lagi');
      if (btn) btn.disabled = false;
      return;
    }

    _regSamples.push(Array.from(r.descriptor));

    // Thumbnail preview
    const thumb = document.createElement('canvas');
    thumb.width = 44; thumb.height = 44;
    const { x, y, width, height } = r.detection.box;
    thumb.getContext('2d').drawImage(video, x, y, width, height, 0, 0, 44, 44);
    const img = new Image();
    img.src = thumb.toDataURL();
    img.style.cssText = 'width:44px;height:44px;border-radius:6px;object-fit:cover;border:2px solid var(--success)';
    document.getElementById('fr-samples')?.appendChild(img);

    const count = _regSamples.length;
    const countEl = document.getElementById('fr-count');
    if (countEl) countEl.textContent = `(${count}/5)`;

    if (count < 5) {
      if (btn) btn.disabled = false;
      const s = document.getElementById('fr-status');
      if (s) s.textContent = `Sampel ${count}/5 — miring sedikit dan ambil lagi`;
    } else {
      // All 5 collected — save
      _stopStream();
      await _saveRegDescriptors(empId);
    }
  }

  async function _saveRegDescriptors(empId) {
    const emp = _employees.find(e => e.id === empId);
    if (!emp) return;
    emp.faceDescriptors = _regSamples;
    try {
      await DB.saveEmployee(emp);
      _buildMatcher();
      if (_regMid) Modal.close(_regMid);
      Notify.success('Wajah ' + emp.nama + ' berhasil didaftarkan ✓');
    } catch(e) {
      Notify.error('Gagal menyimpan data wajah', e.message);
    }
    _regSamples = [];
    _regMid     = null;
  }

  function _stopReg() {
    _stopStream();
    _regSamples = [];
  }

  // =========================================================
  //  KIOSK MODE — Pengenalan Otomatis
  // =========================================================
  async function openKiosk() {
    const mid = Utils.uid();
    Modal.open({
      id: mid,
      title: '🏢 Kiosk Absensi Wajah',
      body: `
        <div id="kiosk-status" style="text-align:center;font-size:13px;font-weight:600;color:var(--text-2);margin-bottom:10px">
          Memuat sistem...
        </div>
        <div style="position:relative;border-radius:12px;overflow:hidden;background:#111;aspect-ratio:16/9;max-height:380px">
          <video id="kiosk-video" autoplay muted playsinline style="width:100%;height:100%;object-fit:cover;transform:scaleX(-1)"></video>
          <canvas id="kiosk-canvas" style="position:absolute;top:0;left:0;width:100%;height:100%;transform:scaleX(-1)"></canvas>
          <div id="kiosk-loader" style="position:absolute;inset:0;background:rgba(0,0,0,.8);display:flex;flex-direction:column;align-items:center;justify-content:center;color:white;gap:8px">
            <div style="font-size:36px">🤖</div>
            <div style="font-weight:600">Memuat AI Model...</div>
            <div style="font-size:11px;opacity:.6">Pertama kali memuat ~10 detik, selanjutnya instan</div>
          </div>
          <div id="kiosk-result" style="display:none;position:absolute;bottom:0;left:0;right:0;padding:14px 20px;
            background:linear-gradient(transparent,rgba(0,0,0,.85));text-align:center;color:white"></div>
        </div>
        <div id="kiosk-log" style="margin-top:10px;max-height:130px;overflow-y:auto;display:flex;flex-direction:column;gap:4px;font-size:12px"></div>`,
      footer: `<button class="btn btn-ghost" onclick="Modal.close('${mid}');FaceAttendanceModule._stopKiosk()">Tutup Kiosk</button>`,
    });

    try {
      await _loadModels();

      if (!_matcher) {
        const ldr = document.getElementById('kiosk-loader');
        if (ldr) ldr.innerHTML = `
          <div style="text-align:center;padding:16px;color:white">
            <div style="font-size:32px;margin-bottom:8px">⚠️</div>
            <div style="font-weight:600">Belum ada karyawan yang terdaftar</div>
            <div style="font-size:12px;opacity:.7;margin-top:4px">Daftarkan wajah karyawan terlebih dahulu melalui Data Karyawan</div>
          </div>`;
        return;
      }

      _stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      const video = document.getElementById('kiosk-video');
      if (!video) { _stopStream(); return; }
      video.srcObject = _stream;
      await new Promise(res => { video.onloadedmetadata = res; });
      document.getElementById('kiosk-loader')?.remove();

      const status = document.getElementById('kiosk-status');
      if (status) status.innerHTML = '🟢 Sistem aktif — tatap kamera untuk absen';

      _kioskCooldown = {};
      _startKioskLoop(mid);
    } catch(e) {
      const ldr = document.getElementById('kiosk-loader');
      if (ldr) ldr.innerHTML = `
        <div style="text-align:center;padding:16px;color:white">
          <div style="font-size:32px;margin-bottom:8px">❌</div>
          <div style="font-weight:600">${e.message}</div>
        </div>`;
    }
  }

  function _startKioskLoop(mid) {
    const video    = document.getElementById('kiosk-video');
    const canvas   = document.getElementById('kiosk-canvas');
    const resultEl = document.getElementById('kiosk-result');
    if (!video || !canvas) return;

    let frameCount = 0;

    const loop = async () => {
      if (!document.getElementById('kiosk-video')) { _stopStream(); return; }
      frameCount++;

      // Full pipeline every 20 frames (~667ms at 30fps) — reduce CPU load
      if (frameCount % 20 === 0) {
        const r = await faceapi
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 416 }))
          .withFaceLandmarks(true)
          .withFaceDescriptor()
          .catch(() => null);

        if (r && _matcher) {
          const match   = _matcher.findBestMatch(r.descriptor);
          const unknown = match.label === 'unknown';
          _drawBox(canvas, video, r.detection.box, unknown ? '#ef4444' : '#22c55e');

          if (!unknown) {
            const [empId, empNama] = match.label.split('||');
            const now = Date.now();
            if (!_kioskCooldown[empId] || now - _kioskCooldown[empId] > 12000) {
              _kioskCooldown[empId] = now;
              await _recordKioskAbsensi(empId, empNama, resultEl);
            }
          }
        } else {
          // clear canvas when no face
          const ctx = canvas.getContext('2d');
          canvas.width  = video.videoWidth  || 1280;
          canvas.height = video.videoHeight || 720;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }

      _rafId = requestAnimationFrame(loop);
    };
    loop();
  }

  async function _recordKioskAbsensi(empId, empNama, resultEl) {
    const today   = new Date().toISOString().split('T')[0];
    const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    const existing = _absensi.find(a => (a.empId===empId || a.empNama===empNama) && a.tgl===today);
    if (existing) {
      if (resultEl) {
        resultEl.style.display = 'block';
        resultEl.innerHTML = `
          <div style="font-size:16px;font-weight:700">👋 ${empNama}</div>
          <div style="font-size:12px;opacity:.8">Sudah tercatat hari ini (${existing.status}) · ${timeStr}</div>`;
        setTimeout(() => { if (resultEl) resultEl.style.display = 'none'; }, 3000);
      }
      return;
    }

    const rec = {
      empId, empNama, tgl: today, status: 'H',
      ket: 'Face Recognition ' + timeStr,
      createdAt: new Date().toISOString(),
    };
    const saved = await DB.saveEmpAbsensi(rec).catch(() => rec);
    if (!saved.id) saved.id = Utils.uid();
    _absensi.push(saved);

    // Sync ke EmployeeModule
    if (window.EmployeeModule?._onFaceAbsensi) EmployeeModule._onFaceAbsensi(saved);

    if (resultEl) {
      resultEl.style.display = 'block';
      resultEl.innerHTML = `
        <div style="font-size:22px;font-weight:700;color:#4ade80">✅ Selamat datang, ${empNama}!</div>
        <div style="font-size:13px;opacity:.8">${timeStr} · Hadir tercatat</div>`;
      setTimeout(() => { if (resultEl) resultEl.style.display = 'none'; }, 4500);
    }

    // Log entry
    const logEl = document.getElementById('kiosk-log');
    if (logEl) {
      const entry = document.createElement('div');
      entry.style.cssText = 'padding:5px 10px;border-radius:6px;background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.3);color:var(--success)';
      entry.textContent = `${timeStr} — ${empNama} ✓ Hadir`;
      logEl.prepend(entry);
    }
    Notify.success(empNama + ' absen via wajah ✓');
  }

  function _stopKiosk() {
    _stopStream();
    _kioskCooldown = {};
  }

  // ---- toggle button renderer ----
  function renderToggle() {
    const on = isEnabled();
    return `<button class="btn btn-ghost btn-sm" onclick="FaceAttendanceModule.toggleAndRender()"
      style="gap:6px;${on?'border-color:rgba(34,197,94,.5);color:var(--success)':''}">
      <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${on?'var(--success)':'var(--text-3)'}"></span>
      ${on ? 'Wajah ON' : 'Wajah OFF'}
    </button>`;
  }

  function toggleAndRender() {
    setEnabled(!isEnabled());
    if (window.EmployeeModule) EmployeeModule.renderAbsensi();
  }

  return {
    isEnabled, setEnabled, init, pushAbsensi,
    openRegisterModal, _captureReg, _stopReg,
    openKiosk, _stopKiosk,
    renderToggle, toggleAndRender,
    get state() { return _state; },
  };

})();
window.FaceAttendanceModule = FaceAttendanceModule;

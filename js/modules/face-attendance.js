/* ============================================
   BECCA V2.0 — Face Attendance Module
   Anti-spoof: Depth (micro-movement) + Liveness Challenge
   Auto-capture: pengambilan foto otomatis setelah liveness
   Thumbnails disimpan di localStorage (becca_face_thumbs_{empId})
============================================ */
const FaceAttendanceModule = (() => {

  const LIB_CDN     = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
  const MODEL_URL   = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights';
  const ENABLED_KEY = 'becca_face_att_on';
  const THUMBS_KEY  = id => 'becca_face_thumbs_' + id;

  let _state    = 'idle';
  let _errorMsg = '';
  let _stream   = null;
  let _rafId    = null;
  let _matcher  = null;
  let _employees = [];
  let _absensi   = [];
  let _kioskCooldown = {};

  // ---- hints for each auto-capture frame ----
  const _CAPTURE_HINTS = [
    'Lurus ke depan',
    'Toleh sedikit ke kanan',
    'Toleh sedikit ke kiri',
    'Angkat dagu sedikit',
    'Turunkan dagu sedikit',
  ];

  // =============================================
  //  HELPERS
  // =============================================
  function isEnabled()   { return localStorage.getItem(ENABLED_KEY) === '1'; }
  function setEnabled(v) { localStorage.setItem(ENABLED_KEY, v ? '1' : '0'); if (!v) _stopStream(); }

  function _loadScript(src) {
    return new Promise((res, rej) => {
      if (window.faceapi) { res(); return; }
      const el = document.querySelector(`script[src="${src}"]`);
      if (el) { el.addEventListener('load', res); return; }
      const s = document.createElement('script');
      s.src = src; s.onload = res;
      s.onerror = () => rej(new Error('Gagal mengunduh face-api.js — cek koneksi'));
      document.head.appendChild(s);
    });
  }

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
    } catch(e) { _state = 'error'; _errorMsg = e.message; throw e; }
  }

  function _stopStream() {
    if (_stream) { _stream.getTracks().forEach(t => t.stop()); _stream = null; }
    if (_rafId)  { cancelAnimationFrame(_rafId); _rafId = null; }
  }

  function init(employees, absensi) {
    _employees = employees || []; _absensi = absensi || [];
    if (_state === 'ready') _buildMatcher();
  }
  function pushAbsensi(rec) { _absensi.push(rec); }

  function _buildMatcher() {
    if (!window.faceapi) return;
    const labeled = _employees
      .filter(e => e.faceDescriptors?.length)
      .map(e => new faceapi.LabeledFaceDescriptors(
        e.id + '||' + e.nama,
        e.faceDescriptors.map(d => new Float32Array(Object.values(d)))
      ));
    _matcher = labeled.length ? new faceapi.FaceMatcher(labeled, 0.5) : null;
  }

  // =============================================
  //  FACE GEOMETRY
  // =============================================
  function _ear(pts, i1, i2, i3, i4, i5, i6) {
    const d = (a, b) => Math.hypot(pts[a].x - pts[b].x, pts[a].y - pts[b].y);
    return (d(i2, i6) + d(i3, i5)) / (2 * d(i1, i4));
  }
  function _avgEAR(landmarks) {
    const p = landmarks.positions;
    return (_ear(p,36,37,38,39,40,41) + _ear(p,42,43,44,45,46,47)) / 2;
  }
  function _yaw(landmarks) {
    const p = landmarks.positions;
    const cx = (p[0].x + p[16].x) / 2;
    const fw = p[16].x - p[0].x;
    return fw > 0 ? (p[30].x - cx) / fw : 0;
  }
  function _pitch(landmarks) {
    const p = landmarks.positions;
    const fh = p[8].y - p[27].y;
    return fh > 0 ? (p[30].y - p[27].y) / fh : 0;
  }

  // =============================================
  //  DEPTH CHECK (background — micro-movement)
  // =============================================
  async function _depthCheckBackground(video, frames = 20) {
    const noseXs = [], earVals = [];
    for (let i = 0; i < frames; i++) {
      let r = null;
      try { r = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224 })).withFaceLandmarks(true); } catch(e) { r = null; }
      if (r) {
        noseXs.push(r.landmarks.positions[30].x);
        earVals.push(_avgEAR(r.landmarks));
      }
      await new Promise(res => setTimeout(res, 80));
    }
    if (noseXs.length < 8) return true; // not enough data → allow through
    const mean = arr => arr.reduce((s, v) => s + v, 0) / arr.length;
    const vari = arr => { const m = mean(arr); return arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length; };
    return Math.sqrt(vari(noseXs) + vari(noseXs)) > 0.08 || vari(earVals) > 0.000008;
  }

  // =============================================
  //  LIVENESS CHALLENGE
  // =============================================
  const _CHALLENGES = [
    { type: 'BLINK', icon: '😑', text: 'Kedipkan mata sekali',      hint: 'tutup dan buka mata' },
    { type: 'NOD',   icon: '🙇', text: 'Anggukkan kepala',          hint: 'turunkan dan naikkan kepala' },
    { type: 'TURN',  icon: '↔️',  text: 'Toleh ke samping sedikit',  hint: 'putar kepala kiri atau kanan' },
  ];
  function _pickChallenge() {
    return _CHALLENGES[Math.floor(Math.random() * _CHALLENGES.length)];
  }

  function _runChallenge(video, overlayEl, challenge, timeoutMs) {
    return new Promise(resolve => {
      let done = false;
      const finish = ok => { if (!done) { done = true; clearTimeout(timer); resolve(ok); } };

      if (overlayEl) {
        overlayEl.style.cssText = 'display:flex;position:absolute;inset:0;align-items:center;justify-content:center;background:rgba(0,0,0,.65);border-radius:inherit;z-index:5';
        overlayEl.innerHTML = `
          <div style="text-align:center;color:white;padding:20px;max-width:260px;pointer-events:none">
            <div style="font-size:44px;margin-bottom:10px;animation:pls 1s ease infinite">${challenge.icon}</div>
            <div style="font-size:17px;font-weight:700;margin-bottom:4px">${challenge.text}</div>
            <div style="font-size:12px;opacity:.7;margin-bottom:12px">${challenge.hint}</div>
            <div style="height:4px;background:rgba(255,255,255,.2);border-radius:2px;overflow:hidden">
              <div id="ch-bar" style="height:100%;background:#22c55e;width:100%;transition:width linear ${timeoutMs}ms"></div>
            </div>
            <div id="ch-time" style="font-size:12px;opacity:.7;margin-top:6px">${Math.round(timeoutMs/1000)}s</div>
          </div>
          <style>@keyframes pls{0%,100%{transform:scale(1)}50%{transform:scale(1.2)}}</style>`;
        requestAnimationFrame(() => { const b = document.getElementById('ch-bar'); if (b) b.style.width = '0%'; });
      }

      const deadline = Date.now() + timeoutMs;
      let baseline = null;
      const bsArr  = { ear: [], yaw: [], pitch: [] };

      const tick = async () => {
        if (done) return;
        const rem = deadline - Date.now();
        if (rem <= 0) { finish(false); return; }
        const te = document.getElementById('ch-time');
        if (te) te.textContent = Math.ceil(rem / 1000) + 's';

        let r = null;
        try { r = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320 })).withFaceLandmarks(true); } catch(e) { r = null; }
        if (!r) { if (!done) setTimeout(tick, 150); return; }

        const ear = _avgEAR(r.landmarks), yaw = _yaw(r.landmarks), pitch = _pitch(r.landmarks);
        if (!baseline) {
          bsArr.ear.push(ear); bsArr.yaw.push(yaw); bsArr.pitch.push(pitch);
          if (bsArr.ear.length >= 8) {
            const avg = arr => arr.reduce((s, v) => s + v, 0) / arr.length;
            baseline = { ear: avg(bsArr.ear), yaw: avg(bsArr.yaw), pitch: avg(bsArr.pitch) };
          }
          if (!done) setTimeout(tick, 100); return;
        }

        const pass = challenge.type === 'BLINK'  ? ear < baseline.ear * 0.62
                   : challenge.type === 'TURN'   ? Math.abs(yaw   - baseline.yaw)   > 0.10
                   : /* NOD */                     Math.abs(pitch  - baseline.pitch) > 0.07;
        if (pass) finish(true); else if (!done) setTimeout(tick, 100);
      };

      const timer = setTimeout(() => finish(false), timeoutMs);
      tick();
    });
  }

  // =============================================
  //  DRAW helpers
  // =============================================
  function _drawBox(canvas, video, box, color, label) {
    const ctx = canvas.getContext('2d');
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!box) return;
    const sx = canvas.width  / (video.videoWidth  || 640);
    const sy = canvas.height / (video.videoHeight || 480);
    ctx.strokeStyle = color; ctx.lineWidth = 3;
    ctx.shadowBlur  = 10;    ctx.shadowColor = color;
    ctx.strokeRect(box.x*sx, box.y*sy, box.width*sx, box.height*sy);
    if (label) {
      ctx.shadowBlur = 0; ctx.fillStyle = color;
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(label, box.x*sx, (box.y*sy) - 6);
    }
  }

  function _flashCapture(canvas) {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setTimeout(() => {
      const v = document.getElementById('fr-video');
      if (v) _drawBox(canvas, v, null, '');
    }, 120);
  }

  function _showOverlayError(el, msg) {
    if (!el) return;
    el.style.cssText = 'display:flex;position:absolute;inset:0;align-items:center;justify-content:center;background:rgba(0,0,0,.8);border-radius:inherit';
    el.innerHTML = `<div style="text-align:center;color:white;padding:24px">
      <div style="font-size:28px;margin-bottom:8px">⚠️</div>
      <div style="font-weight:600;margin-bottom:4px">${msg}</div>
      <div style="font-size:11px;opacity:.6;margin-top:6px">Fitur dapat dinonaktifkan via toggle Absensi</div>
    </div>`;
  }

  // =============================================
  //  REGISTRATION — full auto-capture flow
  // =============================================
  let _regSamples = [];
  let _regThumbs  = [];
  let _regMid     = null;
  let _regBusy    = false;

  async function openRegisterModal(empId) {
    const emp = _employees.find(e => e.id === empId);
    if (!emp) return;
    _regSamples = []; _regThumbs = []; _regMid = Utils.uid(); _regBusy = false;

    Modal.open({
      id: _regMid,
      title: '📷 Daftarkan Wajah — ' + emp.nama,
      body: `
        <div id="fr-status" style="text-align:center;font-size:13px;font-weight:500;color:var(--text-2);min-height:22px;margin-bottom:8px">
          Memuat AI Model... (pertama kali ±15 detik)
        </div>
        <div style="position:relative;border-radius:10px;overflow:hidden;background:#111;aspect-ratio:4/3;max-height:300px;user-select:none">
          <video id="fr-video" autoplay muted playsinline style="width:100%;height:100%;object-fit:cover;transform:scaleX(-1)"></video>
          <canvas id="fr-canvas" style="position:absolute;top:0;left:0;width:100%;height:100%;transform:scaleX(-1);pointer-events:none"></canvas>
          <div id="fr-overlay" style="display:none;position:absolute;inset:0;border-radius:inherit"></div>
          <div id="fr-loader" style="position:absolute;inset:0;background:rgba(0,0,0,.85);display:flex;flex-direction:column;align-items:center;justify-content:center;color:white;gap:10px;border-radius:inherit">
            <div style="font-size:30px">🤖</div>
            <div style="font-weight:600;font-size:14px">Memuat AI Model...</div>
            <div style="font-size:11px;opacity:.5">Model di-cache setelah loading pertama</div>
          </div>
          <div id="fr-count-badge" style="display:none;position:absolute;top:8px;right:8px;background:rgba(0,0,0,.6);color:white;font-size:13px;font-weight:700;padding:4px 10px;border-radius:20px"></div>
        </div>
        <div style="margin-top:10px">
          <div style="font-size:11px;color:var(--text-3);margin-bottom:6px">Hasil foto analisa:</div>
          <div id="fr-samples" style="display:flex;gap:6px;min-height:44px;flex-wrap:wrap"></div>
        </div>`,
      footer: `<button class="btn btn-ghost" onclick="Modal.close('${_regMid}');FaceAttendanceModule._stopReg()">Batal</button>`,
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

      // Step 1: live detection loop starts immediately
      _setStatus('Posisikan wajah di tengah kamera...', 'var(--text-3)');
      _startRegLiveLoop();

      // Step 2: depth check runs silently in background while user sees camera
      const depthOk = await _depthCheckBackground(video, 18);
      if (!depthOk) {
        _setStatus('⚠️ Wajah tampak seperti foto/layar statis — gunakan wajah asli', 'var(--warning)');
        Notify.warning('Anti-spoof: pastikan menggunakan wajah asli, bukan foto');
        return;
      }

      // Step 3: liveness challenge
      const challenge = _pickChallenge();
      _setStatus('🎯 ' + challenge.text + ' untuk verifikasi...', 'var(--primary-h)');
      const overlay = document.getElementById('fr-overlay');
      const passed  = await _runChallenge(video, overlay, challenge, 7000);
      if (overlay) overlay.style.display = 'none';

      if (!passed) {
        _setStatus('❌ Liveness gagal — tutup dan coba lagi', 'var(--danger)');
        Notify.warning('Challenge tidak terdeteksi. Lakukan gerakan lebih jelas.');
        return;
      }
      _setStatus('✅ Liveness OK — Pengambilan foto otomatis dimulai...', 'var(--success)');

      // Step 4: auto-capture 5 samples
      await _autoCapture(empId, video);

    } catch(e) {
      _showOverlayError(document.getElementById('fr-loader') || document.getElementById('fr-overlay'), e.message);
    }
  }

  function _setStatus(msg, color) {
    const el = document.getElementById('fr-status');
    if (el) { el.textContent = msg; el.style.color = color || 'var(--text-2)'; }
  }

  function _startRegLiveLoop() {
    const video  = document.getElementById('fr-video');
    const canvas = document.getElementById('fr-canvas');
    if (!video || !canvas) return;
    const loop = async () => {
      if (!document.getElementById('fr-video') || _regBusy) { _rafId = requestAnimationFrame(loop); return; }
      let r = null;
      try { r = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224 })).withFaceLandmarks(true); } catch(e) { r = null; }
      _drawBox(canvas, video, r?.detection.box || null, r ? '#22c55e' : '#6b7280');
      _rafId = requestAnimationFrame(loop);
    };
    loop();
  }

  // Auto-capture: 5 sampel otomatis, 1.5s jeda antar sampel
  async function _autoCapture(empId, video) {
    _regBusy = true; // pause live box loop
    const canvas  = document.getElementById('fr-canvas');
    const badge   = document.getElementById('fr-count-badge');
    if (badge) badge.style.display = 'block';

    for (let i = 0; i < 5; i++) {
      const hint = _CAPTURE_HINTS[i];
      _setStatus(`📸 Auto-capture ${i+1}/5 — ${hint}`, 'var(--primary-h)');
      if (badge) badge.textContent = `${i+1}/5`;

      // Wait for face to be present before capturing
      let r = null;
      const deadline = Date.now() + 4000;
      while (!r && Date.now() < deadline) {
        try { r = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320 })).withFaceLandmarks(true).withFaceDescriptor(); } catch(e) { r = null; }
        if (!r) await new Promise(res => setTimeout(res, 200));
      }

      if (!r) {
        _setStatus(`⚠️ Sampel ${i+1} gagal — lanjut sampel berikutnya`, 'var(--warning)');
        await new Promise(res => setTimeout(res, 800));
        continue;
      }

      // Capture!
      if (canvas) _flashCapture(canvas);
      _regSamples.push(Array.from(r.descriptor));

      // Save thumbnail
      const thumb = document.createElement('canvas');
      thumb.width = 52; thumb.height = 52;
      const { x, y, width, height } = r.detection.box;
      thumb.getContext('2d').drawImage(video, x, y, width, height, 0, 0, 52, 52);
      const b64 = thumb.toDataURL('image/jpeg', 0.75);
      _regThumbs.push(b64);

      // Show thumbnail in modal
      const samplesEl = document.getElementById('fr-samples');
      if (samplesEl) {
        const img = new Image(); img.src = b64;
        img.style.cssText = 'width:52px;height:52px;border-radius:8px;object-fit:cover;border:2px solid var(--success);animation:fadeIn .3s ease';
        img.title = hint;
        samplesEl.appendChild(img);
      }

      // Draw box on captured frame
      if (canvas) _drawBox(canvas, video, r.detection.box, '#22c55e', `${i+1}/5`);

      // Wait before next capture (except last)
      if (i < 4) await new Promise(res => setTimeout(res, 1500));
    }

    _regBusy = false;
    if (badge) badge.style.display = 'none';

    if (_regSamples.length === 0) {
      _setStatus('❌ Tidak ada sampel berhasil — coba lagi', 'var(--danger)');
      return;
    }

    _setStatus(`✅ ${_regSamples.length} sampel terkumpul — menyimpan...`, 'var(--success)');
    _stopStream();
    await _saveRegDescriptors(empId);
  }

  async function _saveRegDescriptors(empId) {
    const emp = _employees.find(e => e.id === empId);
    if (!emp) return;
    emp.faceDescriptors = _regSamples;

    // Simpan thumbnail ke localStorage
    try { localStorage.setItem(THUMBS_KEY(empId), JSON.stringify(_regThumbs)); } catch(e) {}

    try {
      await DB.saveEmployee(emp);
      _buildMatcher();
      if (_regMid) Modal.close(_regMid);
      Notify.success(`Wajah ${emp.nama} terdaftar ✓ (${_regSamples.length} sampel tersimpan)`);
      // Refresh employee table so face badge appears immediately
      if (window.EmployeeModule?.renderData) EmployeeModule.renderData();
    } catch(e) { Notify.error('Gagal menyimpan', e.message); }
    _regSamples = []; _regThumbs = []; _regMid = null;
  }

  function _stopReg() { _stopStream(); _regSamples = []; _regThumbs = []; _regBusy = false; }

  // Get saved thumbnails for an employee
  function getEmpThumbs(empId) {
    try { return JSON.parse(localStorage.getItem(THUMBS_KEY(empId)) || '[]'); } catch { return []; }
  }

  // =============================================
  //  KIOSK MODE
  // =============================================
  async function openKiosk() {
    const mid = Utils.uid();
    Modal.open({
      id: mid,
      title: '🏢 Kiosk Absensi Wajah',
      body: `
        <div id="kiosk-status" style="text-align:center;font-size:13px;font-weight:600;color:var(--text-2);margin-bottom:10px">
          Memuat sistem...
        </div>
        <div style="position:relative;border-radius:12px;overflow:hidden;background:#111;aspect-ratio:16/9;max-height:360px">
          <video id="kiosk-video" autoplay muted playsinline style="width:100%;height:100%;object-fit:cover;transform:scaleX(-1)"></video>
          <canvas id="kiosk-canvas" style="position:absolute;top:0;left:0;width:100%;height:100%;transform:scaleX(-1)"></canvas>
          <div id="kiosk-overlay" style="display:none;position:absolute;inset:0;border-radius:inherit"></div>
          <div id="kiosk-loader" style="position:absolute;inset:0;background:rgba(0,0,0,.8);display:flex;flex-direction:column;align-items:center;justify-content:center;color:white;gap:8px;border-radius:inherit">
            <div style="font-size:36px">🤖</div>
            <div style="font-weight:600">Memuat AI...</div>
            <div style="font-size:11px;opacity:.6">Pertama kali ~15 detik</div>
          </div>
          <div id="kiosk-result" style="display:none;position:absolute;bottom:0;left:0;right:0;padding:14px 20px;
            background:linear-gradient(transparent,rgba(0,0,0,.85));text-align:center;color:white;pointer-events:none"></div>
        </div>
        <div id="kiosk-log" style="margin-top:10px;max-height:120px;overflow-y:auto;display:flex;flex-direction:column;gap:4px;font-size:12px"></div>`,
      footer: `<button class="btn btn-ghost" onclick="Modal.close('${mid}');FaceAttendanceModule._stopKiosk()">Tutup</button>`,
    });

    try {
      await _loadModels();
      if (!_matcher) _buildMatcher(); // build after models ready (init() runs before models load)
      if (!_matcher) {
        _showOverlayError(document.getElementById('kiosk-loader'), 'Belum ada karyawan yang mendaftarkan wajah');
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
      const st = document.getElementById('kiosk-status');
      if (st) st.innerHTML = '🟢 Sistem aktif — tatap kamera untuk absen';
      _kioskCooldown = {};
      _startKioskLoop();
    } catch(e) {
      _showOverlayError(document.getElementById('kiosk-loader'), e.message);
    }
  }

  function _startKioskLoop() {
    const video    = document.getElementById('kiosk-video');
    const canvas   = document.getElementById('kiosk-canvas');
    const resultEl = document.getElementById('kiosk-result');
    if (!video || !canvas) return;
    let frame = 0, busy = false;

    const loop = async () => {
      if (!document.getElementById('kiosk-video')) { _stopStream(); return; }
      frame++;
      if (frame % 20 === 0 && !busy) {
        busy = true;
        let r = null;
        try { r = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 416 })).withFaceLandmarks(true).withFaceDescriptor(); } catch(e) { r = null; }

        if (r && _matcher) {
          const match   = _matcher.findBestMatch(r.descriptor);
          const unknown = match.label === 'unknown';
          _drawBox(canvas, video, r.detection.box, unknown ? '#ef4444' : '#22c55e');

          if (!unknown) {
            const [empId, empNama] = match.label.split('||');
            const now = Date.now();
            if (!_kioskCooldown[empId] || now - _kioskCooldown[empId] > 15000) {
              _kioskCooldown[empId] = now;
              await _recordKioskAbsensi(empId, empNama, resultEl);
            }
          }
        } else if (!r) {
          const ctx = canvas.getContext('2d');
          canvas.width = video.videoWidth || 1280; canvas.height = video.videoHeight || 720;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        busy = false;
      }
      _rafId = requestAnimationFrame(loop);
    };
    loop();
  }

  async function _recordKioskAbsensi(empId, empNama, resultEl) {
    const today   = new Date().toISOString().split('T')[0];
    const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const st      = document.getElementById('kiosk-status');
    const existing = _absensi.find(a => (a.empId===empId||a.empNama===empNama) && a.tgl===today);

    if (existing) {
      if (resultEl) {
        resultEl.style.display = 'block';
        resultEl.innerHTML = `<div style="font-size:16px;font-weight:700">👋 ${empNama}</div>
          <div style="font-size:12px;opacity:.8">Sudah absen hari ini · ${timeStr}</div>`;
        setTimeout(() => { if (resultEl) resultEl.style.display = 'none'; }, 3000);
      }
      if (st) st.innerHTML = '🟢 Sistem aktif — tatap kamera untuk absen';
      return;
    }

    const rec = { empId, empNama, tgl: today, status: 'H', ket: 'Face ' + timeStr, createdAt: new Date().toISOString() };
    const saved = await DB.saveEmpAbsensi(rec).catch(() => rec);
    if (!saved.id) saved.id = Utils.uid();
    _absensi.push(saved);
    if (window.EmployeeModule?._onFaceAbsensi) EmployeeModule._onFaceAbsensi(saved);

    _speak('Selamat datang, ' + empNama);

    if (resultEl) {
      resultEl.style.display = 'block';
      resultEl.innerHTML = `<div style="font-size:22px;font-weight:700;color:#4ade80">✅ Selamat datang, ${empNama}!</div>
        <div style="font-size:13px;opacity:.8">${timeStr} · Hadir · Wajah ✓</div>`;
      setTimeout(() => { if (resultEl) resultEl.style.display = 'none'; }, 4500);
    }
    const logEl = document.getElementById('kiosk-log');
    if (logEl) {
      const el = document.createElement('div');
      el.style.cssText = 'padding:5px 10px;border-radius:6px;background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.3);color:var(--success)';
      el.textContent = `${timeStr} — ${empNama} ✓ Hadir`;
      logEl.prepend(el);
    }
    if (st) st.innerHTML = '🟢 Sistem aktif — tatap kamera untuk absen';
    Notify.success(empNama + ' absen ✓');
  }

  function _stopKiosk() { _stopStream(); _kioskCooldown = {}; }

  // =============================================
  //  SPEECH
  // =============================================
  function _speak(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const _doSpeak = (voices) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang  = 'id-ID';
      u.rate  = 0.88;   // sedikit lebih lambat = lebih jelas
      u.pitch = 1.0;    // pitch netral = lebih natural
      u.volume = 1;
      // Urutan preferensi: Google Indonesian > Damayanti (iOS) > id-ID lain > Google English
      const voice =
        voices.find(v => v.lang.startsWith('id') && v.name.toLowerCase().includes('google')) ||
        voices.find(v => v.name.includes('Damayanti')) ||
        voices.find(v => v.lang === 'id-ID') ||
        voices.find(v => v.lang.startsWith('id')) ||
        voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('google')) ||
        voices.find(v => v.lang.startsWith('en'));
      if (voice) u.voice = voice;
      window.speechSynthesis.speak(u);
    };
    const voices = window.speechSynthesis.getVoices();
    if (voices.length) { _doSpeak(voices); }
    else { window.speechSynthesis.onvoiceschanged = () => { _doSpeak(window.speechSynthesis.getVoices()); }; }
  }

  // =============================================
  //  FULLSCREEN KIOSK
  // =============================================
  let _fsClock = null;

  function openKioskFullscreen() {
    // Request native fullscreen
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();

    const fs = document.createElement('div');
    fs.id = 'kiosk-fs';
    fs.style.cssText = 'position:fixed;inset:0;z-index:9998;background:#0a0d14;display:flex;flex-direction:column;font-family:sans-serif';
    fs.innerHTML = `
      <style>
        @keyframes ks-fadein {from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes ks-scan   {0%{top:0%}50%{top:97%}100%{top:0%}}
        @keyframes ks-pulse  {0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.6);opacity:.4}}
        #kiosk-fs{display:flex;flex-direction:column}
        #ks-header{display:flex;align-items:center;padding:10px 20px;background:rgba(10,13,20,.95);border-bottom:1px solid rgba(99,102,241,.2);flex-shrink:0;backdrop-filter:blur(8px)}
        #ks-body{flex:1;position:relative;background:#000;overflow:hidden;min-height:0}
        #ks-video{width:100%;height:100%;object-fit:cover;transform:scaleX(-1);display:block}
        #ks-canvas{position:absolute;top:0;left:0;width:100%;height:100%;transform:scaleX(-1);pointer-events:none}
        #ks-scan{position:absolute;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,rgba(99,102,241,.8),transparent);box-shadow:0 0 8px rgba(99,102,241,.5);animation:ks-scan 8s ease-in-out infinite;pointer-events:none}
        @media (orientation:portrait){
          #ks-clock{font-size:18px!important}
          #ks-result-name{font-size:22px!important}
          #ks-status{font-size:12px!important}
        }
        @media (orientation:landscape){
          #ks-clock{font-size:26px!important}
          #ks-result-name{font-size:30px!important}
        }
      </style>

      <!-- Header -->
      <div id="ks-header">
        <div style="display:flex;align-items:center;gap:12px">
          <img src="/img/logo-bps.png" style="height:34px;object-fit:contain"
               onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
          <div style="display:none;width:34px;height:34px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:8px;align-items:center;justify-content:center;font-size:16px;font-weight:900;color:#fff;flex-shrink:0">B</div>
          <div>
            <div style="font-size:13px;font-weight:700;color:#f0f0f0;letter-spacing:.06em">BPS Face Recognition</div>
            <div style="font-size:10px;color:#6366f1;letter-spacing:.04em" id="ks-date"></div>
          </div>
        </div>
        <div style="margin-left:auto;display:flex;align-items:center;gap:16px">
          <div id="ks-clock" style="font-weight:700;color:#f0f0f0;font-variant-numeric:tabular-nums;letter-spacing:.06em;text-shadow:0 0 20px rgba(99,102,241,.4)"></div>
          <button onclick="FaceAttendanceModule.closeFullscreenKiosk()"
            style="padding:6px 14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:8px;color:#9ca3af;font-size:12px;cursor:pointer;transition:background .2s"
            onmouseover="this.style.background='rgba(255,255,255,.12)'" onmouseout="this.style.background='rgba(255,255,255,.06)'">
            ✕ Tutup
          </button>
        </div>
      </div>

      <!-- Body: camera full width -->
      <div id="ks-body">
        <video id="ks-video" autoplay muted playsinline></video>
        <canvas id="ks-canvas"></canvas>

        <!-- Scan line -->
        <div id="ks-scan"></div>

        <!-- Today attendance badge -->
        <div style="position:absolute;top:16px;right:16px;background:rgba(10,13,20,.8);border:1px solid rgba(99,102,241,.3);border-radius:12px;padding:10px 16px;text-align:center;backdrop-filter:blur(8px)">
          <div id="ks-count" style="font-size:26px;font-weight:800;color:#6366f1;line-height:1;font-variant-numeric:tabular-nums">0</div>
          <div style="font-size:10px;color:#6b7280;margin-top:3px;letter-spacing:.04em">HADIR HARI INI</div>
        </div>

        <!-- Loader -->
        <div id="ks-loader" style="position:absolute;inset:0;background:rgba(0,0,0,.9);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;gap:16px">
          <div style="font-size:16px;font-weight:600;letter-spacing:.06em;opacity:.85">MEMUAT AI MODEL</div>
          <div style="font-size:12px;opacity:.4;letter-spacing:.04em">Pertama kali ±15 detik</div>
          <div style="width:140px;height:2px;background:#1f2937;border-radius:2px;overflow:hidden;margin-top:4px">
            <div style="height:100%;background:linear-gradient(90deg,#6366f1,#8b5cf6);border-radius:2px;animation:becca-load 1.4s ease-in-out infinite"></div>
          </div>
        </div>

        <!-- Welcome result overlay -->
        <div id="ks-result" style="display:none;position:absolute;inset:0;align-items:center;justify-content:center;background:rgba(0,0,0,.78);flex-direction:column;gap:14px;animation:ks-fadein .3s ease">
          <div id="ks-result-icon" style="font-size:60px"></div>
          <div id="ks-result-name" style="font-weight:800;color:#fff;text-align:center;text-shadow:0 2px 20px rgba(99,102,241,.6);letter-spacing:.02em"></div>
          <div id="ks-result-sub" style="font-size:15px;color:rgba(255,255,255,.65);text-align:center;letter-spacing:.04em"></div>
        </div>

        <!-- Status bar -->
        <div style="position:absolute;bottom:0;left:0;right:0;padding:12px 20px;background:linear-gradient(transparent,rgba(0,0,0,.85))">
          <div style="display:flex;align-items:center;justify-content:center;gap:8px">
            <span id="ks-dot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#6b7280;flex-shrink:0"></span>
            <span id="ks-status" style="font-size:14px;font-weight:600;color:#f0f0f0;letter-spacing:.03em">Memuat sistem...</span>
          </div>
        </div>
      </div>

      <div id="ks-log" style="display:none"></div>`;

    document.body.appendChild(fs);
    _startFsClock();
    _runFullscreenKiosk();
  }

  function _startFsClock() {
    const tick = () => {
      const now = new Date();
      const c = document.getElementById('ks-clock');
      const d = document.getElementById('ks-date');
      if (c) c.textContent = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      if (d) d.textContent = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    };
    tick();
    _fsClock = setInterval(tick, 1000);
  }

  async function _runFullscreenKiosk() {
    // Sync fresh absensi from DB before showing count
    const today = new Date().toISOString().split('T')[0];
    try {
      const fresh = await DB.getEmpAbsensi();
      if (fresh?.length) _absensi = fresh;
    } catch(e) {}

    const todayAbs = _absensi.filter(a => a.tgl === today);
    const logEl   = document.getElementById('ks-log');
    const countEl = document.getElementById('ks-count');
    if (countEl) countEl.textContent = todayAbs.length;
    if (logEl) {
      todayAbs.slice().reverse().forEach(a => _fsAddLog(a.empNama, a.ket || ''));
    }

    try {
      await _loadModels();
      if (!_matcher) _buildMatcher();
      if (!_matcher) {
        const loader = document.getElementById('ks-loader');
        if (loader) {
          loader.innerHTML = `<div style="text-align:center;color:#fff;padding:32px">
            <div style="font-size:16px;font-weight:600">Belum ada karyawan mendaftarkan wajah</div>
          </div>`;
        }
        return;
      }
      _stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      const video = document.getElementById('ks-video');
      if (!video) { _stopStream(); return; }
      video.srcObject = _stream;
      await new Promise(res => { video.onloadedmetadata = res; });
      document.getElementById('ks-loader')?.remove();
      _setFsStatus('Tatap kamera untuk absen', '#4ade80');
      _kioskCooldown = {};
      _startFsLoop();
    } catch(e) {
      const loader = document.getElementById('ks-loader');
      if (loader) loader.innerHTML = `<div style="text-align:center;color:#fff;padding:32px"><div style="font-size:16px;font-weight:600">${e.message}</div></div>`;
    }
  }

  function _setFsStatus(msg, color) {
    const el  = document.getElementById('ks-status');
    const dot = document.getElementById('ks-dot');
    if (el)  { el.textContent = msg; el.style.color = color || '#f0f0f0'; }
    if (dot) {
      dot.style.background = color || '#6b7280';
      dot.style.animation  = color ? 'ks-pulse 1.4s ease-in-out infinite' : 'none';
      dot.style.boxShadow  = color ? `0 0 6px ${color}` : 'none';
    }
  }

  function _fsAddLog(nama, ket) {
    const logEl = document.getElementById('ks-log');
    const countEl = document.getElementById('ks-count');
    if (!logEl) return;
    const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const el = document.createElement('div');
    el.className = 'ks-log-item';
    el.style.cssText = 'display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;background:rgba(34,197,94,.08);border:1px solid rgba(34,197,94,.2)';
    el.innerHTML = `<span style="font-size:18px">✅</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;color:#f0f0f0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${nama}</div>
        <div style="font-size:11px;color:#6b7280">${timeStr}</div>
      </div>`;
    logEl.prepend(el);
    if (countEl) countEl.textContent = logEl.children.length;
  }

  function _startFsLoop() {
    const video  = document.getElementById('ks-video');
    const canvas = document.getElementById('ks-canvas');
    if (!video || !canvas) return;
    let frame = 0, busy = false;

    const loop = async () => {
      if (!document.getElementById('ks-video')) { _stopStream(); return; }
      frame++;
      if (frame % 20 === 0 && !busy) {
        busy = true;
        let r = null;
        try { r = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 416 })).withFaceLandmarks(true).withFaceDescriptor(); } catch(e) { r = null; }

        if (r && _matcher) {
          const match   = _matcher.findBestMatch(r.descriptor);
          const unknown = match.label === 'unknown';
          _drawBox(canvas, video, r.detection.box, unknown ? '#ef4444' : '#22c55e');
          if (!unknown) {
            const [empId, empNama] = match.label.split('||');
            const now = Date.now();
            if (!_kioskCooldown[empId] || now - _kioskCooldown[empId] > 15000) {
              _kioskCooldown[empId] = now;
              await _recordFsAbsensi(empId, empNama);
            }
          }
        } else if (!r) {
          const ctx = canvas.getContext('2d');
          canvas.width = video.videoWidth || 1280; canvas.height = video.videoHeight || 720;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        busy = false;
      }
      _rafId = requestAnimationFrame(loop);
    };
    loop();
  }

  async function _recordFsAbsensi(empId, empNama) {
    const today   = new Date().toISOString().split('T')[0];
    const timeStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const existing = _absensi.find(a => (a.empId === empId || a.empNama === empNama) && a.tgl === today);

    // Show result overlay
    const resultEl = document.getElementById('ks-result');
    const iconEl   = document.getElementById('ks-result-icon');
    const nameEl   = document.getElementById('ks-result-name');
    const subEl    = document.getElementById('ks-result-sub');

    if (existing) {
      if (resultEl) {
        resultEl.style.display = 'flex';
        if (iconEl) iconEl.textContent = '👋';
        if (nameEl) nameEl.textContent = empNama;
        if (subEl)  subEl.textContent  = `Sudah absen hari ini · ${timeStr}`;
        _setFsStatus(empNama + ' sudah absen hari ini', '#fbbf24');
        setTimeout(() => { if (resultEl) resultEl.style.display = 'none'; _setFsStatus('Tatap kamera untuk absen', '#4ade80'); }, 3000);
      }
      return;
    }

    const rec = { empId, empNama, tgl: today, status: 'H', ket: 'Face ' + timeStr, createdAt: new Date().toISOString() };
    const saved = await DB.saveEmpAbsensi(rec).catch(() => rec);
    if (!saved.id) saved.id = Utils.uid();
    _absensi.push(saved);
    if (window.EmployeeModule?._onFaceAbsensi) EmployeeModule._onFaceAbsensi(saved);

    // Voice greeting
    _speak('Selamat datang, ' + empNama);

    // Show welcome overlay
    if (resultEl) {
      resultEl.style.display = 'flex';
      if (iconEl) iconEl.textContent = '✅';
      if (nameEl) { nameEl.textContent = empNama; nameEl.style.color = '#4ade80'; }
      if (subEl)  subEl.textContent = timeStr + ' · Hadir · Wajah ✓';
      _setFsStatus('Selamat datang, ' + empNama, '#4ade80');
      setTimeout(() => { if (resultEl) resultEl.style.display = 'none'; _setFsStatus('Tatap kamera untuk absen', '#4ade80'); }, 4000);
    }

    _fsAddLog(empNama, timeStr);
    Notify.success(empNama + ' absen ✓');
  }

  function closeFullscreenKiosk() {
    _stopStream();
    _kioskCooldown = {};
    if (_fsClock) { clearInterval(_fsClock); _fsClock = null; }
    document.getElementById('kiosk-fs')?.remove();
    if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
  }

  // =============================================
  //  TOGGLE
  // =============================================
  function renderToggle() {
    const on = isEnabled();
    return `<div onclick="FaceAttendanceModule.toggleAndRender()"
      style="display:flex;align-items:center;gap:7px;cursor:pointer;user-select:none;padding:5px 10px 5px 6px;border-radius:20px;border:1px solid ${on?'rgba(34,197,94,.45)':'var(--border)'}">
      <div style="position:relative;width:34px;height:19px;flex-shrink:0">
        <div style="position:absolute;inset:0;border-radius:10px;background:${on?'#22c55e':'var(--surface2)'}"></div>
        <div style="position:absolute;top:2px;left:${on?'17':'2'}px;width:15px;height:15px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.28)"></div>
      </div>
      <span style="font-size:12px;font-weight:600;color:${on?'var(--success)':'var(--text-3)'}">Face ${on?'ON':'OFF'}</span>
    </div>`;
  }
  function toggleAndRender() {
    setEnabled(!isEnabled());
    if (window.EmployeeModule) EmployeeModule.renderAbsensi();
  }

  return {
    isEnabled, setEnabled, init, pushAbsensi, getEmpThumbs,
    openRegisterModal, _captureReg: () => {}, _stopReg,
    openKiosk, _stopKiosk,
    openKioskFullscreen, closeFullscreenKiosk,
    renderToggle, toggleAndRender,
    get state() { return _state; },
  };

})();
window.FaceAttendanceModule = FaceAttendanceModule;

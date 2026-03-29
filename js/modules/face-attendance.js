/* ============================================
   BECCA V2.0 — Face Attendance Module
   Anti-spoof: Depth (micro-movement) + Liveness Challenge
   - Depth check: analisa variance gerakan micro wajah nyata vs foto
   - Challenge: BLINK / NOD / TURN (random)
============================================ */
const FaceAttendanceModule = (() => {

  const LIB_CDN    = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
  const MODEL_URL  = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights';
  const ENABLED_KEY = 'becca_face_att_on';

  let _state    = 'idle'; // 'idle'|'loading'|'ready'|'error'
  let _errorMsg = '';
  let _stream   = null;
  let _rafId    = null;
  let _matcher  = null;
  let _employees = [];
  let _absensi   = [];
  let _kioskCooldown = {};

  // =============================================
  //  STATE HELPERS
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
      s.onerror = () => rej(new Error('Gagal mengunduh face-api.js — cek koneksi internet'));
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
    } catch(e) {
      _state = 'error'; _errorMsg = e.message; throw e;
    }
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
  //  FACE GEOMETRY — landmark math
  // =============================================

  // Eye Aspect Ratio — deteksi kedipan
  // indices: p1(corner) p2 p3 p4(corner) p5 p6
  function _ear(pts, i1, i2, i3, i4, i5, i6) {
    const d = (a, b) => Math.hypot(pts[a].x - pts[b].x, pts[a].y - pts[b].y);
    return (d(i2, i6) + d(i3, i5)) / (2 * d(i1, i4));
  }

  function _avgEAR(landmarks) {
    const pts = landmarks.positions;
    return (_ear(pts,36,37,38,39,40,41) + _ear(pts,42,43,44,45,46,47)) / 2;
  }

  // Yaw: posisi relatif hidung vs pusat wajah → toleh
  function _yaw(landmarks) {
    const pts = landmarks.positions;
    const cx  = (pts[0].x + pts[16].x) / 2;
    const fw  = pts[16].x - pts[0].x;
    return fw > 0 ? (pts[30].x - cx) / fw : 0; // normalized −0.5..+0.5
  }

  // Pitch: rasio hidung ke dagu vs total tinggi wajah → angguk
  function _pitch(landmarks) {
    const pts = landmarks.positions;
    const fh  = pts[8].y - pts[27].y;
    return fh > 0 ? (pts[30].y - pts[27].y) / fh : 0;
  }

  // =============================================
  //  A) DEPTH CHECK — analisa micro-movement
  //     Wajah nyata punya getaran kecil alami.
  //     Foto/layar statis = variance ≈ 0.
  // =============================================
  async function _checkDepth(video, statusEl) {
    const FRAMES = 25;
    const noseXs = [], noseYs = [], earVals = [];

    const _setText = t => { if (statusEl) statusEl.innerHTML = t; };
    _setText('<span style="color:var(--primary-h)">🔍 Analisa kedalaman wajah (<span id="depth-cnt">0</span>/25 frame)...</span>');

    for (let i = 0; i < FRAMES; i++) {
      const r = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320 }))
        .withFaceLandmarks(true)
        .catch(() => null);
      if (r) {
        const pts = r.landmarks.positions;
        noseXs.push(pts[30].x);
        noseYs.push(pts[30].y);
        earVals.push(_avgEAR(r.landmarks));
        const cnt = document.getElementById('depth-cnt');
        if (cnt) cnt.textContent = noseXs.length;
      }
      await new Promise(res => setTimeout(res, 80));
    }

    if (noseXs.length < 12) return { ok: false, reason: 'Tidak cukup data — pastikan wajah terlihat' };

    const mean  = arr => arr.reduce((s, v) => s + v, 0) / arr.length;
    const vari  = arr => { const m = mean(arr); return arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length; };
    const varX  = vari(noseXs);
    const varY  = vari(noseYs);
    const varEAR = vari(earVals);
    const totalVar = Math.sqrt(varX + varY);

    // Threshold diturunkan agar lebih sensitif:
    // Wajah nyata: totalVar > 0.15px dan/atau varEAR > 0.0001 (kedipan micro, gerakan napas)
    // Foto statis: totalVar ≈ 0, varEAR ≈ 0
    const isReal = totalVar > 0.15 || varEAR > 0.0001;
    return { ok: isReal, totalVar: totalVar.toFixed(3), varEAR: varEAR.toFixed(5) };
  }

  // =============================================
  //  B) LIVENESS CHALLENGE — gesture acak
  // =============================================
  const _CHALLENGES = [
    { type: 'BLINK', icon: '😑', text: 'Kedipkan mata sekali',    hint: 'tutup dan buka mata perlahan' },
    { type: 'NOD',   icon: '🙇', text: 'Anggukkan kepala',        hint: 'turunkan dagu lalu naik lagi' },
    { type: 'TURN',  icon: '↔️',  text: 'Toleh ke samping sedikit', hint: 'putar kepala sedikit ke kiri atau kanan' },
  ];

  function _pickChallenge() {
    return _CHALLENGES[Math.floor(Math.random() * _CHALLENGES.length)];
  }

  // Kembalikan Promise<boolean> — true jika challenge berhasil dalam timeout
  function _runChallenge(video, overlayEl, challenge, timeoutMs = 7000) {
    return new Promise(resolve => {
      let done = false;
      const finish = (ok) => { if (!done) { done = true; clearTimeout(timer); resolve(ok); } };

      if (overlayEl) {
        overlayEl.style.cssText = 'display:flex;position:absolute;inset:0;align-items:center;justify-content:center;background:rgba(0,0,0,.65);border-radius:inherit';
        overlayEl.innerHTML = `
          <div style="text-align:center;color:white;padding:20px;max-width:260px">
            <div style="font-size:44px;margin-bottom:10px;animation:pulse-icon 1s ease infinite">${challenge.icon}</div>
            <div style="font-size:17px;font-weight:700;margin-bottom:4px">${challenge.text}</div>
            <div style="font-size:12px;opacity:.7;margin-bottom:12px">${challenge.hint}</div>
            <div style="height:4px;background:rgba(255,255,255,.2);border-radius:2px;overflow:hidden">
              <div id="ch-bar" style="height:100%;background:#22c55e;width:100%;transition:width linear ${timeoutMs}ms"></div>
            </div>
            <div id="ch-time" style="font-size:11px;opacity:.6;margin-top:6px">${Math.round(timeoutMs/1000)}s</div>
          </div>
          <style>@keyframes pulse-icon{0%,100%{transform:scale(1)}50%{transform:scale(1.15)}}</style>`;
        requestAnimationFrame(() => {
          const bar = document.getElementById('ch-bar');
          if (bar) bar.style.width = '0%';
        });
      }

      const deadline = Date.now() + timeoutMs;
      let baseline = null;
      const bsArr = { ear: [], yaw: [], pitch: [] };

      const tick = async () => {
        if (done) return;
        const remaining = deadline - Date.now();
        if (remaining <= 0) { finish(false); return; }

        const timeEl = document.getElementById('ch-time');
        if (timeEl) timeEl.textContent = Math.ceil(remaining / 1000) + 's';

        const r = await faceapi
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320 }))
          .withFaceLandmarks(true)
          .catch(() => null);

        if (!r) { if (!done) setTimeout(tick, 150); return; }

        const ear   = _avgEAR(r.landmarks);
        const yaw   = _yaw(r.landmarks);
        const pitch = _pitch(r.landmarks);

        // Kumpulkan baseline 8 sampel pertama
        if (!baseline) {
          bsArr.ear.push(ear); bsArr.yaw.push(yaw); bsArr.pitch.push(pitch);
          if (bsArr.ear.length >= 8) {
            const avg = arr => arr.reduce((s, v) => s + v, 0) / arr.length;
            baseline = { ear: avg(bsArr.ear), yaw: avg(bsArr.yaw), pitch: avg(bsArr.pitch) };
          }
          if (!done) setTimeout(tick, 100); return;
        }

        let passed = false;
        if (challenge.type === 'BLINK') {
          passed = ear < baseline.ear * 0.62; // tutup mata → EAR turun ≥38%
        } else if (challenge.type === 'TURN') {
          passed = Math.abs(yaw - baseline.yaw) > 0.10;
        } else if (challenge.type === 'NOD') {
          passed = Math.abs(pitch - baseline.pitch) > 0.07;
        }

        if (passed) finish(true);
        else if (!done) setTimeout(tick, 100);
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
      ctx.fillText(label, box.x*sx, box.y*sy - 6);
    }
  }

  function _showOverlayError(el, msg) {
    if (!el) return;
    el.style.cssText = 'display:flex;position:absolute;inset:0;align-items:center;justify-content:center;background:rgba(0,0,0,.75);border-radius:inherit';
    el.innerHTML = `<div style="text-align:center;color:white;padding:20px">
      <div style="font-size:28px;margin-bottom:8px">⚠️</div>
      <div style="font-weight:600;margin-bottom:4px">Gagal</div>
      <div style="font-size:12px;opacity:.7">${msg}</div>
    </div>`;
  }

  // =============================================
  //  REGISTRATION
  // =============================================
  let _regSamples = [];
  let _regMid     = null;

  async function openRegisterModal(empId) {
    const emp = _employees.find(e => e.id === empId);
    if (!emp) return;
    _regSamples = []; _regMid = Utils.uid();

    Modal.open({
      id: _regMid,
      title: '📷 Daftarkan Wajah — ' + emp.nama,
      body: `
        <div id="fr-status" style="text-align:center;font-size:13px;color:var(--text-3);min-height:20px;margin-bottom:8px">
          Memuat AI... (pertama kali ±15 detik)
        </div>
        <div style="position:relative;border-radius:10px;overflow:hidden;background:#111;aspect-ratio:4/3;max-height:300px">
          <video id="fr-video" autoplay muted playsinline style="width:100%;height:100%;object-fit:cover;transform:scaleX(-1)"></video>
          <canvas id="fr-canvas" style="position:absolute;top:0;left:0;width:100%;height:100%;transform:scaleX(-1)"></canvas>
          <div id="fr-overlay" style="display:none;position:absolute;inset:0;border-radius:inherit"></div>
          <div id="fr-loader" style="position:absolute;inset:0;background:rgba(0,0,0,.8);display:flex;flex-direction:column;align-items:center;justify-content:center;color:white;gap:8px">
            <div style="font-size:28px">🤖</div>
            <div style="font-weight:600">Memuat AI Model...</div>
            <div style="font-size:11px;opacity:.6">Setelah selesai, model di-cache browser</div>
          </div>
        </div>
        <div style="margin-top:10px">
          <div style="font-size:11px;color:var(--text-3);margin-bottom:6px">Sampel (butuh 5 — ambil dari berbagai sudut):</div>
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

      // A) Depth check
      const statusEl = document.getElementById('fr-status');
      const depth = await _checkDepth(video, statusEl);
      if (!depth.ok) {
        if (statusEl) statusEl.innerHTML = '<span style="color:var(--danger)">❌ Depth check gagal — gunakan wajah asli, bukan foto</span>';
        Notify.warning('Anti-spoof: wajah tampak tidak nyata. Pastikan kamera menghadap wajah asli.');
        return;
      }
      if (statusEl) statusEl.innerHTML = '<span style="color:var(--success)">✅ Wajah 3D terverifikasi</span>';
      await new Promise(res => setTimeout(res, 800));

      // B) Liveness challenge
      const challenge = _pickChallenge();
      const overlayEl = document.getElementById('fr-overlay');
      if (statusEl) statusEl.innerHTML = `<span style="color:var(--primary-h)">🎯 Challenge: <strong>${challenge.text}</strong></span>`;
      const passed = await _runChallenge(video, overlayEl, challenge, 7000);

      if (overlayEl) overlayEl.style.display = 'none';
      if (!passed) {
        if (statusEl) statusEl.innerHTML = '<span style="color:var(--danger)">❌ Liveness challenge gagal — coba ulangi pendaftaran</span>';
        Notify.warning('Challenge tidak terdeteksi. Coba lagi dengan gerakan yang lebih jelas.');
        document.getElementById('fr-btn').disabled = true;
        return;
      }
      if (statusEl) statusEl.innerHTML = '<span style="color:var(--success)">✅ Liveness terverifikasi — ambil 5 sampel wajah</span>';

      // Enable capture + start live detection loop
      document.getElementById('fr-btn').disabled = false;
      _startRegLoop();

    } catch(e) {
      const ldr = document.getElementById('fr-loader');
      _showOverlayError(ldr, e.message);
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
      _drawBox(canvas, video, r?.detection.box || null, '#22c55e');
      const s = document.getElementById('fr-status');
      if (s && _regSamples.length < 5) {
        s.innerHTML = r
          ? `<span style="color:var(--success)">✅ Wajah terdeteksi — ambil sampel (${_regSamples.length}/5)</span>`
          : `<span style="color:var(--warning)">⚠️ Wajah belum terdeteksi...</span>`;
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

    const thumb = document.createElement('canvas');
    thumb.width = 44; thumb.height = 44;
    const { x, y, width, height } = r.detection.box;
    thumb.getContext('2d').drawImage(video, x, y, width, height, 0, 0, 44, 44);
    const img = new Image(); img.src = thumb.toDataURL();
    img.style.cssText = 'width:44px;height:44px;border-radius:6px;object-fit:cover;border:2px solid var(--success)';
    document.getElementById('fr-samples')?.appendChild(img);

    const cnt = _regSamples.length;
    const cntEl = document.getElementById('fr-count');
    if (cntEl) cntEl.textContent = `(${cnt}/5)`;

    if (cnt < 5) {
      if (btn) btn.disabled = false;
      const s = document.getElementById('fr-status');
      if (s) s.innerHTML = `<span style="color:var(--success)">✅ Sampel ${cnt}/5 — miring sedikit lalu ambil lagi</span>`;
    } else {
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
    } catch(e) { Notify.error('Gagal menyimpan', e.message); }
    _regSamples = []; _regMid = null;
  }

  function _stopReg() { _stopStream(); _regSamples = []; }

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
          <div id="kiosk-loader" style="position:absolute;inset:0;background:rgba(0,0,0,.8);display:flex;flex-direction:column;align-items:center;justify-content:center;color:white;gap:8px">
            <div style="font-size:36px">🤖</div>
            <div style="font-weight:600">Memuat AI...</div>
            <div style="font-size:11px;opacity:.6">Pertama kali ~15 detik, selanjutnya instan</div>
          </div>
          <div id="kiosk-result" style="display:none;position:absolute;bottom:0;left:0;right:0;padding:14px 20px;
            background:linear-gradient(transparent,rgba(0,0,0,.85));text-align:center;color:white"></div>
        </div>
        <div id="kiosk-log" style="margin-top:10px;max-height:120px;overflow-y:auto;display:flex;flex-direction:column;gap:4px;font-size:12px"></div>`,
      footer: `<button class="btn btn-ghost" onclick="Modal.close('${mid}');FaceAttendanceModule._stopKiosk()">Tutup</button>`,
    });

    try {
      await _loadModels();
      if (!_matcher) {
        _showOverlayError(document.getElementById('kiosk-loader'),
          'Belum ada karyawan yang mendaftarkan wajah');
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
      _startKioskLoop(mid);
    } catch(e) {
      _showOverlayError(document.getElementById('kiosk-loader'), e.message);
    }
  }

  function _startKioskLoop(mid) {
    const video    = document.getElementById('kiosk-video');
    const canvas   = document.getElementById('kiosk-canvas');
    const resultEl = document.getElementById('kiosk-result');
    if (!video || !canvas) return;

    let frame = 0;
    let busy  = false; // prevent overlapping recognition

    const loop = async () => {
      if (!document.getElementById('kiosk-video')) { _stopStream(); return; }
      frame++;

      if (frame % 20 === 0 && !busy) {
        busy = true;
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
            if (!_kioskCooldown[empId] || now - _kioskCooldown[empId] > 15000) {
              _kioskCooldown[empId] = now; // pre-set cooldown to prevent double trigger

              // Liveness: quick blink challenge
              const overlay  = document.getElementById('kiosk-overlay');
              const st       = document.getElementById('kiosk-status');
              if (st) st.innerHTML = `🎯 <strong>${empNama}</strong> — ${_CHALLENGES[0].text}...`;
              const lived = await _runChallenge(video, overlay, _CHALLENGES[0], 2500); // BLINK only in kiosk
              if (overlay) overlay.style.display = 'none';

              if (lived) {
                await _recordKioskAbsensi(empId, empNama, resultEl);
              } else {
                _kioskCooldown[empId] = 0; // reset so they can try again
                if (st) st.innerHTML = '🟢 Sistem aktif — tatap kamera untuk absen';
                if (resultEl) {
                  resultEl.style.display = 'block';
                  resultEl.innerHTML = `<div style="font-size:15px;color:#fca5a5">❌ Liveness gagal, ${empNama} — coba lagi</div>`;
                  setTimeout(() => { if (resultEl) resultEl.style.display = 'none'; }, 3000);
                }
              }
            }
          }
        } else if (!r) {
          const ctx = canvas.getContext('2d');
          canvas.width  = video.videoWidth  || 1280;
          canvas.height = video.videoHeight || 720;
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
    const existing = _absensi.find(a => (a.empId===empId||a.empNama===empNama) && a.tgl===today);
    const st = document.getElementById('kiosk-status');

    if (existing) {
      if (resultEl) {
        resultEl.style.display = 'block';
        resultEl.innerHTML = `<div style="font-size:16px;font-weight:700">👋 ${empNama}</div>
          <div style="font-size:12px;opacity:.8">Sudah tercatat hari ini · ${timeStr}</div>`;
        setTimeout(() => { if (resultEl) resultEl.style.display = 'none'; }, 3000);
      }
      if (st) st.innerHTML = '🟢 Sistem aktif — tatap kamera untuk absen';
      return;
    }

    const rec = {
      empId, empNama, tgl: today, status: 'H',
      ket: 'Face + Liveness ' + timeStr, createdAt: new Date().toISOString(),
    };
    const saved = await DB.saveEmpAbsensi(rec).catch(() => rec);
    if (!saved.id) saved.id = Utils.uid();
    _absensi.push(saved);
    if (window.EmployeeModule?._onFaceAbsensi) EmployeeModule._onFaceAbsensi(saved);

    if (resultEl) {
      resultEl.style.display = 'block';
      resultEl.innerHTML = `<div style="font-size:22px;font-weight:700;color:#4ade80">✅ Selamat datang, ${empNama}!</div>
        <div style="font-size:13px;opacity:.8">${timeStr} · Hadir · Liveness ✓</div>`;
      setTimeout(() => { if (resultEl) resultEl.style.display = 'none'; }, 4500);
    }
    const logEl = document.getElementById('kiosk-log');
    if (logEl) {
      const e = document.createElement('div');
      e.style.cssText = 'padding:5px 10px;border-radius:6px;background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.3);color:var(--success)';
      e.textContent = `${timeStr} — ${empNama} ✓ Hadir (Face + Liveness)`;
      logEl.prepend(e);
    }
    if (st) st.innerHTML = '🟢 Sistem aktif — tatap kamera untuk absen';
    Notify.success(empNama + ' absen — face + liveness ✓');
  }

  function _stopKiosk() { _stopStream(); _kioskCooldown = {}; }

  // =============================================
  //  TOGGLE BUTTON (rendered in absensi tab)
  // =============================================
  function renderToggle() {
    const on = isEnabled();
    return `<button class="btn btn-ghost btn-sm" onclick="FaceAttendanceModule.toggleAndRender()"
      style="${on ? 'border-color:rgba(34,197,94,.5);color:var(--success)' : ''}">
      <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${on ? 'var(--success)' : 'var(--text-3)'};margin-right:4px"></span>
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

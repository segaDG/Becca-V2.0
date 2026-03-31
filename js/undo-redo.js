/**
 * BECCA Undo/Redo Manager
 * Shared utility for spreadsheet-like tables.
 * Cmd+Z / Ctrl+Z = undo, Cmd+Shift+Z / Ctrl+Y = redo
 */
const UndoRedo = (() => {
  const MAX = 50;
  const _stacks = {};
  let _activeModule = null;

  function _ensure(mod) {
    if (!_stacks[mod]) _stacks[mod] = { undo: [], redo: [] };
    return _stacks[mod];
  }

  function setActive(mod) { _activeModule = mod; }
  function getActive() { return _activeModule; }

  function push(mod, entry) {
    const s = _ensure(mod);
    s.undo.push(entry);
    if (s.undo.length > MAX) s.undo.shift();
    s.redo = [];
  }

  function canUndo(mod) { return _ensure(mod).undo.length > 0; }
  function canRedo(mod) { return _ensure(mod).redo.length > 0; }

  function undo(mod) {
    const s = _ensure(mod);
    if (!s.undo.length) return;
    const entry = s.undo.pop();
    s.redo.push(entry);
    // Render first (instant), DB save in background
    if (entry.render) entry.render();
    if (entry.save && entry.before) entry.save(entry.before).catch(() => {});
  }

  function redo(mod) {
    const s = _ensure(mod);
    if (!s.redo.length) return;
    const entry = s.redo.pop();
    s.undo.push(entry);
    if (entry.render) entry.render();
    if (entry.save && entry.after) entry.save(entry.after).catch(() => {});
  }

  function clear(mod) {
    if (mod) _stacks[mod] = { undo: [], redo: [] };
    else Object.keys(_stacks).forEach(k => { _stacks[k] = { undo: [], redo: [] }; });
  }

  document.addEventListener('keydown', e => {
    if ((e.target.tagName||'').toLowerCase() === 'textarea') return;
    const isMeta = e.metaKey || e.ctrlKey;
    if (!isMeta || !_activeModule) return;

    if (e.key === 'z' && !e.shiftKey) {
      e.preventDefault(); undo(_activeModule);
    } else if ((e.key === 'z' && e.shiftKey) || (e.key === 'y' && !e.shiftKey)) {
      e.preventDefault(); redo(_activeModule);
    }
  });

  return { push, undo, redo, canUndo, canRedo, clear, setActive, getActive };
})();
window.UndoRedo = UndoRedo;

/**
 * BECCA Undo/Redo Manager
 * Shared utility for spreadsheet-like tables.
 * Stores snapshots of row changes; supports Cmd+Z / Ctrl+Z (undo) and Cmd+Shift+Z / Ctrl+Y (redo).
 *
 * Usage from module:
 *   UndoRedo.push('kas', { id, before: {...oldRow}, after: {...newRow}, save: fn, render: fn })
 *   UndoRedo.undo('kas')
 *   UndoRedo.redo('kas')
 *   UndoRedo.canUndo('kas')  // boolean
 *   UndoRedo.canRedo('kas')  // boolean
 */
const UndoRedo = (() => {
  const MAX = 50;
  const _stacks = {};  // { moduleName: { undo: [], redo: [] } }
  let _activeModule = null;

  function _ensure(mod) {
    if (!_stacks[mod]) _stacks[mod] = { undo: [], redo: [] };
    return _stacks[mod];
  }

  function setActive(mod) { _activeModule = mod; }
  function getActive() { return _activeModule; }

  // Push a change onto the undo stack
  // entry = { id, before, after, save(rowData), render() }
  function push(mod, entry) {
    const s = _ensure(mod);
    s.undo.push(entry);
    if (s.undo.length > MAX) s.undo.shift();
    s.redo = []; // clear redo on new action
  }

  function canUndo(mod) { return (_ensure(mod).undo.length > 0); }
  function canRedo(mod) { return (_ensure(mod).redo.length > 0); }

  async function undo(mod) {
    const s = _ensure(mod);
    if (!s.undo.length) return false;
    const entry = s.undo.pop();
    s.redo.push(entry);
    // Restore 'before' state
    try {
      if (entry.save && entry.before) await entry.save(entry.before);
      if (entry.render) entry.render();
      if (window.Notify) Notify.info('Undo');
    } catch(e) { console.warn('[UndoRedo] undo error:', e); }
    return true;
  }

  async function redo(mod) {
    const s = _ensure(mod);
    if (!s.redo.length) return false;
    const entry = s.redo.pop();
    s.undo.push(entry);
    // Apply 'after' state
    try {
      if (entry.save && entry.after) await entry.save(entry.after);
      if (entry.render) entry.render();
      if (window.Notify) Notify.info('Redo');
    } catch(e) { console.warn('[UndoRedo] redo error:', e); }
    return true;
  }

  function clear(mod) {
    if (mod) { _stacks[mod] = { undo: [], redo: [] }; }
    else { Object.keys(_stacks).forEach(k => { _stacks[k] = { undo: [], redo: [] }; }); }
  }

  // Keyboard shortcut: Cmd+Z / Ctrl+Z = undo, Cmd+Shift+Z / Ctrl+Y = redo
  document.addEventListener('keydown', e => {
    // Skip if typing in input/textarea/select
    const tag = (e.target.tagName||'').toLowerCase();
    if (tag === 'textarea') return;

    const isMeta = e.metaKey || e.ctrlKey;
    if (!isMeta) return;

    const mod = _activeModule;
    if (!mod) return;

    if (e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      undo(mod);
    } else if ((e.key === 'z' && e.shiftKey) || (e.key === 'y' && !e.shiftKey)) {
      e.preventDefault();
      redo(mod);
    }
  });

  return { push, undo, redo, canUndo, canRedo, clear, setActive, getActive };
})();

window.UndoRedo = UndoRedo;

/* ==================== CORE ==================== */
const $ = id => document.getElementById(id);
const en2bn = s => String(s).replace(/[0-9]/g, d => '০১২৩৪৫৬৭৮৯'[d]);
function esc(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escapeRegex(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

/* ==================== CONSTANTS ==================== */
const DEFAULT_CREATIVE_INSTR = '[বি:দ্র: সংক্ষিপ্ত অংশ হতে যেকোনো ১০টি এবং সৃজনশীল অংশ হতে যেকোনো ০৫ টি প্রশ্নের উত্তর দাও।]';
const DEFAULT_MCQ_INSTR = '[দ্রষ্টব্য: সরবারহকৃত বহুনির্বাচনি অভিক্ষার উত্তরপত্রে প্রশ্নের ক্রমিক নম্বরের বিপরীতে প্রদত্ত বর্ণসংবলিত বৃত্তসমূহ হতে সঠিক/সর্বোৎকৃষ্ট উত্তরের বৃত্তটি বল পয়েন্ট কলম দ্বারা সম্পূর্ণ ভরাট কর। প্রতিটি প্রশ্নের মান ১।]';
const MODE_TIME = { creative: '২ ঘন্টা ৩০ মিনিট', mcq: '৩০ মিনিট' };
const CACHE_KEY = 'qp_cache_v1';
const PRESET_KEY = 'qp_presets_v1';
const CACHE_FIELDS = ['school','exam','class','subject','subjectCode','time','fullmark','fontSize','fontFamily','encoding','instructions','pasteSmall','pasteMain','pasteMcq'];
const DIV_MARKER = '@@DIV@@';
const MAX_SECTIONS = 5;
const MAX_IMAGES_PER_ROW = 3;
const SECTION_LABELS_BN = ['ক','খ','গ','ঘ','ঙ'];
const SECTION_LABELS_EN = ['K','L','M','N','O'];
const MARKER_RE = /^\s*[\(\[\{]?\s*([কখগঘঙKLMNO])\s*[\)\]\}\।\.\|\:\,\-]\s*(.*)$/;
const NUMPREFIX_RE = /^[০-৯0-9]+\s*[।\.\|\:\-\)]\s*/;
const SHORT_MARKS = { 'ক':1,'K':1,'খ':1,'L':1,'গ':1,'M':1,'ঘ':1,'N':1,'ঙ':1,'O':1 };
const CREATIVE_MARKS = { 'ক':1,'K':1,'খ':2,'L':2,'গ':3,'M':3,'ঘ':4,'N':4,'ঙ':5,'O':5 };
const OPTION_RE = /^\s*[\(\[\{]?\s*([কখগঘঙKLMNO])\s*[\)\]\}\।\.\|\:\,\-\/\;\?]\s*(.+)$/;
const MCQ_QNUM_RE = /^\s*[০-৯0-9]+\s*[।\.\)\|\:\-]\s*(.+)$/;
const OPTION_SPLIT_RE = /\s+(?=[\(\[\{]?[কখগঘঙKLMNO][\)\]\}\।\.\|\:\,\-\/\;\?]\s)/g;

const isKa = ch => ch === 'ক' || ch === 'K';
function isBijoy() { const el = $('encoding'); return el && el.value === 'bijoy'; }
function num(n) { return isBijoy() ? String(n) : en2bn(n); }

/* ==================== DARK ==================== */
function applyDark() {
  document.documentElement.classList.toggle('dark', localStorage.getItem('qp_dark') === '1');
}
function toggleDark() {
  const next = localStorage.getItem('qp_dark') !== '1';
  localStorage.setItem('qp_dark', next ? '1' : '0');
  applyDark();
}

/* ==================== LAZY LOADERS ==================== */
const _loadedScripts = {};
function loadScript(url) {
  if (_loadedScripts[url]) return _loadedScripts[url];
  _loadedScripts[url] = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = url; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
  return _loadedScripts[url];
}
async function ensureHtml2Canvas() {
  if (window.html2canvas) return;
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
}
async function ensureJsPdf() {
  if (window.jspdf) return;
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
}
async function ensureFontsLoaded() {
  if (!document.fonts) return;
  const families = ['Nikosh', 'Kalpurush', 'SutonnyMJ'];
  const proms = [];
  for (const fam of families) {
    proms.push(document.fonts.load('12px "' + fam + '"').catch(() => {}));
    proms.push(document.fonts.load('bold 12px "' + fam + '"').catch(() => {}));
  }
  try { await Promise.all(proms); } catch (e) {}
  try {
    await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 2000))]);
  } catch (e) {}
}

/* ==================== IDB ==================== */
const imageCache = new Map();
let idb = null;
function openIdb() {
  return new Promise(res => {
    try {
      const req = indexedDB.open('prosnopotro', 1);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('images')) db.createObjectStore('images');
      };
      req.onsuccess = e => { idb = e.target.result; res(idb); };
      req.onerror = () => res(null);
    } catch (e) { res(null); }
  });
}
function idbPut(key, val) {
  if (!idb) return;
  try { idb.transaction('images','readwrite').objectStore('images').put(val, key); } catch (e) {}
}
function idbGet(key) {
  return new Promise(res => {
    if (!idb) return res(null);
    try {
      const req = idb.transaction('images','readonly').objectStore('images').get(key);
      req.onsuccess = () => res(req.result || null);
      req.onerror = () => res(null);
    } catch (e) { res(null); }
  });
}
function idbDelete(key) {
  if (!idb) return;
  try { idb.transaction('images','readwrite').objectStore('images').delete(key); } catch (e) {}
}
function idbGetAll() {
  return new Promise(res => {
    if (!idb) return res([]);
    const out = [];
    try {
      const tx = idb.transaction('images','readonly').objectStore('images');
      tx.openCursor().onsuccess = e => {
        const c = e.target.result;
        if (c) { out.push([c.key, c.value]); c.continue(); } else res(out);
      };
      tx.onerror = () => res(out);
    } catch (e) { res(out); }
  });
}
async function loadImagesDeferred() {
  await openIdb();
  const all = await idbGetAll();
  all.forEach(([k,v]) => {
    if (k !== 'spell_aff' && k !== 'spell_dic') imageCache.set(k, v);
  });
  if (all.length) render();
}
function nextImgKey() {
  return 'img_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
}

function compressImage(file) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      const MAX_W = 900;
      if (w > MAX_W) { h = Math.round(h * MAX_W / w); w = MAX_W; }
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      let q = 0.8;
      let url = c.toDataURL('image/jpeg', q);
      while (url.length > 105000 && q > 0.35) { q -= 0.05; url = c.toDataURL('image/jpeg', q); }
      resolve(url);
    };
    img.onerror = () => resolve(null);
    img.src = URL.createObjectURL(file);
  });
}

/* ==================== IMAGE INSERT ==================== */
let pendingImageTarget = null;
function handleImagePick(e) {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file || !pendingImageTarget) return;
  const pt = pendingImageTarget;
  pendingImageTarget = null;
  compressImage(file).then(dataUrl => {
    if (!dataUrl) { alert('ছবি লোড করা যায়নি'); return; }
    const key = nextImgKey();
    imageCache.set(key, dataUrl);
    idbPut(key, dataUrl);
    insertImageToken(pt.target, pt.gap, key);
    render(); scheduleCache();
  });
}
function insertImageToken(targetId, gap, key) {
  const raw = $(targetId).value;
  const lines = raw.replace(/\r\n?/g, '\n').split('\n');
  let insertAt = -1;
  if (targetId === 'pasteMain') {
    const info = parseCreative(raw);
    if (info.groups[gap]) insertAt = info.groups[gap].startLine;
  } else if (targetId === 'pasteMcq') {
    const info = parseMcq(raw);
    if (info[gap]) insertAt = info[gap].startLine;
  }
  if (insertAt < 0) insertAt = lines.length;
  lines.splice(insertAt, 0, '[img:' + key + ']');
  $(targetId).value = lines.join('\n');
}

/* ==================== IMAGE RENDER ==================== */
function imgTag(key) {
  const src = imageCache.get(key);
  if (!src) return '<span style="color:#dc2626">[ছবি]</span>';
  return '<img class="paper-img" src="' + src + '" alt="ছবি" data-imgkey="' + key + '" onclick="openImgEditor(\'' + key + '\', event)">';
}
function renderInlineText(text) {
  let s = esc(text);
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, '$1<em>$2</em>');
  return s;
}
function escWithImgs(s, targetId) {
  const str = String(s);
  const parts = [];
  const re = /\[table\]([\s\S]*?)\[\/table\]/g;
  let last = 0, m, tableIdx = 0;
  while ((m = re.exec(str))) {
    if (m.index > last) parts.push({ type: 'text', content: str.slice(last, m.index) });
    parts.push({ type: 'table', content: m[1].trim(), idx: tableIdx++ });
    last = m.index + m[0].length;
  }
  if (last < str.length) parts.push({ type: 'text', content: str.slice(last) });
  if (!parts.length) parts.push({ type: 'text', content: str });
  let html = '';
  for (const part of parts) {
    if (part.type === 'table') html += renderTableHtml(part.content, targetId || '', part.idx);
    else html += renderTextWithImgs(part.content);
  }
  return html;
}
function renderTextWithImgs(text) {
  const parts = String(text).split(/(\[img:[a-zA-Z0-9_]+\])/);
  let html = '';
  let pending = [];
  function flush() {
    if (!pending.length) return;
    const n = pending.length;
    const widthPct = n === 1 ? '65' : (n === 2 ? '48' : '32');
    if (n === 1) {
      html += '<div class="img-figure" style="display:block;max-width:' + widthPct + '%;margin:4px auto;">' + imgTag(pending[0]) + '<div class="img-caption"></div></div>';
    } else {
      html += '<div class="img-row" style="display:flex;gap:10px;justify-content:center;align-items:flex-start;margin:6px 0;">';
      pending.forEach(k => {
        html += '<div class="img-figure" style="flex:0 0 ' + widthPct + '%;max-width:' + widthPct + '%;display:flex;flex-direction:column;align-items:center;">' + imgTag(k) + '<div class="img-caption"></div></div>';
      });
      html += '</div>';
    }
    pending = [];
  }
  for (const part of parts) {
    const m = part.match(/^\[img:([a-zA-Z0-9_]+)\]$/);
    if (m) {
      if (pending.length >= MAX_IMAGES_PER_ROW) flush();
      pending.push(m[1]);
      continue;
    }
    if (part.trim() === '') continue;
    flush();
    html += renderInlineText(part);
  }
  flush();
  return html;
}
function parseTableBlock(blockText) {
  const lines = blockText.split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  return lines.map(l => l.split('|').map(c => c.trim()));
}
function renderTableHtml(blockText, targetId, blockIdx) {
  const rows = parseTableBlock(blockText);
  if (!rows.length) return '';
  const headerRow = rows[0];
  const bodyRows = rows.slice(1);
  let html = '<div class="table-wrapper" data-target="' + targetId + '" data-idx="' + blockIdx + '" onclick="openTableEditor(\'' + targetId + '\', ' + blockIdx + ', event)">';
  html += '<button class="table-remove" onclick="removeTable(\'' + targetId + '\', ' + blockIdx + ', event)" title="মুছুন">✕</button>';
  html += '<table class="qp-table"><thead><tr>';
  headerRow.forEach(c => { html += '<th>' + renderInlineText(c) + '</th>'; });
  html += '</tr></thead><tbody>';
  bodyRows.forEach(r => {
    html += '<tr>';
    r.forEach(c => { html += '<td>' + renderInlineText(c) + '</td>'; });
    html += '</tr>';
  });
  html += '</tbody></table></div>';
  return html;
}
function numberFigureCaptions() {
  let counter = 0;
  ['page1', 'page2'].forEach(id => {
    const page = $(id);
    if (!page) return;
    page.querySelectorAll('.img-caption').forEach(cap => {
      counter++;
      const n = en2bn(String(counter).padStart(2, '0'));
      cap.textContent = 'চিত্র নং: ' + n;
    });
  });
}

/* ==================== TABLE EDITOR ==================== */
let tableEditState = { targetId: null, idx: -1, gap: null, rows: [], mode: 'insert' };

function openTableEditor(targetId, idx, e) {
  if (e) { e.stopPropagation(); e.preventDefault(); }
  const text = $(targetId).value;
  const blocks = [...text.matchAll(/\[table\]([\s\S]*?)\[\/table\]/g)];
  if (idx < 0 || idx >= blocks.length) return;
  tableEditState = { targetId, idx, gap: null, rows: parseTableBlock(blocks[idx][1].trim()), mode: 'edit' };
  renderTableGrid();
  $('tableEditorModal').classList.remove('hidden');
}
function openTableEditorNew(targetId, gap, e) {
  if (e) { e.stopPropagation(); e.preventDefault(); }
  tableEditState = { targetId, idx: -1, gap, rows: [['','',''],['','',''],['','','']], mode: 'insert' };
  renderTableGrid();
  $('tableEditorModal').classList.remove('hidden');
}
function closeTableEditor() { $('tableEditorModal').classList.add('hidden'); }

function renderTableGrid() {
  const container = $('tblGridContainer');
  const rows = tableEditState.rows;
  if (!rows.length) { container.innerHTML = ''; return; }
  const cols = Math.max(...rows.map(r => r.length));
  rows.forEach(r => { while (r.length < cols) r.push(''); });
  let html = '<table>';
  rows.forEach((row, ri) => {
    html += '<tr>';
    row.forEach((cell, ci) => {
      const isHeader = ri === 0;
      html += '<td class="border border-edge-light dark:border-edge-dark p-0 ' + (isHeader ? 'bg-stone-200 dark:bg-brand-700/30' : 'bg-white dark:bg-surface-dark') + '">';
      html += '<input type="text" data-ri="' + ri + '" data-ci="' + ci + '" value="' + esc(cell) + '" oninput="onTableCellInput(this)" onpaste="onTableCellPaste(event, this)" class="w-full px-2 py-1 text-xs bg-transparent ' + (isHeader ? 'font-semibold' : '') + '">';
      html += '</td>';
    });
    html += '</tr>';
  });
  html += '</table>';
  container.innerHTML = html;
  $('tblRows').value = rows.length;
  $('tblCols').value = cols;
}
function onTableCellInput(input) {
  const ri = +input.dataset.ri, ci = +input.dataset.ci;
  tableEditState.rows[ri][ci] = input.value;
}
function onTableCellPaste(e, input) {
  const text = (e.clipboardData || window.clipboardData).getData('text');
  if (!text) return;
  if (text.indexOf('\t') !== -1 || text.indexOf('\n') !== -1) {
    e.preventDefault();
    const pasted = text.replace(/\r\n?/g, '\n').split('\n').filter(l => l.trim()).map(l => l.split('\t').map(c => c.trim()));
    if (pasted.length) {
      tableEditState.rows = pasted;
      renderTableGrid();
      showToast('টেবিল আপডেট ✓');
    }
  }
}
function resizeTable() {
  const r = Math.max(2, Math.min(10, +$('tblRows').value || 3));
  const c = Math.max(2, Math.min(6, +$('tblCols').value || 3));
  const newRows = [];
  for (let i = 0; i < r; i++) {
    const row = [];
    for (let j = 0; j < c; j++) {
      row.push(tableEditState.rows[i] && tableEditState.rows[i][j] ? tableEditState.rows[i][j] : '');
    }
    newRows.push(row);
  }
  tableEditState.rows = newRows;
  renderTableGrid();
}
function addTableRow() {
  const cols = (tableEditState.rows[0] || []).length || 3;
  if (tableEditState.rows.length >= 10) return;
  tableEditState.rows.push(Array(cols).fill(''));
  renderTableGrid();
}
function removeTableRow() {
  if (tableEditState.rows.length <= 2) return;
  tableEditState.rows.pop();
  renderTableGrid();
}
function addTableCol() {
  if (((tableEditState.rows[0] || []).length || 0) >= 6) return;
  tableEditState.rows.forEach(r => r.push(''));
  renderTableGrid();
}
function removeTableCol() {
  if (((tableEditState.rows[0] || []).length || 0) <= 2) return;
  tableEditState.rows.forEach(r => r.pop());
  renderTableGrid();
}
function saveTableEdit() {
  const st = tableEditState;
  const targetId = st.targetId, idx = st.idx, gap = st.gap, mode = st.mode, rows = st.rows;
  if (!rows.length) return;
  const blockText = '[table]\n' + rows.map(r => r.join(' | ')).join('\n') + '\n[/table]';
  const normText = $(targetId).value.replace(/\r\n?/g, '\n');
  if (mode === 'edit') {
    let count = -1;
    const newText = normText.replace(/\[table\]([\s\S]*?)\[\/table\]/g, (m) => {
      count++;
      return count === idx ? blockText : m;
    });
    $(targetId).value = newText;
  } else {
    const lines = normText.split('\n');
    let insertAt = -1;
    if (targetId === 'pasteMain') {
      const info = parseCreative(normText);
      if (info.groups[gap]) insertAt = info.groups[gap].startLine;
    } else if (targetId === 'pasteMcq') {
      const info = parseMcq(normText);
      if (info[gap]) insertAt = info[gap].startLine;
    }
    if (insertAt < 0) insertAt = lines.length;
    lines.splice(insertAt, 0, blockText);
    $(targetId).value = lines.join('\n');
  }
  closeTableEditor();
  render(); scheduleCache();
  showToast('টেবিল সংরক্ষিত ✓');
}
function removeTable(targetId, idx, e) {
  if (e) { e.stopPropagation(); e.preventDefault(); }
  if (!confirm('এই টেবিলটি মুছে ফেলবেন?')) return;
  const text = $(targetId).value;
  let count = -1;
  const newText = text.replace(/\[table\]([\s\S]*?)\[\/table\]\n?/g, (m) => {
    count++;
    return count === idx ? '' : m;
  });
  $(targetId).value = newText;
  render(); scheduleCache();
  showToast('টেবিল মুছে ফেলা হয়েছে ✓');
}
function handleTextareaPaste(e) {
  const text = (e.clipboardData || window.clipboardData).getData('text');
  if (!text) return;
  if (text.indexOf('\t') !== -1 && text.indexOf('\n') !== -1) {
    e.preventDefault();
    const rows = text.replace(/\r\n?/g, '\n').split('\n').filter(l => l.trim()).map(l => l.split('\t').map(c => c.trim()));
    if (rows.length >= 2) {
      const blockText = '\n[table]\n' + rows.map(r => r.join(' | ')).join('\n') + '\n[/table]\n';
      const el = e.target;
      const start = el.selectionStart;
      el.value = el.value.slice(0, start) + blockText + el.value.slice(el.selectionEnd);
      render(); scheduleCache();
    }
  }
}

/* ==================== QR ==================== */
let qrEnabled = localStorage.getItem('qp_qr') !== '0';
function toggleQR() {
  qrEnabled = !qrEnabled;
  localStorage.setItem('qp_qr', qrEnabled ? '1' : '0');
  updateQrBtn();
  render();
}
function updateQrBtn() {
  const btn = $('qrBtn'), txt = $('qrBtnText');
  if (!btn || !txt) return;
  txt.textContent = qrEnabled ? 'QR ✓' : 'QR ✗';
  btn.style.opacity = qrEnabled ? '1' : '0.55';
}
function buildQRContent() {
  const school = $('school').value.trim();
  const cls = $('class').value.trim();
  const subject = $('subject').value.trim();
  const code = $('subjectCode').value.trim();
  const lines = ['Prosnopotro'];
  if (school) lines.push(school);
  if (subject) lines.push(subject + (cls ? ' · ' + cls : ''));
  if (code) lines.push('Code: ' + code);
  lines.push('github.com/Opirajbhor/prosnopotro');
  return lines.join('\n');
}
function generateQRSvg(text) {
  if (typeof qrcode === 'undefined') return '';
  try {
    const qr = qrcode(0, 'L');
    qr.addData(text);
    qr.make();
    return qr.createSvgTag({ cellSize: 3, margin: 0 });
  } catch (e) { return ''; }
}
function generateQRDataUrl(text) {
  if (typeof qrcode === 'undefined') return '';
  try {
    const qr = qrcode(0, 'L');
    qr.addData(text);
    qr.make();
    return qr.createDataURL(4, 0);
  } catch (e) { return ''; }
}

/* ==================== SPELL ==================== */
let spellEngine = null;
let spellLoadingPromise = null;

async function loadSpellEngine() {
  if (spellEngine) return spellEngine;
  if (spellLoadingPromise) return spellLoadingPromise;
  spellLoadingPromise = (async () => {
    await openIdb();
    let aff = await idbGet('spell_aff');
    let dic = await idbGet('spell_dic');
    if (!aff || !dic) {
      const urls = [
        ['https://cdn.jsdelivr.net/gh/wooorm/dictionaries@main/dictionaries/bn/index.aff',
         'https://cdn.jsdelivr.net/gh/wooorm/dictionaries@main/dictionaries/bn/index.dic'],
        ['https://cdn.jsdelivr.net/gh/LibreOffice/dictionaries@master/bn_BD/bn_BD.aff',
         'https://cdn.jsdelivr.net/gh/LibreOffice/dictionaries@master/bn_BD/bn_BD.dic']
      ];
      let lastErr = null;
      for (const [affUrl, dicUrl] of urls) {
        try {
          const [affRes, dicRes] = await Promise.all([
            fetch(affUrl).then(r => { if (!r.ok) throw new Error(r.status); return r.text(); }),
            fetch(dicUrl).then(r => { if (!r.ok) throw new Error(r.status); return r.text(); })
          ]);
          aff = affRes; dic = dicRes;
          idbPut('spell_aff', aff);
          idbPut('spell_dic', dic);
          lastErr = null;
          break;
        } catch (e) { lastErr = e; }
      }
      if (lastErr) throw lastErr;
    }
    const mod = await import('https://cdn.jsdelivr.net/npm/nspell@2/+esm');
    const nspell = mod.default || mod;
    spellEngine = nspell(aff, dic);
    return spellEngine;
  })();
  return spellLoadingPromise;
}

function extractBanglaWords(text) {
  const cleaned = String(text)
    .replace(/\[img:[a-zA-Z0-9_]+\]/g, ' ')
    .replace(/\[table\][\s\S]*?\[\/table\]/g, ' ');
  return cleaned.split(/[\s।,\.\?\!;:\(\)\[\]\{\}\-\u2013\u2014"'\u2018\u2019\u201C\u201D]+/)
    .filter(w => w.length > 1 && /[\u0980-\u09FF]/.test(w));
}

async function runSpellCheck() {
  const btn = $('spellBtn');
  const label = $('spellBtnText');
  if (isBijoy()) return;
  if (!spellEngine) {
    label.textContent = 'লোড হচ্ছে…';
    btn.disabled = true;
    btn.style.opacity = '0.7';
    try { await loadSpellEngine(); }
    catch (err) {
      alert('বানান পরীক্ষার ইঞ্জিন লোড করা যায়নি: ' + err.message);
      label.textContent = 'বানান পরীক্ষা';
      btn.disabled = false;
      btn.style.opacity = '';
      spellLoadingPromise = null;
      return;
    }
    label.textContent = 'আবার পরীক্ষা';
    btn.disabled = false;
    btn.style.opacity = '';
  }
  ['pasteSmall', 'pasteMain', 'pasteMcq'].forEach(id => {
    const el = $(id);
    if (!el) return;
    const results = checkTextForMisspellings(el.value);
    renderSpellResults(id, results);
  });
}

function checkTextForMisspellings(text) {
  if (!spellEngine) return [];
  const words = extractBanglaWords(text);
  const seen = new Map();
  for (const w of words) {
    if (seen.has(w)) continue;
    if (!spellEngine.correct(w)) {
      const suggestions = spellEngine.suggest(w).slice(0, 3);
      seen.set(w, suggestions);
    }
  }
  return [...seen.entries()].map(([word, suggestions]) => ({ word, suggestions }));
}

function escAttr(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function renderSpellResults(targetId, results) {
  const boxId = targetId === 'pasteSmall' ? 'spellSmall'
              : targetId === 'pasteMain' ? 'spellMain' : 'spellMcq';
  const box = $(boxId);
  if (!box) return;
  if (!results.length) {
    box.innerHTML = '<div class="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">✓ কোনো ভুল পাওয়া যায়নি</div>';
    return;
  }
  const pills = results.slice(0, 30).map(r => {
    const sug = r.suggestions[0] || '';
    const sugHtml = sug
      ? '<button type="button" onclick="replaceWord(\'' + targetId + '\',\'' + escAttr(r.word) + '\',\'' + escAttr(sug) + '\')" class="ml-1 underline text-emerald-700 dark:text-emerald-400">' + esc(sug) + '</button>'
      : '<span class="ml-1 text-ink-subtle">—</span>';
    return '<span class="inline-flex items-center bg-red-50 dark:bg-red-700/20 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded mr-1 mb-1 border border-red-500/30 text-[11px]"><s>' + esc(r.word) + '</s>' + sugHtml + '</span>';
  }).join('');
  const more = results.length > 30 ? '<div class="text-[10px] text-ink-subtle mt-1">আরও ' + (results.length - 30) + 'টি ভুল</div>' : '';
  box.innerHTML = '<div class="mt-1 flex flex-wrap">' + pills + '</div>' + more;
}

function replaceWord(targetId, wrong, right) {
  const el = $(targetId);
  if (!el) return;
  const re = new RegExp('(^|[\\s।,\\.\\?\\!;:\\(\\)\\[\\]\\{\\}\\"\\'])' + escapeRegex(wrong) + '(?=$|[\\s।,\\.\\?\\!;:\\(\\)\\[\\]\\{\\}\\"\\'])', 'g');
  el.value = el.value.replace(re, '$1' + right);
  render(); scheduleCache();
  const results = checkTextForMisspellings(el.value);
  renderSpellResults(targetId, results);
}

function updateSpellBtnState() {
  const btn = $('spellBtn'), txt = $('spellBtnText');
  if (!btn) return;
  if (isBijoy()) {
    btn.disabled = true;
    btn.style.opacity = '0.4';
    btn.style.cursor = 'not-allowed';
    btn.title = 'শুধু ইউনিকোডে কাজ করে';
    if (txt) txt.textContent = 'বানান পরীক্ষা';
  } else {
    btn.disabled = false;
    btn.style.opacity = '';
    btn.style.cursor = '';
    btn.title = 'বানান পরীক্ষা';
  }
}

/* ==================== TEXTAREA FONT ==================== */
function applyTextareaFont() {
  const b = isBijoy();
  ['pasteSmall', 'pasteMain', 'pasteMcq'].forEach(id => {
    const el = $(id);
    if (!el) return;
    el.classList.toggle('bijoy-font', b);
  });
}
function onEncodingChange() {
  applyTextareaFont();
  updateSpellBtnState();
  ['spellSmall', 'spellMain', 'spellMcq'].forEach(id => { const el = $(id); if (el) el.innerHTML = ''; });
  render();
  scheduleCache();
}

/* ==================== FORMAT ==================== */
function applyFormat(targetId, type) {
  const el = $(targetId);
  const start = el.selectionStart, end = el.selectionEnd;
  if (start === end) return;
  const before = el.value.slice(0, start);
  const sel = el.value.slice(start, end);
  const after = el.value.slice(end);
  const wrap = type === 'bold' ? '**' : '*';
  if (before.endsWith(wrap) && after.startsWith(wrap)) {
    el.value = before.slice(0, -wrap.length) + sel + after.slice(wrap.length);
    el.selectionStart = start - wrap.length;
    el.selectionEnd = end - wrap.length;
  } else {
    el.value = before + wrap + sel + wrap + after;
    el.selectionStart = start + wrap.length;
    el.selectionEnd = end + wrap.length;
  }
  el.focus(); render(); scheduleCache();
}

/* ==================== VOICE ==================== */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let recog = null, recogTarget = null;
function initVoice() {
  if (!SR) return;
  document.querySelectorAll('.mic-btn').forEach(b => b.classList.remove('hidden'));
}
function toggleVoice(targetId) {
  if (!SR) return;
  const btn = $('mic' + targetId.replace('paste',''));
  if (recog && recogTarget === targetId) { recog.stop(); return; }
  if (recog) { try { recog.stop(); } catch (e) {} }
  recog = new SR();
  recog.lang = 'bn-BD'; recog.continuous = true; recog.interimResults = false;
  recogTarget = targetId;
  document.querySelectorAll('.mic-btn').forEach(b => b.classList.remove('recording'));
  if (btn) btn.classList.add('recording');
  recog.onresult = e => {
    let finalTxt = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) finalTxt += e.results[i][0].transcript;
    }
    if (finalTxt) {
      const el = $(targetId);
      el.value = el.value + (el.value.endsWith(' ') || !el.value ? '' : ' ') + finalTxt;
      render(); scheduleCache();
    }
  };
  recog.onerror = () => stopVoice();
  recog.onend = () => stopVoice();
  try { recog.start(); } catch (e) {}
}
function stopVoice() {
  document.querySelectorAll('.mic-btn').forEach(b => b.classList.remove('recording'));
  if (recog) { try { recog.stop(); } catch (e) {} }
  recog = null; recogTarget = null;
}

/* ==================== IMG EDITOR ==================== */
let imgEditorState = { key: null, originalSrc: null, filter: 'none', brightness: 0, contrast: 0, rotation: 0, crop: null, baseImg: null, cropping: false, cropStart: null };

function openImgEditor(key, ev) {
  if (ev) { ev.stopPropagation(); ev.preventDefault(); }
  const src = imageCache.get(key);
  if (!src) return;
  imgEditorState = { key, originalSrc: src, filter: 'none', brightness: 0, contrast: 0, rotation: 0, crop: null, baseImg: null, cropping: false, cropStart: null };
  $('brightnessSlider').value = 0; $('contrastSlider').value = 0;
  $('brightnessVal').textContent = '0'; $('contrastVal').textContent = '0';
  document.querySelectorAll('.img-filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === 'none'));
  $('cropOverlay').style.display = 'none';
  const img = new Image();
  img.onload = () => {
    imgEditorState.baseImg = img;
    $('imgEditorModal').classList.remove('hidden');
    drawEditorCanvas();
  };
  img.src = src;
}
function closeImgEditor() { $('imgEditorModal').classList.add('hidden'); imgEditorState.key = null; imgEditorState.baseImg = null; }
function resetImgEditor() {
  imgEditorState.filter = 'none'; imgEditorState.brightness = 0; imgEditorState.contrast = 0; imgEditorState.rotation = 0; imgEditorState.crop = null;
  $('brightnessSlider').value = 0; $('contrastSlider').value = 0;
  $('brightnessVal').textContent = '0'; $('contrastVal').textContent = '0';
  document.querySelectorAll('.img-filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === 'none'));
  $('cropOverlay').style.display = 'none';
  drawEditorCanvas();
}
function applyImgFilter(f) {
  imgEditorState.filter = f;
  document.querySelectorAll('.img-filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === f));
  drawEditorCanvas();
}
function onSliderChange() {
  imgEditorState.brightness = +$('brightnessSlider').value;
  imgEditorState.contrast = +$('contrastSlider').value;
  $('brightnessVal').textContent = imgEditorState.brightness;
  $('contrastVal').textContent = imgEditorState.contrast;
  drawEditorCanvas();
}
function rotateImg(deg) {
  imgEditorState.rotation = ((imgEditorState.rotation + deg) % 360 + 360) % 360;
  imgEditorState.crop = null; $('cropOverlay').style.display = 'none';
  drawEditorCanvas();
}
function clearCrop() { imgEditorState.crop = null; $('cropOverlay').style.display = 'none'; drawEditorCanvas(); }

function removeImageFromPaper() {
  const key = imgEditorState.key;
  if (!key) return;
  if (!confirm('এই ছবিটি প্রশ্ন থেকে মুছে ফেলবেন?')) return;
  ['pasteSmall', 'pasteMain', 'pasteMcq'].forEach(tid => {
    const el = $(tid);
    if (!el) return;
    const tokenRe = new RegExp('\\[img:' + key + '\\]\\n?', 'g');
    el.value = el.value.replace(tokenRe, '');
  });
  imageCache.delete(key);
  idbDelete(key);
  closeImgEditor();
  render(); scheduleCache();
  showToast('ছবি মুছে ফেলা হয়েছে ✓');
}

function drawEditorCanvas() {
  const state = imgEditorState;
  if (!state.baseImg) return;
  const canvas = $('imgEditorCanvas');
  const ctx = canvas.getContext('2d');
  const rot = state.rotation, img = state.baseImg;
  const swap = rot === 90 || rot === 270;
  const baseW = swap ? img.height : img.width;
  const baseH = swap ? img.width : img.height;
  const MAXW = 600;
  const scale = baseW > MAXW ? MAXW / baseW : 1;
  const drawW = Math.round(baseW * scale);
  const drawH = Math.round(baseH * scale);
  canvas.width = drawW; canvas.height = drawH;
  canvas.style.width = drawW + 'px'; canvas.style.height = drawH + 'px';
  ctx.save();
  ctx.translate(drawW / 2, drawH / 2);
  ctx.rotate(rot * Math.PI / 180);
  const srcW = img.width * scale, srcH = img.height * scale;
  ctx.filter = buildCanvasFilter(state);
  ctx.drawImage(img, -srcW / 2, -srcH / 2, srcW, srcH);
  ctx.restore();
  if (state.filter === 'sepia') applySepiaPixelPass(ctx, drawW, drawH);
  ctx.filter = 'none';
}
function buildCanvasFilter(state) {
  const parts = [];
  if (state.filter === 'bw') parts.push('grayscale(1)');
  if (state.filter === 'highcontrast') parts.push('grayscale(1)', 'contrast(1.8)', 'brightness(1.05)');
  parts.push('brightness(' + (100 + state.brightness) + '%)');
  parts.push('contrast(' + (100 + state.contrast) + '%)');
  return parts.join(' ');
}
function applySepiaPixelPass(ctx, w, h) {
  try {
    const data = ctx.getImageData(0, 0, w, h);
    const d = data.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i+1], b = d[i+2];
      d[i] = Math.min(255, 0.393 * r + 0.769 * g + 0.189 * b);
      d[i+1] = Math.min(255, 0.349 * r + 0.686 * g + 0.168 * b);
      d[i+2] = Math.min(255, 0.272 * r + 0.534 * g + 0.131 * b);
    }
    ctx.putImageData(data, 0, 0);
  } catch (e) {}
}
function canvasPointFromEvent(e, canvas) {
  const rect = canvas.getBoundingClientRect();
  const cx = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
  const cy = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
  const scaleX = canvas.width / rect.width, scaleY = canvas.height / rect.height;
  return { x: cx * scaleX, y: cy * scaleY };
}
function startCrop(e) {
  e.preventDefault();
  const canvas = $('imgEditorCanvas');
  const pt = canvasPointFromEvent(e, canvas);
  imgEditorState.cropping = true; imgEditorState.cropStart = pt;
  imgEditorState.crop = { x: pt.x, y: pt.y, w: 0, h: 0 };
  updateCropOverlay();
}
function moveCrop(e) {
  if (!imgEditorState.cropping) return;
  e.preventDefault();
  const canvas = $('imgEditorCanvas');
  const pt = canvasPointFromEvent(e, canvas);
  const start = imgEditorState.cropStart;
  imgEditorState.crop = {
    x: Math.min(start.x, pt.x), y: Math.min(start.y, pt.y),
    w: Math.abs(pt.x - start.x), h: Math.abs(pt.y - start.y)
  };
  updateCropOverlay();
}
function endCrop() {
  if (!imgEditorState.cropping) return;
  imgEditorState.cropping = false;
  const c = imgEditorState.crop;
  if (!c || c.w < 5 || c.h < 5) {
    imgEditorState.crop = null;
    $('cropOverlay').style.display = 'none';
  }
}
function updateCropOverlay() {
  const canvas = $('imgEditorCanvas');
  const overlay = $('cropOverlay');
  const rect = canvas.getBoundingClientRect();
  const wrapRect = canvas.parentElement.getBoundingClientRect();
  const c = imgEditorState.crop;
  if (!c) { overlay.style.display = 'none'; return; }
  const scaleX = rect.width / canvas.width, scaleY = rect.height / canvas.height;
  overlay.style.display = 'block';
  overlay.style.left = ((rect.left - wrapRect.left) + c.x * scaleX) + 'px';
  overlay.style.top = ((rect.top - wrapRect.top) + c.y * scaleY) + 'px';
  overlay.style.width = (c.w * scaleX) + 'px';
  overlay.style.height = (c.h * scaleY) + 'px';
}
function saveImgEdit() {
  const state = imgEditorState;
  if (!state.key || !state.baseImg) return;
  const srcCanvas = $('imgEditorCanvas');
  let out = srcCanvas;
  if (state.crop && state.crop.w > 5 && state.crop.h > 5) {
    const c = state.crop;
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = Math.round(c.w); cropCanvas.height = Math.round(c.h);
    cropCanvas.getContext('2d').drawImage(srcCanvas, Math.round(c.x), Math.round(c.y), Math.round(c.w), Math.round(c.h), 0, 0, Math.round(c.w), Math.round(c.h));
    out = cropCanvas;
  }
  let dataUrl = out.toDataURL('image/jpeg', 0.85);
  let q = 0.85;
  while (dataUrl.length > 105000 && q > 0.35) {
    q -= 0.05;
    dataUrl = out.toDataURL('image/jpeg', q);
  }
  imageCache.set(state.key, dataUrl);
  idbPut(state.key, dataUrl);
  closeImgEditor();
  render(); scheduleCache();
  showToast('ছবি সংরক্ষিত ✓');
}
function initImgEditorListeners() {
  const canvas = $('imgEditorCanvas');
  if (!canvas) return;
  canvas.addEventListener('mousedown', startCrop);
  canvas.addEventListener('mousemove', moveCrop);
  canvas.addEventListener('mouseup', endCrop);
  canvas.addEventListener('mouseleave', endCrop);
  canvas.addEventListener('touchstart', startCrop, { passive: false });
  canvas.addEventListener('touchmove', moveCrop, { passive: false });
  canvas.addEventListener('touchend', endCrop);
}

/* ==================== DUPLICATE ==================== */
function tokenize(s) {
  return String(s).toLowerCase().replace(/[^\u0980-\u09FFa-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 1);
}
function jaccard(a, b) {
  const A = new Set(a), B = new Set(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / new Set([...A, ...B]).size;
}
function findDuplicates() {
  const texts = [];
  if (MODE === 'mcq') {
    parseMcq($('pasteMcq').value).forEach(q => texts.push(q.question));
  } else {
    parseShort($('pasteSmall').value).forEach(q => texts.push(q.text));
    parseCreative($('pasteMain').value).groups.forEach(g => texts.push(g.stimulus));
  }
  const dupes = [];
  const tokens = texts.map(tokenize);
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      if (!tokens[i].length || !tokens[j].length) continue;
      if (jaccard(tokens[i], tokens[j]) >= 0.8) dupes.push({ i, j });
    }
  }
  return { dupes, count: texts.length };
}

/* ==================== MODE ==================== */
let MODE = localStorage.getItem('qp_mode') || 'creative';
function setMode(m) {
  if (MODE === m) return;
  MODE = m;
  localStorage.setItem('qp_mode', m);
  const ta = $('instructions');
  const cur = ta.value.trim();
  if (cur === '' || cur === DEFAULT_CREATIVE_INSTR || cur === DEFAULT_MCQ_INSTR) {
    ta.value = m === 'mcq' ? DEFAULT_MCQ_INSTR : DEFAULT_CREATIVE_INSTR;
  }
  $('time').value = MODE_TIME[m] || MODE_TIME.creative;
  applyMode(); render(); scheduleCache();
}
function applyMode() {
  $('modeBtnCreative').classList.toggle('active', MODE === 'creative');
  $('modeBtnMcq').classList.toggle('active', MODE === 'mcq');
  $('creativeFields').classList.toggle('hidden', MODE !== 'creative');
  $('mcqFields').classList.toggle('hidden', MODE !== 'mcq');
}

/* ==================== SUBJECTS ==================== */
const NCTB_SUBJECTS = [
  { name:'বাংলা ১ম পত্র', code:'১০১' }, { name:'বাংলা ২য় পত্র', code:'১০২' },
  { name:'ইংরেজি ১ম পত্র', code:'১০৭' }, { name:'ইংরেজি ২য় পত্র', code:'১০৮' },
  { name:'গণিত', code:'১০৯' }, { name:'তথ্য ও যোগাযোগ প্রযুক্তি', code:'১৫৪' },
  { name:'শারীরিক শিক্ষা, স্বাস্থ্যবিজ্ঞান ও খেলাধুলা', code:'১৪৭' },
  { name:'ক্যারিয়ার শিক্ষা', code:'১৫৬' }, { name:'চারু ও কারুকলা', code:'১৪৮' },
  { name:'কর্ম ও জীবনমুখী শিক্ষা', code:'১৫৫' }, { name:'পদার্থবিজ্ঞান', code:'১৩৬' },
  { name:'রসায়ন', code:'১৩৭' }, { name:'জীববিজ্ঞান', code:'১৩৮' },
  { name:'উচ্চতর গণিত', code:'১২৬' }, { name:'বিজ্ঞান', code:'১২৭' },
  { name:'বাংলাদেশ ও বিশ্বপরিচয়', code:'১৫০' }, { name:'বাংলাদেশের ইতিহাস ও বিশ্বসভ্যতা', code:'১৫৩' },
  { name:'ভূগোল ও পরিবেশ', code:'১১০' }, { name:'পৌরনীতি ও নাগরিকতা', code:'১৪০' },
  { name:'অর্থনীতি', code:'১৪১' }, { name:'হিসাববিজ্ঞান', code:'১৪৬' },
  { name:'ব্যবসায় উদ্যোগ', code:'১৪৩' }, { name:'ফিন্যান্স ও ব্যাংকিং', code:'১৫২' },
  { name:'কৃষিশিক্ষা', code:'১৩৪' }, { name:'গার্হস্থ্য বিজ্ঞান', code:'১৫১' },
  { name:'ইসলাম শিক্ষা', code:'১১১' }, { name:'হিন্দুধর্ম শিক্ষা', code:'১১২' },
  { name:'বৌদ্ধধর্ম শিক্ষা', code:'১১৩' }, { name:'খ্রীষ্টধর্ম শিক্ষা', code:'১১৪' },
  { name:'আরবি', code:'১২১' }, { name:'সংস্কৃত', code:'১২৩' },
  { name:'পালি', code:'১২৪' }, { name:'সংগীত', code:'১৪৯' },
];
function populateSubjects() {
  const sel = $('subject');
  if (!sel) return;
  sel.innerHTML = NCTB_SUBJECTS.map(s =>
    '<option value="' + esc(s.name) + '" data-code="' + esc(s.code) + '">' + esc(s.name) + '</option>').join('');
}
function autoFillCode() {
  const sel = $('subject');
  const opt = sel.options[sel.selectedIndex];
  if (opt && opt.dataset.code) $('subjectCode').value = opt.dataset.code;
  render(); scheduleCache();
}

/* ==================== HELPERS ==================== */
function getShortHeading()  { return isBijoy() ? 'msÿwc&Z Ask' : 'সংক্ষিপ্ত অংশ'; }
function getCreativeHeading(){ return isBijoy() ? 'm…Rbkxj Ask' : 'সৃজনশীল অংশ'; }
function getMcqHeading()    { return isBijoy() ? '†bqwe©ËK Ask' : 'নৈর্ব্যত্তিক অংশ'; }
function omrLetter(idx) {
  if (isBijoy()) return ['K','L','M','N','O'][idx] || '?';
  return ['ক','খ','গ','ঘ','ঙ'][idx] || '?';
}
function optionIndex(letter) {
  const UNI = { 'ক':0, 'খ':1, 'গ':2, 'ঘ':3, 'ঙ':4 };
  const BIJ = { 'K':0, 'L':1, 'M':2, 'N':3, 'O':4 };
  if (letter in UNI) return UNI[letter];
  if (letter in BIJ) return BIJ[letter];
  return 0;
}
function sectionLabel(i) { return isBijoy() ? SECTION_LABELS_EN[i] : SECTION_LABELS_BN[i]; }
function sectionWord()   { return isBijoy() ? ' Section' : ' বিভাগ'; }

/* ==================== PARSERS ==================== */
function parseShort(raw) {
  return raw.replace(/\r\n?/g, '\n').split('\n').map(l => l.trim()).filter(Boolean).map(line => {
    const m = line.match(MARKER_RE);
    if (m) return { marker: m[1] + '.', text: m[2].trim(), marks: SHORT_MARKS[m[1]] };
    return { marker: null, text: line.replace(NUMPREFIX_RE, '').trim(), marks: null };
  });
}
function parseCreative(raw) {
  const lines = String(raw).replace(/\r\n?/g, '\n').split('\n');
  const groups = [], dividerAtGap = new Map();
  let currentGroup = null, stimBuffer = [], pendingStimStart = -1;
  for (let li = 0; li < lines.length; li++) {
    const trimmed = lines[li].trim();
    if (!trimmed) continue;
    if (trimmed === DIV_MARKER) { dividerAtGap.set(groups.length, li); continue; }
    const m = trimmed.match(MARKER_RE);
    if (m) {
      const letter = m[1], text = m[2].trim();
      if (isKa(letter) || currentGroup === null) {
        const startLine = (pendingStimStart >= 0) ? pendingStimStart : li;
        currentGroup = { stimulus: stimBuffer.join(' ').trim(), subs: [], startLine };
        groups.push(currentGroup);
        stimBuffer = []; pendingStimStart = -1;
      }
      currentGroup.subs.push({ marker: letter + '.', text, marks: CREATIVE_MARKS[letter] });
    } else {
      const clean = trimmed.replace(NUMPREFIX_RE, '').trim();
      if (clean) {
        if (pendingStimStart < 0) pendingStimStart = li;
        stimBuffer.push(clean);
      }
    }
  }
  return { groups, dividerAtGap };
}
function parseMcq(raw) {
  const text = String(raw).replace(/\r\n?/g, '\n').replace(/[\u2028\u2029]/g, '\n').replace(/[\u200B-\u200D\uFEFF]/g, '');
  const originalLines = text.split('\n');
  const lines = [], lineIdxMap = [];
  originalLines.forEach((l, origIdx) => {
    const parts = l.split(OPTION_SPLIT_RE);
    parts.forEach(p => { lines.push(p); lineIdxMap.push(origIdx); });
  });
  const questions = [];
  let current = null;
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li].trim();
    if (!line) continue;
    const startLine = lineIdxMap[li];
    const om = line.match(OPTION_RE);
    if (om) {
      const idx = optionIndex(om[1]);
      const optText = om[2].trim();
      if (!current) { current = { question: optText, options: [], startLine }; questions.push(current); continue; }
      if (current.options.length < 4) current.options.push({ idx, text: optText });
      else { current = { question: optText, options: [], startLine }; questions.push(current); }
      continue;
    }
    const qm = line.match(MCQ_QNUM_RE);
    if (qm) { current = { question: qm[1].trim(), options: [], startLine }; questions.push(current); continue; }
    if (!current) { current = { question: line, options: [], startLine }; questions.push(current); }
    else if (current.options.length === 0) current.question += ' ' + line;
    else if (/[?।]\s*$/.test(line) || line.length > 45) { current = { question: line, options: [], startLine }; questions.push(current); }
    else { const last = current.options[current.options.length - 1]; if (last) last.text += ' ' + line; }
  }
  return questions.filter(q => q.question && q.options.length >= 2);
}

/* ==================== INSERT / DELETE ==================== */
function insertDivider(gapIndex) {
  const raw = $('pasteMain').value;
  const info = parseCreative(raw);
  if (gapIndex < 0 || gapIndex >= info.groups.length) return;
  if (info.dividerAtGap.size >= MAX_SECTIONS) return;
  if (info.dividerAtGap.has(gapIndex)) return;
  const lines = raw.replace(/\r\n?/g, '\n').split('\n');
  lines.splice(info.groups[gapIndex].startLine, 0, DIV_MARKER);
  $('pasteMain').value = lines.join('\n');
  render(); scheduleCache();
}
function deleteDivider(gapIndex) {
  const raw = $('pasteMain').value;
  const info = parseCreative(raw);
  const lineIdx = info.dividerAtGap.get(gapIndex);
  if (lineIdx === undefined) return;
  const lines = raw.replace(/\r\n?/g, '\n').split('\n');
  lines.splice(lineIdx, 1);
  $('pasteMain').value = lines.join('\n');
  render(); scheduleCache();
}
function handlePreviewClick(e) {
  if (e.target.closest('.table-wrapper')) return;
  const ins = e.target.closest('.insert-btn');
  if (ins) { e.preventDefault(); insertDivider(parseInt(ins.dataset.gap, 10)); return; }
  const del = e.target.closest('.delete-div');
  if (del) { e.preventDefault(); deleteDivider(parseInt(del.dataset.gap, 10)); return; }
  const img = e.target.closest('.insert-img-btn');
  if (img) {
    if (img.classList.contains('insert-tbl-btn')) return;
    e.preventDefault();
    pendingImageTarget = { target: img.dataset.imgtarget, gap: parseInt(img.dataset.gap, 10) };
    $('imgPicker').click(); return;
  }
  const block = e.target.closest('.question-clickable');
  if (block && !e.target.closest('.paper-img') && !e.target.closest('.qp-table')) {
    e.preventDefault();
    scrollTextareaToText(block.dataset.src, block.dataset.find || '');
  }
}
function scrollTextareaToText(targetId, findText) {
  const el = $(targetId);
  if (!el) return;
  el.focus();
  const idx = el.value.indexOf(findText.slice(0, 30));
  if (idx >= 0) {
    el.setSelectionRange(idx, idx + Math.min(findText.length, 30));
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20;
    const lines = el.value.slice(0, idx).split('\n').length - 1;
    el.scrollTop = Math.max(0, lines * lineHeight - el.clientHeight / 3);
  }
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ==================== RENDER HELPERS ==================== */
function shortQHtml(q, n) {
  const label = q.marker || (num(n) + '.');
  const mark = q.marks !== null ? num(q.marks) : '';
  return '<div class="question-clickable" data-src="pasteSmall" data-find="' + esc(q.text) + '">' +
    '<div class="flex gap-3 leading-relaxed">' +
    '<span class="font-semibold whitespace-nowrap w-7 shrink-0">' + esc(label) + '</span>' +
    '<span class="flex-1 flex justify-between gap-4">' +
    '<span>' + escWithImgs(q.text, 'pasteSmall') + '</span>' +
    '<span class="font-semibold whitespace-nowrap">' + esc(mark) + '</span>' +
    '</span></div></div>';
}
function creativeGroupHtml(g, numLabel) {
  const findText = g.stimulus || (g.subs[0] ? g.subs[0].text : '');
  let h = '<div class="question-clickable" data-src="pasteMain" data-find="' + esc(findText) + '">';
  if (g.stimulus) {
    h += '<div class="flex gap-3 leading-relaxed">' +
      '<span class="font-semibold whitespace-nowrap w-8 shrink-0">' + esc(numLabel) + '</span>' +
      '<span class="flex-1">' + escWithImgs(g.stimulus, 'pasteMain') + '</span></div>';
  } else {
    h += '<div class="flex gap-3"><span class="font-semibold w-8 shrink-0">' + esc(numLabel) + '</span></div>';
  }
  h += '<div class="mt-1 ml-8 space-y-1">';
  g.subs.forEach(q => {
    h += '<div class="flex justify-between gap-4 leading-relaxed">' +
      '<span><span class="font-semibold mr-2">' + esc(q.marker) + '</span>' + escWithImgs(q.text, 'pasteMain') + '</span>' +
      '<span class="font-semibold whitespace-nowrap">' + esc(num(q.marks)) + '</span></div>';
  });
  h += '</div></div>';
  return h;
}
function mcqHtml(q, n) {
  return '<div class="mcq question-clickable" data-src="pasteMcq" data-find="' + esc(q.question) + '">' +
    '<div class="mcq-q"><span class="mcq-num">' + esc(num(n) + '.') + '</span><span class="mcq-text">' + escWithImgs(q.question, 'pasteMcq') + '</span></div>' +
    '<div class="mcq-opts">' +
    q.options.map(opt => '<span class="mcq-opt"><b>(' + esc(omrLetter(opt.idx)) + ')</b>' + escWithImgs(opt.text, 'pasteMcq') + '</span>').join('') +
    '</div></div>';
}
function codeTableHtml(code) {
  if (!code) return '';
  const digits = code.replace(/[^0-9০-৯]/g, '').split('');
  if (!digits.length) return '';
  const cells = digits.map(d => '<td class="digit">' + esc(d) + '</td>').join('');
  const label = isBijoy() ? 'welq †KvW' : 'বিষয় কোড';
  return '<table class="code-table"><tr><th colspan="' + digits.length + '">' + esc(label) + '</th></tr>' +
    '<tr>' + cells + '</tr></table>';
}

/* ==================== BUILD ==================== */
function buildBlocks() {
  const school = $('school').value.trim();
  const exam = $('exam').value.trim();
  const cls = $('class').value.trim();
  const subject = $('subject').value.trim();
  const subjectCode = $('subjectCode').value.trim();
  const time = $('time').value.trim();
  const fullmark = $('fullmark').value.trim();
  const instruct = $('instructions').value.trim();
  let totalAuto = 0;
  const blocks = [];

  let header = '<header style="position:relative;text-align:center;min-height:1px;">';
  header += '<div style="font-size:1.5em;font-weight:700;line-height:1.3;">' + esc(school) + '</div>';
  if (exam) header += '<div style="margin-top:4px;line-height:1.35;">' + esc(exam) + '</div>';
  if (cls || subject) {
    header += '<div style="font-weight:600;margin-top:4px;line-height:1.35;">';
    if (cls) header += (isBijoy() ? '†kÖYx' : 'শ্রেণি') + ': ' + esc(cls);
    if (cls && subject) header += ' &nbsp;|&nbsp; ';
    if (subject) header += (isBijoy() ? 'welq' : 'বিষয়') + ': ' + esc(subject);
    header += '</div>';
  }
  if (subjectCode) {
    header += '<div style="position:absolute;top:0;right:0;line-height:1;">' + codeTableHtml(subjectCode) + '</div>';
  }
  if (qrEnabled) {
    const qrSvg = generateQRSvg(buildQRContent());
    if (qrSvg) {
      header += '<div class="qr-wrap" style="position:absolute;top:0;left:0;width:58px;height:58px;">' + qrSvg + '</div>';
    }
  }
  header += '</header>';
  blocks.push({ html: header, cls: 'block-header' });

  if (MODE === 'creative') {
    const small = parseShort($('pasteSmall').value);
    const creativeInfo = parseCreative($('pasteMain').value);
    const totalShort = small.filter(q => q.marks !== null).reduce((s, q) => s + q.marks, 0);
    const totalMain = creativeInfo.groups.reduce((s, g) => s + g.subs.reduce((ss, q) => ss + q.marks, 0), 0);
    totalAuto = totalShort + totalMain;

    if (time || fullmark) {
      const timeLbl = isBijoy() ? 'mgq' : 'সময়';
      const markLbl = isBijoy() ? 'c~Y©gvb' : 'পূর্ণমান';
      blocks.push({ html: '<div class="flex justify-between font-semibold pt-2 border-t border-black">' +
        '<span>' + timeLbl + ': ' + esc(time || '—') + '</span>' +
        '<span>' + markLbl + ': ' + esc(fullmark || num(totalAuto)) + '</span></div>', cls: 'block-meta' });
    }
    if (instruct) {
      blocks.push({ html: '<div style="font-weight:700;text-align:center;line-height:1.5;">' + escWithImgs(instruct).replace(/\n/g, '<br>') + '</div>', cls: 'block-inst' });
    }
    if (small.length) {
      blocks.push({ html: '<h2 class="font-bold text-center">' + esc(getShortHeading()) + '</h2>', cls: 'block-heading' });
      let n = 0;
      small.forEach(q => { if (!q.marker) n++; blocks.push({ html: shortQHtml(q, n), cls: 'block-q' }); });
    }
    const groups = creativeInfo.groups;
    const dividerAtGap = creativeInfo.dividerAtGap;
    if (groups.length) {
      blocks.push({ html: '<h2 class="font-bold text-center">' + esc(getCreativeHeading()) + '</h2>', cls: 'block-heading' });
      const sortedGaps = [...dividerAtGap.keys()].sort((a, b) => a - b);
      const labelOf = {};
      sortedGaps.forEach((g, i) => { labelOf[g] = sectionLabel(i); });
      const totalDividers = sortedGaps.length;
      for (let i = 0; i < groups.length; i++) {
        let prefixHtml = '';
        if (dividerAtGap.has(i)) {
          const lbl = labelOf[i] + sectionWord();
          prefixHtml = '<div class="section-divider" data-gap="' + i + '">' +
            '<span class="section-label">' + esc(lbl) + '</span>' +
            '<button class="delete-div" data-gap="' + i + '" title="×">✕</button>' +
            '</div>';
        } else if (totalDividers < MAX_SECTIONS) {
          prefixHtml = '<div class="insert-gap" data-gap="' + i + '">' +
            '<button class="insert-btn" data-gap="' + i + '">' + (isBijoy() ? 'Add Section' : 'বিভাগ') + '</button>' +
            '<button class="insert-img-btn" data-imgtarget="pasteMain" data-gap="' + i + '">ছবি</button>' +
            '<button class="insert-img-btn insert-tbl-btn" style="left:calc(50% + 100px);" onclick="event.stopPropagation(); openTableEditorNew(\'pasteMain\', ' + i + ', event);" data-gap="' + i + '">টেবিল</button>' +
            '</div>';
        }
        blocks.push({ html: prefixHtml + creativeGroupHtml(groups[i], num(i + 1) + '.'), cls: 'block-q' });
      }
    } else if ($('pasteMain').value.trim()) {
      blocks.push({ html: '<p class="text-center text-red-600 text-sm py-3">সৃজনশীল পার্স করা যায়নি — ফরম্যাট চেক করুন।</p>', cls: 'block-q' });
    }
  } else {
    const mcqs = parseMcq($('pasteMcq').value);
    totalAuto = mcqs.length;
    if (time || fullmark) {
      const timeLbl = isBijoy() ? 'mgq' : 'সময়';
      const markLbl = isBijoy() ? 'c~Y©gvb' : 'পূর্ণমান';
      blocks.push({ html: '<div class="flex justify-between font-semibold pt-2 border-t border-black">' +
        '<span>' + timeLbl + ': ' + esc(time || '—') + '</span>' +
        '<span>' + markLbl + ': ' + esc(fullmark || num(totalAuto)) + '</span></div>', cls: 'block-meta' });
    }
    if (instruct) {
      blocks.push({ html: '<div style="font-weight:700;text-align:center;line-height:1.5;">' + escWithImgs(instruct).replace(/\n/g, '<br>') + '</div>', cls: 'block-inst' });
    }
    if (mcqs.length) {
      const heading = esc(getMcqHeading()) + ' <span style="font-weight:400;font-size:0.85em">— ' + esc(num(1)) + ' × ' + esc(num(mcqs.length)) + ' = ' + esc(num(mcqs.length)) + '</span>';
      blocks.push({ html: '<h2 class="font-bold text-center">' + heading + '</h2>', cls: 'block-heading' });
      mcqs.forEach((q, i) => {
        const gapHtml = '<div class="insert-gap" data-gap="' + i + '">' +
          '<button class="insert-img-btn" data-imgtarget="pasteMcq" data-gap="' + i + '">ছবি</button>' +
          '<button class="insert-img-btn insert-tbl-btn" style="left:calc(50% + 55px);" onclick="event.stopPropagation(); openTableEditorNew(\'pasteMcq\', ' + i + ', event);" data-gap="' + i + '">টেবিল</button>' +
          '</div>';
        blocks.push({ html: gapHtml + mcqHtml(q, i + 1), cls: 'block-q' });
      });
    } else if ($('pasteMcq').value.trim()) {
      blocks.push({ html: '<p class="text-center text-red-600 text-sm py-3">নৈর্ব্যত্তিক পার্স করা যায়নি — প্রশ্নের পরে অপশন লিখুন।</p>', cls: 'block-q' });
    }
  }
  return blocks;
}

/* ==================== PAGINATION ==================== */
const CONTENT_MAX = 990;
let _renderQueued = false;
let _secondaryTimer = null;

function render() {
  if (_renderQueued) return;
  _renderQueued = true;
  requestAnimationFrame(() => { _renderQueued = false; _renderNow(); });
}
function scheduleSecondary() {
  clearTimeout(_secondaryTimer);
  _secondaryTimer = setTimeout(runSecondaryChecks, 800);
}
function runSecondaryChecks() {
  const dupEl = $('dupWarn');
  const { dupes, count } = findDuplicates();
  if (dupes.length && count > 1) {
    dupEl.classList.remove('hidden');
    dupEl.innerHTML = '⚠️ সম্ভাব্য পুনরাবৃত্তি: <b>' + dupes.length + '</b> জোড়া প্রশ্ন প্রায় একই রকম';
  } else {
    dupEl.classList.add('hidden');
  }
}
function _renderNow() {
  try {
    const fontSize = parseInt($('fontSize').value, 10) || 12;
    const ff = $('fontFamily').value || 'Nikosh';
    const familyStack = isBijoy()
      ? "'SutonnyMJ', '" + ff + "', 'Kalpurush', sans-serif"
      : "'" + ff + "', 'Kalpurush', sans-serif";
    const page1 = $('page1'), page2 = $('page2'), page2Wrapper = $('page2-wrapper');
    [page1, page2].forEach(p => { p.style.fontSize = fontSize + 'px'; p.style.fontFamily = familyStack; });

    page1.innerHTML = ''; page2.innerHTML = '';
    page2Wrapper.classList.add('hidden');
    document.body.classList.remove('has-page2');

    const blocks = buildBlocks();
    if (!blocks.length) {
      page1.innerHTML = '<p class="text-center text-gray-400 py-10">ডানদিকের ফর্ম পূরণ করুন।</p>';
    } else {
      let used = 0, currentPage = page1;
      for (const b of blocks) {
        const el = document.createElement('div');
        el.className = 'paper-block ' + (b.cls || '');
        el.innerHTML = b.html;
        currentPage.appendChild(el);
        const h = el.offsetHeight;
        if (currentPage === page1 && used + h > CONTENT_MAX) {
          page2.appendChild(el); currentPage = page2; used = h;
        } else used += h;
      }
      if (page2.children.length > 0) {
        const lastP1 = page1.lastElementChild;
        if (lastP1 && lastP1.classList.contains('block-heading'))
          page2.insertBefore(lastP1, page2.firstElementChild);
        page2Wrapper.classList.remove('hidden');
        document.body.classList.add('has-page2');
      }
    }

    numberFigureCaptions();
    scheduleSecondary();
    updatePreviewScale();

    if ('ontouchstart' in window) {
      document.querySelectorAll('.insert-gap, .section-divider').forEach(el => {
        if (el.dataset.touchBound) return;
        el.dataset.touchBound = '1';
        el.addEventListener('click', function (ev) {
          if (ev.target.closest('button')) return;
          el.classList.toggle('touch-open');
          setTimeout(() => el.classList.remove('touch-open'), 2500);
        });
      });
    }
  } catch (err) {
    console.error(err);
    $('page1').innerHTML = '<p class="text-red-600 text-sm p-4">Error: ' + err.message + '</p>';
  }
}

/* ==================== SCALE ==================== */
function updatePreviewScale() {
  const isMobile = window.innerWidth < 1024;
  document.querySelectorAll('.a4-page-wrap').forEach(w => {
    const page = w.querySelector('.a4-page');
    if (!page) return;
    if (isMobile) {
      const avail = w.parentElement.clientWidth;
      const scale = Math.min(1, avail / 794);
      w.style.width = (794 * scale) + 'px';
      w.style.height = (1123 * scale) + 'px';
      w.style.overflow = 'hidden';
      page.style.transform = 'scale(' + scale + ')';
      page.style.transformOrigin = 'top left';
    } else {
      w.style.width = ''; w.style.height = ''; w.style.overflow = '';
      page.style.transform = ''; page.style.transformOrigin = '';
    }
  });
}

/* ==================== STATE ==================== */
function collectState() {
  const state = { v: 1, mode: MODE, qr: qrEnabled, images: [...imageCache.entries()] };
  CACHE_FIELDS.forEach(k => { state[k] = $(k).value; });
  return state;
}
function restoreState(data) {
  CACHE_FIELDS.forEach(k => { if (data[k] !== undefined) $(k).value = data[k]; });
  if (data.mode) { MODE = data.mode; localStorage.setItem('qp_mode', MODE); applyMode(); }
  if (data.qr !== undefined) {
    qrEnabled = data.qr;
    localStorage.setItem('qp_qr', qrEnabled ? '1' : '0');
    updateQrBtn();
  }
  if (Array.isArray(data.images)) {
    for (const [k, v] of data.images) { imageCache.set(k, v); idbPut(k, v); }
  }
  applyTextareaFont();
  render(); scheduleCache();
}
function b64encode(str) { return btoa(unescape(encodeURIComponent(str))); }
function b64decode(str) { return decodeURIComponent(escape(atob(str))); }
function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function getSubjectFileBase() { return ($('subject').value || 'paper').replace(/\s+/g, '-'); }

/* ==================== DOC EXPORT ==================== */
function exportDoc() {
  closeExportMenu();
  const fontSize = parseInt($('fontSize').value, 10) || 12;
  const ff = $('fontFamily').value || 'Nikosh';
  const fontName = isBijoy() ? 'SutonnyMJ, ' + ff + ', Kalpurush, sans-serif' : ff + ', Kalpurush, sans-serif';
  const school = $('school').value.trim(), exam = $('exam').value.trim();
  const cls = $('class').value.trim(), subject = $('subject').value.trim();
  const subjectCode = $('subjectCode').value.trim();
  const time = $('time').value.trim(), fullmark = $('fullmark').value.trim();
  const instruct = $('instructions').value.trim();
  const P = (s, t) => '<p style="' + s + '">' + t + '</p>';
  let body = '';

  const codeHtml = subjectCode ? (() => {
    const digits = subjectCode.replace(/[^0-9০-৯]/g, '').split('');
    const label = isBijoy() ? 'welq †KvW' : 'বিষয় কোড';
    return '<table style="float:right;border-collapse:collapse;margin:0 0 4pt 8pt;" cellpadding="2" cellspacing="0">' +
      '<tr><td colspan="' + digits.length + '" style="border:1pt solid #000;text-align:center;font-weight:bold;font-size:' + (fontSize*0.75) + 'pt;">' + esc(label) + '</td></tr>' +
      '<tr>' + digits.map(d => '<td style="border:1pt solid #000;text-align:center;font-weight:bold;min-width:14pt;">' + esc(d) + '</td>').join('') + '</tr></table>';
  })() : '';

  if (qrEnabled) {
    const qrDataUrl = generateQRDataUrl(buildQRContent());
    if (qrDataUrl) {
      body += '<img src="' + qrDataUrl + '" style="float:left;width:58px;height:58px;margin:0 8pt 4pt 0;" />';
    }
  }
  if (codeHtml) body += codeHtml;
  if (school) body += P('text-align:center;font-size:' + (fontSize*1.6) + 'pt;font-weight:bold;margin:0 0 2pt;', esc(school));
  if (exam) body += P('text-align:center;font-size:' + (fontSize*1.1) + 'pt;margin:0 0 2pt;', esc(exam));
  if (cls || subject) {
    let line = '';
    if (cls) line += (isBijoy() ? '†kÖYx: ' : 'শ্রেণি: ') + esc(cls);
    if (cls && subject) line += ' &nbsp;|&nbsp; ';
    if (subject) line += (isBijoy() ? 'welq: ' : 'বিষয়: ') + esc(subject);
    body += P('text-align:center;font-weight:bold;margin:0 0 6pt;', line);
  }
  if (qrEnabled || codeHtml) body += '<div style="clear:both;"></div>';

  let totalAuto = 0;
  if (MODE === 'creative') {
    const small = parseShort($('pasteSmall').value);
    const creativeInfo = parseCreative($('pasteMain').value);
    totalAuto = small.filter(q => q.marks !== null).reduce((s, q) => s + q.marks, 0)
      + creativeInfo.groups.reduce((s, g) => s + g.subs.reduce((ss, q) => ss + q.marks, 0), 0);
  } else totalAuto = parseMcq($('pasteMcq').value).length;

  if (time || fullmark) {
    const tL = isBijoy() ? 'mgq' : 'সময়', mL = isBijoy() ? 'c~Y©gvb' : 'পূর্ণমান';
    body += '<table style="width:100%;border-top:1pt solid #000;margin-top:6pt;" cellpadding="0" cellspacing="0"><tr>' +
      '<td style="text-align:left;font-weight:bold;">' + tL + ': ' + esc(time || '—') + '</td>' +
      '<td style="text-align:right;font-weight:bold;">' + mL + ': ' + esc(fullmark || num(totalAuto)) + '</td></tr></table>';
  }
  if (instruct) body += P('text-align:center;font-weight:bold;margin:10pt 0;', escWithImgs(instruct).replace(/\n/g, '<br>'));

  if (MODE === 'creative') {
    const small = parseShort($('pasteSmall').value);
    const creativeInfo = parseCreative($('pasteMain').value);
    const groups = creativeInfo.groups;
    const dividerAtGap = creativeInfo.dividerAtGap;
    if (small.length) {
      body += P('text-align:center;font-weight:bold;margin:12pt 0 6pt;', esc(getShortHeading()));
      let n = 0;
      small.forEach(q => {
        let label; if (q.marker) label = q.marker; else { n++; label = num(n) + '.'; }
        const mark = q.marks !== null ? num(q.marks) : '';
        body += '<table style="width:100%;margin-bottom:4pt;" cellpadding="0" cellspacing="0"><tr>' +
          '<td style="width:24pt;vertical-align:top;font-weight:bold;">' + esc(label) + '</td>' +
          '<td style="vertical-align:top;">' + escWithImgs(q.text) + '</td>' +
          '<td style="width:40pt;text-align:right;vertical-align:top;font-weight:bold;">' + esc(mark) + '</td></tr></table>';
      });
    }
    if (groups.length) {
      body += P('text-align:center;font-weight:bold;margin:12pt 0 6pt;', esc(getCreativeHeading()));
      const sortedGaps = [...dividerAtGap.keys()].sort((a, b) => a - b);
      const labelOf = {};
      sortedGaps.forEach((g, i) => { labelOf[g] = sectionLabel(i); });
      for (let i = 0; i < groups.length; i++) {
        if (dividerAtGap.has(i)) body += P('text-align:center;font-weight:bold;margin:10pt 0 6pt;', esc(labelOf[i] + sectionWord()));
        const g = groups[i];
        body += '<table style="width:100%;margin-bottom:4pt;" cellpadding="0" cellspacing="0"><tr>' +
          '<td style="width:24pt;vertical-align:top;font-weight:bold;">' + esc(num(i + 1) + '.') + '</td>' +
          '<td style="vertical-align:top;">' + escWithImgs(g.stimulus) +

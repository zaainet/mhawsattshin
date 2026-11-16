let currentMode = 'grid';
let rowsCount = 3; let colsCount = 11;
let gridData = {}; 
let cellStates = {}; 
let circleData = Array(16).fill('');
let complexData = {};
let selectedCell = null;
let showVectorLines = false;
let undoStack = [], redoStack = [];

// Local Storage Loading
try {
  const g = localStorage.getItem('inn_grid_data_v4'); if(g) gridData = JSON.parse(g);
  const c = localStorage.getItem('inn_circle_data_v4'); if(c) circleData = JSON.parse(c);
  const s = localStorage.getItem('inn_cell_states_v4'); if(s) cellStates = JSON.parse(s);
} catch(e) {}

function saveState() {
  const state = {
    mode: currentMode,
    rows: rowsCount, cols: colsCount,
    gridData: JSON.parse(JSON.stringify(gridData)),
    cellStates: JSON.parse(JSON.stringify(cellStates)),
    circleData: [...circleData],
    complexData: JSON.parse(JSON.stringify(complexData)),
    showVectorLines: showVectorLines,
    innTitle: document.getElementById('exportInnTitle').innerText,
    innNote: document.getElementById('exportNoteBox').innerText
  };
  undoStack.push(state);
  if (undoStack.length > 30) undoStack.shift();
  redoStack = [];
  updateUndoRedoUI();
  persistData();
}

function persistData() {
  try {
    localStorage.setItem('inn_grid_data_v4', JSON.stringify(gridData));
    localStorage.setItem('inn_circle_data_v4', JSON.stringify(circleData));
    localStorage.setItem('inn_cell_states_v4', JSON.stringify(cellStates));
  } catch(e) {}
}

function updateUndoRedoUI() {
  document.getElementById('undoBtn').disabled = undoStack.length === 0;
  document.getElementById('redoBtn').disabled = redoStack.length === 0;
}

function undoAction() {
  if (!undoStack.length) return;
  redoStack.push(getCurrentState());
  applyState(undoStack.pop());
  updateUndoRedoUI();
}

function redoAction() {
  if (!redoStack.length) return;
  undoStack.push(getCurrentState());
  applyState(redoStack.pop());
  updateUndoRedoUI();
}

function getCurrentState() {
  return {
    mode: currentMode, rows: rowsCount, cols: colsCount,
    gridData: JSON.parse(JSON.stringify(gridData)),
    cellStates: JSON.parse(JSON.stringify(cellStates)),
    circleData: [...circleData],
    complexData: JSON.parse(JSON.stringify(complexData)),
    showVectorLines: showVectorLines,
    innTitle: document.getElementById('exportInnTitle').innerText,
    innNote: document.getElementById('exportNoteBox').innerText
  };
}

function applyState(state) {
  gridData = state.gridData; cellStates = state.cellStates || {};
  circleData = state.circleData; complexData = state.complexData || {};
  rowsCount = state.rows; colsCount = state.cols;
  showVectorLines = !!state.showVectorLines;
  if(state.innTitle) document.getElementById('exportInnTitle').innerText = state.innTitle;
  if(state.innNote) document.getElementById('exportNoteBox').innerText = state.innNote;
  document.getElementById('inputRows').value = rowsCount;
  document.getElementById('inputCols').value = colsCount;
  switchMode(state.mode, false);
  if (state.mode === 'grid') { renderGrid(); renderVectorPath(); }
  if (state.mode === 'circle') renderCircleCells();
  if (state.mode === 'complex') renderComplexShrine();
}

function switchMode(mode, triggerState = true) {
  if (triggerState) saveState();
  currentMode = mode; closeKeypad();
  document.getElementById('gridModeBtn').classList.toggle('active', mode === 'grid');
  document.getElementById('circleModeBtn').classList.toggle('active', mode === 'circle');
  document.getElementById('complexModeBtn').classList.toggle('active', mode === 'complex');
  document.getElementById('canvasModeBtn').classList.toggle('active', mode === 'canvas');

  document.getElementById('gridToolbarContainer').style.display = (mode === 'grid') ? 'block' : 'none';
  document.getElementById('canvasToolsContainer').style.display = (mode === 'canvas') ? 'grid' : 'none';

  document.getElementById('gridWrapper').style.display = (mode === 'grid') ? 'inline-block' : 'none';
  document.getElementById('circleContainer').style.display = (mode === 'circle') ? 'block' : 'none';
  document.getElementById('complexContainer').style.display = (mode === 'complex') ? 'block' : 'none';
  document.getElementById('canvasWrapper').style.display = (mode === 'canvas') ? 'block' : 'none';

  if (mode === 'grid') { renderGrid(); renderVectorPath(); }
  if (mode === 'circle') { renderCircleSVG(); renderCircleCells(); }
  if (mode === 'complex') renderComplexShrine();
  if (mode === 'canvas') initCanvas();
}

function autoFitFont(el, text) {
  const baseSize = parseInt(document.getElementById('fontSizeRange').value, 10) || 18;
  const str = text || '';
  if (str.length > 4) el.style.fontSize = Math.max(9, baseSize * 0.45) + 'px';
  else if (str.length > 2) el.style.fontSize = Math.max(11, baseSize * 0.65) + 'px';
  else el.style.fontSize = baseSize + 'px';
}

function attachEditableListeners(cell, type, identifier) {
  cell.contentEditable = "true";
  cell.setAttribute("spellcheck", "false");

  cell.addEventListener('click', function(e) {
    const mode = document.getElementById('cellToolMode').value;
    if (mode === 'circle') {
      saveState();
      this.classList.toggle('circle-marked');
      cellStates[identifier] = this.classList.contains('circle-marked') ? 'circle' : '';
      return;
    } else if (mode === 'shade') {
      saveState();
      this.classList.toggle('shaded');
      cellStates[identifier] = this.classList.contains('shaded') ? 'shaded' : '';
      return;
    }
  });

  cell.addEventListener('focus', function() {
    if (document.getElementById('cellToolMode').value !== 'edit') { this.blur(); return; }
    saveState(); selectedCell = this;
    document.getElementById('keypadModal').classList.add('show');
  });

  cell.addEventListener('input', function() {
    autoFitFont(this, this.innerText);
    if (type === 'grid') {
      const keyStr = `${rowsCount}x${colsCount}`;
      gridData[keyStr][this.dataset.index] = this.innerText;
    } else if (type === 'circle') {
      circleData[this.dataset.index] = this.innerText;
    } else if (type === 'complex') {
      complexData[this.dataset.index] = this.innerText;
    }
  });

  cell.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); this.blur(); closeKeypad(); }
  });
}

function appendValue(val) {
  if (!selectedCell) return;
  selectedCell.focus();
  // Modern insertion (document.execCommand is deprecated)
  const selection = window.getSelection();
  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    range.deleteContents();
    const textNode = document.createTextNode(val);
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  } else {
    selectedCell.textContent = (selectedCell.textContent || '') + val;
  }
  selectedCell.dispatchEvent(new Event('input'));
}

function backspaceValue() {
  if (!selectedCell) return;
  selectedCell.focus();
  const selection = window.getSelection();
  if (selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    if (range.collapsed) {
      if (range.startOffset > 0) {
        range.setStart(range.startContainer, range.startOffset - 1);
        range.deleteContents();
      } else if (selectedCell.textContent && selectedCell.textContent.length > 0) {
        selectedCell.textContent = selectedCell.textContent.slice(0, -1);
      }
    } else {
      range.deleteContents();
    }
  } else if (selectedCell.textContent) {
    selectedCell.textContent = selectedCell.textContent.slice(0, -1);
  }
  selectedCell.dispatchEvent(new Event('input'));
}
function closeKeypad() {
  if (selectedCell) selectedCell.blur();
  selectedCell = null;
  document.getElementById('keypadModal').classList.remove('show');
}

function switchKbTab(tab) {
  document.querySelectorAll('.kb-tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.kb-layout').forEach(lay => lay.classList.remove('active'));
  if (tab === 'numbers') { document.querySelectorAll('.kb-tab-btn')[0].classList.add('active'); document.getElementById('kbNumbers').classList.add('active'); }
  else if (tab === 'myanmar') { document.querySelectorAll('.kb-tab-btn')[1].classList.add('active'); document.getElementById('kbMyanmar').classList.add('active'); }
  else { document.querySelectorAll('.kb-tab-btn')[2].classList.add('active'); document.getElementById('kbComplex').classList.add('active'); }
}

const presetSizes = [
  { r: 3, c: 11, label: '၃x၁၁ (ဗျည်းအင်း)' },
  { r: 3, c: 3, label: '၃x၃' },
  { r: 4, c: 4, label: '၄x၄' },
  { r: 5, c: 5, label: '၅x၅' },
  { r: 11, c: 11, label: '၁၁x၁၁' }
];
const toolbar = document.getElementById('toolbar');
presetSizes.forEach(p => {
  const btn = document.createElement('button'); btn.innerText = p.label;
  if (p.r === rowsCount && p.c === colsCount) btn.classList.add('active');
  btn.onclick = () => {
    saveState(); rowsCount = p.r; colsCount = p.c;
    document.getElementById('inputRows').value = p.r; document.getElementById('inputCols').value = p.c;
    document.querySelectorAll('.toolbar button').forEach(b => b.classList.toggle('active', b.innerText.includes(`${p.r}x${p.c}`)));
    renderGrid(); renderVectorPath(); closeKeypad();
  };
  toolbar.appendChild(btn);
});

function applyCustomGrid() {
  const r = parseInt(document.getElementById('inputRows').value);
  const c = parseInt(document.getElementById('inputCols').value);
  if (r && c && r >= 1 && r <= 30 && c >= 1 && c <= 30) {
    saveState(); rowsCount = r; colsCount = c;
    document.querySelectorAll('.toolbar button').forEach(b => b.classList.remove('active'));
    renderGrid(); renderVectorPath(); closeKeypad();
  }
}

function renderGrid() {
  const grid = document.getElementById('gridDisplay');
  grid.innerHTML = '';
  grid.style.gridTemplateColumns = `repeat(${colsCount}, 1fr)`;
  grid.style.gridTemplateRows = `repeat(${rowsCount}, 1fr)`;
  const keyStr = `${rowsCount}x${colsCount}`;
  if (!gridData[keyStr]) gridData[keyStr] = Array(rowsCount * colsCount).fill('');

  for (let i = 0; i < rowsCount * colsCount; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    const val = gridData[keyStr][i] || '';
    cell.innerText = val;
    autoFitFont(cell, val);
    cell.dataset.index = i;
    const cellId = `grid_${keyStr}_${i}`;
    if (cellStates[cellId] === 'circle') cell.classList.add('circle-marked');
    if (cellStates[cellId] === 'shaded') cell.classList.add('shaded');

    attachEditableListeners(cell, 'grid', cellId);
    grid.appendChild(cell);
  }
}

function toggleVectorLine() {
  showVectorLines = !showVectorLines;
  const btn = document.getElementById('btnVectorLine');
  btn.style.background = showVectorLines ? 'var(--primary)' : '#555';
  renderVectorPath();
}

function renderVectorPath() {
  const svg = document.getElementById('vectorSvg');
  if (!showVectorLines || rowsCount !== 3 || colsCount !== 11) {
    svg.style.display = 'none';
    return;
  }
  svg.style.display = 'block';
  svg.innerHTML = '';
  
  const points = [];
  const colW = 100 / 11;
  const rowH = 100 / 3;
  
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 11; c++) {
      points.push({ x: c * colW + colW / 2, y: r * rowH + rowH / 2 });
    }
  }

  const order = [0, 12, 23, 2, 14, 25, 4, 16, 27, 6, 18, 29, 8, 20, 31, 10, 21, 32, 1, 13, 24, 3, 15, 26, 5, 17, 28, 7, 19, 30, 9, 22, 11];
  let pathD = `M ${points[order[0]].x} ${points[order[0]].y} `;
  for (let i = 1; i < order.length; i++) {
    pathD += `L ${points[order[i]].x} ${points[order[i]].y} `;
  }

  const pathElem = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  pathElem.setAttribute('d', pathD);
  pathElem.setAttribute('stroke', getComputedStyle(document.documentElement).getPropertyValue('--grid-border-color').trim() || '#8b0000');
  pathElem.setAttribute('stroke-width', '1.2');
  pathElem.setAttribute('fill', 'none');
  pathElem.setAttribute('opacity', '0.75');
  svg.appendChild(pathElem);
}

function renderCircleSVG() {
  const svg = document.getElementById('circleSvg');
  svg.innerHTML = '';
  const stroke = getComputedStyle(document.documentElement).getPropertyValue('--grid-border-color').trim() || '#8b0000';
  const cx = 190, cy = 190, rOuter = 170, rInner = 98;
  let markup = `<circle cx="${cx}" cy="${cy}" r="${rOuter}" stroke="${stroke}" stroke-width="2.5" fill="none" /><circle cx="${cx}" cy="${cy}" r="${rInner}" stroke="${stroke}" stroke-width="2.5" fill="none" /><line x1="${cx}" y1="${cy - rInner}" x2="${cx}" y2="${cy + rInner}" stroke="${stroke}" stroke-width="2" /><line x1="${cx - rInner}" y1="${cy}" x2="${cx + rInner}" y2="${cy}" stroke="${stroke}" stroke-width="2" />`;
  for (let i = 0; i < 12; i++) {
    let angle = (i * 30) * Math.PI / 180;
    markup += `<line x1="${cx + rInner * Math.cos(angle)}" y1="${cy + rInner * Math.sin(angle)}" x2="${cx + rOuter * Math.cos(angle)}" y2="${cy + rOuter * Math.sin(angle)}" stroke="${stroke}" stroke-width="2" />`;
  }
  svg.innerHTML = markup;
}

function renderCircleCells() {
  const container = document.getElementById('circleCellsContainer');
  container.innerHTML = '';
  const cx = 190, cy = 190;
  const innerOffsets = [{ idx: 0, x: cx - 50, y: cy - 50 }, { idx: 1, x: cx + 5, y: cy - 50 }, { idx: 2, x: cx - 50, y: cy + 5 }, { idx: 3, x: cx + 5, y: cy + 5 }];
  innerOffsets.forEach(pos => {
    const cell = document.createElement('div');
    cell.className = 'circle-cell'; cell.style.width = '45px'; cell.style.height = '45px'; cell.style.left = pos.x + 'px'; cell.style.top = pos.y + 'px';
    const val = circleData[pos.idx] || ''; cell.innerText = val; autoFitFont(cell, val); cell.dataset.index = pos.idx;
    attachEditableListeners(cell, 'circle', `circle_${pos.idx}`);
    container.appendChild(cell);
  });
  const rOuterMid = (98 + 170) / 2;
  for (let i = 0; i < 12; i++) {
    let midAngle = (i * 30 + 15) * Math.PI / 180;
    const cell = document.createElement('div');
    cell.className = 'circle-cell'; cell.style.width = '44px'; cell.style.height = '44px';
    cell.style.left = (cx + rOuterMid * Math.cos(midAngle) - 22) + 'px';
    cell.style.top = (cy + rOuterMid * Math.sin(midAngle) - 22) + 'px';
    const val = circleData[4 + i] || ''; cell.innerText = val; autoFitFont(cell, val); cell.dataset.index = 4 + i;
    attachEditableListeners(cell, 'circle', `circle_${4 + i}`);
    container.appendChild(cell);
  }
}

function renderComplexShrine(variant = 'shrine') {
  const container = document.getElementById('complexGridDisplay');
  container.innerHTML = '';
  
  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.flexDirection = 'column';
  wrap.style.alignItems = 'center';
  wrap.style.gap = '2px';
  wrap.style.border = '2px solid var(--grid-border-color)';
  wrap.style.padding = '8px';
  wrap.style.background = 'var(--cell-bg-color)';
  wrap.style.borderRadius = '8px';

  const crown = document.createElement('div');
  crown.style.fontSize = '0.9rem';
  crown.style.fontWeight = 'bold';
  crown.style.color = 'var(--primary)';
  crown.style.marginBottom = '6px';
  crown.innerText = (variant === 'shrine') ? 'ဗိမာန်တော်ကျောခုံး မဟာအင်းစံ' : 'ပြာသာဒ်/စေတီတော် မဟာအင်းစံ';
  wrap.appendChild(crown);

  const towerGrid = document.createElement('div');
  towerGrid.style.display = 'grid';
  towerGrid.style.gridTemplateColumns = 'repeat(9, 32px)';
  towerGrid.style.gap = '1px';
  towerGrid.style.background = 'var(--grid-border-color)';

  for (let r = 0; r < 18; r++) {
    for (let c = 0; c < 9; c++) {
      const isCellActive = (variant === 'shrine')
        ? (r >= 6 || (c >= 3 && c <= 5) || (r >= 2 && (c === 0 || c === 8)))
        : (r >= 10 || (c >= 3 && c <= 5) || (r >= 5 && (c >= 2 && c <= 6)));

      const block = document.createElement('div');
      block.style.width = '32px';
      block.style.height = '32px';
      if (isCellActive) {
        block.className = 'cell';
        const cellKey = `cplx_${r}_${c}`;
        block.innerText = complexData[cellKey] || '';
        block.dataset.index = cellKey;
        attachEditableListeners(block, 'complex', cellKey);
      } else {
        block.style.background = 'transparent';
      }
      towerGrid.appendChild(block);
    }
  }
  wrap.appendChild(towerGrid);
  container.appendChild(wrap);
}

// Template Picker with LocalStorage Custom Template Support
function openTemplatePicker() {
  let customTemplates = {};
  try {
    const saved = localStorage.getItem('inn_custom_templates');
    if(saved) customTemplates = JSON.parse(saved);
  } catch(e) {}

  let defaultOptions = {
    'byan_number': '၁။ ဗျည်းအင်း ဇာဂဏန်း အစဉ်လိုက် (၃x၁၁)',
    'water_kawtow': '၂။ ကတော်လေးပါးမှော်အင်း (ရေယဉ်ကတော်)',
    'north_kawtow': '၃။ မြောက်ဘက်ကတော် အင်းစံ (၃x၁၁)',
    'west_kawtow': '၄။ အနောက်ကတော် အင်းစံ (၃x၁၁)',
    'zawgyi_kawtow': '၅။ ဇော်ဂနီလေးပါးအင်း (၃x၁၁)',
    'shrine_tower': '၆။ ဗိမာန်တော်ကျောခုံး ၃ ဆင့်အင်း',
    'pagoda_stupa': '၇။ စေတီတော်/ပြာသာဒ်ပုံ ရိုးရာမဟာအင်းတော်ကြီး',
    'thambuddhe': '၈။ သမ္ဗုဒ္ဓေ ၄x၄ ရိုးရိုးအင်း',
    'datkyi': '၉။ ဓာတ်ကြီး ၄ ပါး ၃x၃ အင်း'
  };

  // Merge custom saved templates
  Object.keys(customTemplates).forEach(k => {
    defaultOptions[k] = `⭐ (သိမ်းပြီး) ${customTemplates[k].name}`;
  });

  Swal.fire({
    title: 'မဟာအင်းစံများ ရွေးချယ်ပါ',
    input: 'select',
    inputOptions: defaultOptions,
    inputPlaceholder: 'အင်းစံတစ်ခု ရွေးချယ်ပါ',
    showCancelButton: true,
    confirmButtonText: 'ဖန်တီးအသုံးချမည်',
    confirmButtonColor: '#8b0000'
  }).then((result) => {
    if (result.isConfirmed && result.value) {
      if(customTemplates[result.value]) {
        loadCustomTemplate(customTemplates[result.value]);
      } else {
        applyPresetTemplate(result.value);
      }
    }
  });
}

// Save Current Layout as Template to LocalStorage
function saveAsTemplate() {
  Swal.fire({
    title: 'Template အဖြစ် သိမ်းမည်',
    input: 'text',
    inputLabel: 'ဤအင်းစံအတွက် အမည်ပေးပါ',
    inputPlaceholder: 'ဥပမာ - ကိုယ်ပိုင် အောင်ချာအင်း',
    showCancelButton: true,
    confirmButtonText: 'သိမ်းမည်',
    confirmButtonColor: '#10b981'
  }).then((result) => {
    if (result.isConfirmed && result.value) {
      const tName = result.value.trim();
      const tKey = 'custom_' + Date.now();
      const templateObj = {
        name: tName,
        mode: currentMode,
        rows: rowsCount,
        cols: colsCount,
        gridData: JSON.parse(JSON.stringify(gridData)),
        cellStates: JSON.parse(JSON.stringify(cellStates)),
        circleData: [...circleData],
        complexData: JSON.parse(JSON.stringify(complexData)),
        showVectorLines: showVectorLines,
        innTitle: document.getElementById('exportInnTitle').innerText,
        innNote: document.getElementById('exportNoteBox').innerText
      };

      let customTemplates = {};
      try {
        const saved = localStorage.getItem('inn_custom_templates');
        if(saved) customTemplates = JSON.parse(saved);
      } catch(e) {}

      customTemplates[tKey] = templateObj;
      localStorage.setItem('inn_custom_templates', JSON.stringify(customTemplates));
      Swal.fire('အောင်မြင်သည်', 'သင်၏ Template ကို သိမ်းဆည်းပြီးပါပြီ။', 'success');
    }
  });
}

function loadCustomTemplate(tObj) {
  saveState();
  rowsCount = tObj.rows || 3;
  colsCount = tObj.cols || 11;
  document.getElementById('inputRows').value = rowsCount;
  document.getElementById('inputCols').value = colsCount;
  if(tObj.gridData) gridData = tObj.gridData;
  if(tObj.cellStates) cellStates = tObj.cellStates;
  if(tObj.circleData) circleData = tObj.circleData;
  if(tObj.complexData) complexData = tObj.complexData;
  showVectorLines = !!tObj.showVectorLines;
  if(tObj.innTitle) document.getElementById('exportInnTitle').innerText = tObj.innTitle;
  if(tObj.innNote) document.getElementById('exportNoteBox').innerText = tObj.innNote;
  switchMode(tObj.mode || 'grid', false);
}

function applyPresetTemplate(key) {
  saveState();
  document.getElementById('exportInnTitle').innerText = document.querySelector(`.swal2-select option[value="${key}"]`)?.innerText.replace(/^[က-ဟက-အ၀-၉0-9]+\.\s*/, '') || 'မဟာအင်းစံ';
  if (key === 'byan_number') {
    switchMode('grid');
    rowsCount = 3; colsCount = 11;
    document.getElementById('inputRows').value = 3; document.getElementById('inputCols').value = 11;
    gridData['3x11'] = [
      '၁', '၄', '၇', '၁၄', '၁၁', '၂၆', '၂၉', '၃၂', '၁၇', '၂၀', '၂၃',
      '၆', '၁၃', '၂', '၉', '၂၈', '၃၃', '၁၆', '၂၅', '၂၂', '၃၁', '၁၈',
      '၃', '၈', '၅', '၁၂', '၁၅', '၁၀', '၂၇', '၃၀', '၁၉', '၂၄', '၂၁'
    ];
    showVectorLines = true;
    document.getElementById('btnVectorLine').style.background = 'var(--primary)';
    renderGrid(); renderVectorPath();
  }
  else if (key === 'water_kawtow') {
    switchMode('grid');
    rowsCount = 3; colsCount = 11;
    document.getElementById('inputRows').value = 3; document.getElementById('inputCols').value = 11;
    gridData['3x11'] = [
      'တ', 'စ', 'ဖ', 'ဝ', 'ယ', 'ဇ', 'ဋ္ဋ', 'ပ', 'င', 'ခ', 'င',
      'ပ', 'လ', 'ထ', 'ဘ', 'ည', 'ဏ', 'ဟ', 'ဆ', 'ဃ', '၃', 'အ',
      'ဒ', 'ဗ', 'န', 'ရ', 'သ', 'မ', 'ဈ', 'ဌ', 'က', 'စ', 'ဂ'
    ];
    showVectorLines = false;
    renderGrid(); renderVectorPath();
  }
  else if (key === 'north_kawtow') {
    switchMode('grid');
    rowsCount = 3; colsCount = 11;
    document.getElementById('inputRows').value = 3; document.getElementById('inputCols').value = 11;
    gridData['3x11'] = [
      'ရ', 'သ', 'အ', 'ဆ', 'ဃ', 'စ', 'ဖ', 'မ', 'ည', '၃', 'တ',
      'င', 'စ', 'လ', 'ခ', 'ပ', 'ယ', 'ဈ', 'ဒ', 'ဏ', 'ဘ', 'ဋ္ဋ',
      'ဝ', 'က', 'ဟ', 'င', 'ဇ', 'ဂ', 'န', 'ဗ', 'ဌ', 'ထ', 'ပ'
    ];
    showVectorLines = false;
    renderGrid(); renderVectorPath();
  }
  else if (key === 'west_kawtow') {
    switchMode('grid');
    rowsCount = 3; colsCount = 11;
    document.getElementById('inputRows').value = 3; document.getElementById('inputCols').value = 11;
    gridData['3x11'] = [
      'ဟ', 'က', 'ဃ', 'ဋ္ဋ', 'ဇ', 'ဗ', 'ယ', 'ဝ', 'ပ', 'ထ', 'န',
      'ဂ', 'ည', 'င', 'စ', 'မ', 'သ', '၃', 'ဖ', 'စ', 'လ', 'ဏ',
      'အ', 'င', 'ခ', 'ဈ', 'ဌ', 'ဆ', 'ဘ', 'ရ', 'တ', 'ပ', 'ဒ'
    ];
    showVectorLines = false;
    renderGrid(); renderVectorPath();
  }
  else if (key === 'zawgyi_kawtow') {
    switchMode('grid');
    rowsCount = 3; colsCount = 11;
    document.getElementById('inputRows').value = 3; document.getElementById('inputCols').value = 11;
    gridData['3x11'] = [
      'လ', 'ဟ', 'က', 'ဇ', 'င', 'န', 'ဗ', 'ယ', 'ဋ္ဋ', 'ပ', 'ထ',
      'အ', 'ဆ', 'ဝ', 'ဂ', 'ဖ', 'ရ', 'ည', 'စ', 'တ', 'မ', 'ဌ',
      'သ', 'ခ', 'င', 'စ', 'ဈ', 'ဃ', 'ပ', 'ဘ', '၃', 'ဒ', 'ဏ'
    ];
    showVectorLines = false;
    renderGrid(); renderVectorPath();
  }
  else if (key === 'shrine_tower') {
    switchMode('complex');
    renderComplexShrine('shrine');
  }
  else if (key === 'pagoda_stupa') {
    switchMode('complex');
    renderComplexShrine('pagoda');
  }
  else if (key === 'thambuddhe') {
    switchMode('grid');
    rowsCount = 4; colsCount = 4;
    document.getElementById('inputRows').value = 4; document.getElementById('inputCols').value = 4;
    gridData['4x4'] = ['သ', 'ဓု', 'အ', 'သု', 'န', 'မော', 'ဗု', 'ဒ္ဓံ', 'ဇ', 'ယ', 'မံ', 'ဂ', 'လံ', 'ပု', 'တ္တံ', 'သိ'];
    showVectorLines = false;
    renderGrid(); renderVectorPath();
  }
  else if (key === 'datkyi') {
    switchMode('grid');
    rowsCount = 3; colsCount = 3;
    document.getElementById('inputRows').value = 3; document.getElementById('inputCols').value = 3;
    gridData['3x3'] = ['ပ', 'ထ', 'ဝီ', 'တေ', 'ဇော', 'အာ', 'ပေါ', 'ဝါ', 'ယော'];
    showVectorLines = false;
    renderGrid(); renderVectorPath();
  }
}

function clearCurrentMode() {
  Swal.fire({
    title: 'ရှင်းလင်းမည်လား?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#8b0000',
    confirmButtonText: 'ဖျက်မည်'
  }).then((result) => {
    if (result.isConfirmed) {
      saveState();
      if (currentMode === 'grid') {
        gridData[`${rowsCount}x${colsCount}`] = Array(rowsCount * colsCount).fill('');
        renderGrid();
      } else if (currentMode === 'circle') {
        circleData = Array(16).fill('');
        renderCircleCells();
      } else if (currentMode === 'complex') {
        complexData = {};
        renderComplexShrine();
      } else {
        initCanvas();
      }
    }
  });
}

function loadLocalFont(input) {
  const file = input.files[0]; if (!file) return;
  const fontName = 'CustomUserFont_' + Date.now();
  const reader = new FileReader();
  reader.onload = function(e) {
    const font = new FontFace(fontName, e.target.result);
    font.load().then(loadedFont => {
      document.fonts.add(loadedFont);
      document.documentElement.style.setProperty('--selected-inn-font', `'${fontName}', sans-serif`);
      const opt = document.createElement('option');
      opt.value = `'${fontName}', sans-serif`;
      opt.innerText = `တင်ထားသော Font (${file.name})`;
      opt.selected = true;
      document.getElementById('fontSelect').prepend(opt);
      Swal.fire({ toast: true, position: 'top', icon: 'success', title: 'Font တင်သွင်းပြီးပါပြီ', showConfirmButton: false, timer: 1500 });
    }).catch(() => { Swal.fire('အမှား', 'Font ဖိုင် ဖတ်မရပါ၊ စစ်ဆေးပါ။', 'error'); });
  };
  reader.readAsArrayBuffer(file);
}

/* Scoped Font Styling: Changes only the Inn cells and Title without affecting website UI */
function changeFontFamily() {
  document.documentElement.style.setProperty('--selected-inn-font', document.getElementById('fontSelect').value);
}
function changeTextColor() { document.documentElement.style.setProperty('--cell-text-color', document.getElementById('textColorSelect').value); }
function changeBorderColor() {
  const color = document.getElementById('borderColorSelect').value;
  document.documentElement.style.setProperty('--grid-border-color', color);
  if (currentMode === 'circle') renderCircleSVG();
  if (currentMode === 'grid') renderVectorPath();
  if (currentMode === 'complex') renderComplexShrine();
}
function changeFontSize(size) {
  document.documentElement.style.setProperty('--font-size', size + 'px');
  document.getElementById('fontSizeVal').innerText = size + 'px';
  if (currentMode === 'grid') renderGrid();
  if (currentMode === 'circle') renderCircleCells();
}

const canvas = document.getElementById('drawCanvas');
const ctx = canvas.getContext('2d');
let canvasTool = 'pen', isDrawing = false, startPos = null, savedImageData = null;

function initCanvas() {
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--cell-bg-color').trim() || '#faf8f5';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--grid-border-color').trim() || '#8b0000';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
}

function setCanvasTool(tool) {
  canvasTool = tool;
  ['pen','line','rect','circle','text','eraser'].forEach(t => {
    const btn = document.getElementById('tool' + t.charAt(0).toUpperCase() + t.slice(1));
    if(btn) btn.classList.toggle('active', t === tool);
  });
}

function getCanvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return {
    x: (clientX - rect.left) * (canvas.width / rect.width),
    y: (clientY - rect.top) * (canvas.height / rect.height)
  };
}

function startDrawing(e) {
  e.preventDefault();
  saveState();
  isDrawing = true;
  startPos = getCanvasPos(e);
  savedImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function moveDrawing(e) {
  if (!isDrawing) return;
  e.preventDefault();
  const pos = getCanvasPos(e);
  ctx.putImageData(savedImageData, 0, 0);
  ctx.strokeStyle = (canvasTool === 'eraser') ? '#faf8f5' : document.getElementById('textColorSelect').value;
  ctx.lineWidth = (canvasTool === 'eraser') ? 18 : 2.5;
  ctx.lineCap = 'round';
  if (canvasTool === 'pen' || canvasTool === 'eraser') {
    ctx.beginPath();
    ctx.moveTo(startPos.x, startPos.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    startPos = pos;
    savedImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  } else if (canvasTool === 'line') {
    ctx.beginPath();
    ctx.moveTo(startPos.x, startPos.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  } else if (canvasTool === 'rect') {
    ctx.beginPath();
    ctx.strokeRect(startPos.x, startPos.y, pos.x - startPos.x, pos.y - startPos.y);
  } else if (canvasTool === 'circle') {
    ctx.beginPath();
    const r = Math.sqrt(Math.pow(pos.x - startPos.x, 2) + Math.pow(pos.y - startPos.y, 2));
    ctx.arc(startPos.x, startPos.y, r, 0, 2 * Math.PI);
    ctx.stroke();
  }
}

function endDrawing() {
  isDrawing = false;
}

// Mouse events
canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', moveDrawing);
canvas.addEventListener('mouseup', endDrawing);
canvas.addEventListener('mouseleave', endDrawing);

// Touch events (Android / mobile support)
canvas.addEventListener('touchstart', startDrawing, { passive: false });
canvas.addEventListener('touchmove', moveDrawing, { passive: false });
canvas.addEventListener('touchend', endDrawing);
canvas.addEventListener('touchcancel', endDrawing);

function saveAsImage() {
  closeKeypad();
  const captureElement = document.getElementById('captureArea');
  html2canvas(captureElement, { scale: 3, backgroundColor: '#f5f2eb', useCORS: true }).then(canvasImg => {
    const link = document.createElement('a');
    link.download = `amulet-${currentMode}-${Date.now()}.png`;
    link.href = canvasImg.toDataURL('image/png');
    link.click();
  }).catch(() => { Swal.fire('အမှား', 'ပုံထုတ်ယူရာတွင် အမှားရှိခဲ့ပါသည်။', 'error'); });
}

switchMode('grid', false);

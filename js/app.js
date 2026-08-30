// app.js — UI renderer
// Calls the classify layer. No grading rules here.

// ═══════════════════════════════════════════════════════════════
// SECTION 7 — APPLICATION STATE
// ═══════════════════════════════════════════════════════════════

const PAGE_SIZE = 8;
let ALL_RESULTS  = [];
let CHECKING     = {};
let FILTER_STATE = { search: '', class: 'all', status: 'all', grade: 'all' };
let ACTIVE_TAB   = 'results';
let PAGE_STATE   = { results: 1, optional: 1, practical: 1, absence: 1 };
let CURRENT_CASE = null;
let P08_CASES    = [];

// ═══════════════════════════════════════════════════════════════
// SECTION 8 — DASHBOARD RENDERING
// ═══════════════════════════════════════════════════════════════

function renderDashboard() {
  const total  = ALL_RESULTS.length;
  const passed = ALL_RESULTS.filter(r => r.passed).length;
  const failed = total - passed;
  const avgGPA = (ALL_RESULTS.reduce((s, r) => s + r.finalGPA, 0) / total).toFixed(2);
  const review = (CHECKING.optionalReview?.length || 0)
               + (CHECKING.practicalFailure?.length || 0)
               + (CHECKING.absenceReview?.length || 0);

  document.getElementById('stat-total').textContent     = total;
  document.getElementById('stat-passed').textContent    = passed;
  document.getElementById('stat-failed').textContent    = failed;
  document.getElementById('stat-avg-gpa').textContent   = avgGPA;
  document.getElementById('stat-review').textContent    = review;
  document.getElementById('stat-pass-rate').textContent = total ? ((passed / total) * 100).toFixed(1) + '%' : '—';
  document.getElementById('stat-fail-rate').textContent = total ? ((failed / total) * 100).toFixed(1) + '%' : '—';
}

// ═══════════════════════════════════════════════════════════════
// SECTION 9 — RESULTS TABLE
// ═══════════════════════════════════════════════════════════════

function getFilteredResults() {
  const { search, class: cls, status, grade } = FILTER_STATE;
  return ALL_RESULTS.filter(r => {
    const s = r.student;
    if (search) {
      const q = search.toLowerCase();
      if (!s.name.toLowerCase().includes(q) && !s.id.toLowerCase().includes(q)) return false;
    }
    if (cls !== 'all' && s.class !== cls) return false;
    if (status !== 'all') {
      if (status === 'pass' && !r.passed) return false;
      if (status === 'fail' && r.passed)  return false;
    }
    if (grade !== 'all' && r.finalGrade !== grade) return false;
    return true;
  });
}

function pageMeta(list, page) {
  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE) || 1);
  let current = page;
  if (current > pages) current = pages;
  if (current < 1) current = 1;
  const start = (current - 1) * PAGE_SIZE;
  return {
    page: current,
    pages,
    total,
    from: total === 0 ? 0 : start + 1,
    to: Math.min(start + PAGE_SIZE, total),
    rows: list.slice(start, start + PAGE_SIZE),
  };
}

function fillerRows(count, colspan) {
  let html = '';
  for (let i = 0; i < count; i++) {
    html += `<tr class="row-filler" aria-hidden="true">${'<td></td>'.repeat(colspan)}</tr>`;
  }
  return html;
}

function fillPage(rowsHtml, rowCount, colspan, emptyMsg) {
  if (rowCount === 0) {
    return `<tr class="row-empty"><td colspan="${colspan}">${escHtml(emptyMsg)}</td></tr>` +
      fillerRows(PAGE_SIZE - 1, colspan);
  }
  return rowsHtml + fillerRows(PAGE_SIZE - rowCount, colspan);
}

function renderPager(infoId, prevId, nextId, meta) {
  const label = meta.total === 0
    ? 'Showing 0 of 0'
    : `Showing ${meta.from}–${meta.to} of ${meta.total}`;
  document.getElementById(infoId).textContent = label;
  document.getElementById(prevId).disabled = meta.page <= 1;
  document.getElementById(nextId).disabled = meta.page >= meta.pages || meta.total === 0;
}

function renderTable() {
  const filtered = getFilteredResults();
  const meta     = pageMeta(filtered, PAGE_STATE.results);
  PAGE_STATE.results = meta.page;

  const tbody = document.getElementById('results-tbody');
  const count = document.getElementById('result-count');
  count.textContent = `${filtered.length} of ${ALL_RESULTS.length} students`;

  if (meta.rows.length === 0) {
    tbody.innerHTML = fillPage('', 0, 8, 'No students match the current filters.');
    renderPager('results-page-info', 'results-page-prev', 'results-page-next', meta);
    return;
  }

  const rowsHtml = meta.rows.map(r => {
    const s          = r.student;
    const optMeta    = SUBJECT_META[s.optional] || { name: s.optional };
    const statusClass = r.passed ? 'badge-pass' : 'badge-fail';
    const statusText  = r.passed ? 'PASS' : 'FAIL';
    const gradeClass  = `grade-${r.finalGrade.replace('+', 'plus').replace('-', 'minus')}`;

    return `<tr class="${r.passed ? '' : 'row-fail'}" data-id="${s.id}">
      <td class="col-id">${s.id}</td>
      <td class="col-name">${escHtml(s.name)}</td>
      <td>${escHtml(s.class)}</td>
      <td class="col-optional">${escHtml(optMeta.name)}</td>
      <td class="col-gpa ${r.finalGPA === 0 && r.compulsoryFailed ? 'gpa-override' : ''}">
        ${r.finalGPA.toFixed(2)}
        ${r.overrideApplied ? '<span class="override-badge" title="R-13 override applied">⚠</span>' : ''}
      </td>
      <td><span class="grade-badge ${gradeClass}">${r.finalGrade}</span></td>
      <td><span class="status-badge ${statusClass}">${statusText}</span></td>
      <td>
        <button class="btn-trace" onclick="openTrace('${s.id}')">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg>
          Trace
        </button>
      </td>
    </tr>`;
  }).join('');

  tbody.innerHTML = fillPage(rowsHtml, meta.rows.length, 8, 'No students match the current filters.');
  renderPager('results-page-info', 'results-page-prev', 'results-page-next', meta);
}

// ═══════════════════════════════════════════════════════════════
// SECTION 10 — STUDENT TRACE MODAL
// ═══════════════════════════════════════════════════════════════

function openTrace(studentId) {
  const r = ALL_RESULTS.find(r => r.student.id === studentId);
  if (!r) return;
  renderStudentTrace(r);
  document.getElementById('trace-modal').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeTrace() {
  document.getElementById('trace-modal').classList.remove('open');
  document.body.style.overflow = '';
}

function renderStudentTrace(r) {
  const s    = r.student;
  const wrap = document.getElementById('trace-content');

  const infoHtml = `
    <div class="trace-header-info">
      <div class="trace-student-id">${escHtml(s.id)}</div>
      <div class="trace-student-name">${escHtml(s.name)}</div>
      <div class="trace-meta">
        <span>${escHtml(s.class)}</span>
        <span>Optional: ${escHtml((SUBJECT_META[s.optional] || { name: s.optional }).name)}</span>
        <span class="trace-final-grade ${r.passed ? '' : 'fail-grade'}">
          Final: ${r.finalGrade} — GPA ${r.finalGPA.toFixed(2)}
        </span>
      </div>
    </div>`;

  const subjRows = COMPULSORY_CODES.map(code => renderSubjectRow(r.subjectResults[code], false)).join('');
  const optRow   = renderSubjectRow(r.optResult, true);

  const overrideBlock = r.overrideApplied ? `
    <div class="trace-override-box">
      <div class="override-header">⚠ R-13 — Compulsory Failure Override</div>
      <div class="override-body">
        <div>Uncancelled GPA: <strong>${r.uncancelledGPA.toFixed(2)}</strong></div>
        <div>Compulsory subject failure detected → GPA set to 0.00</div>
        <div>Final Grade overridden to <strong>F</strong></div>
        ${r.failedSubjects.map(fs => `
          <div class="override-subject">⚠ ${escHtml(fs.name)}: ${escHtml(fs.failReason || 'FAIL')}</div>
        `).join('')}
      </div>
    </div>` : '';

  const gpaSummary = `
    <div class="trace-gpa-summary">
      <div class="gpa-row"><span>Compulsory GP Sum</span><strong>${r.compulsoryGPSum.toFixed(2)} / 30.00</strong></div>
      <div class="gpa-row"><span>Optional GP</span><strong>${r.optResult.gradePoint.toFixed(2)}</strong></div>
      <div class="gpa-row"><span>Optional Bonus <small>(max(0, GP−2))</small></span><strong>${r.optBonus.toFixed(2)}</strong></div>
      <div class="gpa-row"><span>Uncancelled GPA <small>((sum + bonus) / 6)</small></span><strong>${r.uncancelledGPA.toFixed(2)}</strong></div>
      ${overrideBlock}
      <div class="gpa-row gpa-final ${r.passed ? '' : 'final-fail'}">
        <span>Final GPA</span><strong>${r.finalGPA.toFixed(2)}</strong>
      </div>
      <div class="gpa-row gpa-final ${r.passed ? '' : 'final-fail'}">
        <span>Final Grade</span><strong>${r.finalGrade}</strong>
      </div>
    </div>`;

  wrap.innerHTML = infoHtml + `
    <div class="trace-section-title">Subject Results</div>
    <div class="trace-subjects">
      ${subjRows}
      <div class="trace-section-divider">Optional Subject</div>
      ${optRow}
    </div>
    <div class="trace-section-title">GPA Calculation</div>
    ${gpaSummary}
  `;
}

function renderSubjectRow(sr, isOptional) {
  const statusClass  = sr.status === 'PASS' ? 'subj-pass' : 'subj-fail';
  const hasPractical = sr.isPractical;
  const absent       = sr.absent;

  let marksHtml = '';
  if (absent) {
    marksHtml = `<div class="subj-mark absent-mark">AB</div>`;
  } else if (hasPractical) {
    const tPass = sr.theory    >= 25 ? 'mark-pass' : 'mark-fail';
    const pPass = sr.practical >= 8  ? 'mark-pass' : 'mark-fail';
    marksHtml = `
      <div class="subj-marks-grid">
        <span class="mark-label">Theory</span>
        <span class="mark-value ${tPass}">${sr.theory}<small>/75</small></span>
        <span class="mark-label">Practical</span>
        <span class="mark-value ${pPass}">${sr.practical}<small>/25</small></span>
        <span class="mark-label">Total</span>
        <span class="mark-value">${sr.total}<small>/100</small></span>
      </div>`;
  } else {
    marksHtml = `<div class="subj-mark">${sr.theory}<small>/100</small></div>`;
  }

  const rulesHtml = sr.rulesFired.length > 0
    ? `<div class="subj-rules">${sr.rulesFired.map(r => `<span class="rule-tag">${r.replace('R-11-theory', 'R-11').replace('R-11-practical', 'R-11')}</span>`).join('')}</div>`
    : '';

  const failBox = (sr.status === 'FAIL' || sr.absent) && sr.failReason
    ? `<div class="subj-fail-reason">⚠ ${escHtml(sr.failReason)}</div>`
    : '';

  return `
    <div class="subj-row ${statusClass}">
      <div class="subj-name">
        ${escHtml(sr.name)}
        ${isOptional ? '<span class="opt-label">OPT</span>' : ''}
      </div>
      <div class="subj-details">
        ${marksHtml}
        <div class="subj-gp">GP: <strong>${sr.gradePoint.toFixed(2)}</strong> <span class="subj-letter">${sr.letterGrade}</span></div>
        ${rulesHtml}
        ${failBox}
      </div>
    </div>`;
}

// ═══════════════════════════════════════════════════════════════
// SECTION 11 — CHECKING LISTS
// ═══════════════════════════════════════════════════════════════

function renderCheckingLists() {
  renderOptionalList();
  renderPracticalList();
  renderAbsenceList();

  document.getElementById('tab-opt-count').textContent  = CHECKING.optionalReview.length;
  document.getElementById('tab-prac-count').textContent = CHECKING.practicalFailure.length;
  document.getElementById('tab-abs-count').textContent  = CHECKING.absenceReview.length;
}

function renderOptionalList() {
  const list  = CHECKING.optionalReview || [];
  const meta  = pageMeta(list, PAGE_STATE.optional);
  PAGE_STATE.optional = meta.page;
  const tbody = document.getElementById('optional-tbody');

  const rowsHtml = meta.rows.map(e => `
        <tr>
          <td>${escHtml(e.id)}</td>
          <td>${escHtml(e.name)}</td>
          <td>${escHtml(e.class)}</td>
          <td>${escHtml(e.optional)}</td>
          <td class="${e.optGP === 'AB' ? 'absent-mark' : ''}">${escHtml(String(e.optGP))}</td>
          <td class="reason-col">${escHtml(e.reason)}</td>
        </tr>`).join('');

  tbody.innerHTML = fillPage(rowsHtml, meta.rows.length, 6, 'No students require optional review.');
  renderPager('optional-page-info', 'optional-page-prev', 'optional-page-next', meta);
}

function renderPracticalList() {
  const list  = CHECKING.practicalFailure || [];
  const meta  = pageMeta(list, PAGE_STATE.practical);
  PAGE_STATE.practical = meta.page;
  const tbody = document.getElementById('practical-tbody');

  const rowsHtml = meta.rows.map(e => `
        <tr>
          <td>${escHtml(e.id)}</td>
          <td>${escHtml(e.name)}</td>
          <td>${escHtml(e.class)}</td>
          <td>${escHtml(e.subject)}</td>
          <td class="${e.theory < 25 ? 'mark-fail' : ''}">${e.theory}/75</td>
          <td class="${e.practical < 8 ? 'mark-fail' : ''}">${e.practical}/25</td>
          <td class="reason-col">${escHtml(e.reason)}</td>
        </tr>`).join('');

  tbody.innerHTML = fillPage(rowsHtml, meta.rows.length, 7, 'No practical failures detected.');
  renderPager('practical-page-info', 'practical-page-prev', 'practical-page-next', meta);
}

function renderAbsenceList() {
  const list  = CHECKING.absenceReview || [];
  const meta  = pageMeta(list, PAGE_STATE.absence);
  PAGE_STATE.absence = meta.page;
  const tbody = document.getElementById('absence-tbody');

  const rowsHtml = meta.rows.map(e => `
        <tr>
          <td>${escHtml(e.id)}</td>
          <td>${escHtml(e.name)}</td>
          <td>${escHtml(e.class)}</td>
          <td>${escHtml(e.subject)}</td>
          <td><span class="type-badge type-${e.type.toLowerCase()}">${escHtml(e.type)}</span></td>
          <td>${escHtml(e.status)}</td>
        </tr>`).join('');

  tbody.innerHTML = fillPage(rowsHtml, meta.rows.length, 6, 'No absences recorded.');
  renderPager('absence-page-info', 'absence-page-prev', 'absence-page-next', meta);
}

// ═══════════════════════════════════════════════════════════════
// SECTION 12 — TAB NAVIGATION
// ═══════════════════════════════════════════════════════════════

function switchMainTab(tab) {
  ACTIVE_TAB = tab;
  document.querySelectorAll('.main-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `panel-${tab}`));
}

function switchCheckTab(tab) {
  document.querySelectorAll('.check-tab').forEach(t => t.classList.toggle('active', t.dataset.check === tab));
  document.querySelectorAll('.check-panel').forEach(p => p.classList.toggle('active', p.id === `check-${tab}`));
}

// ═══════════════════════════════════════════════════════════════
// SECTION 13 — UTILITIES
// ═══════════════════════════════════════════════════════════════

function escHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}

function populateClassFilter(students) {
  const select = document.getElementById('filter-class');
  const classes = [...new Set(students.map(s => s.class))].sort();
  const current = FILTER_STATE.class;
  select.innerHTML = `<option value="all">All Classes</option>` +
    classes.map(c => `<option value="${escHtml(c)}">${escHtml(c)}</option>`).join('');
  if (current !== 'all' && classes.includes(current)) select.value = current;
  else {
    FILTER_STATE.class = 'all';
    select.value = 'all';
  }
}

function findCase(id) {
  return P08_CASES.find(c => c.case_id === id) || null;
}

function applyCase(caseObj) {
  if (!caseObj) return;
  CURRENT_CASE = caseObj;
  setCaseContext(caseObj);

  const dataErrors = validateDataset(caseObj.students);
  if (dataErrors.length > 0) {
    document.getElementById('app').innerHTML = `
      <div class="validation-error">
        <h2>Dataset Validation Failed</h2>
        <ul>${dataErrors.map(e => `<li>${escHtml(e)}</li>`).join('')}</ul>
      </div>`;
    return;
  }

  ALL_RESULTS = caseObj.students.map(calculateStudentResult);

  const resultErrors = validateResults(ALL_RESULTS);
  if (resultErrors.length > 0) {
    document.getElementById('app').innerHTML = `
      <div class="validation-error">
        <h2>Result Validation Failed</h2>
        <ul>${resultErrors.map(e => `<li>${escHtml(e)}</li>`).join('')}</ul>
      </div>`;
    return;
  }

  CHECKING = generateCheckingLists(ALL_RESULTS);
  FILTER_STATE = { search: '', class: 'all', status: 'all', grade: 'all' };
  PAGE_STATE   = { results: 1, optional: 1, practical: 1, absence: 1 };

  const search = document.getElementById('search-box');
  const status = document.getElementById('filter-status');
  const grade  = document.getElementById('filter-grade');
  if (search) search.value = '';
  if (status) status.value = 'all';
  if (grade)  grade.value  = 'all';

  populateClassFilter(caseObj.students);

  renderDashboard();
  renderTable();
  renderCheckingLists();
}

function loadPublishedFixture() {
  const data = window.P08_DATA;
  if (!data || !Array.isArray(data.cases) || data.cases.length === 0) {
    throw new Error('Published fixture is missing. Check js/cases.js (from P08_school_results_public.json).');
  }
  return data;
}

function showLoadError(err) {
  document.getElementById('app').innerHTML = `
    <div class="validation-error">
      <h2>Could not load published cases</h2>
      <p>${escHtml(err.message || String(err))}</p>
    </div>`;
}

function init() {
  document.getElementById('search-box').addEventListener('input', e => {
    FILTER_STATE.search = e.target.value.trim();
    PAGE_STATE.results = 1;
    renderTable();
  });
  document.getElementById('filter-class').addEventListener('change', e => {
    FILTER_STATE.class = e.target.value;
    PAGE_STATE.results = 1;
    renderTable();
  });
  document.getElementById('filter-status').addEventListener('change', e => {
    FILTER_STATE.status = e.target.value;
    PAGE_STATE.results = 1;
    renderTable();
  });
  document.getElementById('filter-grade').addEventListener('change', e => {
    FILTER_STATE.grade = e.target.value;
    PAGE_STATE.results = 1;
    renderTable();
  });
  document.getElementById('clear-filters').addEventListener('click', () => {
    FILTER_STATE = { search: '', class: 'all', status: 'all', grade: 'all' };
    PAGE_STATE.results = 1;
    document.getElementById('search-box').value    = '';
    document.getElementById('filter-class').value  = 'all';
    document.getElementById('filter-status').value = 'all';
    document.getElementById('filter-grade').value  = 'all';
    renderTable();
  });

  function bindPager(prevId, nextId, key, render) {
    document.getElementById(prevId).addEventListener('click', () => {
      if (PAGE_STATE[key] > 1) {
        PAGE_STATE[key] -= 1;
        render();
      }
    });
    document.getElementById(nextId).addEventListener('click', () => {
      PAGE_STATE[key] += 1;
      render();
    });
  }
  bindPager('results-page-prev', 'results-page-next', 'results', renderTable);
  bindPager('optional-page-prev', 'optional-page-next', 'optional', renderOptionalList);
  bindPager('practical-page-prev', 'practical-page-next', 'practical', renderPracticalList);
  bindPager('absence-page-prev', 'absence-page-next', 'absence', renderAbsenceList);

  document.getElementById('modal-close').addEventListener('click', closeTrace);
  document.getElementById('trace-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('trace-modal')) closeTrace();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeTrace();
  });

  document.querySelectorAll('.main-tab').forEach(btn => {
    btn.addEventListener('click', () => switchMainTab(btn.dataset.tab));
  });

  document.querySelectorAll('.check-tab').forEach(btn => {
    btn.addEventListener('click', () => switchCheckTab(btn.dataset.check));
  });

  window.applyCase = applyCase;

  try {
    const data = loadPublishedFixture();
    P08_CASES = data.cases;
    const requested = new URLSearchParams(location.search).get('case');
    applyCase(findCase(requested) || P08_CASES[0]);
  } catch (err) {
    showLoadError(err);
  }
}

document.addEventListener('DOMContentLoaded', init);
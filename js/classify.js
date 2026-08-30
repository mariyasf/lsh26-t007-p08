// classify.js — GPA / grade-point engine
// All grading rules implemented here. No hardcoded GPAs.
// Reads the published student shape: student.marks[code].

'use strict';

let SUBJECT_META = {};
let COMPULSORY_CODES = ['BAN', 'ENG', 'MAT', 'PHY', 'CHE', 'BIO'];

function setCaseContext(caseObj) {
  SUBJECT_META = {};
  (caseObj.subjects || []).forEach(s => {
    SUBJECT_META[s.code] = { name: s.name, practical: !!s.practical };
  });
  COMPULSORY_CODES = (caseObj.compulsory && caseObj.compulsory.length)
    ? caseObj.compulsory.slice()
    : ['BAN', 'ENG', 'MAT', 'PHY', 'CHE', 'BIO'];
}

function subjectMark(student, code) {
  if (student.marks) return student.marks[code];
  if (code === student.optional) return student.optional_marks;
  return student.subjects ? student.subjects[code] : undefined;
}

function getGradePoint(mark) {
  if (mark === 'AB' || mark === null || mark === undefined) return 0;
  const n = Number(mark);
  if (isNaN(n)) return 0;
  if (n >= 80) return 5.00;
  if (n >= 70) return 4.00;
  if (n >= 60) return 3.50;
  if (n >= 50) return 3.00;
  if (n >= 40) return 2.00;
  if (n >= 33) return 1.00;
  return 0.00;
}

function getLetterGrade(gpa) {
  if (gpa >= 5.00) return 'A+';
  if (gpa >= 4.00) return 'A';
  if (gpa >= 3.50) return 'A-';
  if (gpa >= 3.00) return 'B';
  if (gpa >= 2.00) return 'C';
  if (gpa >= 1.00) return 'D';
  return 'F';
}

function calculateSubject(code, marks) {
  const meta = SUBJECT_META[code] || { name: code, practical: false };
  const isPractical = meta.practical;
  const result = {
    code,
    name: meta.name,
    isPractical,
    theory: null,
    practical: null,
    total: null,
    gradePoint: 0,
    letterGrade: 'F',
    status: 'PASS',
    absent: false,
    rulesFired: [],
    failReason: null,
  };

  // R-12 — Absence
  if (marks === 'AB' || (isPractical && typeof marks === 'object' && (marks.theory === 'AB' || marks.practical === 'AB'))) {
    result.absent = true;
    result.status = 'FAIL';
    result.gradePoint = 0;
    result.letterGrade = 'F';
    result.rulesFired.push('R-12');
    result.failReason = 'R-12 — Absent';
    if (isPractical && typeof marks === 'object') {
      result.theory = marks.theory;
      result.practical = marks.practical;
    } else {
      result.theory = 'AB';
    }
    return result;
  }

  if (isPractical) {
    const theory    = Number(marks.theory);
    const practical = Number(marks.practical);
    result.theory    = theory;
    result.practical = practical;
    result.total     = theory + practical;

    const theoryFail    = theory    < 25;
    const practicalFail = practical < 8;

    if (theoryFail || practicalFail) {
      result.status      = 'FAIL';
      result.gradePoint  = 0;
      result.letterGrade = 'F';

      if (theoryFail)    result.rulesFired.push('R-11-theory');
      if (practicalFail) result.rulesFired.push('R-11-practical');

      if (theoryFail && practicalFail) {
        result.failReason = 'R-11 — Theory below 25 AND Practical below 8';
      } else if (theoryFail) {
        result.failReason = `R-11 — Theory ${theory}/75 below minimum 25`;
      } else {
        result.failReason = `R-11 — Practical ${practical}/25 below minimum 8`;
      }
    } else {
      result.gradePoint  = getGradePoint(result.total);
      result.letterGrade = getLetterGrade(result.gradePoint);
      result.status      = result.gradePoint === 0 ? 'FAIL' : 'PASS';
    }
  } else {
    const mark = Number(marks);
    result.theory    = mark;
    result.total     = mark;
    result.gradePoint  = getGradePoint(mark);
    result.letterGrade = getLetterGrade(result.gradePoint);
    result.status      = result.gradePoint === 0 ? 'FAIL' : 'PASS';
    if (result.status === 'FAIL') {
      result.failReason = `Mark ${mark} below 33`;
    }
  }

  return result;
}

function calculateOptional(code, marks) {
  const meta = SUBJECT_META[code] || { name: code, practical: false };

  if (marks === 'AB') {
    return {
      code, name: meta.name, isPractical: meta.practical,
      theory: 'AB', practical: null, total: null,
      gradePoint: 0, letterGrade: 'F',
      status: 'AB', absent: true,
      bonus: 0,
      rulesFired: ['R-12'],
      failReason: 'R-12 — Absent (optional)',
    };
  }

  const subjectResult = calculateSubject(code, marks);
  subjectResult.bonus = Math.max(0, subjectResult.gradePoint - 2);
  return subjectResult;
}

function calculateStudentResult(student) {
  const subjectResults = {};
  let compulsoryGPSum  = 0;
  let compulsoryFailed = false;
  const failedSubjects = [];

  for (const code of COMPULSORY_CODES) {
    const marks  = subjectMark(student, code);
    const result = calculateSubject(code, marks);
    subjectResults[code] = result;
    compulsoryGPSum += result.gradePoint;

    if (result.status === 'FAIL' || result.absent) {
      compulsoryFailed = true;
      failedSubjects.push(result);
    }
  }

  const optCode   = student.optional;
  const optMarks  = subjectMark(student, optCode);
  const optResult = calculateOptional(optCode, optMarks);

  const optBonus       = optResult.bonus ?? 0;
  const rawGPA         = (compulsoryGPSum + optBonus) / 6;
  const uncancelledGPA = Math.min(5.00, rawGPA);

  let finalGPA;
  let finalGrade;
  let overrideApplied = false;

  if (compulsoryFailed) {
    finalGPA        = 0.00;
    finalGrade      = 'F';
    overrideApplied = true;
  } else {
    finalGPA   = uncancelledGPA;
    finalGrade = getLetterGrade(finalGPA);
  }

  return {
    student,
    subjectResults,
    optResult,
    compulsoryGPSum,
    optBonus,
    uncancelledGPA,
    finalGPA,
    finalGrade,
    compulsoryFailed,
    overrideApplied,
    failedSubjects,
    passed: !compulsoryFailed && finalGPA >= 1.00,
  };
}

function generateCheckingLists(results) {
  const optionalReview   = [];
  const practicalFailure = [];
  const absenceReview    = [];

  for (const r of results) {
    const s = r.student;

    if (r.optResult.absent || r.optResult.gradePoint <= 2.0) {
      optionalReview.push({
        id:       s.id,
        name:     s.name,
        class:    s.class,
        optional: r.optResult.name,
        optGP:    r.optResult.absent ? 'AB' : r.optResult.gradePoint.toFixed(2),
        reason:   r.optResult.absent ? 'Absent in optional subject' : `Optional GP ${r.optResult.gradePoint.toFixed(2)} ≤ 2.00 — no bonus`,
      });
    }

    const allParts = COMPULSORY_CODES.map(code => r.subjectResults[code]).concat([r.optResult]);
    for (const sr of allParts) {
      if (!sr) continue;
      // R-29 — practical fail list: practical part below 8 in any subject
      if (sr.isPractical && !sr.absent && sr.practical != null && Number(sr.practical) < 8) {
        practicalFailure.push({
          id:        s.id,
          name:      s.name,
          class:     s.class,
          subject:   sr.code === s.optional ? sr.name + ' (optional)' : sr.name,
          theory:    sr.theory,
          practical: sr.practical,
          reason:    sr.failReason || `Practical ${sr.practical}/25 below minimum 8`,
        });
      }
    }

    for (const code of COMPULSORY_CODES) {
      const sr = r.subjectResults[code];
      if (sr.absent) {
        absenceReview.push({
          id:      s.id,
          name:    s.name,
          class:   s.class,
          subject: sr.name,
          type:    'Compulsory',
          status:  'Result: F',
        });
      }
    }
    if (r.optResult.absent) {
      absenceReview.push({
        id:      s.id,
        name:    s.name,
        class:   s.class,
        subject: r.optResult.name + ' (optional)',
        type:    'Optional',
        status:  'Bonus: 0',
      });
    }
  }

  return { optionalReview, practicalFailure, absenceReview };
}

function validateDataset(students) {
  const errors = [];

  if (students.length < 60) errors.push(`Only ${students.length} students — minimum 60 required.`);

  const classes = new Set(students.map(s => s.class));
  if (classes.size !== 2) errors.push(`${classes.size} classes found — exactly 2 required.`);

  for (const s of students) {
    const marks = s.marks || {};
    const markKeys = Object.keys(marks);

    if (!s.optional) errors.push(`Student ${s.id} has no optional subject.`);

    for (const code of COMPULSORY_CODES) {
      if (!(code in marks) && !(s.subjects && code in s.subjects)) {
        errors.push(`Student ${s.id} missing compulsory ${code}.`);
      }
    }
    if (s.optional && !(s.optional in marks) && s.optional_marks == null && s.optional_marks !== 'AB') {
      errors.push(`Student ${s.id} missing optional marks for ${s.optional}.`);
    }

    if (markKeys.length && markKeys.length !== 7) {
      errors.push(`Student ${s.id} has ${markKeys.length} marks (need 7).`);
    }

    const codesToCheck = markKeys.length ? markKeys : [...COMPULSORY_CODES, s.optional].filter(Boolean);
    for (const code of codesToCheck) {
      const meta  = SUBJECT_META[code];
      const value = subjectMark(s, code);
      if (!meta || value === 'AB') continue;
      if (meta.practical) {
        const { theory, practical } = value;
        if (theory < 0 || theory > 75)      errors.push(`${s.id} ${code} theory ${theory} out of range.`);
        if (practical < 0 || practical > 25) errors.push(`${s.id} ${code} practical ${practical} out of range.`);
      } else {
        const n = Number(value);
        if (n < 0 || n > 100) errors.push(`${s.id} ${code} mark ${n} out of range.`);
      }
    }
  }

  return errors;
}

function validateResults(results) {
  const errors = [];
  for (const r of results) {
    if (r.compulsoryFailed && r.finalGPA !== 0.00) {
      errors.push(`${r.student.id}: compulsory failure but finalGPA=${r.finalGPA}`);
    }
  }
  return errors;
}

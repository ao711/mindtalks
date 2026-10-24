(function () {
  'use strict';
  var LANGS = ['ar', 'en', 'it', 'fr', 'es', 'de'];
  var TASKS = ['breath', 'loose', 'walk', 'visual', 'count', 'defuse', 'talk'];
  var PROGRAM_DAYS = 196;
  var LIBS = {
    xlsx: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    pdf: 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js'
  };

  // ---------- helpers ----------
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var keyOf = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  var parseK = function (k) { var p = k.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
  var diffDays = function (a, b) { return Math.round((parseK(b) - parseK(a)) / 864e5); };
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function load(k) { try { return JSON.parse(lsGet('dt:' + k)) || {}; } catch (e) { return {}; } }
  function save(k, v) { lsSet('dt:' + k, JSON.stringify(v)); }
  var $ = function (id) { return document.getElementById(id); };

  var lang = LANGS.indexOf(lsGet('mt:lang')) >= 0 ? lsGet('mt:lang') : 'ar';
  var T = I18N[lang];
  var now = new Date();
  var TODAY = keyOf(now);
  var st = load(TODAY); st.done = st.done || {};
  var period = 28;

  function fmt(k, o) { return new Intl.DateTimeFormat(T.locale, o).format(parseK(k)); }
  var fmtLong = function (k) { return fmt(k, { weekday: 'long', day: 'numeric', month: 'long' }); };
  var fmtDate = function (k) { return fmt(k, { day: 'numeric', month: 'long', year: 'numeric' }); };
  var fmtShort = function (k) { return fmt(k, { weekday: 'short', day: 'numeric', month: 'short' }); };
  var f1 = function (v) { return v == null ? '–' : String(Math.round(v * 10) / 10); };
  var avg = function (a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : null; };

  function isActive(s) { return !!((s.done && TASKS.some(function (t) { return s.done[t]; })) || s.breathSec || s.dizzy != null || s.anx != null || s.thought); }
  function dayData(k) { return k === TODAY ? st : load(k); }
  function allDays() {
    var out = [];
    try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf('dt:') === 0) out.push(k.slice(3)); } } catch (e) {}
    if (out.indexOf(TODAY) < 0) out.push(TODAY);
    return out.filter(function (k) { return /^\d{4}-\d{2}-\d{2}$/.test(k); }).sort().reverse();
  }
  function startKey() { var ks = allDays().filter(function (k) { return isActive(dayData(k)); }).sort(); return ks[0] || TODAY; }

  // ---------- render ----------
  function task(k, title, desc, muted) {
    return '<label class="task" for="t-' + k + '"><input type="checkbox" id="t-' + k + '" data-k="' + k + '"><span class="t"><b>' + title + '</b>' +
      (desc ? '<span' + (muted ? ' class="muted"' : '') + '>' + desc + '</span>' : '') + '</span></label>';
  }
  function slotHead(when, title, mins) {
    return '<div class="slot-head"><div>' + (when ? '<span class="when">' + when + '</span>' : '') + '<h2>' + title + '</h2></div>' + (mins ? '<span class="mins">' + mins + '</span>' : '') + '</div>';
  }

  function render() {
    T = I18N[lang];
    document.documentElement.lang = lang;
    document.documentElement.dir = T.dir;
    var langOpts = LANGS.map(function (l) { return '<option value="' + l + '"' + (l === lang ? ' selected' : '') + '>' + I18N[l].native + '</option>'; }).join('');
    $('app').innerHTML =
      '<header>' +
        '<div class="toprow"><h1>' + T.appTitle + '</h1><label class="langpick"><span class="sr">' + T.lang + '</span><select id="lang" aria-label="' + T.lang + '">' + langOpts + '</select></label></div>' +
        '<p class="muted">' + T.today(fmtLong(TODAY)) + '</p>' +
        '<div class="horizon" aria-hidden="true"></div>' +
        '<div class="week" id="week"></div>' +
        '<p class="muted">' + T.weekIntro + '</p>' +
      '</header>' +

      '<section class="slot">' + slotHead(T.morning, T.breathTitle, T.min(5)) +
        '<p>' + T.breathDesc + '</p>' +
        '<div class="pacer"><div class="ring"><div class="ball" id="ball"></div><div class="phase" id="phase">' + T.ready + '<small>&nbsp;</small></div></div>' +
        '<div class="timer" id="ptimer">5:00</div><div class="timer" id="pToday"></div>' +
        '<div class="row"><button id="pStart">' + T.start + '</button><button class="ghost" id="pStop">' + T.stop + '</button></div></div>' +
        task('breath', T.breathTask, T.breathHint, true) +
      '</section>' +

      '<section class="slot">' + slotHead(T.midday, T.pppdTitle, T.min(7)) +
        '<p class="muted">' + T.pppdIntro + '</p>' +
        task('loose', T.looseT, T.looseD) + task('walk', T.walkT, T.walkD) + task('visual', T.visualT, T.visualD) +
        '<div class="script">' + T.pppdScript + '</div>' +
      '</section>' +

      '<section class="slot">' + slotHead(T.evening, T.mindTitle, T.min(7)) +
        '<h3>' + T.countTitle + '</h3>' +
        '<div class="row"><span class="big" id="cdStart"></span><button class="ghost" id="cdNew">' + T.newNumber + '</button><button class="ghost" id="cdShow">' + T.showAnswers + '</button></div>' +
        '<p class="seq" id="cdSeq" hidden></p>' +
        task('count', T.countTask, T.countHint, true) +
        '<h3>' + T.defuseTitle + '</h3><p>' + T.defuseIntro + '</p>' +
        '<ol>' + T.defuseSteps.map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ol>' +
        '<p class="muted">' + T.defuseNote + '</p>' +
        '<textarea id="thought" placeholder="' + esc(T.defusePh) + '"></textarea>' +
        task('defuse', T.defuseTask) +
        '<h3>' + T.talkTitle + '</h3><p class="muted">' + T.talkIntro + '</p>' +
        T.talkScripts.map(function (s) { return '<div class="script">' + s + '</div>'; }).join('') +
        task('talk', T.talkTask) +
      '</section>' +

      '<section class="slot">' + slotHead('', T.ratingTitle, T.min(1)) +
        '<div class="rate"><label for="rDizzy">' + T.dizzyLabel + ' <output id="oDizzy">–</output></label><input type="range" id="rDizzy" min="0" max="10" step="1"></div>' +
        '<div class="rate"><label for="rAnx">' + T.anxLabel + ' <output id="oAnx">–</output></label><input type="range" id="rAnx" min="0" max="10" step="1"></div>' +
        '<p class="muted">' + T.ratingNote + '</p>' +
      '</section>' +

      '<section class="slot"><div class="slot-head"><h2>' + T.logTitle + '</h2><button class="ghost" id="copyLog">' + T.copyLog + '</button></div>' +
        '<p class="muted">' + T.logIntro + '</p><div class="log" id="log"></div></section>' +

      '<section class="slot" id="report"><div class="slot-head"><div><span class="when" id="progLabel"></span><h2>' + T.reportTitle + '</h2></div></div>' +
        '<p class="muted">' + T.reportIntro + '</p>' +
        '<div class="seg" role="group">' + [28, 84, 0].map(function (p, i) { return '<button class="ghost' + (p === period ? ' on' : '') + '" data-p="' + p + '">' + T.periods[i] + '</button>'; }).join('') + '</div>' +
        '<div class="sum" id="sum"></div>' +
        '<div class="tbl-wrap"><table class="wk" id="wk"></table></div>' +
        '<div class="row"><button id="rExport">' + T.exportBtn + '</button><button class="ghost" id="rCopy">' + T.copyReport + '</button></div>' +
        '<p class="muted" id="rMsg" aria-live="polite"></p>' +
        '<details><summary>' + T.backupTitle + '</summary><p class="muted">' + T.backupIntro + '</p>' +
        '<div class="row"><button class="ghost" id="bSave">' + T.backupSave + '</button><label class="ghost btnlike" for="bLoad">' + T.backupLoad + '</label><input type="file" id="bLoad" accept=".json,application/json" hidden></div></details>' +
      '</section>' +

      '<section class="sos"><h2>' + T.sosTitle + '</h2><ol>' + T.sos.map(function (s) { return '<li><b>' + s[0] + '</b> ' + s[1] + '</li>'; }).join('') + '</ol></section>' +

      '<details><summary>' + T.whyTitle + '</summary><ul>' + T.why.map(function (w) { return '<li><b>' + w[0] + '</b> ' + w[1] + '</li>'; }).join('') + '</ul></details>' +
      '<p class="note">' + T.note + '</p>' +

      '<div class="overlay" id="dlg" hidden><div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dlgT">' +
        '<h2 id="dlgT">' + T.dlgTitle + '</h2>' +
        '<label class="opt" for="oPdf"><input type="checkbox" id="oPdf" checked><span><b>' + T.optPdf + '</b><span class="muted">' + T.optPdfD + '</span></span></label>' +
        '<label class="opt" for="oXlsx"><input type="checkbox" id="oXlsx" checked><span><b>' + T.optXlsx + '</b><span class="muted">' + T.optXlsxD + '</span></span></label>' +
        '<p class="muted" id="dMsg" aria-live="polite"></p>' +
        '<div class="row"><button id="dGo">' + T.download + '</button><button class="ghost" id="dCancel">' + T.cancel + '</button></div>' +
      '</div></div>';
    bind();
  }

  // ---------- behaviour ----------
  var timer = null;
  function bind() {
    $('lang').onchange = function () { stopPacer(); lang = this.value; lsSet('mt:lang', lang); render(); };

    document.querySelectorAll('input[data-k]').forEach(function (cb) {
      var k = cb.dataset.k; cb.checked = !!st.done[k];
      cb.closest('.task').classList.toggle('is-done', cb.checked);
      cb.onchange = function () { st.done[k] = cb.checked; cb.closest('.task').classList.toggle('is-done', cb.checked); persist(); };
    });

    [['rDizzy', 'oDizzy', 'dizzy'], ['rAnx', 'oAnx', 'anx']].forEach(function (a) {
      var R = $(a[0]), O = $(a[1]), k = a[2];
      if (st[k] != null) { R.value = st[k]; O.textContent = st[k]; } else { R.value = 5; }
      R.oninput = function () { st[k] = +R.value; O.textContent = R.value; persist(); };
    });
    var ta = $('thought'); ta.value = st.thought || '';
    ta.oninput = function () { st.thought = ta.value; save(TODAY, st); };
    ta.onchange = persist;

    bindPacer(); bindCountdown(); bindReport();
    $('copyLog').onclick = function () { var b = this; copyText(logText(), function () { b.textContent = T.copied; setTimeout(function () { b.textContent = T.copyLog; }, 1800); }); };
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
    renderWeek(); renderLog(); renderReport(); showToday();
  }
  function persist() { save(TODAY, st); renderWeek(); renderLog(); renderReport(); }
  function markDone(k) { var cb = document.querySelector('input[data-k="' + k + '"]'); if (cb) { cb.checked = true; cb.closest('.task').classList.add('is-done'); } st.done[k] = true; persist(); }

  function renderWeek() {
    var w = $('week'); if (!w) return; var html = '';
    for (var i = 6; i >= 0; i--) {
      var d = new Date(now); d.setDate(now.getDate() - i);
      var k = keyOf(d), s = dayData(k);
      var n = TASKS.filter(function (t) { return s.done && s.done[t]; }).length;
      var cls = n === 0 ? '' : (n >= TASKS.length ? 'p2' : 'p1');
      html += '<div class="day' + (k === TODAY ? ' today' : '') + '"><div class="dot ' + cls + '">' + n + '</div><span>' + fmt(k, { weekday: 'short' }) + '</span></div>';
    }
    w.innerHTML = html;
  }

  // pacer
  var left = 300, ph = 0, sec = 0;
  function phases() { return [{ n: T.inhale, s: 4, sc: 1 }, { n: T.exhale, s: 6, sc: .45 }, { n: T.rest, s: 5, sc: .45 }]; }
  var mmss = function (s) { return Math.floor(s / 60) + ':' + pad(s % 60); };
  function showPhase() { $('phase').innerHTML = phases()[ph].n + '<small>' + sec + '</small>'; }
  function setPhase(p) {
    var P = phases()[p]; ph = p; sec = P.s;
    if (p !== 2) { var b = $('ball'); b.style.transitionDuration = P.s + 's'; b.style.transform = 'scale(' + P.sc + ')'; }
    showPhase();
  }
  function stopPacer() { clearInterval(timer); timer = null; var b = $('ball'); if (b) { b.style.transitionDuration = '1s'; b.style.transform = 'scale(.45)'; } }
  function showToday() { var s = st.breathSec || 0; var el = $('pToday'); if (el) el.textContent = s ? T.breathedToday(mmss(s)) : ''; }
  function bindPacer() {
    $('ptimer').textContent = mmss(left);
    $('pStart').onclick = function () {
      if (timer) return; if (left <= 0) left = 300; $('ptimer').textContent = mmss(left); setPhase(0);
      timer = setInterval(function () {
        left--; sec--; $('ptimer').textContent = mmss(left);
        st.breathSec = (st.breathSec || 0) + 1; save(TODAY, st); showToday();
        if (st.breathSec % 60 === 0) { renderLog(); renderReport(); }
        if (left <= 0) { stopPacer(); $('phase').innerHTML = T.wellDone + '<small>&nbsp;</small>'; markDone('breath'); return; }
        if (sec <= 0) setPhase((ph + 1) % 3); else showPhase();
      }, 1000);
    };
    $('pStop').onclick = function () { stopPacer(); $('phase').innerHTML = T.paused + '<small>&nbsp;</small>'; persist(); };
  }

  // countdown
  function bindCountdown() {
    var start = st.cd || 100;
    var draw = function () { $('cdStart').textContent = start; var a = []; for (var n = start; n >= 0; n -= 7) a.push(n); $('cdSeq').textContent = a.join(', '); };
    draw();
    $('cdNew').onclick = function () { start = 100 + Math.floor(Math.random() * 150); st.cd = start; save(TODAY, st); $('cdSeq').hidden = true; $('cdShow').textContent = T.showAnswers; draw(); };
    $('cdShow').onclick = function () { var q = $('cdSeq'); q.hidden = !q.hidden; this.textContent = q.hidden ? T.showAnswers : T.hideAnswers; };
  }

  // log (last 14 days)
  function rowOf(k) { var s = dayData(k); var done = TASKS.filter(function (t) { return s.done && s.done[t]; }); return { k: k, s: s, done: done, mins: Math.round((s.breathSec || 0) / 60) }; }
  function dayName(k) { return (k === TODAY ? T.todayWord + ' · ' : '') + fmtLong(k); }
  function renderLog() {
    var box = $('log'); if (!box) return;
    var ks = allDays().slice(0, 14).filter(function (k) { return k === TODAY || isActive(dayData(k)); });
    if (!ks.length) { box.innerHTML = '<p class="empty">' + T.emptyLog + '</p>'; return; }
    box.innerHTML = ks.map(function (k) {
      var r = rowOf(k), s = r.s;
      return '<div class="log-row"><div class="d">' + dayName(k) + '</div><div class="chips">' +
        '<span class="chip' + (r.done.length === TASKS.length ? ' ok' : '') + '">' + T.chipTasks(r.done.length, TASKS.length) + '</span>' +
        '<span class="chip">' + T.chipBreath(r.mins) + '</span>' +
        '<span class="chip">' + T.chipDizzy(s.dizzy != null ? s.dizzy : '–') + '</span>' +
        '<span class="chip">' + T.chipAnx(s.anx != null ? s.anx : '–') + '</span></div>' +
        (s.thought ? '<div class="th">' + esc(s.thought) + '</div>' : '') + '</div>';
    }).join('');
  }
  function logText() {
    return allDays().slice(0, 14).map(function (k) {
      var r = rowOf(k), s = r.s;
      return dayName(k) + '\n- ' + (r.done.map(function (t) { return T.tasks[t]; }).join(', ') || '–') + '\n- ' + T.chipBreath(r.mins) + ' · ' + T.chipDizzy(s.dizzy != null ? s.dizzy : '–') + ' · ' + T.chipAnx(s.anx != null ? s.anx : '–') + (s.thought ? '\n- ' + s.thought : '');
    }).join('\n\n');
  }

  // ---------- report data ----------
  function build() {
    var start = startKey();
    var from = period ? keyOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() - period + 1)) : start;
    var lo = from < start ? start : from;
    var rows = [];
    for (var d = parseK(lo); keyOf(d) <= TODAY; d.setDate(d.getDate() + 1)) {
      var k = keyOf(d), r = rowOf(k);
      r.week = Math.floor(diffDays(start, k) / 7) + 1; r.active = isActive(r.s);
      rows.push(r);
    }
    var byW = {}; rows.forEach(function (r) { (byW[r.week] = byW[r.week] || []).push(r); });
    var wk = Object.keys(byW).map(Number).sort(function (a, b) { return a - b; }).map(function (w) {
      var rs = byW[w];
      return {
        w: w, days: rs.length, active: rs.filter(function (r) { return r.active; }).length,
        pct: Math.round(100 * rs.reduce(function (x, r) { return x + r.done.length; }, 0) / (rs.length * TASKS.length)),
        mins: rs.reduce(function (x, r) { return x + r.mins; }, 0),
        diz: avg(rs.filter(function (r) { return r.s.dizzy != null; }).map(function (r) { return r.s.dizzy; })),
        anx: avg(rs.filter(function (r) { return r.s.anx != null; }).map(function (r) { return r.s.anx; }))
      };
    });
    var rated = rows.filter(function (r) { return r.s.dizzy != null || r.s.anx != null; });
    var half = Math.max(1, Math.min(7, Math.floor(rated.length / 2)));
    var first = rated.slice(0, half), last = rated.slice(-half);
    var pick = function (rs, f) { return avg(rs.filter(function (r) { return r.s[f] != null; }).map(function (r) { return r.s[f]; })); };
    var actv = rows.filter(function (r) { return r.active; });
    var skip = TASKS.map(function (t) { return { t: t, n: actv.filter(function (r) { return !(r.s.done && r.s.done[t]); }).length }; }).sort(function (a, b) { return b.n - a.n; })[0];
    return {
      start: start, lo: lo, rows: rows, wk: wk, active: actv.length,
      pct: rows.length ? Math.round(100 * rows.reduce(function (x, r) { return x + r.done.length; }, 0) / (rows.length * TASKS.length)) : 0,
      mins: rows.reduce(function (x, r) { return x + r.mins; }, 0),
      dizF: pick(first, 'dizzy'), dizL: pick(last, 'dizzy'), anxF: pick(first, 'anx'), anxL: pick(last, 'anx'),
      enough: rated.length >= 4, skip: skip && skip.n ? skip : null,
      thoughts: rows.filter(function (r) { return r.s.thought && r.s.thought.trim(); })
    };
  }
  function trendHtml(a, b) {
    if (a == null || b == null) return '';
    var d = b - a; if (Math.abs(d) < .5) return ' <span class="flat">(' + T.stable + ')</span>';
    return d < 0 ? ' <span class="trend-down">▼ ' + f1(-d) + '</span>' : ' <span class="trend-up">▲ ' + f1(d) + '</span>';
  }
  function pair(R, a, b) { return R.enough ? f1(R[a]) + ' ' + T.arrow + ' ' + f1(R[b]) : f1(R[b]); }
  function statsList(R) {
    return [
      [R.active + ' / ' + R.rows.length, T.sDays],
      [R.pct + '%', T.sPct],
      [R.mins + '', T.sMins],
      [pair(R, 'dizF', 'dizL') + trendHtml(R.enough ? R.dizF : null, R.dizL), T.sDizzy],
      [pair(R, 'anxF', 'anxL') + trendHtml(R.enough ? R.anxF : null, R.anxL), T.sAnx],
      [R.skip ? T.tasks[R.skip.t] : '–', T.sSkip]
    ];
  }
  function weekRows(R) { return R.wk.map(function (w) { return [w.w, w.active + '/' + w.days, w.pct + '%', T.min(w.mins), f1(w.diz), f1(w.anx)]; }); }
  function renderReport() {
    if (!$('sum')) return;
    var R = build(), n = diffDays(startKey(), TODAY) + 1;
    $('progLabel').textContent = n <= PROGRAM_DAYS ? T.prog(n, Math.ceil(n / 7)) : T.progDone(n);
    $('sum').innerHTML = statsList(R).map(function (s) { return '<div class="stat"><b>' + s[0] + '</b><span>' + s[1] + '</span></div>'; }).join('');
    $('wk').innerHTML = '<thead><tr>' + T.th.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead><tbody>' +
      weekRows(R).map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody>';
  }

  // ---------- text report ----------
  function stripTags(s) { return String(s).replace(/<[^>]+>/g, ''); }
  function reportText() {
    var R = build(), L = [];
    L.push(T.rTitle);
    L.push(T.rPeriod(fmtDate(R.lo), fmtDate(TODAY)));
    L.push(T.rStart(fmtDate(R.start)));
    L.push('');
    L.push(T.rAboutT); L.push(T.rAbout[0]); L.push(T.rAbout[1]);
    T.rAboutItems.forEach(function (i) { L.push('- ' + i); });
    L.push('');
    L.push(T.rResultsT);
    statsList(R).forEach(function (s) { L.push('- ' + s[1] + ': ' + stripTags(s[0])); });
    L.push('');
    L.push(T.rWeeklyT);
    L.push(T.th.join(' | '));
    weekRows(R).forEach(function (r) { L.push(r.join(' | ')); });
    L.push('');
    L.push(T.rDailyT);
    R.rows.slice().reverse().forEach(function (r) {
      if (!r.active) { L.push(r.k + ': ' + T.rNoData); return; }
      L.push(r.k + ' (' + T.weekShort + r.week + '): ' + T.chipTasks(r.done.length, TASKS.length) + ' [' + (r.done.map(function (t) { return T.tasks[t]; }).join(', ') || '–') + '], ' +
        T.chipBreath(r.mins) + ', ' + T.chipDizzy(r.s.dizzy != null ? r.s.dizzy : '–') + ', ' + T.chipAnx(r.s.anx != null ? r.s.anx : '–'));
    });
    L.push('');
    L.push(T.rThoughtsT);
    if (!R.thoughts.length) L.push(T.rNoThoughts);
    R.thoughts.forEach(function (r) { L.push('- ' + r.k + ': ' + r.s.thought.replace(/\s+/g, ' ').trim()); });
    L.push('');
    L.push(T.rDisc);
    return L.join('\n');
  }

  // ---------- PDF ----------
  function chartSvg(wk) {
    var pts = wk.filter(function (w) { return w.diz != null || w.anx != null; });
    if (!pts.length) return '';
    var W = 700, H = 230, l = 34, r = 14, t = 14, b = 32;
    var n = wk.length, x = function (i) { return n === 1 ? (l + (W - l - r) / 2) : l + i * (W - l - r) / (n - 1); };
    var y = function (v) { return t + (10 - v) * (H - t - b) / 10; };
    var g = '';
    [0, 2, 4, 6, 8, 10].forEach(function (v) { g += '<line x1="' + l + '" x2="' + (W - r) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="#dfe5e6" stroke-width="1"/><text x="' + (l - 8) + '" y="' + (y(v) + 4) + '" font-size="11" text-anchor="end" fill="#5d6c70">' + v + '</text>'; });
    var step = n > 16 ? 4 : n > 8 ? 2 : 1;
    wk.forEach(function (w, i) { if (i % step === 0 || i === n - 1) g += '<text x="' + x(i) + '" y="' + (H - 10) + '" font-size="11" text-anchor="middle" fill="#5d6c70">' + T.weekShort + w.w + '</text>'; });
    var line = function (f, col) {
      var p = [], out = '';
      wk.forEach(function (w, i) { if (w[f] != null) p.push([x(i), y(w[f])]); });
      if (p.length > 1) out += '<polyline fill="none" stroke="' + col + '" stroke-width="2.5" stroke-linejoin="round" points="' + p.map(function (q) { return q[0].toFixed(1) + ',' + q[1].toFixed(1); }).join(' ') + '"/>';
      p.forEach(function (q) { out += '<circle cx="' + q[0].toFixed(1) + '" cy="' + q[1].toFixed(1) + '" r="3.5" fill="' + col + '"/>'; });
      return out;
    };
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" direction="ltr">' + g + line('diz', '#2f6f73') + line('anx', '#b5762f') + '</svg>';
  }
  function pdfHtml(R) {
    var css = '<style>' +
      '.pdf{width:720px;padding:8px 4px;font-family:"IBM Plex Sans Arabic","Segoe UI",Arial,sans-serif;color:#1d2a2e;background:#fff;font-size:13px;line-height:1.7}' +
      '.pdf h1{font-family:"Readex Pro","IBM Plex Sans Arabic",Arial,sans-serif;font-size:24px;margin:0 0 4px;color:#1d2a2e}' +
      '.pdf h2{font-family:"Readex Pro","IBM Plex Sans Arabic",Arial,sans-serif;font-size:16px;margin:22px 0 8px;color:#2f6f73;border-bottom:2px solid #2f6f73;padding-bottom:4px}' +
      '.pdf .meta{color:#5d6c70;font-size:12px}' +
      '.pdf .bar{height:3px;background:#b5762f;width:80px;margin:10px 0 4px}' +
      '.pdf ul{margin:6px 0;padding-inline-start:20px}.pdf li{margin:3px 0}' +
      '.pdf .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}' +
      '.pdf .st{background:#eef1f2;border-radius:8px;padding:8px 10px}.pdf .st b{display:block;font-size:17px}.pdf .st span{font-size:11px;color:#5d6c70}' +
      '.pdf .trend-down{color:#3d7a4f}.pdf .trend-up{color:#b5762f}.pdf .flat{color:#5d6c70;font-size:11px}' +
      '.pdf table{width:100%;border-collapse:collapse;font-size:12px}.pdf th,.pdf td{border-bottom:1px solid #d3dadc;padding:5px 6px;text-align:center}.pdf th{background:#eef1f2;color:#5d6c70;font-weight:600}' +
      '.pdf .legend{display:flex;gap:16px;font-size:12px;margin-bottom:4px}.pdf .sw{display:inline-block;width:12px;height:12px;border-radius:2px;vertical-align:middle;margin-inline-end:5px}' +
      '.pdf .th{padding:6px 0;border-bottom:1px solid #eef1f2;page-break-inside:avoid}.pdf .th .d{font-weight:600;color:#2f6f73;font-size:12px}' +
      '.pdf .disc{margin-top:22px;font-size:11px;color:#5d6c70;border-top:1px solid #d3dadc;padding-top:8px}' +
      '.pdf .avoid{page-break-inside:avoid}' +
      '</style>';
    var h = css + '<div class="pdf" dir="' + T.dir + '" lang="' + lang + '">';
    h += '<h1>' + T.rTitle + '</h1><div class="bar"></div>';
    h += '<div class="meta">' + T.rPeriod(fmtDate(R.lo), fmtDate(TODAY)) + '<br>' + T.rStart(fmtDate(R.start)) + '<br>' + T.rGen(fmtDate(TODAY)) + '</div>';
    h += '<div class="avoid"><h2>' + T.rAboutT + '</h2><p>' + T.rAbout[0] + '</p><p>' + T.rAbout[1] + '</p><ul>' + T.rAboutItems.map(function (i) { return '<li>' + i + '</li>'; }).join('') + '</ul></div>';
    h += '<div class="avoid"><h2>' + T.rResultsT + '</h2><div class="grid">' + statsList(R).map(function (s) { return '<div class="st"><b>' + s[0] + '</b><span>' + s[1] + '</span></div>'; }).join('') + '</div></div>';
    var svg = chartSvg(R.wk);
    if (svg) h += '<div class="avoid"><h2>' + T.rTrendT + '</h2><div class="legend"><span><i class="sw" style="background:#2f6f73"></i>' + T.legDizzy + '</span><span><i class="sw" style="background:#b5762f"></i>' + T.legAnx + '</span></div>' + svg + '</div>';
    h += '<h2>' + T.rWeeklyT + '</h2><table><thead><tr>' + T.th.map(function (x) { return '<th>' + x + '</th>'; }).join('') + '</tr></thead><tbody>' +
      weekRows(R).map(function (r) { return '<tr class="avoid">' + r.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table>';
    h += '<h2>' + T.rThoughtsT + '</h2><p class="meta">' + T.rThoughtsIntro + '</p>';
    h += R.thoughts.length ? R.thoughts.map(function (r) { return '<div class="th"><div class="d">' + fmtShort(r.k) + '</div>' + esc(r.s.thought.trim()) + '</div>'; }).join('') : '<p>' + T.rNoThoughts + '</p>';
    h += '<p class="disc">' + T.rDisc + '</p></div>';
    return h;
  }

  // ---------- Excel ----------
  function makeXlsx(R) {
    var C = T.xCols;
    var sum = [[T.rTitle], [T.rPeriod(fmtDate(R.lo), fmtDate(TODAY))], [T.rStart(fmtDate(R.start))], [], [T.xItem, T.xValue]];
    statsList(R).forEach(function (s) { sum.push([s[1], stripTags(s[0])]); });
    sum.push([]); sum.push([T.rAboutT]); sum.push([T.rAbout[0]]); T.rAboutItems.forEach(function (i) { sum.push([i]); });
    var wkly = [T.th].concat(R.wk.map(function (w) { return [w.w, w.active, w.pct / 100, w.mins, w.diz == null ? '' : Math.round(w.diz * 10) / 10, w.anx == null ? '' : Math.round(w.anx * 10) / 10]; }));
    var head = [C.date, C.week, C.breath, C.done].concat(TASKS.map(function (t) { return T.tasks[t]; })).concat([C.dizzy, C.anx, C.thought]);
    var daily = [head].concat(R.rows.map(function (r) {
      return [r.k, r.week, r.mins, r.done.length].concat(TASKS.map(function (t) { return r.s.done && r.s.done[t] ? 1 : 0; }))
        .concat([r.s.dizzy != null ? r.s.dizzy : '', r.s.anx != null ? r.s.anx : '', (r.s.thought || '').trim()]);
    }));
    var wb = XLSX.utils.book_new();
    var s1 = XLSX.utils.aoa_to_sheet(sum); s1['!cols'] = [{ wch: 48 }, { wch: 22 }];
    var s2 = XLSX.utils.aoa_to_sheet(wkly); s2['!cols'] = T.th.map(function () { return { wch: 12 }; });
    for (var i = 1; i < wkly.length; i++) { var c = s2[XLSX.utils.encode_cell({ r: i, c: 2 })]; if (c) c.z = '0%'; }
    var s3 = XLSX.utils.aoa_to_sheet(daily); s3['!cols'] = head.map(function (h, i) { return { wch: i === head.length - 1 ? 50 : Math.max(10, String(h).length + 2) }; });
    s3['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: daily.length - 1, c: head.length - 1 } }) };
    XLSX.utils.book_append_sheet(wb, s1, T.xSheets[0]);
    XLSX.utils.book_append_sheet(wb, s2, T.xSheets[1]);
    XLSX.utils.book_append_sheet(wb, s3, T.xSheets[2]);
    if (T.dir === 'rtl') { wb.Workbook = { Views: [{ RTL: true }] }; }
    return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  }

  // ---------- export plumbing ----------
  var loaded = {};
  function loadLib(name) {
    if (loaded[name]) return loaded[name];
    loaded[name] = new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = LIBS[name]; s.onload = res;
      s.onerror = function () { loaded[name] = null; s.remove(); rej(new Error('net')); };
      document.head.appendChild(s);
    });
    return loaded[name];
  }
  function downloadBlob(blob, name) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }
  function msg(id, t) { var m = $(id); if (!m) return; m.textContent = t; setTimeout(function () { if (m.textContent === t) m.textContent = ''; }, 5000); }
  function copyText(t, ok) {
    var fb = function () { var ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); ok(); } catch (e) {} ta.remove(); };
    try { navigator.clipboard.writeText(t).then(ok, fb); } catch (e) { fb(); }
  }
  async function makePdf(R) {
    await loadLib('pdf');
    if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (e) {} }
    var holder = document.createElement('div');
    holder.style.cssText = 'position:fixed;top:0;left:-10000px;width:740px;background:#fff';
    holder.innerHTML = pdfHtml(R);
    document.body.appendChild(holder);
    try {
      var name = 'MindTalks-report-' + TODAY + '.pdf';
      var blob = await html2pdf().set({
        margin: [12, 12, 14, 12], filename: name,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, backgroundColor: '#ffffff', useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'], avoid: ['.avoid', '.th', 'tr'] }
      }).from(holder.querySelector('.pdf')).outputPdf('blob');
      downloadBlob(blob, name);
      return name;
    } finally { holder.remove(); }
  }
  async function exportChosen() {
    var wantPdf = $('oPdf').checked, wantX = $('oXlsx').checked;
    if (!wantPdf && !wantX) { msg('dMsg', T.pickOne); return; }
    var go = $('dGo'); go.disabled = true; go.textContent = T.preparing;
    var R = build(), names = [];
    try {
      if (wantX) {
        await loadLib('xlsx');
        var nm = 'MindTalks-' + TODAY + '.xlsx';
        downloadBlob(new Blob([makeXlsx(R)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), nm);
        names.push(nm);
        if (wantPdf) await new Promise(function (r) { setTimeout(r, 700); });
      }
      if (wantPdf) names.push(await makePdf(R));
      $('dlg').hidden = true;
      msg('rMsg', T.downloaded(names.join(' + ')));
    } catch (e) {
      msg('dMsg', e && e.message === 'net' ? T.needNet : T.exportFail);
      if (window.console) console.error(e);
    } finally { go.disabled = false; go.textContent = T.download; }
  }
  function bindReport() {
    document.querySelectorAll('.seg button').forEach(function (b) {
      b.onclick = function () { document.querySelectorAll('.seg button').forEach(function (x) { x.classList.toggle('on', x === b); }); period = +b.dataset.p; renderReport(); };
    });
    $('rExport').onclick = function () { $('dlg').hidden = false; $('dGo').focus(); };
    $('dCancel').onclick = function () { $('dlg').hidden = true; };
    $('dlg').onclick = function (e) { if (e.target === this) this.hidden = true; };
    $('dGo').onclick = exportChosen;
    $('rCopy').onclick = function () { copyText(reportText(), function () { msg('rMsg', T.reportCopied); }); };
    $('bSave').onclick = function () {
      var out = { app: 'mindtalks', v: 1, saved: TODAY, days: {} };
      allDays().forEach(function (k) { out.days[k] = dayData(k); });
      var nm = 'mindtalks-backup-' + TODAY + '.json';
      downloadBlob(new Blob([JSON.stringify(out)], { type: 'application/json' }), nm);
      msg('rMsg', T.downloaded(nm));
    };
    $('bLoad').onchange = function (e) {
      var f = e.target.files[0]; if (!f) return; var rd = new FileReader();
      rd.onload = function () {
        try {
          var d = JSON.parse(rd.result); if (d.app !== 'mindtalks' || !d.days) throw 0; var n = 0;
          Object.keys(d.days).forEach(function (k) { if (/^\d{4}-\d{2}-\d{2}$/.test(k) && !isActive(load(k))) { save(k, d.days[k]); n++; } });
          st = load(TODAY); st.done = st.done || {}; render(); msg('rMsg', T.restored(n));
        } catch (err) { msg('rMsg', T.badBackup); }
      };
      rd.readAsText(f);
    };
  }

  // warm the export libraries into the offline cache once the app is idle
  function prewarm() {
    if (!navigator.onLine || !('serviceWorker' in navigator)) return;
    Object.keys(LIBS).forEach(function (k) { try { fetch(LIBS[k], { mode: 'no-cors' }).catch(function () {}); } catch (e) {} });
  }

  render();
  setTimeout(prewarm, 4000);
  // day rollover while the app stays open
  setInterval(function () { if (keyOf(new Date()) !== TODAY) location.reload(); }, 60000);
})();

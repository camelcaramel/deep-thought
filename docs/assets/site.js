/* Deep Thought 랜딩 페이지. 스크립트가 없어도 모든 내용과 내려받기 링크가 동작한다. */
(function () {
  'use strict';

  var REPO = 'camelcaramel/incident-sim-tester';
  var BASE = 'https://github.com/' + REPO + '/releases/latest/download/';
  var FILES = {
    windows: { name: 'Windows', file: 'IncidentSim-windows.exe', size: '151KB' },
    macos: { name: 'macOS', file: 'IncidentSim-macos.zip', size: '13KB' },
    ubuntu: { name: 'Ubuntu', file: 'IncidentSim-ubuntu.deb', size: '13KB' }
  };
  var $ = function (s, root) { return (root || document).querySelector(s); };
  var $$ = function (s, root) { return Array.prototype.slice.call((root || document).querySelectorAll(s)); };
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* 방문자 OS */
  function detect() {
    var ua = navigator.userAgent;
    var touchMac = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
    if (/Android|iPhone|iPad|iPod/.test(ua)) return { os: null, mobile: true };
    if (touchMac) return { os: 'macos', mobile: true }; /* iPad. 터치 되는 Mac 이어도 받을 파일은 맞는다 */
    if (/Windows/.test(ua)) return { os: 'windows' };
    if (/Mac OS X|Macintosh/.test(ua)) return { os: 'macos' };
    if (/Linux|X11/.test(ua) && !/CrOS/.test(ua)) return { os: 'ubuntu' };
    return { os: null };
  }
  var me = detect();

  if (me.mobile) $$('[data-mobile]').forEach(function (p) { p.hidden = false; });
  if (me.os) {
    var rest = Object.keys(FILES).filter(function (k) { return k !== me.os; });
    $$('[data-get]').forEach(function (box) {
      $('[data-get-label]', box).textContent = FILES[me.os].name + '용 내려받기';
      $('[data-get-main]', box).href = BASE + FILES[me.os].file;
      $$('[data-get-other]', box).forEach(function (a, i) {
        a.textContent = FILES[rest[i]].name + '용';
        a.href = BASE + FILES[rest[i]].file;
      });
    });
    $$('#install details').forEach(function (d) { d.open = d.dataset.os === me.os; });
  }

  /* 내려받을 파일의 크기 */
  function showSizes() {
    var mine = FILES[me.os || 'windows'], part = /^([\d.]+)(.+)$/.exec(mine.size);
    Object.keys(FILES).forEach(function (k) {
      $('[data-asset="' + FILES[k].file + '"] [data-size]').textContent = FILES[k].size;
    });
    $$('[data-my-os]').forEach(function (e) { e.textContent = mine.name; });
    $$('[data-my-size]').forEach(function (e) {
      if (e.dataset.mySize !== 'unit') { e.textContent = mine.size; return; }
      var unit = document.createElement('span');
      unit.className = 'unit';
      unit.textContent = part[2];
      e.replaceChildren(part[1], unit);
    });
  }
  showSizes();

  /* 릴리스 정보. 못 읽거나 새 파일이 없으면 적어 둔 크기가 그대로 보인다. 1KB 는 1,000바이트 */
  function size(n) {
    return n < 1e6 ? Math.max(1, Math.round(n / 1e3)) + 'KB' : (n / 1e6).toFixed(1) + 'MB';
  }
  function day(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return '';
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function showRelease(rel) {
    var any = false;
    (rel.assets || []).forEach(function (a) {
      var li = $$('[data-asset]').filter(function (e) { return e.dataset.asset === a.name; })[0];
      if (!li) return;
      any = true;
      if (a.size) Object.keys(FILES).forEach(function (k) { if (FILES[k].file === a.name) FILES[k].size = size(a.size); });
      if (/^sha256:[0-9a-f]{64}$/.test(a.digest || '')) {
        var h = $('[data-sha]', li); h.textContent = 'SHA-256 ' + a.digest.slice(7); h.hidden = false;
      }
    });
    showSizes();
    if (!any || !rel.tag_name) return;
    var text = [String(rel.tag_name).replace(/^v/, '') + '판', day(rel.published_at)].filter(Boolean).join(' · ');
    $$('[data-release]').forEach(function (p) { p.textContent = text; p.hidden = false; });
  }
  function loadRelease() {
    var key = 'dt-release';
    try {
      var hit = JSON.parse(sessionStorage.getItem(key));
      if (hit && Date.now() - hit.at < 600000) { showRelease(hit.rel); return; }
    } catch (e) { /* 저장소를 못 쓰면 새로 읽는다 */ }
    if (!window.fetch) return;
    fetch('https://api.github.com/repos/' + REPO + '/releases/latest', { headers: { Accept: 'application/vnd.github+json' } })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (r) {
        var rel = {
          tag_name: r.tag_name, published_at: r.published_at,
          assets: (r.assets || []).map(function (a) { return { name: a.name, size: a.size, digest: a.digest }; })
        };
        try { sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), rel: rel })); } catch (e) { /* 무시 */ }
        showRelease(rel);
      })
      .catch(function () { /* 감춘 채로 둔다 */ });
  }
  loadRelease();

  /* 가상 시각: 실제 1초가 5분. 하루가 지나면 멈춘다 */
  var clock = $('#clock'), bar = $('#clock-bar'), cap = $('#clock-cap'), toggle = $('#clock-toggle');
  var START = 9 * 60, DAY = 24 * 60, passed = 0, timer = null;
  function draw() {
    var t = (START + passed) % DAY;
    clock.textContent = String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
    bar.style.width = (passed / DAY * 100) + '%';
  }
  function stop() { clearInterval(timer); timer = null; toggle.textContent = '시계 이어 가기'; }
  function go() {
    toggle.textContent = '시계 멈추기';
    timer = setInterval(function () {
      if (document.hidden) return;
      passed = Math.min(DAY, passed + 5);
      draw();
      if (passed === DAY) {
        stop();
        toggle.hidden = true;
        cap.textContent = '하루가 지났습니다 · 실제로는 4분 48초';
      }
    }, 1000);
  }
  toggle.hidden = false;
  toggle.addEventListener('click', function () { if (timer) stop(); else go(); });
  if (calm) stop(); else go();

  /* 진행: 지금 단계를 채우고, 장애 구간이 화면 가운데를 지나는 동안 화면을 뒤집는다.
     움직임 줄이기를 켠 사람에게는 머리줄과 단계 줄만 바꾼다 */
  var root = document.documentElement, header = $('.header'), stepBar = $('#steps');
  var bars = $$('#steps li'), steps = $$('[data-step]'), incident = $('.incident');
  var state = $('#state'), color = $('meta[name="theme-color"]');
  var links = $$('.nav a'), targets = links.map(function (a) { return $(a.getAttribute('href')); });
  var shown = -1, dark = false, ticking = false;
  stepBar.classList.add('live');

  function flip(on) {
    if (on === dark) return;
    dark = on;
    state.textContent = on ? '운영 장애' : '운영 정상';
    (calm ? [header, stepBar] : [root]).forEach(function (el) {
      if (on) el.setAttribute('data-theme', 'incident'); else el.removeAttribute('data-theme');
    });
    color.content = getComputedStyle(on ? incident : root).getPropertyValue('--ground').trim();
  }
  function look() {
    ticking = false;
    var line = window.innerHeight / 2, now = 0, at = -1;
    steps.forEach(function (el, i) { if (el.getBoundingClientRect().top <= line) now = i; });
    if (now !== shown) {
      shown = now;
      bars.forEach(function (li, i) {
        li.className = i === now ? 'now' : i < now ? 'done' : '';
        if (i === now) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
      });
    }
    var box = incident.getBoundingClientRect();
    flip(box.top <= line && box.bottom > line);

    targets.forEach(function (el, i) {
      var b = el.getBoundingClientRect();
      if (b.top <= line && b.bottom > line) at = i;
    });
    links.forEach(function (a, i) { if (i === at) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current'); });
  }
  function ask() { if (!ticking) { ticking = true; requestAnimationFrame(look); } }
  window.addEventListener('scroll', ask, { passive: true });
  window.addEventListener('resize', ask);
  look();
})();

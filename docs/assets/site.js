/* Deep Thought 랜딩 페이지. 스크립트가 없어도 모든 내용과 내려받기 링크가 동작한다. */
(function () {
  'use strict';

  var REPO = 'camelcaramel/deep-thought';
  var BASE = 'https://github.com/' + REPO + '/releases/latest/download/';
  var FILES = {
    windows: { name: 'Windows', file: 'DeepThought-windows.exe', size: '153KB' },
    macos: { name: 'macOS', file: 'DeepThought-macos.zip', size: '14KB' },
    ubuntu: { name: 'Ubuntu', file: 'DeepThought-ubuntu.deb', size: '13KB' }
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

  /* 실제 화면: 5초마다 다음 화면으로 넘긴다. 마우스를 올리거나 키보드 초점이 들어오면 멈춘다.
     움직임 줄이기를 켠 사람에게는 저절로 넘기지 않고, 옮길 때도 미끄러지지 않는다.
     스크립트가 없으면 가로로 밀어 보는 목록으로 남는다 */
  var shots = $('[data-shots]');
  if (shots) (function () {
    var track = $('[data-shots-track]', shots), slides = $$('.shot', shots);
    var dotsBox = $('[data-shots-dots]', shots), count = $('[data-shots-count]', shots), play = $('[data-shots-play]', shots);
    var WAIT = 5000, at = 0, timer = null, stopped = calm, hover = false, focused = false, settle = null;
    var dots = slides.map(function (li, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'shots-dot';
      b.setAttribute('aria-label', (i + 1) + '번째 화면');
      b.addEventListener('click', function () { go(i); });
      dotsBox.appendChild(b);
      return b;
    });
    function mark(i) {
      at = i;
      dots.forEach(function (b, k) { if (k === i) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
      slides.forEach(function (li, k) { if (k === i) li.removeAttribute('aria-hidden'); else li.setAttribute('aria-hidden', 'true'); });
      count.textContent = (i + 1) + ' / ' + slides.length;
    }
    function x(i) { return slides[i].offsetLeft - slides[0].offsetLeft; }
    function go(i) {
      i = (i + slides.length) % slides.length;
      track.scrollTo({ left: x(i), behavior: calm ? 'auto' : 'smooth' });
      mark(i);
      run();
    }
    function run() {
      clearInterval(timer);
      timer = null;
      var moving = !stopped && !hover && !focused;
      if (moving) timer = setInterval(function () { if (!document.hidden) go(at + 1); }, WAIT);
      track.setAttribute('aria-live', moving ? 'off' : 'polite');
    }
    /* 손가락이나 트랙패드로 밀었을 때 */
    track.addEventListener('scroll', function () {
      clearTimeout(settle);
      settle = setTimeout(function () {
        var i = Math.round(track.scrollLeft / track.clientWidth);
        if (i !== at && slides[i]) { mark(i); run(); }
      }, 150);
    }, { passive: true });
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(at + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(at - 1); }
    });
    $('[data-shots-prev]', shots).addEventListener('click', function () { go(at - 1); });
    $('[data-shots-next]', shots).addEventListener('click', function () { go(at + 1); });
    play.addEventListener('click', function () {
      stopped = !stopped;
      play.textContent = stopped ? '자동으로 넘기기' : '멈추기';
      run();
    });
    shots.addEventListener('mouseenter', function () { hover = true; run(); });
    shots.addEventListener('mouseleave', function () { hover = false; run(); });
    /* 마우스로 누른 단추에 남은 초점 때문에 계속 멈춰 있지 않도록 키보드 초점만 본다 */
    shots.addEventListener('focusin', function (e) {
      var keyboard = true;
      try { keyboard = e.target.matches(':focus-visible'); } catch (x) { /* :focus-visible 을 모르는 브라우저 */ }
      if (keyboard) { focused = true; run(); }
    });
    shots.addEventListener('focusout', function (e) {
      if (!shots.contains(e.relatedTarget)) { focused = false; run(); }
    });
    window.addEventListener('resize', function () { track.scrollTo({ left: x(at), behavior: 'auto' }); });
    /* 첫 화면이 뜬 뒤에는 나머지 화면도 미리 받아 둔다 */
    window.addEventListener('load', function () { $$('img[loading="lazy"]', track).forEach(function (img) { img.loading = 'eager'; }); });

    shots.classList.add('live');
    $('[data-shots-ctl]', shots).hidden = false;
    if (calm) play.hidden = true;
    mark(0);
    run();
  })();

  /* 진행: 지금 단계를 채우고, 장애 구간이 화면 가운데를 지나는 동안 화면을 장애 색으로 바꾼다.
     움직임 줄이기를 켠 사람에게는 머리줄과 단계 줄만 바꾼다 */
  var root = document.documentElement, header = $('.header'), stepBar = $('#steps');
  var bars = $$('#steps li'), steps = $$('[data-step]'), incident = $('.incident');
  var color = $('meta[name="theme-color"]');
  var links = $$('.nav a'), targets = links.map(function (a) { return $(a.getAttribute('href')); });
  var shown = -1, dark = false, ticking = false;
  stepBar.classList.add('live');

  function flip(on) {
    if (on === dark) return;
    dark = on;
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

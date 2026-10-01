/* ---------- Aktiven Abschnitt in der Kopfzeile markieren ---------- */
const navLinks = [...document.querySelectorAll('.nav a')];
const navSections = navLinks.map(a => document.querySelector(a.hash)).filter(Boolean);
function spy(){
  const y = scrollY + innerHeight * 0.35;
  let idx = -1;
  navSections.forEach((s, i) => { if (s.offsetTop <= y) idx = i; });
  navLinks.forEach((a, j) => {
    const on = j === idx;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'true');
    else a.removeAttribute('aria-current');
  });
}
addEventListener('scroll', spy, { passive: true });
addEventListener('resize', spy);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(spy);
spy();

/* ---------- Menü: Popover in Mobil- und Tablet-Ansicht ---------- */
/* Findet der Browser das Popover-Attribut nicht, übernimmt eine Klasse dieselbe Aufgabe. */
const menuBtn = document.getElementById('menuBtn'), menuPop = document.getElementById('menuPop');
const hasPopover = 'popover' in HTMLElement.prototype;
const menuOpen = () => hasPopover ? menuPop.matches(':popover-open') : menuPop.classList.contains('open');
/* Mit popovertarget meldet der Browser den Zustand selbst; aria-expanded wäre dort unzulässig. */
function syncMenu(){
  if (!hasPopover) menuBtn.setAttribute('aria-expanded', String(menuOpen()));
}
function closeMenu(){
  if (hasPopover){ if (menuOpen()) menuPop.hidePopover(); }
  else menuPop.classList.remove('open');
  syncMenu();
}
if (hasPopover){
  menuPop.addEventListener('toggle', syncMenu);
} else {
  document.documentElement.classList.add('no-popover');
  menuBtn.removeAttribute('popovertarget');
  menuBtn.setAttribute('aria-expanded', 'false');
  menuBtn.addEventListener('click', () => { menuPop.classList.toggle('open'); syncMenu(); });
  document.addEventListener('click', e => {
    if (menuOpen() && !menuPop.contains(e.target) && !menuBtn.contains(e.target)) closeMenu();
  });
  addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
  syncMenu();
}
menuPop.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
/* Beim Wechsel in die große Ansicht schließt das Menü */
matchMedia('(min-width: 961px)').addEventListener('change', e => { if (e.matches) closeMenu(); });

/* ---------- Produktkarten: Messblatt bei Hover, Fokus oder Tippen ---------- */
const touchOnly = matchMedia('(hover: none)');
document.querySelectorAll('.card').forEach(card => {
  const isOpen = () => card.classList.contains('open');
  const toggle = v => card.classList.toggle('open', v);
  card.addEventListener('click', e => {
    if (touchOnly.matches && !e.target.closest('a')) toggle(!isOpen());
  });
  card.addEventListener('keydown', e => {
    if (e.target !== card) return;                 /* Link in der Karte behält Enter und Leertaste */
    if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); toggle(!isOpen()); }
  });
});
addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  document.querySelectorAll('.card.open').forEach(c => c.classList.remove('open'));
});

/* ---------- Partikelwolke im Hero ----------
   Die Punkte liegen auf einem Canvas über dem statischen CSS-Punktraster. Sie
   folgen der Maus, kehren aber in ihre Ruhelage zurück. Die Ruhelage selbst
   wandert: jeder Punkt steht auf einer eigenen Bahn, die sich langsam um die
   Mitte dreht, dazu ein leichter Wirbel und mehr Rauschen. Die Wolke bewegt
   sich deshalb auch, wenn niemand mit dem Zeiger da ist.
   Aufwand: höchstens 260 Punkte (33.670 Paarprüfungen je Durchgang),
   1,5-fache Pixelauflösung, ein Pfad je Durchgang, Animation nur im
   Sichtfeld und nur im aktiven Tab. Bei reduzierter Bewegung wird einmal
   gezeichnet. Ohne JavaScript bleibt das Punktraster sichtbar. */
const cloud = document.getElementById('cloud');
if (cloud){
  const cx = cloud.getContext('2d');
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const vars = getComputedStyle(document.documentElement);
  const rgb = v => { const n = parseInt(v.trim().slice(1), 16); return (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255); };
  const DOT = 'rgba(' + rgb(vars.getPropertyValue('--accent-d')) + ',.85)';
  const LINK = 'rgba(' + rgb(vars.getPropertyValue('--accent-dd')) + ',.16)';
  const REACH = 110, REACH2 = REACH * REACH, NEAR2 = 34 * 34;
  let W = 0, H = 0, ps = [], mx = -1e4, my = -1e4, raf = 0, visible = false, t = 0;

  function size(){                     /* Wolke als weiche Scheibe anlegen */
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    W = cloud.clientWidth; H = cloud.clientHeight;
    if (!W || !H) return false;
    cloud.width = Math.round(W * dpr); cloud.height = Math.round(H * dpr);
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.max(40, Math.min(260, Math.round(W * H / 1100)));
    const rad = Math.min(W, H) * .38;
    ps = Array.from({ length: n }, () => {
      const a = Math.random() * 6.2832, d = Math.sqrt(Math.random()) * rad;
      const x = W / 2 + Math.cos(a) * d, y = H / 2 + Math.sin(a) * d * .82;
      /* a und d sind die Ruhelage in Polkoordinaten, sp der eigene Gang,
         ph die Phase: jedes Punkt hat eine eigene, kleine Bahn. */
      return { x: x, y: y, hx: x, hy: y, vx: 0, vy: 0, r: 1 + Math.random() * 1.2,
               a: a, d: d, ph: Math.random() * 6.2832,
               sp: (.0007 + Math.random() * .0011) * (Math.random() < .5 ? -1 : 1) };
    });
    return true;
  }
  function push(x, y, force){          /* Punkte vom Zeiger wegdrücken */
    for (const p of ps){
      const dx = p.x - x, dy = p.y - y, d2 = dx * dx + dy * dy;
      if (d2 > 1 && d2 < REACH2){
        const k = (1 - Math.sqrt(d2) / REACH) * force / Math.sqrt(d2);
        p.vx += dx * k; p.vy += dy * k;
      }
    }
  }
  function paint(){
    t++;
    cx.clearRect(0, 0, W, H);
    const n = ps.length, ox0 = W / 2, oy0 = H / 2;
    for (let i = 0; i < n; i++){
      const p = ps[i];
      /* Die Ruhelage wandert: Drehung um die Mitte, atmender Radius, Wellenlauf.
         Umschlag etwa einmal je Minute, jeder Punkt in eigenem Tempo. */
      p.a += p.sp * (1 + .5 * Math.sin(t * .012 + p.ph));
      const b = 1 + .07 * Math.sin(t * .009 + p.ph * 1.3);
      p.hx = ox0 + Math.cos(p.a) * p.d * b;
      p.hy = oy0 + Math.sin(p.a) * p.d * b * .82 + Math.sin(t * .008 + p.ph) * 7;
      /* Feder zur Ruhelage, kräftigeres Rauschen, leichter Wirbel um die Mitte */
      const rx = p.x - ox0, ry = p.y - oy0;
      p.vx += (p.hx - p.x) * .012 + (Math.random() - .5) * .16 - ry * .0003;
      p.vy += (p.hy - p.y) * .012 + (Math.random() - .5) * .16 + rx * .0003;
      const dx = p.x - mx, dy = p.y - my, d2 = dx * dx + dy * dy;
      if (d2 > 1 && d2 < REACH2){
        const k = (1 - Math.sqrt(d2) / REACH) * 3.4 / Math.sqrt(d2);
        p.vx += dx * k; p.vy += dy * k;
      }
      p.vx *= .93; p.vy *= .93; p.x += p.vx; p.y += p.vy;
    }
    cx.strokeStyle = LINK; cx.lineWidth = 1; cx.beginPath();
    for (let i = 0; i < n; i++){       /* Verbindungen: ein Pfad, ein Strich */
      const a = ps[i];
      for (let j = i + 1; j < n; j++){
        const b = ps[j], dx = a.x - b.x, dy = a.y - b.y;
        if (dx * dx + dy * dy < NEAR2){ cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); }
      }
    }
    cx.stroke();
    cx.fillStyle = DOT; cx.beginPath();      /* alle Punkte: ein Pfad, ein Fill */
    for (let i = 0; i < n; i++){ const p = ps[i]; cx.moveTo(p.x + p.r, p.y); cx.arc(p.x, p.y, p.r, 0, 6.2832); }
    cx.fill();
  }
  function loop(){ paint(); raf = requestAnimationFrame(loop); }
  const awake = () => visible && !document.hidden && !calm.matches;
  function maybe(){ if (awake() && !raf) raf = requestAnimationFrame(loop); else if (!awake() && raf){ cancelAnimationFrame(raf); raf = 0; } }

  if (size()){
    cloud.addEventListener('pointermove', e => {
      const r = cloud.getBoundingClientRect();
      mx = e.clientX - r.left; my = e.clientY - r.top;
    }, { passive: true });
    cloud.addEventListener('pointerleave', () => { mx = my = -1e4; });
    cloud.addEventListener('pointerdown', e => {              /* Impuls beim Tippen */
      const r = cloud.getBoundingClientRect();
      push(e.clientX - r.left, e.clientY - r.top, 10);
    }, { passive: true });

    if (window.IntersectionObserver){
      new IntersectionObserver(([en]) => { visible = en.isIntersecting; maybe(); }, { rootMargin: '120px' }).observe(cloud);
    } else {
      visible = true;
    }
    document.addEventListener('visibilitychange', maybe);
    calm.addEventListener('change', () => { if (calm.matches) paint(); maybe(); });
    if (window.ResizeObserver) new ResizeObserver(() => { if (size()) paint(); }).observe(cloud);
    else addEventListener('resize', () => { if (size()) paint(); }, { passive: true });
    if (calm.matches) paint();       /* reduzierter Wunsch: ein ruhiges Standbild */
    maybe();
  }
}

/* ---------- Lautsprecher im Hero: Drehung nach dem Scrollfortschritt ----------
   Kein Scroll-Hacking: nichts wird abgefangen oder ersetzt, es wird nur die
   Variable --spin gesetzt, die die Transformierung in styles.css steuert. Browser
   mit scroll() als Zeitachse erledigen das in CSS, dann bleibt dieser Block stumm.
   Bei reduzierter Bewegung wird nichts verändert, die Ruheansicht aus CSS gilt. */
const speaker = document.getElementById('speaker');
if (speaker){
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const nativeScroll = window.CSS && CSS.supports && CSS.supports('animation-timeline', 'scroll()');
  if (!nativeScroll && !still.matches){
    let queued = false;
    const spin = () => {
      if (queued) return;            /* höchstens eine Berechnung je Bild */
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        const p = Math.min(1, Math.max(0, scrollY / Math.max(1, innerHeight * .9)));
        speaker.style.setProperty('--spin', (-20 + p * 68).toFixed(2) + 'deg');
      });
    };
    addEventListener('scroll', spin, { passive: true });
    addEventListener('resize', spin);
    spin();
  }
}

/* ---------- Referenzton ---------- */
const toneBox = document.getElementById('tone'), toneBtn = document.getElementById('toneBtn'), toneTime = document.getElementById('toneTime');
let ac, osc, gain, playing = false, tInt, sec = 0;
function stamp(){ toneTime.textContent = String(Math.floor(sec / 60)).padStart(2,'0') + ':' + String(sec % 60).padStart(2,'0'); }
function stopTone(){
  gain.gain.linearRampToValueAtTime(0, ac.currentTime + .2);
  osc.stop(ac.currentTime + .25);
  playing = false; clearInterval(tInt); toneBox.classList.remove('on');
  toneBtn.textContent = 'Referenzton starten';
  sec = 0; stamp();                                   /* die Uhr läuft mit dem Ton zurück */
}
/* Die Prüfung deckt die Rechtstexte ab, wo es weder Referenzton noch Formular gibt. */
if (toneBtn) toneBtn.addEventListener('click', async () => {
  ac = ac || new (window.AudioContext || window.webkitAudioContext)();
  if (ac.state === 'suspended') await ac.resume();
  if (playing){ stopTone(); return; }
  osc = ac.createOscillator(); gain = ac.createGain();
  osc.type = 'sine'; osc.frequency.value = 432;
  gain.gain.setValueAtTime(0, ac.currentTime);
  gain.gain.linearRampToValueAtTime(.045, ac.currentTime + .4);
  osc.connect(gain).connect(ac.destination); osc.start();
  playing = true; sec = 0; toneBox.classList.add('on');
  toneBtn.textContent = 'Ton stoppen'; stamp();
  tInt = setInterval(() => { sec++; stamp(); }, 1000);
});

/* ---------- Formular ---------- */
/* Testfassung: Es gibt kein Backend. Senden prüft die Felder, meldet Erfolg
   und stellt das Formular danach wieder her. Adresse unten eintragen. */
const form = document.getElementById('contactForm'), note = document.getElementById('formNote');
const validators = {
  fName: v => v.trim().length > 0,
  fMail: v => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v),
  fTopic: v => v !== '',
  fMsg: v => v.trim().length > 0
};
if (form) form.querySelectorAll('.fin').forEach(f => f.addEventListener('input', () => {
  f.closest('.field').classList.remove('err');
  f.removeAttribute('aria-invalid');
}));
let noteTimer;
if (form) form.addEventListener('submit', e => {
  e.preventDefault();
  let firstBad = null;
  Object.keys(validators).forEach(id => {
    const f = document.getElementById(id);
    const bad = !validators[id](f.value);
    f.closest('.field').classList.toggle('err', bad);
    if (bad) f.setAttribute('aria-invalid', 'true'); else f.removeAttribute('aria-invalid');
    if (bad && !firstBad) firstBad = f;
  });
  if (firstBad){ firstBad.focus(); note.classList.remove('show'); return; }
  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.textContent = 'Anfrage übermittelt';
  note.innerHTML = '<i class="sq"></i>Anfrage übermittelt. Antwort innerhalb von zwei Werktagen.';
  note.classList.add('show');
  form.querySelectorAll('.fin').forEach(f => { f.value = ''; f.blur(); });
  clearTimeout(noteTimer);
  noteTimer = setTimeout(() => {                      /* zurück zu einem nutzbaren Formular */
    btn.disabled = false;
    btn.textContent = 'Nachricht senden';
    note.classList.remove('show');
  }, 6000);
});

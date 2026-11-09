import { AIM_DEPTH, AMMO, DURATION, FLIGHT, HOME, WINDUP, clamp, distance, makeTarget, pace, scoreHit, signs, targetContact } from './engine.mjs';
import { Scene } from './scene.mjs?v=2';
import { fillShatter } from './shatter.mjs';

const $ = (id) => document.getElementById(id);
const canvas = $('scene');
const scene = new Scene(canvas);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const controls = [$('throw'), canvas];
const directions = new Map([
  ['ArrowUp', [0, 1]], ['KeyW', [0, 1]], ['ArrowDown', [0, -1]], ['KeyS', [0, -1]],
  ['ArrowLeft', [-1, 0]], ['KeyA', [-1, 0]], ['ArrowRight', [1, 0]], ['KeyD', [1, 0]],
]);
const keyAim = new Set();
let state = 'title';
let run = newRun(false);
let hold = null;
let elapsed = 0;
let lastFrame = 0;
let lastDraw = 0;
let redraw = true;
let lean = 0;
let sound = load('sound', 'on') === 'on';
let best = Number(load('best','0')) || 0;
let audio;
let noiseBuffer;
const shatters = [];
let nextShatter = 0;

function load(key, fallback) {
  try { return localStorage.getItem('bottletoss.' + key) ?? fallback; } catch { return fallback; }
}

function save(key, value) {
  try { localStorage.setItem('bottletoss.' + key, value); } catch { /* Private browsing still plays. */ }
}

function newRun(practice) {
  return {
    practice, time: 0, dist: 0, aim: { ...HOME }, targets: [], nextIndex: 0, nextZ: practice ? 68 : 75,
    shots: [], bursts: [], score: 0, ammo: AMMO, tossed: 0, hits: 0, streak: 0, longest: 0,
    callout: '', calloutUntil: 0, hitUntil: 0, pullbackUntil: 0, lastThrow: null,
  };
}

function warmAudio() {
  if (!sound) return;
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    if (!audio) {
      audio = new Audio();
      noiseBuffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * .38), audio.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (audio.state !== 'running') audio.resume().catch(() => {});
  } catch { /* Sound remains optional. */ }
}

function tone(start, end, length, volume, type = 'sine', delay = 0) {
  const t = audio.currentTime + delay;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(start, t);
  oscillator.frequency.exponentialRampToValueAtTime(end, t + length);
  gain.gain.setValueAtTime(.001, t);
  gain.gain.linearRampToValueAtTime(volume, t + .009);
  gain.gain.exponentialRampToValueAtTime(.001, t + length);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(t);
  oscillator.stop(t + length);
}

function crunch(frequency, length, volume, type = 'bandpass') {
  const t = audio.currentTime;
  const src = audio.createBufferSource(), filter = audio.createBiquadFilter(), gain = audio.createGain();
  src.buffer = noiseBuffer;
  filter.type = type;
  filter.frequency.setValueAtTime(frequency, t);
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(.001, t + length);
  src.connect(filter).connect(gain).connect(audio.destination);
  src.start(t); src.stop(t + length);
}

function playShatter() {
  const index = nextShatter;
  nextShatter = (index + 1) % 3;
  if (!shatters[index]) {
    const buffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * .49), audio.sampleRate);
    fillShatter(buffer.getChannelData(0), audio.sampleRate, 179 + index * 811);
    shatters[index] = buffer;
  }
  const source = audio.createBufferSource();
  const gain = audio.createGain();
  source.buffer = shatters[index];
  gain.gain.value = .88;
  source.connect(gain).connect(audio.destination);
  source.start();
}

function playSound(name, perfect = false) {
  if (!sound || audio?.state !== 'running') return;
  if (name === 'throw') {
    crunch(740,.18,.19);
    tone(258,112,.15,.035,'triangle');
  } else if (name === 'hit') {
    playShatter();
    if (perfect) tone(1810,1590,.21,.025,'sine',.12);
  } else if (name === 'miss') {
    crunch(350,.13,.10);
    tone(130,85,.15,.043,'triangle');
  } else {
    tone(410,490,.11,.045,'triangle');
  }
}

function write(id, value) {
  const element = $(id);
  const text = String(value);
  if (element.textContent !== text) element.textContent = text;
}

function writeBest() {
  $('best').firstChild.nodeValue = 'LOCAL BEST ' + String(best).padStart(4, '0') + ' ';
}

function updateSound() {
  $('sound').setAttribute('aria-pressed', String(sound));
  $('sound').lastElementChild.textContent = sound ? 'on' : 'off';
}

function updateHUD() {
  const multiplier = run.streak ? Math.min(4, 1 + Math.floor((run.streak - 1) / 2)) : 1;
  write('score', String(run.score).padStart(4,'0'));
  write('timeLabel', run.practice ? 'MODE' : 'TIME LEFT');
  write('time', run.practice ? 'FREE' : Math.max(0, Math.ceil(DURATION - run.time)) + 's');
  write('ammo', run.practice ? '∞' : run.ammo);
  write('speed', Math.round(pace(run.time)));
  write('combo', run.streak >= 2 ? run.streak + ' IN A ROW  ·  ×' + multiplier : '');
}

function panel(next) {
  state = next;
  redraw = true;
  const active = next === 'playing';
  const title = next === 'title';
  const paused = next === 'paused';
  $('overlay').hidden = active;
  $('hud').hidden = !active;
  $('status').hidden = !active;
  $('drive').hidden = !active;
  $('pause').hidden = !active;
  $('footer').hidden = active;
  $('steps').hidden = !title;
  $('results').hidden = next !== 'finished';
  $('practice').hidden = paused;
  $('menu').hidden = title;
  $('panelTitle').classList.toggle('compact', !title);
  $('panelTitle').innerHTML = title ? 'BOTTLE<span>TOSS</span>' : paused ? 'PIT <span>STOP</span>' : 'RUN <span>COMPLETE</span>';
  write('intro', title ? 'Ride in the back seat on the Sunset Circuit. Time your throw as a roadside sign sweeps into range.'
    : paused ? 'Your run is on hold.' : 'Take another run at your best score.');
  $('start').firstChild.nodeValue = title ? 'Start run ' : paused ? 'Resume ' : 'Run again ';
  if (active) canvas.focus({ preventScroll: true });
  else $('start').focus({ preventScroll: true });
  updateHUD();
}

function start(practice) {
  warmAudio();
  playSound('start');
  cancelHold();
  run = newRun(practice);
  lean = 0;
  fillRoad();
  panel('playing');
  updatePrompt(null);
}

function finish() {
  cancelHold();
  if (run.score > best) {
    best = run.score;
    save('best', String(best));
    writeBest();
  }
  const stats = [
    [run.score, 'SCORE'], [run.hits + '/' + run.tossed, 'HITS'],
    [(run.tossed ? Math.round(run.hits * 100 / run.tossed) : 0) + '%', 'ACCURACY'],
    [run.longest, 'BEST STREAK'],
  ];
  $('results').replaceChildren(...stats.map(([value, label]) => {
    const cell = document.createElement('span'), number = document.createElement('b');
    number.textContent = value;
    cell.append(number, label);
    return cell;
  }));
  panel('finished');
}

function pause() {
  if (state !== 'playing') return;
  cancelHold();
  panel('paused');
}

function canThrow() {
  return state === 'playing' && (run.practice || (run.ammo > 0 && run.time < DURATION))
    && run.time >= run.pullbackUntil;
}

function beginHold(input, x = 0, y = 0, target = null) {
  if (hold || !canThrow()) return false;
  warmAudio();
  hold = { input, x, y, time: run.time, target };
  run.aim = { ...HOME };
  return true;
}

function cancelHold() {
  const previous = hold;
  hold = null;
  keyAim.clear();
  if (previous?.target?.hasPointerCapture(previous.input)) previous.target.releasePointerCapture(previous.input);
}

function fillRoad() {
  while (run.nextZ < run.dist + 300) {
    run.targets.push(makeTarget(run.nextIndex, run.nextZ));
    run.nextZ += (run.practice ? 55 : 73) + (run.nextIndex * 17 % 19);
    run.nextIndex++;
  }
  run.targets = run.targets.filter(target => target.z > run.dist - 5);
}

function aimAt(x, y) {
  run.aim.x = clamp(x, 3.9, 7.65);
  run.aim.y = clamp(y, 1.40, 3.32);
}

function targetGuide() {
  const future = distance(run.time + FLIGHT);
  let guide = null;
  let contact = null;
  let nearest = Infinity;
  for (const target of run.targets) {
    if (target.hitAt !== null) continue;
    const depth = target.z - future;
    const offset = Math.abs(depth - AIM_DEPTH);
    if (depth < 8 || depth > 34 || offset >= nearest) continue;
    nearest = offset;
    guide = target;
    contact = targetContact(target, depth, run.aim, run.practice);
  }
  return { guide, contact };
}

function release(input) {
  if (hold?.input !== input) return;
  const duration = run.time - hold.time;
  cancelHold();
  if (!canThrow()) return;
  if (duration < WINDUP) {
    message('HOLD A LITTLE LONGER', .85);
    return;
  }
  const future = distance(run.time + FLIGHT);
  const { guide, contact } = targetGuide();
  const hit = contact?.hit;
  const shot = {
    aim: { ...run.aim }, depth: hit ? guide.z - future : AIM_DEPTH, age: 0, at: run.time,
    origin: scene.launchOrigin(run.aim, lean, reduced.matches),
    target: hit ? guide : null, perfect: Boolean(contact?.perfect),
    miss: !guide ? 'OUT OF RANGE' : contact.t > 1 ? 'TOO EARLY'
      : contact.t < -1 ? 'TOO LATE' : 'MISSED · ADJUST AIM',
  };
  run.shots.push(shot);
  run.lastThrow = run.time;
  run.tossed++;
  if (!run.practice) run.ammo--;
  run.pullbackUntil = run.time + FLIGHT + .07;
  playSound('throw');
  updateHUD();
}

function message(text, seconds) {
  run.callout = text;
  run.calloutUntil = run.time + seconds;
}

function resolve(shot) {
  if (!shot.target) {
    run.streak = 0;
    message(shot.miss, 1.0);
    playSound('miss');
    return;
  }
  const target = shot.target;
  target.hitAt = run.time;
  run.hits++;
  run.streak++;
  run.longest = Math.max(run.streak, run.longest);
  const { points } = scoreHit(target.kind, run.streak, shot.perfect);
  run.score += points;
  run.hitUntil = run.time + .18;
  run.bursts.push({ x: shot.aim.x, y: shot.aim.y, z: target.z, age: 0, points });
  message((shot.perfect ? 'PERFECT · ' : 'HIT · ') + signs[target.kind].name + ' +' + points, 1.15);
  playSound('hit', shot.perfect);
}

function updatePrompt(contact) {
  const lock = contact?.hit;
  const charged = hold && run.time - hold.time >= WINDUP;
  const recent = run.calloutUntil > run.time;
  const prompt = hold ? !charged ? 'LEANING OUT…' : lock ? 'RELEASE NOW'
    : !contact ? 'WATCH FOR THE NEXT SIGN' : contact.t > 1 ? 'WAIT FOR GREEN'
    : contact.t < -1 ? 'SIGN PASSED' : 'LINE UP THE SIGHT'
    : recent ? run.callout : run.shots.length ? 'BOTTLE IN FLIGHT' : canThrow() ? 'HOLD TO LEAN' : 'RUN COMPLETE';
  write('callout', prompt);
  $('callout').classList.toggle('ready', Boolean(charged && lock));
  $('throw').classList.toggle('held', Boolean(hold));
  const buttonText = hold ? charged && lock ? 'RELEASE NOW' : 'DRAG TO AIM' : canThrow() ? 'HOLD TO LEAN' : 'WAIT…';
  write('throw', buttonText);
  $('throw').setAttribute('aria-disabled', String(!hold && !canThrow()));
}

function simulate(dt) {
  run.time += dt;
  run.dist = distance(run.time);
  fillRoad();
  if (hold?.input === 'key') {
    let x = 0, y = 0;
    keyAim.forEach(code => { const [dx,dy] = directions.get(code); x += dx; y += dy; });
    aimAt(run.aim.x + x*dt*2.5, run.aim.y + y*dt*1.75);
  }
  run.shots.forEach(shot => {
    shot.age = (run.time - shot.at) / FLIGHT;
    if (shot.age >= 1) resolve(shot);
  });
  run.shots = run.shots.filter(shot => shot.age < 1);
  run.bursts.forEach(burst => { burst.age += dt; });
  run.bursts = run.bursts.filter(burst => burst.age < .78);
  if (!run.practice && (run.time >= DURATION || run.ammo === 0) && run.shots.length === 0
      && run.time >= run.pullbackUntil && !run.bursts.length) finish();
}

function frame(timestamp) {
  requestAnimationFrame(frame);
  const animated = state === 'playing' || (state === 'title' && !reduced.matches);
  const dt = lastFrame ? Math.max(0, (timestamp - lastFrame) / 1000) : 0;
  lastFrame = timestamp;
  if (!animated && !redraw) return;
  if (state === 'title' && !redraw && timestamp - lastDraw < 38) {
    elapsed += dt;
    return;
  }
  redraw = false;
  lastDraw = timestamp;
  if (!reduced.matches || state !== 'title') elapsed += dt;
  if (state === 'playing') simulate(dt);
  const active = state === 'playing';
  const title = state === 'title';
  const { guide, contact } = active && hold ? targetGuide() : { guide: null, contact: null };
  const showThrow = active && (run.shots.length > 0 || run.hitUntil > run.time);
  const targetLean = active && hold ? 1 : showThrow ? .91 : 0;
  const easing = targetLean > lean ? 15 : 9;
  if (active || title) lean += (targetLean - lean) * (1 - Math.exp(-dt * easing));
  if (active) { updateHUD(); updatePrompt(contact); }
  const time = title ? elapsed : run.time;
  const hitShake = active && !reduced.matches ? Math.max(0, run.hitUntil - time) * Math.sin(time * 145) * 21 : 0;
  const bob = reduced.matches ? 0 : Math.sin(time * 3.8) * Math.min(2.5, scene.h*.005) + hitShake;
  const view = {
    time, dist: title ? elapsed * 24 : run.dist, lean, bob, holding: active && Boolean(hold), guide, contact,
    charge: hold ? clamp((run.time - hold.time) / WINDUP, 0, 1) : 1,
    follow: !hold && run.lastThrow !== null ? (run.time - run.lastThrow) / FLIGHT : null,
    aim: run.aim, reduced: reduced.matches, shots: run.shots, bursts: run.bursts,
    targets: title ? titleTargets(time) : run.targets, ammo: run.practice ? AMMO : run.ammo,
  };
  scene.render(view);
}

function titleTargets(time) {
  const dist = time * 24;
  const first = Math.floor(dist / 80);
  return Array.from({length: 5}, (_, i) => makeTarget(first + i, (first + i)*80 + 24));
}

for (const surface of controls) {
  surface.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !event.isPrimary) return;
    if (!beginHold(event.pointerId,event.clientX,event.clientY,surface)) return;
    event.preventDefault();
    surface.setPointerCapture(event.pointerId);
  });
  surface.addEventListener('pointermove', event => {
    if (hold?.input !== event.pointerId) return;
    const unit = Math.min(scene.w, scene.h);
    const speed = event.pointerType === 'mouse' ? 11 : 16;
    aimAt(HOME.x + (event.clientX - hold.x) * speed / unit, HOME.y - (event.clientY - hold.y) * speed / unit);
  });
  surface.addEventListener('pointerup', event => release(event.pointerId));
  for (const type of ['pointercancel', 'lostpointercapture']) {
    surface.addEventListener(type, event => { if (hold?.input === event.pointerId) cancelHold(); });
  }
  surface.addEventListener('contextmenu', event => event.preventDefault());
}

document.addEventListener('keydown', event => {
  if (event.code === 'Escape' && !event.repeat) {
    if (state === 'playing') pause();
    else if (state === 'paused') panel('playing');
    return;
  }
  if (state !== 'playing' || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.code === 'Space' && (!event.target.closest('button') || event.target === $('throw'))) {
    event.preventDefault();
    if (!event.repeat) beginHold('key');
  }
  if (hold?.input === 'key' && directions.has(event.code)) {
    event.preventDefault();
    keyAim.add(event.code);
  }
});

document.addEventListener('keyup', event => {
  keyAim.delete(event.code);
  if (event.code === 'Space' && hold?.input === 'key') {
    event.preventDefault();
    release('key');
  }
});

window.addEventListener('blur', pause);
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
new ResizeObserver(() => { scene.resize(); redraw = true; }).observe(canvas);
reduced.addEventListener('change', () => { redraw = true; });
$('sound').addEventListener('click', () => {
  sound = !sound;
  save('sound', sound ? 'on' : 'off');
  updateSound();
  if (sound) { warmAudio(); playSound('start'); }
});
$('pause').addEventListener('click', pause);
$('menu').addEventListener('click', () => { cancelHold(); panel('title'); });
$('start').addEventListener('click', () => state === 'paused' ? panel('playing') : start(false));
$('practice').addEventListener('click', () => start(true));
updateSound();
writeBest();
requestAnimationFrame(frame);

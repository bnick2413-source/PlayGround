import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const canvas = document.querySelector('#scene');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x171b31);
scene.fog = new THREE.FogExp2(0x171b31, 0.035);
const camera = new THREE.PerspectiveCamera(53, innerWidth / innerHeight, 0.1, 100);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

const clock = new THREE.Clock();
const colliders = [];
const particles = [];
const worldItems = [];
const tempV = new THREE.Vector3();
const player = { x: 0, z: 5.3, heading: Math.PI, speed: 0, moving: false };
let started = false, dialogueOpen = false, petals = 0, affinity = 0, ended = false;
let nearest = null, toastTimer = 0, audioCtx = null, soundOn = false;
const keys = new Set();

scene.add(new THREE.HemisphereLight(0xb9c9f1, 0x34334c, 1.55));
const moon = new THREE.DirectionalLight(0xe4eaff, 2.4);
moon.position.set(-5, 11, 6); moon.castShadow = true;
moon.shadow.mapSize.set(1024, 1024); moon.shadow.camera.left = -14; moon.shadow.camera.right = 14; moon.shadow.camera.top = 14; moon.shadow.camera.bottom = -14;
scene.add(moon);
const warm = new THREE.PointLight(0xffc982, 34, 8, 2); warm.position.set(-4, 2, 0); scene.add(warm);
const cool = new THREE.PointLight(0x879fe8, 27, 11, 2); cool.position.set(4, 3, -6); scene.add(cool);

const mat = (color, roughness = .82, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
const groundMat = mat(0x283345);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), groundMat);
ground.rotation.x = -Math.PI / 2; ground.position.y = -.08; ground.receiveShadow = true; scene.add(ground);
const path = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 22), mat(0x605267));
path.rotation.x = -Math.PI / 2; path.position.set(0, -.035, 0); path.receiveShadow = true; scene.add(path);
const pond = new THREE.Mesh(new THREE.CircleGeometry(3.2, 48), new THREE.MeshStandardMaterial({ color: 0x283e57, roughness: .22, metalness: .35, transparent: true, opacity: .9 }));
pond.rotation.x = -Math.PI / 2; pond.position.set(4.7, -.02, -3.1); scene.add(pond);
const pondRim = new THREE.Mesh(new THREE.TorusGeometry(3.18, .09, 8, 60), mat(0x757184)); pondRim.rotation.x = Math.PI / 2; pondRim.position.set(4.7, .01, -3.1); scene.add(pondRim);

function box(parent, size, material, pos, cast = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material); mesh.position.set(...pos); mesh.castShadow = cast; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function sphere(parent, radius, material, pos, scale = [1, 1, 1], segments = 14) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, segments, Math.max(8, segments - 3)), material); mesh.position.set(...pos); mesh.scale.set(...scale); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function cylinder(parent, a, b, height, material, pos, radial = 10) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(a, b, height, radial), material); mesh.position.set(...pos); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
function glow(color, strength) { return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: strength, roughness: .45 }); }

// Soft moon disc and scattered stars make a deep, layered night sky.
const moonBall = new THREE.Mesh(new THREE.SphereGeometry(1.05, 24, 16), new THREE.MeshBasicMaterial({ color: 0xf1e7c9 })); moonBall.position.set(-10, 13, -20); scene.add(moonBall);
const moonHalo = new THREE.Mesh(new THREE.SphereGeometry(1.35, 18, 12), new THREE.MeshBasicMaterial({ color: 0xd7d8ed, transparent: true, opacity: .08, side: THREE.BackSide })); moonHalo.position.copy(moonBall.position); scene.add(moonHalo);
for (let i = 0; i < 110; i++) {
  const star = new THREE.Mesh(new THREE.SphereGeometry(.018 + Math.random() * .025, 5, 4), new THREE.MeshBasicMaterial({ color: Math.random() > .5 ? 0xf5dfb0 : 0xb9c9ee, transparent: true, opacity: .45 + Math.random() * .5 }));
  star.position.set((Math.random() - .5) * 55, 7 + Math.random() * 18, -15 - Math.random() * 24); scene.add(star);
}

// Torii gate, built from sturdy, simple forms.
const torii = new THREE.Group(); scene.add(torii); torii.position.set(0, 0, -8.6);
const vermilion = mat(0x983f4c), darkWood = mat(0x422f3a);
box(torii, [.28, 4.1, .32], vermilion, [-2.5, 2, 0]); box(torii, [.28, 4.1, .32], vermilion, [2.5, 2, 0]);
box(torii, [6.3, .32, .52], vermilion, [0, 4.05, 0]); box(torii, [6.8, .26, .72], darkWood, [0, 4.37, 0]);
box(torii, [4.6, .2, .4], darkWood, [0, 2.92, 0]);

// Stone lanterns and their warm pools of light.
function makeLantern(x, z) {
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
  const stone = mat(0x676875), lightMat = glow(0xffcf83, 1.65);
  cylinder(g, .32, .38, .46, stone, [0, .23, 0], 6); cylinder(g, .25, .31, .12, stone, [0, .53, 0], 6);
  box(g, [.48, .44, .48], stone, [0, .83, 0]);
  const lit = new THREE.Mesh(new THREE.BoxGeometry(.29, .25, .29), lightMat); lit.position.y = .84; g.add(lit);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(.42, .24, 6), stone); cap.position.y = 1.19; cap.rotation.y = Math.PI / 6; g.add(cap);
  const l = new THREE.PointLight(0xffc777, 7, 5, 2); l.position.set(0, 1, 0); g.add(l);
  return g;
}
makeLantern(-3.9, 1.2); makeLantern(3.7, 2.5); makeLantern(-3.2, -5.1); makeLantern(1.9, -6.2);

// Low-poly flowering trees and shrubs around the edges of the garden.
const trunkMat = mat(0x4c3b43), leafMats = [mat(0x344a56), mat(0x40505f), mat(0x485267), mat(0x674c66)];
function makeTree(x, z, size = 1) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(size); scene.add(g);
  cylinder(g, .17, .27, 2.5, trunkMat, [0, 1.25, 0], 7);
  for (let i = 0; i < 4; i++) {
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(.93 - i * .08, 1), leafMats[(Math.random() * leafMats.length) | 0]);
    crown.position.set((Math.random() - .5) * .55, 2.05 + i * .47, (Math.random() - .5) * .5); crown.scale.set(1.1, .76, .9); crown.castShadow = true; g.add(crown);
  }
  sphere(g, .25, mat(0x916a83), [.34, 2.05, .2], [1.3, .8, 1]);
  colliders.push({ x, z, r: 1.05 * size });
}
[[-7,-5,1.3],[-7,-.2,1.2],[-7,5,1.25],[7,-7,1.35],[8,-1,1.25],[7,5,1.5],[-5,-10,1.4],[5,-11,1.3],[-10,-9,1.5],[10,-10,1.6]].forEach(p => makeTree(...p));
for (let i = 0; i < 24; i++) {
  const x = (Math.random() - .5) * 18, z = (Math.random() - .5) * 18;
  if (Math.abs(x) < 3 && Math.abs(z) < 8) continue;
  const shrub = new THREE.Mesh(new THREE.IcosahedronGeometry(.35 + Math.random() * .28, 0), leafMats[(Math.random() * leafMats.length) | 0]); shrub.position.set(x, .22, z); shrub.scale.y = .7; shrub.castShadow = true; scene.add(shrub);
}

// Player avatar, seen from behind: an adult traveler in a midnight-blue coat.
const avatar = new THREE.Group(); scene.add(avatar);
const coatMat = mat(0x354464), coatTrim = mat(0xd0b88e), skin = mat(0xe4b89d), hair = mat(0x272b43), boots = mat(0x211e2c);
const coat = new THREE.Mesh(new THREE.CapsuleGeometry(.36, .75, 4, 8), coatMat); coat.position.y = 1.1; coat.castShadow = true; avatar.add(coat);
box(avatar, [.45, .05, .44], coatTrim, [0, .75, 0]);
sphere(avatar, .34, skin, [0, 2.06, 0], [1, 1.08, .9]);
sphere(avatar, .37, hair, [0, 2.24, -.09], [1.02, .7, 1.04]);
const scarf = new THREE.Mesh(new THREE.CapsuleGeometry(.13, .33, 3, 6), mat(0x8d526d)); scarf.position.set(.13, 1.85, -.13); scarf.rotation.z = -.3; avatar.add(scarf);
for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.CapsuleGeometry(.13, .38, 3, 6), boots); leg.position.set(s * .2, .35, 0); avatar.add(leg); }
const stepBob = new THREE.Group();

// Mika, a 24-year-old shrine caretaker, in a modest plum-and-cream yukata.
const mika = new THREE.Group(); scene.add(mika); mika.position.set(0, 0, -3.6);
const yukata = mat(0x78566f), ivory = mat(0xe6d7bd), mikaSkin = mat(0xf0c6ae), mikaHair = mat(0x37283b), sash = mat(0xc89176);
const body = new THREE.Mesh(new THREE.CapsuleGeometry(.39, .84, 5, 9), yukata); body.position.y = 1.08; body.castShadow = true; mika.add(body);
const collar = new THREE.Mesh(new THREE.ConeGeometry(.2, .59, 4), ivory); collar.position.set(0, 1.65, .25); collar.rotation.x = -.35; collar.rotation.z = Math.PI / 4; mika.add(collar);
box(mika, [.68, .18, .5], sash, [0, 1.3, 0]);
sphere(mika, .34, mikaSkin, [0, 2.13, 0], [1, 1.05, .92]);
sphere(mika, .4, mikaHair, [0, 2.31, -.09], [1.08, .7, 1.03]);
// Fringe and long side locks.
sphere(mika, .22, mikaHair, [0, 2.34, .27], [1.4, .45, .52]);
for (const s of [-1, 1]) { const lock = new THREE.Mesh(new THREE.CapsuleGeometry(.11, .42, 4, 7), mikaHair); lock.position.set(s * .3, 1.93, .05); lock.rotation.z = s * -.16; mika.add(lock); }
const flower = new THREE.Group(); flower.position.set(.29, 2.45, .13); mika.add(flower);
for (let i = 0; i < 5; i++) { const petal = sphere(flower, .07, mat(0xf0d4d0), [Math.cos(i * 1.256) * .1, Math.sin(i * 1.256) * .1, 0], [1, 1.2, .55], 9); }
sphere(flower, .04, mat(0xe8c98c), [0, 0, .025], [1, 1, .6], 9);
const lanternGlow = new THREE.PointLight(0xffc982, 7, 4, 2); lanternGlow.position.set(-.7, 1.4, .4); mika.add(lanternGlow);

// The three floating wish petals.
const petalPositions = [[-3.1, 0, 1.1], [4.55, 0, -1.6], [2.7, 0, -6.15]];
const petalMat = glow(0xf6d698, 2.2);
function createPetal(index, pos) {
  const group = new THREE.Group(); group.position.set(...pos); scene.add(group);
  const shape = new THREE.Shape(); shape.moveTo(0, -.2); shape.bezierCurveTo(-.34, .05, -.13, .48, 0, .23); shape.bezierCurveTo(.13, .48, .34, .05, 0, -.2);
  const geo = new THREE.ShapeGeometry(shape); const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xf7d990, side: THREE.DoubleSide })); mesh.rotation.x = -.3; group.add(mesh);
  const orb = new THREE.Mesh(new THREE.SphereGeometry(.12, 12, 8), petalMat); orb.position.y = .03; group.add(orb);
  const point = new THREE.PointLight(0xffd989, 3.2, 3.4, 2); point.position.y = .25; group.add(point);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(.35, .012, 5, 32), new THREE.MeshBasicMaterial({ color: 0xf5d58c, transparent: true, opacity: .55 })); halo.rotation.x = Math.PI / 2; group.add(halo);
  group.userData = { index, baseY: pos[1] + .82, phase: Math.random() * 6.28, collected: false };
  worldItems.push(group); return group;
}
petalPositions.forEach((p, i) => createPetal(i, p));

// Interactable shrine bell: a decorative landmark and the final meeting point.
const bell = new THREE.Group(); bell.position.set(-4.2, 0, -6.2); scene.add(bell);
const bellWood = mat(0x745a55), bellMetal = mat(0xa58c69, .38, { metalness: .55 });
box(bell, [.12, 3, .12], bellWood, [-.7, 1.5, 0]); box(bell, [.12, 3, .12], bellWood, [.7, 1.5, 0]); box(bell, [1.8, .16, .15], bellWood, [0, 2.9, 0]);
const bellBody = new THREE.Mesh(new THREE.CylinderGeometry(.28, .4, .63, 12), bellMetal); bellBody.position.set(0, 1.62, 0); bell.add(bellBody);
const clapper = new THREE.Mesh(new THREE.SphereGeometry(.11, 10, 8), bellMetal); clapper.position.set(0, 1.18, 0); bell.add(clapper);
const rope = new THREE.Mesh(new THREE.CylinderGeometry(.018, .018, 1.08, 6), mat(0xb99a71)); rope.position.set(0, 2.38, 0); bell.add(rope);

// Pale stepping stones and tiny flowers add scale to the path.
const stoneMat = mat(0x777481);
for (let i = 0; i < 10; i++) {
  const z = 7.5 - i * 1.45;
  const stone = new THREE.Mesh(new THREE.CylinderGeometry(.55, .62, .11, 7), stoneMat); stone.position.set((i % 2 ? .4 : -.35), .015, z); stone.rotation.y = i * .42; stone.receiveShadow = true; scene.add(stone);
}
for (let i = 0; i < 38; i++) {
  const x = (Math.random() - .5) * 16, z = (Math.random() - .5) * 16;
  if (Math.abs(x) < 2.3 && z > -8 && z < 7) continue;
  sphere(scene, .045, [mat(0xc99cac), mat(0xdcc89c), mat(0x8a9ab8)][i % 3], [x, .08, z], [1, .75, 1], 7);
}

// A handful of drifting fireflies; their motion is deliberately slow and calm.
const fireflyMat = new THREE.MeshBasicMaterial({ color: 0xe7d294 });
for (let i = 0; i < 18; i++) {
  const fly = new THREE.Mesh(new THREE.SphereGeometry(.035, 7, 6), fireflyMat);
  fly.position.set((Math.random() - .5) * 17, .45 + Math.random() * 2.2, (Math.random() - .5) * 17);
  fly.userData.phase = Math.random() * 6.28; scene.add(fly); particles.push(fly);
}

const $ = s => document.querySelector(s);
const questTitle = $('#quest-title'), questSubtitle = $('#quest-subtitle'), dialogue = $('#dialogue');
const hint = $('#interaction-hint'), hintText = $('#hint-text'), toast = $('#toast');
const choiceBox = $('#choices'), continueButton = $('#continue-button');
const dialogueText = $('#dialogue-text');

function showToast(message) {
  toast.textContent = message; toast.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 2300);
}
function updateQuest() {
  document.querySelectorAll('.petal-slot').forEach((el, i) => el.classList.toggle('filled', i < petals));
  if (petals < 3) {
    questTitle.textContent = 'Find the three wishes';
    questSubtitle.textContent = petals === 0 ? 'Look around the garden for falling petals.' : 'A little more of the night is yours.';
  } else {
    questTitle.textContent = 'Share your wishes with Mika';
    questSubtitle.textContent = 'She is waiting beneath the torii gate.';
  }
}
function playChime(freq = 660) {
  if (!soundOn) return;
  try {
    audioCtx ||= new AudioContext();
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.type = 'sine'; osc.frequency.value = freq; gain.gain.setValueAtTime(.035, audioCtx.currentTime); gain.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + .45);
    osc.connect(gain); gain.connect(audioCtx.destination); osc.start(); osc.stop(audioCtx.currentTime + .46);
  } catch {}
}
function openDialogue(text, choices = []) {
  dialogueOpen = true; dialogue.classList.remove('hidden'); hint.classList.add('hidden');
  dialogueText.textContent = text; choiceBox.replaceChildren(); continueButton.classList.add('hidden');
  choices.forEach(({ label, onChoose }) => {
    const b = document.createElement('button'); b.className = 'choice-button'; b.textContent = label;
    b.addEventListener('click', () => { playChime(560); onChoose(); }); choiceBox.append(b);
  });
}
function closeDialogue() { dialogueOpen = false; dialogue.classList.add('hidden'); }
function talkToMika() {
  if (ended) {
    openDialogue('The bell rings softly in the night. Mika smiles, and for a moment, the whole garden feels like it belongs just to the two of you.', [{ label: 'Stay a little longer', onChoose: () => { closeDialogue(); showToast('Some nights are worth taking slowly.'); } }]); return;
  }
  if (petals < 3) {
    openDialogue(petals === 0 ? 'You made it. I was beginning to think the moon would keep me company all night. Would you help me find three wish-petals?' : `You found ${petals} ${petals === 1 ? 'wish' : 'wishes'} already. Each one is said to remember something you almost forgot.`, [
      { label: '“I’d love to help.”', onChoose: () => { affinity++; closeDialogue(); showToast(petals === 0 ? 'Wish-petals glow softly around the garden.' : 'Mika gives you an encouraging smile.'); } },
      { label: '“Tell me about this place.”', onChoose: () => { affinity++; openDialogue('My grandmother tended this garden. She said wishes don’t need to be grand. Sometimes they’re just a quiet place to sit, or someone who listens.', [{ label: '“That sounds lovely.”', onChoose: () => { closeDialogue(); } }]); } }
    ]);
  } else {
    openDialogue('Three little wishes, all gathered. What will you wish for?', [
      { label: '“A new beginning.”', onChoose: () => finishStory('A new beginning') },
      { label: '“More nights like this.”', onChoose: () => finishStory('More nights like this') },
      { label: '“Someone to share them with.”', onChoose: () => finishStory('Someone to share them with') }
    ]);
  }
}
function finishStory(wish) {
  ended = true; affinity++; $('#ending-ribbon').classList.remove('hidden');
  openDialogue(`“${wish},” Mika repeats, turning the wish-petal between her fingers. “Then let’s make a promise: we’ll come back and see what the morning brings.” The shrine bell catches a silver note in the breeze.`, [
    { label: '“It’s a promise.”', onChoose: () => { closeDialogue(); showToast('The night is yours to keep. ✦'); playChime(784); } },
    { label: 'Take a quiet moment together', onChoose: () => { closeDialogue(); showToast('A soft ending to a lovely night.'); playChime(784); } }
  ]);
}
function collectPetal(item) {
  if (item.userData.collected) return;
  item.userData.collected = true; item.visible = false; petals++; updateQuest(); playChime(740);
  showToast(petals === 3 ? 'All three wishes found. Mika is waiting by the torii.' : `Wish-petal found · ${petals} of 3`);
}
function nearestInteraction() {
  let found = null, best = 2.45;
  for (const item of worldItems) if (!item.userData.collected) {
    const d = Math.hypot(player.x - item.position.x, player.z - item.position.z);
    if (d < best) { found = { type: 'petal', item, d }; best = d; }
  }
  const md = Math.hypot(player.x - mika.position.x, player.z - mika.position.z);
  if (md < 2.75 && md < best) { found = { type: 'mika', d: md }; best = md; }
  const bd = Math.hypot(player.x - bell.position.x, player.z - bell.position.z);
  if (bd < 2 && bd < best) found = { type: 'bell', d: bd };
  return found;
}
function interact() {
  if (!started || dialogueOpen) return;
  const target = nearestInteraction();
  if (!target) { showToast('Wander a little closer to something that glows.'); return; }
  if (target.type === 'petal') collectPetal(target.item);
  if (target.type === 'mika') talkToMika();
  if (target.type === 'bell') {
    bell.rotation.y += .18; playChime(490);
    showToast(petals === 3 ? 'The bell’s silver note carries your wishes to the sky.' : 'A soft bell-note drifts through the garden.');
  }
}

function clampPlayer(nx, nz) {
  nx = THREE.MathUtils.clamp(nx, -8.7, 8.7); nz = THREE.MathUtils.clamp(nz, -10.7, 8.7);
  for (const c of colliders) {
    const dx = nx - c.x, dz = nz - c.z, d = Math.hypot(dx, dz), min = c.r + .34;
    if (d < min) { const a = Math.atan2(dz, dx); nx = c.x + Math.cos(a) * min; nz = c.z + Math.sin(a) * min; }
  }
  // Keep the pond edge impassable except for the approach from its north side.
  const dx = nx - 4.7, dz = nz + 3.1, d = Math.hypot(dx, dz);
  if (d < 3.45) { const a = Math.atan2(dz, dx); nx = 4.7 + Math.cos(a) * 3.45; nz = -3.1 + Math.sin(a) * 3.45; }
  return [nx, nz];
}

let joy = { x: 0, y: 0, active: false, pointer: null };
const joystick = $('#joystick'), knob = $('#joy-knob');
function updateJoy(e) {
  const r = joystick.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2), max = r.width * .32;
  const mag = Math.min(max, Math.hypot(dx, dy)), a = Math.atan2(dy, dx), x = Math.cos(a) * mag, y = Math.sin(a) * mag;
  joy.x = x / max; joy.y = y / max;
  knob.style.left = `calc(50% + ${x}px)`; knob.style.top = `calc(50% + ${y}px)`;
}
joystick.addEventListener('pointerdown', e => { e.preventDefault(); joy.active = true; joy.pointer = e.pointerId; joystick.setPointerCapture(e.pointerId); updateJoy(e); });
joystick.addEventListener('pointermove', e => { if (joy.active && e.pointerId === joy.pointer) updateJoy(e); });
function releaseJoy() { joy.active = false; joy.x = 0; joy.y = 0; knob.style.left = '50%'; knob.style.top = '50%'; }
joystick.addEventListener('pointerup', releaseJoy); joystick.addEventListener('pointercancel', releaseJoy);
$('#action-button').addEventListener('pointerdown', e => { e.preventDefault(); interact(); });
window.addEventListener('keydown', e => {
  const key = e.key.toLowerCase();
  if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright',' '].includes(key)) e.preventDefault();
  keys.add(key);
  if ((key === 'e' || key === ' ') && !e.repeat) interact();
  if (key === 'escape' && dialogueOpen) closeDialogue();
});
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
$('#close-dialogue').addEventListener('click', closeDialogue);
$('#continue-button').addEventListener('click', closeDialogue);
$('#start-button').addEventListener('click', () => { started = true; $('#start-screen').classList.add('hidden'); showToast('Find the three wish-petals. Mika is just ahead.'); playChime(660); });
$('#sound-toggle').addEventListener('click', e => { soundOn = !soundOn; e.currentTarget.innerHTML = `${soundOn ? '♫' : '♪'} <span>${soundOn ? 'Sound on' : 'Sound off'}</span>`; playChime(); });
$('#help-button').addEventListener('click', () => $('#help-screen').classList.remove('hidden'));
$('.modal-close').addEventListener('click', () => $('#help-screen').classList.add('hidden'));
$('.guide-ok').addEventListener('click', () => $('#help-screen').classList.add('hidden'));
$('#help-screen').addEventListener('click', e => { if (e.target.id === 'help-screen') e.currentTarget.classList.add('hidden'); });

function update(dt, time) {
  mika.position.y = Math.sin(time * 1.4) * .025;
  mika.rotation.y = Math.sin(time * .65) * .045;
  for (const item of worldItems) if (!item.userData.collected) {
    item.position.y = Math.sin(time * 1.5 + item.userData.phase) * .13;
    item.rotation.y += dt * .34;
    item.children[2].rotation.z = Math.sin(time + item.userData.phase) * .2;
  }
  for (const f of particles) {
    f.position.y += Math.sin(time * 1.2 + f.userData.phase) * .0018;
    f.position.x += Math.sin(time * .3 + f.userData.phase) * .0012;
    f.material.opacity = .45 + (Math.sin(time * 2 + f.userData.phase) + 1) * .25;
  }
  const forward = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0) - joy.y;
  const strafe = (keys.has('d') || keys.has('arrowright') ? 1 : 0) - (keys.has('a') || keys.has('arrowleft') ? 1 : 0) + joy.x;
  const magnitude = Math.hypot(forward, strafe), moving = started && !dialogueOpen && magnitude > .08;
  if (moving) {
    const f = forward / Math.max(1, magnitude), s = strafe / Math.max(1, magnitude);
    const speed = 3.15 * dt;
    const dx = (Math.sin(player.heading) * f + Math.cos(player.heading) * s) * speed;
    const dz = (Math.cos(player.heading) * f - Math.sin(player.heading) * s) * speed;
    const [nx, nz] = clampPlayer(player.x + dx, player.z + dz); player.x = nx; player.z = nz;
  }
  player.moving = moving;
  avatar.position.set(player.x, moving ? Math.abs(Math.sin(time * 9)) * .055 : 0, player.z);
  avatar.rotation.y = player.heading;
  avatar.rotation.z = moving ? Math.sin(time * 9) * .035 : 0;
  const backX = player.x - Math.sin(player.heading) * 5.9, backZ = player.z - Math.cos(player.heading) * 5.9;
  const targetCam = tempV.set(backX, 3.35, backZ);
  camera.position.lerp(targetCam, 1 - Math.pow(.001, dt));
  const look = new THREE.Vector3(player.x + Math.sin(player.heading) * .2, 1.2, player.z + Math.cos(player.heading) * .2);
  camera.lookAt(look);
  nearest = nearestInteraction();
  if (started && !dialogueOpen && nearest) {
    hint.classList.remove('hidden');
    hintText.textContent = nearest.type === 'mika' ? 'Talk to Mika' : nearest.type === 'bell' ? 'Ring the shrine bell' : 'Collect a wish-petal';
  } else hint.classList.add('hidden');
}
function resize() {
  camera.aspect = innerWidth / innerHeight; camera.fov = innerWidth < 700 ? 59 : 53; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
}
window.addEventListener('resize', resize);
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), .05), t = clock.elapsedTime;
  update(dt, t); renderer.render(scene, camera);
}
updateQuest();
// Initial camera composition frames the path, the player, and Mika before play begins.
camera.position.set(0, 3.9, 11.6); camera.lookAt(0, 1.15, -.4);
frame();

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const MODELS = './models/';
const DEFAULT_DIR = [0.62, 0.42, 0.92];

const { items } = await fetch('./manifest.json').then((r) => r.json());
const loader = new GLTFLoader();

// One renderer for the whole grid, scissored per card — a WebGL context per card
// would blow past the browser's ~16-context limit.
const gridCanvas = document.getElementById('grid-gl');
const renderer = new THREE.WebGLRenderer({ canvas: gridCanvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setScissorTest(true);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const pmrem = new THREE.PMREMGenerator(renderer);
const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

function fit(root, camera, controls) {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const ctr = box.getCenter(new THREE.Vector3());
  const radius = Math.max(size.length() / 2, 1e-4);
  root.position.sub(ctr);
  const d = new THREE.Vector3(...DEFAULT_DIR).normalize().multiplyScalar(radius * 2.6);
  camera.position.copy(d);
  camera.near = radius / 100;
  camera.far = radius * 100;
  camera.updateProjectionMatrix();
  controls.target.set(0, 0, 0);
  controls.update();
}

const cards = [];

for (const it of items) {
  const el = document.createElement('article');
  el.className = 'card';
  el.innerHTML = `
    <div class="stage" data-slug="${it.slug}"></div>
    <div class="body">
      <div class="brand">${it.brand}</div>
      <h2>${it.name}</h2>
      <div class="specs">
        <span>${it.tri.toLocaleString()} tri</span>
        <span>${(it.bytes / 1048576).toFixed(1)} MB</span>
        <span class="lic">${it.lic ?? ''}</span>
      </div>
      <div class="views">${it.views.map((v) => `<img loading="lazy" src="./qc/${v}" alt="${v}">`).join('')}</div>
      ${it.refs.length ? `<div class="refs">London / UK stock:
        ${it.refs.map((u, i) => `<a target="_blank" rel="noopener" href="${u}">${it.reflabels[i]}</a>`).join('')}</div>` : ''}
      <div class="src">source: ${it.src ?? ''}</div>
    </div>`;
  document.getElementById('grid').appendChild(el);

  const stage = el.querySelector('.stage');
  const scene = new THREE.Scene();
  scene.environment = envMap;
  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
  const controls = new OrbitControls(camera, stage);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.autoRotate = true;         // 360° turntable
  controls.autoRotateSpeed = 1.6;
  stage.addEventListener('pointerdown', () => { controls.autoRotate = false; });
  stage.addEventListener('dblclick', () => { controls.autoRotate = true; });

  loader.load(MODELS + it.file, (gltf) => {
    scene.add(gltf.scene);
    fit(gltf.scene, camera, controls);
    stage.classList.add('ready');
  }, undefined, () => { stage.classList.add('failed'); });

  cards.push({ stage, scene, camera, controls });
}

function frame() {
  requestAnimationFrame(frame);
  const w = innerWidth, h = innerHeight;
  if (renderer.domElement.width !== w * renderer.getPixelRatio()) renderer.setSize(w, h, false);
  for (const c of cards) {
    const r = c.stage.getBoundingClientRect();
    if (r.bottom < 0 || r.top > h || r.width === 0) continue;   // offscreen: skip
    const bottom = h - r.bottom;
    renderer.setViewport(r.left, bottom, r.width, r.height);
    renderer.setScissor(r.left, bottom, r.width, r.height);
    c.camera.aspect = r.width / r.height;
    c.camera.updateProjectionMatrix();
    c.controls.update();
    renderer.render(c.scene, c.camera);
  }
}
frame();

document.getElementById('q').addEventListener('input', (e) => {
  const t = e.target.value.toLowerCase();
  document.querySelectorAll('.card').forEach((c) => {
    c.style.display = c.innerText.toLowerCase().includes(t) ? '' : 'none';
  });
});

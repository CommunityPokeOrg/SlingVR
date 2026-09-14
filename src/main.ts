import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { CityGenerator } from './city/CityGenerator';
import { DesktopInput } from './input/DesktopInput';
import { XRInput } from './input/XRInput';
import { GAME } from './state';

const viewport = document.querySelector<HTMLDivElement>('#viewport');
if (!viewport) throw new Error('Viewport missing');

const scene = new THREE.Scene();
scene.background = new THREE.Color('#081322');
scene.fog = new THREE.Fog('#081322', 90, 520);

const camera = new THREE.PerspectiveCamera(74, innerWidth / innerHeight, 0.1, 900);
camera.position.set(0, GAME.eyeHeight, 12);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.xr.enabled = true;
viewport.appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer));

scene.add(new THREE.HemisphereLight('#b8d9ff', '#182334', 1.8));
const sun = new THREE.DirectionalLight('#ffe3bd', 2.2);
sun.position.set(-100, 180, 80);
scene.add(sun);

const city = new CityGenerator();
scene.add(city.group);

const desktop = new DesktopInput(camera, renderer.domElement, scene, city.data, renderer);
const xr = new XRInput(renderer, camera, city.data, scene);
const overlay = document.querySelector<HTMLElement>('#start-overlay');
document.querySelector<HTMLButtonElement>('#start-button')?.addEventListener('click', () => {
  overlay?.classList.add('hidden');
  desktop.requestLock();
});

let accumulator = 0;
let previous = performance.now();
renderer.setAnimationLoop((now) => {
  const elapsed = Math.min((now - previous) / 1000, 0.1);
  previous = now;
  accumulator += elapsed;
  let substeps = 0;
  while (accumulator >= GAME.fixedStep && substeps < GAME.maxSubsteps) {
    desktop.step(GAME.fixedStep);
    xr.step(GAME.fixedStep);
    accumulator -= GAME.fixedStep;
    substeps += 1;
  }
  desktop.updateCamera();
  xr.update();
  renderer.render(scene, camera);
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

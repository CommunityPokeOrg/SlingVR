import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { CityGenerator } from './city/CityGenerator';
import { Player } from './Player';
import { DesktopInput } from './input/DesktopInput';
import { XRInput } from './input/XRInput';
import { GAME } from './state';

const viewport = document.querySelector<HTMLDivElement>('#viewport');
if (!viewport) throw new Error('Viewport missing');

const scene = new THREE.Scene();
scene.background = new THREE.Color('#081322');
scene.fog = new THREE.Fog('#081322', 90, 520);

const camera = new THREE.PerspectiveCamera(74, innerWidth / innerHeight, 0.1, 900);
camera.position.set(0, 8 + GAME.eyeHeight, 12);
camera.rotation.set(-0.12, 0, 0, 'YXZ');

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
const player = new Player(city.data, scene);
const desktop = new DesktopInput(player, camera, renderer.domElement);
const xr = new XRInput(renderer, camera, player, scene);
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
  const input = renderer.xr.isPresenting ? xr.prepareFrame() : desktop.getFrameInput();
  let substeps = 0;
  while (accumulator >= GAME.fixedStep && substeps < GAME.maxSubsteps) {
    player.stepPhysics(GAME.fixedStep, input);
    accumulator -= GAME.fixedStep;
    substeps += 1;
  }
  if (renderer.xr.isPresenting) {
    xr.updateRig();
    const visualInputs = xr.getVisualInputs();
    player.updateVisuals(visualInputs.left, visualInputs.right, visualInputs.aimOrigin, visualInputs.aimDirection);
  } else {
    desktop.updateCamera();
    const visualInputs = desktop.getVisualInputs();
    player.updateVisuals(visualInputs.left, visualInputs.right, visualInputs.aimOrigin, visualInputs.aimDirection);
  }
  renderer.render(scene, camera);
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

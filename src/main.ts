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
scene.background = new THREE.Color('#3a7bd5');
scene.fog = new THREE.Fog('#f2b880', 110, 560);

const camera = new THREE.PerspectiveCamera(74, innerWidth / innerHeight, 0.1, 900);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.xr.enabled = true;
viewport.appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer));

const sky = new THREE.Mesh(
  new THREE.SphereGeometry(700, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      horizon: { value: new THREE.Color('#f2b880') },
      zenith: { value: new THREE.Color('#3a7bd5') },
    },
    vertexShader: 'varying vec3 vDirection; void main() { vDirection = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 horizon; uniform vec3 zenith; varying vec3 vDirection; void main() { float height = smoothstep(-0.15, 0.72, vDirection.y); gl_FragColor = vec4(mix(horizon, zenith, height), 1.0); }',
  }),
);
sky.renderOrder = -10;
scene.add(sky);
scene.add(new THREE.HemisphereLight('#9fc5ff', '#5a4636', 1.2));
scene.add(new THREE.AmbientLight('#f8dfc2', 0.35));
const sun = new THREE.DirectionalLight('#ffd9a0', 2.5);
sun.position.set(-120, 90, 80);
scene.add(sun);

const city = new CityGenerator();
scene.add(city.group);
const player = new Player(city.data, scene);
camera.position.copy(player.body.position);
camera.position.y += GAME.eyeHeight;
camera.rotation.set(0, 0, 0, 'YXZ');
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

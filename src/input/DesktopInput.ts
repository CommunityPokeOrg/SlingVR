import * as THREE from 'three';
import type { CityData } from '../city/CityGenerator';
import { raycastAABBs } from '../physics/collision';
import { AirTricks } from '../physics/AirTricks';
import { PlayerBody } from '../physics/PlayerBody';
import { WallRun } from '../physics/WallRun';
import { Web } from '../physics/Web';
import { Zip } from '../physics/Zip';
import { Reticle } from '../render/Reticle';
import { WebLine } from '../render/WebLine';
import { Hud } from '../ui/Hud';
import { GAME, type TravelState } from '../state';

export class DesktopInput {
  readonly body = new PlayerBody();
  private readonly leftWeb = new Web();
  private readonly rightWeb = new Web();
  private readonly zip = new Zip();
  private readonly wallRun = new WallRun();
  private readonly tricks = new AirTricks();
  private readonly hud = new Hud();
  private readonly leftLine = new WebLine();
  private readonly rightLine = new WebLine();
  private readonly reticle: Reticle;
  private readonly keys = new Set<string>();
  private yaw = 0;
  private pitch = 0;
  private leftHeld = false;
  private rightHeld = false;
  private readonly city: CityData;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;

  constructor(camera: THREE.PerspectiveCamera, canvas: HTMLCanvasElement, scene: THREE.Scene, city: CityData, renderer: THREE.WebGLRenderer) {
    this.camera = camera;
    this.canvas = canvas;
    this.city = city;
    this.renderer = renderer;
    this.reticle = new Reticle(scene);
    scene.add(this.leftLine.group, this.rightLine.group);
    addEventListener('keydown', this.onKeyDown);
    addEventListener('keyup', this.onKeyUp);
    addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('mousedown', this.onMouseDown);
    canvas.addEventListener('mouseup', this.onMouseUp);
    canvas.addEventListener('click', () => this.requestLock());
  }

  requestLock(): void {
    void this.canvas.requestPointerLock();
  }

  step(dt: number): void {
    if (this.renderer.xr.isPresenting) return;
    const forward = new THREE.Vector3(Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, Math.sin(this.yaw));
    const force = new THREE.Vector3();
    if (this.keys.has('KeyW')) force.add(forward);
    if (this.keys.has('KeyS')) force.addScaledVector(forward, -1);
    if (this.keys.has('KeyD')) force.add(right);
    if (this.keys.has('KeyA')) force.addScaledVector(right, -1);
    if (force.lengthSq() > 0) this.body.push(force.normalize(), 22 * dt);
    if (!this.zip.active) {
      this.body.step(dt, this.city.buildings);
      this.leftWeb.step(dt, this.body, this.city.buildings, this.leftHeld);
      this.rightWeb.step(dt, this.body, this.city.buildings, this.rightHeld);
      this.wallRun.step(dt, this.body, this.city.buildings, this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'), this.keys.has('KeyW') ? 1 : 0);
    } else this.zip.step(dt, this.body);
    this.tricks.step(dt);
    if (this.body.grounded) this.tricks.reset();
    this.hud.update(this.body, this.state(), this.tricks, this.leftWeb, this.rightWeb, this.zip, this.wallRun);
  }

  updateCamera(): void {
    this.camera.position.copy(this.body.position);
    this.camera.position.y += GAME.eyeHeight;
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    const origin = this.camera.position;
    const look = new THREE.Vector3(0, 0, -1).applyEuler(this.camera.rotation).normalize();
    const hit = raycastAABBs(origin, look, this.city.buildings, GAME.zipRange);
    let perch: THREE.Vector3 | null = null;
    let bestDistance: number = GAME.zipRange;
    for (const candidate of this.city.perches) {
      const offset = candidate.clone().sub(origin);
      const distance = offset.length();
      if (distance < bestDistance && offset.normalize().dot(look) > Math.cos(THREE.MathUtils.degToRad(20))) {
        bestDistance = distance;
        perch = candidate;
      }
    }
    this.reticle.update(perch ?? hit?.point ?? null, perch !== null);
    const leftOrigin = origin.clone().add(new THREE.Vector3(-0.28, -0.16, -0.5).applyEuler(this.camera.rotation));
    const rightOrigin = origin.clone().add(new THREE.Vector3(0.28, -0.16, -0.5).applyEuler(this.camera.rotation));
    this.leftLine.update(leftOrigin, this.leftWeb);
    this.rightLine.update(rightOrigin, this.rightWeb);
  }

  private readonly onMouseMove = (event: MouseEvent): void => {
    if (document.pointerLockElement !== this.canvas) return;
    this.yaw -= event.movementX * 0.0023;
    this.pitch = THREE.MathUtils.clamp(this.pitch - event.movementY * 0.0023, -1.45, 1.45);
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    this.keys.add(event.code);
    if (event.code === 'Space') {
      event.preventDefault();
      if (this.body.grounded) this.body.jump();
      else {
        this.leftWeb.release();
        this.rightWeb.release();
      }
    }
    if (event.code === 'KeyE') this.zip.launch(this.camera.position, new THREE.Vector3(0, 0, -1).applyEuler(this.camera.rotation), this.city);
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') this.tricks.dash(this.body, new THREE.Vector3(0, 0, -1).applyEuler(this.camera.rotation));
    if (event.code === 'KeyR') this.body.reset();
    if (event.code === 'KeyH') this.hud.toggleHelp();
    if (event.code === 'KeyF') this.hud.toggleDebug();
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  private readonly onMouseDown = (event: MouseEvent): void => {
    if (event.button === 1) {
      this.zip.launch(this.camera.position, new THREE.Vector3(0, 0, -1).applyEuler(this.camera.rotation), this.city);
      return;
    }
    const direction = new THREE.Vector3(0, 0, -1).applyEuler(this.camera.rotation).normalize();
    const hit = raycastAABBs(this.camera.position, direction, this.city.buildings, GAME.zipRange);
    if (!hit) return;
    if (event.button === 0) {
      this.leftHeld = true;
      this.leftWeb.attach(hit.point, this.body);
    } else if (event.button === 2) {
      this.rightHeld = true;
      this.rightWeb.attach(hit.point, this.body);
    }
  };

  private readonly onMouseUp = (event: MouseEvent): void => {
    if (event.button === 0) {
      this.leftHeld = false;
      this.leftWeb.release();
    } else if (event.button === 2) {
      this.rightHeld = false;
      this.rightWeb.release();
    }
  };

  private state(): TravelState {
    if (this.zip.active) return 'Zipping';
    if (this.wallRun.active) return 'WallRunning';
    const left = this.leftWeb.attached;
    const right = this.rightWeb.attached;
    if (left && right) return 'Swinging Both';
    if (left) return 'Swinging L';
    if (right) return 'Swinging R';
    return this.body.grounded ? 'Grounded' : 'Airborne';
  }
}

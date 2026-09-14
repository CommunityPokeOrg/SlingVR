import * as THREE from 'three';
import type { WebGLRenderer } from 'three';
import type { CityData } from '../city/CityGenerator';
import { PlayerBody } from '../physics/PlayerBody';
import { Web } from '../physics/Web';
import { Zip } from '../physics/Zip';

export class XRInput {
  private readonly renderer: WebGLRenderer;
  private readonly camera: THREE.Camera;
  private readonly city: CityData;
  private readonly body = new PlayerBody();
  private readonly left = new Web();
  private readonly right = new Web();
  private readonly zip = new Zip();
  private readonly rig = new THREE.Group();
  private readonly controllers: THREE.Group[] = [];

  constructor(renderer: WebGLRenderer, camera: THREE.Camera, city: CityData, scene: THREE.Scene) {
    this.renderer = renderer;
    this.camera = camera;
    this.city = city;
    scene.add(this.rig);
    this.rig.add(camera);
    for (let index = 0; index < 2; index += 1) {
      const controller = renderer.xr.getController(index);
      this.controllers.push(controller);
      this.rig.add(controller);
      controller.addEventListener('selectstart', () => this.shoot(index));
      controller.addEventListener('selectend', () => this.release(index));
      controller.addEventListener('squeezestart', () => this.zipToward(index));
    }
  }

  step(dt: number): void {
    if (!this.renderer.xr.isPresenting) return;
    if (this.zip.active) this.zip.step(dt, this.body);
    else {
      this.body.step(dt, this.city.buildings);
      this.left.step(dt, this.body, this.city.buildings);
      this.right.step(dt, this.body, this.city.buildings);
    }
  }

  update(): void {
    if (!this.renderer.xr.isPresenting) return;
    this.rig.position.copy(this.body.position).add(new THREE.Vector3(0, -1.6, 0));
    this.rig.quaternion.identity();
    void this.camera;
  }

  private shoot(index: number): void {
    const controller = this.controllers[index];
    if (!controller) return;
    const origin = new THREE.Vector3();
    const direction = new THREE.Vector3(0, 0, -1);
    controller.getWorldPosition(origin);
    direction.applyQuaternion(controller.getWorldQuaternion(new THREE.Quaternion()));
    const hit = raycastForXR(origin, direction, this.city);
    if (!hit) return;
    (index === 0 ? this.left : this.right).attach(hit, this.body);
  }

  private release(index: number): void {
    (index === 0 ? this.left : this.right).release();
  }

  private zipToward(index: number): void {
    const controller = this.controllers[index];
    if (!controller) return;
    const origin = new THREE.Vector3();
    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(controller.getWorldQuaternion(new THREE.Quaternion()));
    controller.getWorldPosition(origin);
    this.zip.launch(origin, direction, this.city);
  }
}

function raycastForXR(origin: THREE.Vector3, direction: THREE.Vector3, city: CityData): THREE.Vector3 | null {
  let result: THREE.Vector3 | null = null;
  let distance = 120;
  for (const box of city.buildings) {
    const min = box.min;
    const max = box.max;
    const t = (min.x - origin.x) / direction.x;
    if (Number.isFinite(t) && t > 0 && t < distance && origin.y + direction.y * t >= min.y && origin.y + direction.y * t <= max.y) {
      result = origin.clone().addScaledVector(direction, t);
      distance = t;
    }
  }
  return result;
}

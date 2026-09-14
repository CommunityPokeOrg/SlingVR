import * as THREE from 'three';

export class Reticle {
  readonly object = new THREE.Mesh(
    new THREE.RingGeometry(0.18, 0.24, 20),
    new THREE.MeshBasicMaterial({ color: '#ffda7a', side: THREE.DoubleSide, toneMapped: false }),
  );

  constructor(scene: THREE.Scene) {
    this.object.visible = false;
    scene.add(this.object);
  }

  update(point: THREE.Vector3 | null, available: boolean): void {
    this.object.visible = point !== null;
    if (!point) return;
    this.object.position.copy(point);
    this.object.material.color.set(available ? '#65f5bf' : '#ffda7a');
    this.object.lookAt(new THREE.Vector3(0, 0, 0));
  }
}

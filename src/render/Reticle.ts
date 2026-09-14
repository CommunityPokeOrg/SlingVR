import * as THREE from 'three';

export class Reticle {
  readonly object = new THREE.Mesh(
    new THREE.RingGeometry(0.18, 0.24, 20),
    new THREE.MeshBasicMaterial({ color: '#ffda7a', side: THREE.DoubleSide, toneMapped: false, depthTest: false, depthWrite: false }),
  );

  constructor(scene: THREE.Scene) {
    this.object.visible = false;
    this.object.renderOrder = 3;
    scene.add(this.object);
  }

  update(point: THREE.Vector3 | null, available: boolean, viewer: THREE.Vector3): void {
    this.object.visible = point !== null;
    if (!point) return;
    this.object.position.copy(point);
    this.object.material.color.set(available ? '#65f5bf' : '#ffda7a');
    this.object.lookAt(viewer);
    this.object.scale.setScalar(Math.max(1, viewer.distanceTo(point) / 18));
  }
}

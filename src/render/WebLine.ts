import * as THREE from 'three';
import { Web } from '../physics/Web';

export class WebLine {
  readonly group = new THREE.Group();
  private readonly line: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  private readonly positions = new Float32Array(24);
  private readonly geometry = new THREE.BufferGeometry();
  private readonly positionAttribute: THREE.BufferAttribute;
  private readonly marker: THREE.Mesh;

  constructor() {
    this.positionAttribute = new THREE.BufferAttribute(this.positions, 3);
    this.geometry.setAttribute('position', this.positionAttribute);
    this.line = new THREE.Line(this.geometry, new THREE.LineBasicMaterial({ color: '#f3fbff', transparent: true, opacity: 0.9 }));
    this.marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 8, 8),
      new THREE.MeshBasicMaterial({ color: '#bdf5ff', toneMapped: false }),
    );
    this.group.add(this.line, this.marker);
    this.group.visible = false;
  }

  update(origin: THREE.Vector3, web: Web): void {
    this.group.visible = web.attached;
    if (!web.attached) return;
    const end = web.lineEnd;
    for (let index = 0; index < 8; index += 1) {
      const t = index / 7;
      const sag = Math.sin(Math.PI * t) * Math.min(2.2, origin.distanceTo(end) * 0.035);
      this.positions[index * 3] = THREE.MathUtils.lerp(origin.x, end.x, t);
      this.positions[index * 3 + 1] = THREE.MathUtils.lerp(origin.y, end.y, t) - sag;
      this.positions[index * 3 + 2] = THREE.MathUtils.lerp(origin.z, end.z, t);
    }
    this.positionAttribute.needsUpdate = true;
    this.marker.position.copy(end);
  }
}

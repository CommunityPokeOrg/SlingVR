import * as THREE from 'three';
import { Web } from '../physics/Web';
import { WebShot } from '../physics/WebShot';

const SEGMENTS = 12;
const CORE_RADIUS = 0.008;
const HALO_RADIUS = 0.018;
const UP = new THREE.Vector3(0, 1, 0);

/**
 * A web strand rendered as a chain of instanced cylinders: a bright core wrapped in a dark
 * translucent halo so the line reads against both the bright sky and dark building faces.
 */
export class WebLine {
  readonly group = new THREE.Group();
  private readonly core: THREE.InstancedMesh;
  private readonly halo: THREE.InstancedMesh;
  private readonly marker: THREE.Mesh;
  private readonly coreMaterial: THREE.MeshBasicMaterial;
  private readonly haloMaterial: THREE.MeshBasicMaterial;
  private readonly markerMaterial: THREE.MeshBasicMaterial;
  private readonly points: THREE.Vector3[] = Array.from({ length: SEGMENTS + 1 }, () => new THREE.Vector3());
  private readonly matrix = new THREE.Matrix4();
  private readonly quaternion = new THREE.Quaternion();
  private readonly midpoint = new THREE.Vector3();
  private readonly direction = new THREE.Vector3();
  private readonly scale = new THREE.Vector3();
  private readonly tint = new THREE.Color();
  private readonly baseColor = new THREE.Color('#ffffff');
  private readonly chargeColor = new THREE.Color('#ff9d3d');
  private readonly flightEnd = new THREE.Vector3();

  constructor() {
    const geometry = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
    this.coreMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false, fog: false, transparent: true });
    this.haloMaterial = new THREE.MeshBasicMaterial({
      color: '#0b1a2a',
      transparent: true,
      opacity: 0.55,
      toneMapped: false,
      fog: false,
      depthWrite: false,
    });
    this.core = new THREE.InstancedMesh(geometry, this.coreMaterial, SEGMENTS);
    this.halo = new THREE.InstancedMesh(geometry, this.haloMaterial, SEGMENTS);
    this.core.frustumCulled = false;
    this.halo.frustumCulled = false;
    this.halo.renderOrder = 1;
    this.core.renderOrder = 2;
    this.markerMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false, fog: false, transparent: true });
    this.marker = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 10), this.markerMaterial);
    this.group.add(this.halo, this.core, this.marker);
    this.group.visible = false;
  }

  update(origin: THREE.Vector3, web: Web): void {
    if (web.shot.flying) {
      this.updateShot(origin, web.shot);
      return;
    }
    if (!web.attached) {
      this.hide();
      return;
    }
    const freeLength = Math.max(0, web.restLength - web.wrappedLength);
    const slack = Math.max(0, freeLength - origin.distanceTo(web.lineEnd));
    const sag = web.tension > 0 ? 0 : Math.min(4, Math.sqrt(slack * Math.max(1, freeLength)) * 0.5);
    this.updateTarget(origin, web.anchor, 0, 1, sag, web.wrappedLength > 0 ? web.bend : undefined);
  }

  updateShot(origin: THREE.Vector3, shot: WebShot, charge = 0): void {
    this.flightEnd.copy(shot.flying ? shot.tip : shot.target);
    this.updateTarget(origin, this.flightEnd, charge, 1, shot.flying ? 0.2 : 0);
  }

  updateTarget(origin: THREE.Vector3, end: THREE.Vector3, charge: number, opacity = 1, sag?: number, bend?: THREE.Vector3): void {
    const length = bend ? origin.distanceTo(bend) + bend.distanceTo(end) : origin.distanceTo(end);
    if (length < 1e-4) {
      this.hide();
      return;
    }
    this.group.visible = true;
    const sagDepth = Math.min(sag ?? Math.min(2.2, length * 0.035), length * 0.25);
    const bendIndex = bend ? THREE.MathUtils.clamp(Math.round(SEGMENTS * origin.distanceTo(bend) / (origin.distanceTo(bend) + bend.distanceTo(end))), 1, SEGMENTS - 1) : SEGMENTS;
    for (let index = 0; index <= SEGMENTS; index += 1) {
      if (bend && index > bendIndex) {
        this.points[index]!.lerpVectors(bend, end, (index - bendIndex) / (SEGMENTS - bendIndex));
      } else {
        const t = index / bendIndex;
        this.points[index]!.lerpVectors(origin, bend ?? end, t);
        this.points[index]!.y -= Math.sin(Math.PI * t) * sagDepth;
      }
    }
    for (let index = 0; index < SEGMENTS; index += 1) {
      const from = this.points[index]!;
      const to = this.points[index + 1]!;
      this.direction.copy(to).sub(from);
      const segmentLength = this.direction.length();
      if (segmentLength > 1e-6) this.direction.divideScalar(segmentLength);
      else this.direction.copy(UP);
      this.quaternion.setFromUnitVectors(UP, this.direction);
      this.midpoint.copy(from).add(to).multiplyScalar(0.5);
      this.scale.set(CORE_RADIUS, segmentLength, CORE_RADIUS);
      this.matrix.compose(this.midpoint, this.quaternion, this.scale);
      this.core.setMatrixAt(index, this.matrix);
      this.scale.set(HALO_RADIUS, segmentLength, HALO_RADIUS);
      this.matrix.compose(this.midpoint, this.quaternion, this.scale);
      this.halo.setMatrixAt(index, this.matrix);
    }
    this.core.instanceMatrix.needsUpdate = true;
    this.halo.instanceMatrix.needsUpdate = true;
    this.marker.position.copy(end);
    this.tint.copy(this.baseColor).lerp(this.chargeColor, charge);
    this.coreMaterial.color.copy(this.tint);
    this.markerMaterial.color.copy(this.tint);
    this.coreMaterial.opacity = opacity;
    this.markerMaterial.opacity = opacity;
    this.haloMaterial.opacity = 0.55 * opacity;
  }

  hide(): void {
    this.group.visible = false;
  }
}

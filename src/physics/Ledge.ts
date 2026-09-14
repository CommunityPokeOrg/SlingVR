import * as THREE from 'three';
import { GAME } from '../state';
import { raycastAABBs, type AABB } from './collision';

export interface Ledge {
  start: THREE.Vector3;
  end: THREE.Vector3;
  normal: THREE.Vector3;
  buildingIndex: number;
}

export interface LedgeAim {
  point: THREE.Vector3;
  ledge: Ledge;
  distance: number;
}

const ledgeCache = new WeakMap<AABB[], Ledge[]>();
const ray = new THREE.Ray();
const point = new THREE.Vector3();
const offset = new THREE.Vector3();
const sight = new THREE.Vector3();
const midpoint = new THREE.Vector3();

export function buildingLedges(buildings: AABB[]): Ledge[] {
  const cached = ledgeCache.get(buildings);
  if (cached) return cached;
  const ledges: Ledge[] = [];
  const inset = GAME.playerRadius + 0.15;
  for (const [buildingIndex, { min, max }] of buildings.entries()) {
    if (max.x - min.x <= inset * 2 || max.z - min.z <= inset * 2) continue;
    for (const x of [min.x, max.x]) {
      ledges.push({
        start: new THREE.Vector3(x, max.y, min.z + inset),
        end: new THREE.Vector3(x, max.y, max.z - inset),
        normal: new THREE.Vector3(x === min.x ? -1 : 1, 0, 0),
        buildingIndex,
      });
    }
    for (const z of [min.z, max.z]) {
      ledges.push({
        start: new THREE.Vector3(min.x + inset, max.y, z),
        end: new THREE.Vector3(max.x - inset, max.y, z),
        normal: new THREE.Vector3(0, 0, z === min.z ? -1 : 1),
        buildingIndex,
      });
    }
  }
  ledgeCache.set(buildings, ledges);
  return ledges;
}

function visible(origin: THREE.Vector3, target: THREE.Vector3, buildings: AABB[]): boolean {
  sight.copy(target).sub(origin);
  const distance = sight.length();
  if (distance < 1e-6) return false;
  sight.divideScalar(distance);
  return raycastAABBs(origin, sight, buildings, distance - 0.05) === null;
}

export function findLedge(origin: THREE.Vector3, direction: THREE.Vector3, buildings: AABB[]): LedgeAim | null {
  if (direction.lengthSq() < 1e-6) return null;
  ray.origin.copy(origin);
  ray.direction.copy(direction).normalize();
  let best: LedgeAim | null = null;
  let bestAngle = Infinity;
  const cone = Math.cos(THREE.MathUtils.degToRad(GAME.zipConeDegrees));
  for (const ledge of buildingLedges(buildings)) {
    const miss = ray.distanceSqToSegment(ledge.start, ledge.end, undefined, point);
    offset.copy(point).sub(origin);
    const distance = offset.length();
    if (distance < 1 || distance > GAME.zipRange || miss > GAME.zipSnapDistance ** 2) continue;
    const alignment = offset.dot(ray.direction) / distance;
    if (alignment < cone) continue;
    const angle = 1 - alignment;
    if (angle > bestAngle + 1e-6 || (Math.abs(angle - bestAngle) <= 1e-6 && best && distance >= best.distance)) continue;
    if (!visible(origin, point, buildings)) continue;
    best = { point: point.clone(), ledge, distance };
    bestAngle = angle;
  }
  return best;
}

export function findDualLedge(
  leftOrigin: THREE.Vector3,
  leftDirection: THREE.Vector3,
  rightOrigin: THREE.Vector3,
  rightDirection: THREE.Vector3,
  buildings: AABB[],
): LedgeAim | null {
  const left = findLedge(leftOrigin, leftDirection, buildings);
  const right = findLedge(rightOrigin, rightDirection, buildings);
  if (!left || !right || left.ledge !== right.ledge) return null;
  if (left.point.distanceTo(right.point) > GAME.zipDualAimDistance) return null;
  midpoint.copy(left.point).add(right.point).multiplyScalar(0.5);
  const distance = Math.max(leftOrigin.distanceTo(midpoint), rightOrigin.distanceTo(midpoint));
  if (distance > GAME.zipRange || !visible(leftOrigin, midpoint, buildings) || !visible(rightOrigin, midpoint, buildings)) return null;
  return { point: midpoint.clone(), ledge: left.ledge, distance };
}

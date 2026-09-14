import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { nearestWall, raycastAABB } from '../collision';
import { PlayerBody } from '../PlayerBody';
import { stepWebs, Web } from '../Web';
import { GAME } from '../../state';

const box = { min: new THREE.Vector3(0, 0, 0), max: new THREE.Vector3(10, 20, 10) };

describe('building collisions', () => {
  it.each([
    [new THREE.Vector3(0.1, 10, 5), new THREE.Vector3(-0.5, 10, 5)],
    [new THREE.Vector3(9.9, 10, 5), new THREE.Vector3(10.5, 10, 5)],
    [new THREE.Vector3(5, 19.9, 5), new THREE.Vector3(5, 20.5, 5)],
    [new THREE.Vector3(5, 10, 0.1), new THREE.Vector3(5, 10, -0.5)],
    [new THREE.Vector3(5, 10, 9.9), new THREE.Vector3(5, 10, 10.5)],
  ])('expels embedded bodies through the nearest face (%s)', (start, expected) => {
    const body = new PlayerBody(start);
    body.resolveCollisions([box]);
    expect(body.position.distanceTo(expected)).toBeLessThan(1e-6);
  });

  it('expels through the underside of an elevated box', () => {
    const body = new PlayerBody(new THREE.Vector3(5, 10.1, 5));
    body.resolveCollisions([{ min: new THREE.Vector3(0, 10, 0), max: box.max }]);
    expect(body.position.y).toBeCloseTo(9.5);
    expect(body.grounded).toBe(false);
  });

  it('does not tunnel through thin walls at high speed', () => {
    const body = new PlayerBody(new THREE.Vector3(-2, 10, 5));
    body.velocity.set(500, 0, 12);
    body.step(0.02, [{ min: box.min, max: new THREE.Vector3(0.1, 20, 10) }]);
    expect(body.position.x).toBeCloseTo(-GAME.playerRadius);
    expect(body.velocity.x).toBe(0);
    expect(body.velocity.z).toBeGreaterThan(11);
  });

  it('preserves velocity away from a contact', () => {
    const body = new PlayerBody(new THREE.Vector3(-0.4, 10, 5));
    body.velocity.set(-4, 3, 7);
    body.resolveCollisions([box]);
    expect(body.velocity.toArray()).toEqual([-4, 3, 7]);
  });

  it('rejects phantom walls outside the finite face bounds', () => {
    expect(nearestWall(new THREE.Vector3(-0.5, 5, 100), [box], 1)).toBeNull();
    expect(nearestWall(new THREE.Vector3(-0.5, 21, 5), [box], 1)).toBeNull();
    expect(nearestWall(new THREE.Vector3(-0.5, 5, 5), [box], 1)?.normal.x).toBe(-1);
  });

  it('handles parallel rays on a box boundary without NaNs', () => {
    const hit = raycastAABB(new THREE.Vector3(0, 25, 5), new THREE.Vector3(0, -1, 0), box, 5);
    expect(hit?.distance).toBe(5);
    expect(hit?.normal.toArray()).toEqual([0, 1, 0]);
    expect(raycastAABB(new THREE.Vector3(-1, 25, 5), new THREE.Vector3(0, -1, 0), box, 30)).toBeNull();
  });
});

describe('unilateral rope constraint', () => {
  it('removes outward velocity without adding energy or changing the tangent', () => {
    const body = new PlayerBody(new THREE.Vector3(0, 10, 0));
    const web = new Web();
    web.attach(new THREE.Vector3(0, 20, 0), body);
    body.velocity.set(8, -12, 4);
    web.step(GAME.fixedStep, body, [], 0, false);
    expect(body.velocity.toArray()).toEqual([8, 0, 4]);
    expect(web.tension).toBeGreaterThan(0);
  });

  it('allows motion toward the anchor instead of pushing away', () => {
    const body = new PlayerBody(new THREE.Vector3(0, 10, 0));
    const web = new Web();
    web.attach(new THREE.Vector3(0, 20, 0), body);
    body.velocity.set(8, 6, 4);
    web.step(GAME.fixedStep, body, [], 0, false);
    expect(body.velocity.toArray()).toEqual([8, 6, 4]);
  });

  it('does not wrap around the surface its anchor is attached to', () => {
    const body = new PlayerBody(new THREE.Vector3(-5, 10, 5));
    const web = new Web();
    web.attach(new THREE.Vector3(0, 15, 5), body);
    web.step(GAME.fixedStep, body, [box]);
    expect(web.lineEnd).toBe(web.anchor);
  });

  it('keeps both rope lengths feasible when reeling between separated anchors', () => {
    const body = new PlayerBody(new THREE.Vector3(0, 40, 0));
    const left = new Web();
    const right = new Web();
    left.attach(new THREE.Vector3(-10, 50, 0), body);
    right.attach(new THREE.Vector3(10, 50, 0), body);
    for (let i = 0; i < 600; i += 1) {
      body.step(GAME.fixedStep, []);
      stepWebs(GAME.fixedStep, body, [], left, right, 0.05, 0.05, false);
      expect(left.restLength + right.restLength).toBeGreaterThanOrEqual(20);
    }
    expect(Math.abs(body.position.x)).toBeLessThan(0.2);
    expect(body.position.distanceTo(left.anchor)).toBeLessThan(left.restLength + 0.02);
    expect(body.position.distanceTo(right.anchor)).toBeLessThan(right.restLength + 0.02);
    expect(body.velocity.length()).toBeLessThan(1);
  });

  it('preserves a bounded pendulum trajectory without assistance', () => {
    const body = new PlayerBody(new THREE.Vector3(0, 30, 0));
    const web = new Web();
    web.attach(new THREE.Vector3(0, 50, 0), body);
    web.restLength = 20;
    body.velocity.set(12, 0, 0);
    for (let i = 0; i < 1200; i += 1) {
      body.step(GAME.fixedStep, []);
      web.step(GAME.fixedStep, body, [], 0, false);
      expect(body.position.distanceTo(web.anchor)).toBeLessThanOrEqual(20.001);
      expect(body.velocity.length()).toBeLessThan(12.1);
    }
  });
});

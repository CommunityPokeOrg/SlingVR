import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { PlayerBody } from '../PlayerBody';
import { Zip, applyWebZip, findPerch } from '../Zip';
import { effectiveMode } from '../../settings';
import { GAME } from '../../state';

const groundedBody = (): PlayerBody => {
  const body = new PlayerBody();
  body.position.set(0, 0, 0);
  body.grounded = true;
  return body;
};

describe('grounded movement', () => {
  it('stops sliding on the ground without steer input', () => {
    const body = groundedBody();
    body.velocity.set(6, 0, 0);
    for (let i = 0; i < 120; i += 1) {
      body.step(GAME.fixedStep, []);
      body.grounded = true;
    }
    expect(body.velocity.x).toBe(0);
  });

  it('keeps airborne momentum instead of applying ground friction', () => {
    const body = new PlayerBody();
    body.position.set(0, 50, 0);
    body.velocity.set(20, 0, 0);
    body.step(GAME.fixedStep, []);
    expect(body.velocity.x).toBeGreaterThan(19.5);
  });

  it('accelerates responsively toward a capped run speed', () => {
    const body = groundedBody();
    const forward = new THREE.Vector3(0, 0, -1);
    body.steer(forward, GAME.fixedStep);
    expect(-body.velocity.z).toBeGreaterThan(0.3);
    for (let i = 0; i < 240; i += 1) {
      body.steer(forward, GAME.fixedStep);
      body.step(GAME.fixedStep, []);
      body.grounded = true;
    }
    expect(-body.velocity.z).toBeCloseTo(GAME.groundMaxSpeed, 1);
  });
});

describe('zip targeting', () => {
  const origin = new THREE.Vector3(0, 10, 0);
  const forward = new THREE.Vector3(0, 0, -1);

  it('picks the nearest perch inside the cone and strict range', () => {
    const near = new THREE.Vector3(1, 12, -20);
    const far = new THREE.Vector3(0, 10, -(GAME.zipRange + 1));
    const offAxis = new THREE.Vector3(15, 10, -5);
    const target = findPerch(origin, forward, [far, offAxis, near]);
    expect(target?.point).toBe(near);
    expect(target?.kind).toBe('perch');
    expect(findPerch(origin, forward, [far, offAxis])).toBeNull();
  });

  it('refuses to launch beyond the maximum range and mounts on arrival', () => {
    const zip = new Zip();
    const body = new PlayerBody();
    body.position.copy(origin);
    const tooFar = { point: new THREE.Vector3(0, 10, -100), normal: null, kind: 'perch' as const, distance: 100 };
    expect(zip.launch(tooFar, body)).toBe(false);
    expect(zip.launch({ ...tooFar, kind: 'surface' }, body)).toBe(false);
    const perch = new THREE.Vector3(0, 14, -30);
    expect(zip.launch({ point: perch, normal: null, kind: 'perch', distance: 30 }, body)).toBe(true);
    let mounted = false;
    for (let i = 0; i < 600 && !mounted; i += 1) mounted = zip.step(GAME.fixedStep, body);
    expect(mounted).toBe(true);
    expect(body.grounded).toBe(true);
    expect(body.position.x).toBeCloseTo(perch.x);
    expect(body.position.z).toBeCloseTo(perch.z);
    expect(zip.arrivalVelocity.z).toBeLessThan(0);
  });

  it('web zip pulls forward from the ground and in the air, capped', () => {
    const body = groundedBody();
    applyWebZip(body, new THREE.Vector3(0, 0, -30), GAME.webZipImpulse);
    expect(-body.velocity.z).toBeCloseTo(GAME.webZipImpulse, 3);
    expect(body.velocity.y).toBe(GAME.webZipLift);
    expect(body.grounded).toBe(false);
    body.velocity.set(0, 0, -GAME.webZipMaxSpeed);
    applyWebZip(body, new THREE.Vector3(0, 0, -30), GAME.webZipImpulse);
    expect(-body.velocity.z).toBeCloseTo(GAME.webZipMaxSpeed, 3);
  });
});

describe('platform gating', () => {
  it('only resolves Spectacular while presenting in XR', () => {
    expect(effectiveMode({ mode: 'spectacular', xrPresenting: false })).toBe('friendly');
    expect(effectiveMode({ mode: 'spectacular', xrPresenting: true })).toBe('spectacular');
    expect(effectiveMode({ mode: 'friendly', xrPresenting: true })).toBe('friendly');
  });
});

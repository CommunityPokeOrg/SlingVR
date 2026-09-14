import { afterEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { Player, type FrameInput } from '../../Player';
import { SETTINGS } from '../../settings';
import { GAME } from '../../state';
import { WebLine } from '../../render/WebLine';
import { PlayerBody } from '../PlayerBody';
import { WallRun } from '../WallRun';
import { Web } from '../Web';
import { WebShot } from '../WebShot';
import { WebZip } from '../WebZip';
import { Zip } from '../Zip';

vi.mock('../../ui/Hud', () => ({ Hud: class { update = vi.fn(); } }));

const dt = GAME.fixedStep;
const roof = { min: new THREE.Vector3(-30, 0, -90), max: new THREE.Vector3(30, 100, -80) };
const makePlayer = (): Player => new Player({
  buildings: [roof], perches: [], spawn: new THREE.Vector3(0, 50, 0),
}, new THREE.Scene());
const frame = (player: Player): FrameInput => ({
  steer: new THREE.Vector3(), look: new THREE.Vector3(0, 0, -1),
  head: player.body.position.clone().add(new THREE.Vector3(0, GAME.eyeHeight, 0)),
  leftHand: player.body.position.clone().add(new THREE.Vector3(-0.3, 1.4, -0.5)),
  rightHand: player.body.position.clone().add(new THREE.Vector3(0.3, 1.4, -0.5)),
  runHeld: false, wallAlong: 0, leftReel: 0, rightReel: 0, turn: 0,
});

afterEach(() => {
  SETTINGS.mode = 'friendly';
  SETTINGS.xrPresenting = false;
});

describe('web flight before attachment', () => {
  it('advances the visible tip toward a fixed target at the configured speed', () => {
    const shot = new WebShot();
    const origin = new THREE.Vector3(1, 30, 0);
    const target = new THREE.Vector3(1, 30, -80);
    shot.fire(origin, target);
    target.z = -200;
    expect(shot.step(0.25)).toBe(false);
    expect(shot.tip.toArray()).toEqual([1, 30, -40]);
    const line = new WebLine();
    line.updateShot(origin, shot);
    expect(line.group.visible).toBe(true);
    expect(line.group.children[2]!.position.equals(shot.tip)).toBe(true);
    expect(shot.step(0.25)).toBe(true);
    expect(shot.tip.equals(shot.target)).toBe(true);
    expect(shot.step(dt)).toBe(false);
  });

  it('leaves swing motion identical to free fall until the web arrives', () => {
    const player = makePlayer();
    const falling = new PlayerBody(player.body.position);
    player.body.velocity.set(12, -5, 3);
    falling.velocity.copy(player.body.velocity);
    const input = frame(player);
    expect(player.shootWeb('left', input.head, new THREE.Vector3(0, 0, -1), input.leftHand)).toBe(true);
    expect(player.leftWeb.attached).toBe(false);
    for (let i = 0; i < 30; i += 1) {
      player.stepPhysics(dt, frame(player));
      falling.step(dt, [roof]);
      expect(player.body.position.distanceTo(falling.position)).toBeLessThan(1e-10);
      expect(player.body.velocity.distanceTo(falling.velocity)).toBeLessThan(1e-10);
      expect(player.leftWeb.tension).toBe(0);
    }
    for (let i = 0; i < 60 && player.leftWeb.shot.flying; i += 1) player.stepPhysics(dt, frame(player));
    expect(player.leftWeb.attached).toBe(true);
    expect(player.leftWeb.restLength).toBeCloseTo(player.body.position.distanceTo(player.leftWeb.anchor));
  });

  it('cancels an in-flight swing on release and cancels all shots on reset', () => {
    const player = makePlayer();
    const input = frame(player);
    player.shootWeb('right', input.head, new THREE.Vector3(0, 0, -1));
    player.releaseWeb('right');
    for (let i = 0; i < 120; i += 1) player.stepPhysics(dt, frame(player));
    expect(player.rightWeb.attached).toBe(false);
    expect(player.rightWeb.shot.flying).toBe(false);
    player.zipToward(input.head, new THREE.Vector3(0, 0, -1));
    player.reset();
    for (let i = 0; i < 120; i += 1) player.stepPhysics(dt, frame(player));
    expect(player.webZip.active).toBe(false);
    expect(player.body.velocity.z).toBe(0);
  });

  it('keeps gravity and momentum during point-zip flight and waits for both hands', () => {
    const zip = new Zip();
    const body = new PlayerBody(new THREE.Vector3(0, 30, 0));
    const falling = new PlayerBody(body.position);
    const target = { point: new THREE.Vector3(0, 40, -25), normal: null, kind: 'perch' as const, distance: 27 };
    body.velocity.set(10, -3, 0);
    falling.velocity.copy(body.velocity);
    zip.shoot(target, body, new THREE.Vector3(-20, 30, 0), new THREE.Vector3(0, 39, -24));
    for (let i = 0; i < 13; i += 1) {
      zip.step(dt, body);
      falling.step(dt, []);
    }
    expect(zip.rightShot.flying).toBe(false);
    expect(zip.leftShot.flying).toBe(true);
    expect(body.position.distanceTo(falling.position)).toBeLessThan(1e-10);
    expect(body.velocity.distanceTo(falling.velocity)).toBeLessThan(1e-10);
    for (let i = 0; i < 60 && zip.flying; i += 1) zip.step(dt, body);
    expect(zip.flying).toBe(false);
    zip.step(dt, body);
    expect(body.velocity.z).toBeLessThan(-20);
  });
});

describe('sustained web pulls', () => {
  it('applies no impulse or lift on firing, then gradually pulls toward the anchor', () => {
    const player = makePlayer();
    const input = frame(player);
    player.zipToward(input.head, new THREE.Vector3(0, 0, -1), input.rightHand);
    expect(player.body.velocity.lengthSq()).toBe(0);
    for (let i = 0; i < 30; i += 1) player.stepPhysics(dt, frame(player));
    expect(player.webZip.shot.flying).toBe(true);
    expect(player.body.velocity.z).toBe(0);
    expect(player.body.velocity.y).toBeCloseTo(GAME.gravity * 0.25);
    for (let i = 0; i < 60 && player.webZip.shot.flying; i += 1) player.stepPhysics(dt, frame(player));
    expect(player.body.velocity.z).toBe(0);
    player.stepPhysics(dt, frame(player));
    expect(player.body.velocity.z).toBeLessThan(0);
    expect(player.body.velocity.z).toBeGreaterThan(-GAME.webZipAcceleration * dt - 0.01);
  });

  it('pulls a grounded player more than 30 metres without inventing upward lift', () => {
    const body = new PlayerBody(new THREE.Vector3(0, GAME.playerRadius, 0));
    body.grounded = true;
    const zip = new WebZip();
    zip.shoot(body.position, new THREE.Vector3(0, GAME.playerRadius, -80));
    for (let i = 0; i < 240 && zip.active; i += 1) {
      zip.step(dt, body, []);
      body.step(dt, [], zip.force);
      expect(body.position.y).toBe(GAME.playerRadius);
      expect(body.velocity.y).toBe(0);
    }
    expect(zip.active).toBe(false);
    expect(body.position.z).toBeLessThan(-30);
    expect(zip.cooldown).toBeGreaterThan(0);
  });

  it('does not erase opposing or sideways velocity to produce a pull', () => {
    const body = new PlayerBody(new THREE.Vector3(0, 50, 0));
    const zip = new WebZip();
    zip.shoot(body.position, new THREE.Vector3(0, 50, -60));
    while (zip.shot.flying) zip.step(dt, body, []);
    body.velocity.set(13, 0, 25);
    zip.step(dt, body, []);
    expect(body.velocity.toArray()).toEqual([13, 0, 25]);
    expect(zip.force.x).toBe(0);
    expect(zip.force.y).toBe(0);
    body.step(dt, [], zip.force);
    expect(body.velocity.x).toBeGreaterThan(12.9);
    expect(body.velocity.z).toBeGreaterThan(24);
    expect(body.velocity.z).toBeLessThan(25);
  });

  it.each([true, false])('waits for both release and attachment for charged pulls (early release: %s)', (early) => {
    const body = new PlayerBody(new THREE.Vector3(0, 50, 0));
    const zip = new WebZip();
    zip.shoot(body.position, new THREE.Vector3(0, 50, -60), true);
    if (early) zip.release(0.5);
    while (zip.shot.flying) {
      zip.step(dt, body, []);
      expect(zip.force.lengthSq()).toBe(0);
    }
    if (!early) {
      zip.step(dt, body, []);
      expect(zip.force.lengthSq()).toBe(0);
      zip.release(0.5);
    }
    zip.step(dt, body, []);
    expect(zip.force.z).toBeLessThan(0);
  });

  it('rejects repeated shots while busy and during cooldown, then permits another', () => {
    const body = new PlayerBody(new THREE.Vector3(0, 50, 0));
    const zip = new WebZip();
    const target = new THREE.Vector3(0, 50, -60);
    expect(zip.shoot(body.position, target)).toBe(true);
    expect(zip.shoot(body.position, target)).toBe(false);
    zip.cancel();
    expect(zip.shoot(body.position, target)).toBe(false);
    for (let i = 0; i < 120; i += 1) zip.step(dt, body, []);
    expect(zip.shoot(body.position, target)).toBe(true);
  });

  it('stops pulling when another building blocks the tether', () => {
    const body = new PlayerBody(new THREE.Vector3(0, 50, 0));
    const zip = new WebZip();
    zip.shoot(body.position, new THREE.Vector3(0, 50, -60));
    while (zip.shot.flying) zip.step(dt, body, []);
    zip.step(dt, body, [{ min: new THREE.Vector3(-5, 0, -20), max: new THREE.Vector3(5, 80, -10) }]);
    expect(zip.active).toBe(false);
    expect(zip.force.lengthSq()).toBe(0);
  });
});

describe('momentum and rope mechanics', () => {
  it('has a short jump apex, strong free fall, and low horizontal drag', () => {
    const body = new PlayerBody(new THREE.Vector3(0, 100, 0));
    body.velocity.set(30, GAME.jumpSpeed, 0);
    let apexTime = 0;
    for (let i = 0; i < 120; i += 1) {
      body.step(dt, []);
      if (body.velocity.y > 0) apexTime = (i + 1) * dt;
    }
    expect(apexTime).toBeLessThan(0.3);
    expect(body.velocity.y).toBeLessThan(-21);
    expect(body.velocity.x).toBeGreaterThan(29);
    expect(body.position.y).toBeLessThan(94);
  });

  it('respects analog air control without accelerating past its requested speed', () => {
    const body = new PlayerBody(new THREE.Vector3(0, 100, 0));
    body.velocity.z = -20;
    for (let i = 0; i < 120; i += 1) body.steer(new THREE.Vector3(0, 0, -0.2), dt);
    expect(body.velocity.z).toBe(-20);
    body.velocity.z = 0;
    for (let i = 0; i < 1200; i += 1) body.steer(new THREE.Vector3(0, 0, -0.2), dt);
    expect(-body.velocity.z).toBeCloseTo(GAME.airControlSpeed * 0.2);
  });

  it('attaches at the current distance without a positional kick', () => {
    const body = new PlayerBody(new THREE.Vector3(0, 30, 0));
    const web = new Web();
    web.attach(new THREE.Vector3(0, 50, 0), body);
    const before = body.position.clone();
    web.step(dt, body, []);
    expect(web.restLength).toBe(20);
    expect(body.position.equals(before)).toBe(true);
    expect(body.velocity.lengthSq()).toBe(0);
  });

  it('reels smoothly, preserves a physical hand pull across simulation substeps, and retains release velocity', () => {
    const body = new PlayerBody(new THREE.Vector3(0, 30, 0));
    const web = new Web();
    web.attach(new THREE.Vector3(0, 50, 0), body);
    web.step(dt, body, [], 0.32);
    expect(web.restLength).toBeGreaterThan(19.99);
    for (let i = 0; i < 120; i += 1) web.step(dt, body, []);
    expect(web.restLength).toBeCloseTo(19.68);
    const velocity = body.velocity.clone();
    web.release();
    expect(body.velocity.equals(velocity)).toBe(true);
  });

  it('does not add energy to an unpowered swing in either mode', () => {
    for (const assist of [true, false]) {
      const body = new PlayerBody(new THREE.Vector3(0, 30, 0));
      const web = new Web();
      web.attach(new THREE.Vector3(0, 50, 0), body);
      body.velocity.set(18, 0, 0);
      const initialEnergy = body.velocity.lengthSq() / 2 - GAME.gravity * body.position.y;
      for (let i = 0; i < 1200; i += 1) {
        body.step(dt, []);
        web.step(dt, body, [], 0, assist);
        const energy = body.velocity.lengthSq() / 2 - GAME.gravity * body.position.y;
        expect(energy).toBeLessThanOrEqual(initialEnergy + 0.1);
        expect(body.position.distanceTo(web.anchor)).toBeLessThanOrEqual(20.001);
      }
    }
  });
});

describe('directional wall traversal', () => {
  const buildings = [{ min: new THREE.Vector3(0, 0, -100), max: new THREE.Vector3(20, 100, 100) }];
  const makeBody = (): PlayerBody => new PlayerBody(new THREE.Vector3(-GAME.playerRadius, 20, 0));

  it('starts a horizontal wall run at level gaze and preserves incoming tangential speed', () => {
    const body = makeBody();
    const wall = new WallRun();
    body.velocity.set(5, 0, 40);
    expect(wall.step(dt, body, buildings, true, 0, new THREE.Vector3(0, 0, 1))).toBe(true);
    expect(wall.running).toBe(true);
    expect(body.velocity.z).toBeGreaterThan(39);
    expect(body.velocity.x).toBe(0);
    expect(body.position.y).toBe(20);
  });

  it('only leaves an idle wall when looking away', () => {
    const body = makeBody();
    const wall = new WallRun();
    wall.step(dt, body, buildings, true, 1);
    for (let i = 0; i < 120; i += 1) wall.step(dt, body, buildings, false, 0);
    expect(wall.running).toBe(false);
    expect(wall.jumpOff(body, new THREE.Vector3(1, 0, 0))).toBe(false);
    expect(wall.active).toBe(true);
    expect(wall.jumpOff(body, new THREE.Vector3(-1, 0, 0))).toBe(true);
    expect(wall.active).toBe(false);
    expect(body.velocity.x).toBeLessThan(0);
    expect(wall.step(dt, body, buildings, true, 1)).toBe(false);
  });

  it('permits a running jump at level gaze and boosts upward on a cooldown when looking up', () => {
    const body = makeBody();
    const wall = new WallRun();
    for (let i = 0; i < 30; i += 1) wall.step(dt, body, buildings, true, 1);
    const before = body.velocity.y;
    expect(wall.jumpOff(body, new THREE.Vector3(0, 1, 0))).toBe(true);
    expect(wall.active).toBe(true);
    expect(body.velocity.x).toBe(0);
    expect(body.velocity.y).toBeGreaterThan(before);
    const boosted = body.velocity.y;
    expect(wall.jumpOff(body, new THREE.Vector3(0, 1, 0))).toBe(false);
    expect(body.velocity.y).toBe(boosted);
    for (let i = 0; i < 100; i += 1) wall.step(dt, body, buildings, true, 1);
    expect(wall.jumpOff(body, new THREE.Vector3(0, 1, 0))).toBe(true);
    expect(wall.jumpOff(body, new THREE.Vector3(1, 0, 0))).toBe(true);
    expect(wall.active).toBe(false);
    expect(body.velocity.x).toBeLessThan(0);
  });

  it('jumps up from the lip and moves onto the roof only after clearing it', () => {
    const lowRoof = [{ min: new THREE.Vector3(0, 0, -20), max: new THREE.Vector3(20, 20, 20) }];
    const body = new PlayerBody(new THREE.Vector3(-GAME.playerRadius, 17.5, 0));
    const wall = new WallRun();
    wall.step(dt, body, lowRoof, true, 1);
    expect(wall.jumpOff(body, new THREE.Vector3(1, 0, 0))).toBe(true);
    expect(wall.active).toBe(false);
    expect(body.velocity.x).toBe(0);
    expect(body.velocity.y).toBeGreaterThanOrEqual(GAME.wallCrestLift);
    for (let i = 0; i < 180; i += 1) {
      wall.step(dt, body, lowRoof, false, 0);
      body.step(dt, lowRoof);
      if (body.position.y < 20.5) expect(body.position.x).toBeLessThanOrEqual(0);
    }
    expect(body.grounded).toBe(true);
    expect(body.position.x).toBeGreaterThan(0.5);
    expect(body.position.y).toBeCloseTo(20.5);
  });

  it('allows a moving crest after releasing run, without requiring an outward gaze', () => {
    const lowRoof = [{ min: new THREE.Vector3(0, 0, -20), max: new THREE.Vector3(20, 20, 20) }];
    const body = new PlayerBody(new THREE.Vector3(-GAME.playerRadius, 19, 0));
    const wall = new WallRun();
    body.velocity.y = 8;
    wall.step(dt, body, lowRoof, true, 1);
    wall.step(dt, body, lowRoof, false, 0);
    expect(wall.running).toBe(false);
    expect(wall.jumpOff(body, new THREE.Vector3(1, 0, 0))).toBe(true);
    expect(body.velocity.x).toBe(0);
    expect(body.velocity.y).toBeGreaterThanOrEqual(GAME.wallCrestLift);
  });

  it('never turns an upward boost into a brake on existing upward momentum', () => {
    const body = makeBody();
    const wall = new WallRun();
    body.velocity.y = 40;
    wall.step(dt, body, buildings, true, 1);
    const velocity = body.velocity.y;
    expect(wall.jumpOff(body, new THREE.Vector3(0, 1, 0))).toBe(true);
    expect(body.velocity.y).toBeGreaterThanOrEqual(velocity);
  });
});

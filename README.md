# SlingVR

SlingVR is a compact WebXR traversal playground inspired by superhero swinging games: shoot two physical-feeling web lines, swing between a procedural city, zip to rooftops, wall-run, and chain air tricks from either desktop or VR.

**[Play the live demo](https://communitypokeorg.github.io/SlingVR/)**

## Features

- Fixed-timestep custom rope physics with reel-in, spring tension, momentum, and a simplified single-corner tether wrap.
- Seeded low-poly city with instanced buildings, rooftop perch targets, analytic ray/AABB collision, and a readable HUD.
- One-line **Web Zip** (forward pull impulse, grounded or airborne), two-line **Zip-to-Point** onto perches within a strict range with a mount-and-slingshot jump, wall running, air dash, style scoring, and desktop or WebXR controller input.
- Grounded friction so the player stops when you stop steering, with a capped run speed and momentum-preserving air control.
- Vite + Three.js + TypeScript build that deploys to GitHub Pages.

## Control modes

SlingVR opens in **Friendly Neighborhood** mode for assisted, comfortable traversal. **Spectacular** is strictly VR-only: it is offered on the start overlay only when an immersive-vr session is supported, can be toggled with a left-thumbstick click in XR, and the stored preference resolves back to Friendly whenever the app is not presenting in XR (`effectiveMode()` in `src/settings.ts`). Keyboard/mouse always runs the Friendly control set.

| Feature | Friendly Neighborhood (desktop + VR) | Spectacular (VR only) |
| --- | --- | --- |
| Turning | Mouse look / head plus smooth right-stick turn | Head-only turning |
| Web swing | Held mouse buttons or triggers reel and add swing assistance | Physical hand pulls reel and build momentum |
| Web Zip | Aim at a wall, tap zip: one line, instant forward pull | Grip, pull the hand back to charge, release for a stronger pull |
| Zip-to-Point | Aim at a highlighted perch inside range, tap zip: both lines attach and carry you onto it | Same, charge sets travel speed |
| Wall run | Right stick vertical input / `WASD` + Shift | Left stick steers and runs near a wall |
| Jump off wall | A/X or Space | A/X |
| Air dash | B/Y or Shift | Physical forward punch |

### Zip rules

- **Web Zip** (`GAME.webZipRange`, 60 m): one web line to any building surface, then an impulse toward it that keeps existing momentum along the pull and caps at `GAME.webZipMaxSpeed`. From the ground it also lifts you off the floor.
- **Zip-to-Point** (`GAME.zipRange`, 45 m, `GAME.zipConeDegrees` aim cone): only rooftop perches count. Both hands/lines attach, the player is carried straight to the perch and mounted on it. Targets beyond the range are rejected both at aim time and again at launch.
- **Mount slingshot**: pressing jump while the zip is still in flight buffers it; pressing within `GAME.mountGraceTime` after landing on the perch reuses the arrival direction as a forward launch (`mountSlingshotSpeed` / `mountSlingshotLift`).

## Controls

| Action | Desktop | VR |
| --- | --- | --- |
| Look / steer | Mouse + WASD | Head + thumbstick (mode-dependent) |
| Shoot web | LMB / RMB (hold) | Controller trigger (hold) |
| Jump / release / wall jump-off | Space | A / X |
| Web Zip / Zip-to-Point | E or middle mouse | Controller grip |
| Wall run / dash | Hold Shift / tap Shift | Thumbsticks + jump or physical punch |
| Reset / help / debug | R / H / F | — |
| Toggle mode | — (desktop is always Friendly) | Left-stick click |

### XR controls

| Input | Action |
| --- | --- |
| Left/right trigger | Shoot and hold the corresponding web |
| Left/right grip | Zip toward that controller's ray |
| Left stick | Friendly: steer; Spectacular: steer and wall-run |
| Right stick | Friendly: Y wall-run, X smooth turn; Spectacular: unused |
| A/X | Jump when grounded, release webs while airborne |
| B/Y | Friendly air dash along head-forward |
| Punch | Spectacular air dash when a forward hand punch is detected |
| Left-stick click | Toggle Friendly Neighborhood / Spectacular |

## Local development

```bash
npm i
npm run dev
npm run build
npm run preview
```

The Vite base path is `/SlingVR/` for Pages. For local preview, open `http://localhost:4173/SlingVR/`.

## Deploy

Pushes to `main` run the GitHub Actions Pages workflow. In repository Settings → Pages, choose **GitHub Actions** as the source.

## Architecture

| Area | Files |
| --- | --- |
| Bootstrap | `src/main.ts`, `src/state.ts`, `src/Player.ts` |
| City | `src/city/CityGenerator.ts` |
| Physics | `src/physics/PlayerBody.ts`, `Web.ts`, `Zip.ts`, `WallRun.ts`, `AirTricks.ts`, `collision.ts` |
| Input | `src/input/DesktopInput.ts`, `XRInput.ts` (thin adapters over the shared `Player`) |
| Rendering/UI | `src/render/*`, `src/ui/Hud.ts`, `index.html` |
| Tests | `src/physics/__tests__/rope.test.ts` |

## Limitations and future work

This is a deliberately small prototype: it uses custom physics rather than a physics engine, box-only city geometry, no hand tracking, audio, animation/IK, or MSM2 assets, and performance has not been tuned on a standalone Quest. VR play should use a comfort vignette in a future pass; this prototype intentionally keeps the camera free of a vignette. Future experiments could add corner unwrap/multi-segment ropes, loop-de-loops, web wings, better comfort options, richer city materials, and haptics.

The XR adapter treats `renderer.xr.getController(0)` as the left controller and index `1` as the right controller. Three.js/WebXR does not guarantee that index-to-handedness mapping across runtimes; this prototype uses the fixed convention for its trigger and grip bindings. Spectacular's punch and pull detection are heuristics based on controller pose deltas, not hand tracking. It intentionally has no turn assistance, so standing players should turn physically; no hand tracking is available.

## License

MIT. See [LICENSE](LICENSE). Copyright © CommunityPoke contributors.
WebXR / web-based swinging prototype with procedural Three.js city and physics-based traversal mechanics.

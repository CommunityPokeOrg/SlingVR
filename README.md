# SlingVR

SlingVR is a compact WebXR traversal playground inspired by superhero swinging games: shoot two physical-feeling web lines, swing between a procedural city, zip to rooftops, wall-run, and chain air tricks from either desktop or VR.

**[Play the live demo](https://communitypokeorg.github.io/SlingVR/)**

## Features

- Fixed-timestep rope constraints with reel-in, momentum-preserving swings, and a simplified single-corner tether wrap.
- Seeded low-poly city with instanced buildings, continuous rooftop ledges, analytic ray/AABB collision, and a readable HUD.
- One-line **Web Zip** (forward pull impulse, grounded or airborne), two-line **Zip-to-Point** onto ledges within a strict range with a mount-and-slingshot jump, contact-based wall running, air dash, style scoring, and desktop or WebXR controller input.
- Grounded friction so the player stops when you stop steering, with a capped run speed and momentum-preserving air control.
- Vite + Three.js + TypeScript build that deploys to GitHub Pages.

## Control modes

SlingVR opens in **Friendly Neighborhood** mode for assisted, comfortable traversal. **Spectacular** is strictly VR-only: it is offered on the start overlay only when an immersive-vr session is supported, can be toggled with a left-thumbstick click in XR, and the stored preference resolves back to Friendly whenever the app is not presenting in XR (`effectiveMode()` in `src/settings.ts`). Keyboard/mouse always runs the Friendly control set.

| Feature | Friendly Neighborhood (desktop + VR) | Spectacular (VR only) |
| --- | --- | --- |
| Turning | Mouse look / head plus smooth right-stick turn | Head-only turning |
| Web swing | Held mouse buttons or triggers reel and add swing assistance | Physical hand pulls reel and build momentum |
| Web Zip | Aim at a wall, tap zip: one line, instant forward pull | Grip, pull the hand back to charge, release for a stronger pull |
| Zip-to-Point | Aim near a rooftop ledge, tap zip: both lines carry you over its lip | Aim both controllers at the same nearby ledge, then hold both triggers |
| Wall run | Touch a wall, look up, hold Shift (desktop) or push right stick forward (VR) | Touch a wall, look up, push left stick forward |
| Jump off wall | A/X or Space | A/X |
| Air dash | B/Y or Shift | Physical forward punch |

### Zip rules

- **Web Zip** (`GAME.webZipRange`, 60 m): one web line to any building surface, then an impulse toward it that keeps existing momentum along the pull and caps that component at `GAME.webZipMaxSpeed`. Friendly applies a 28 m/s pull and at least 6 m/s upward lift from the ground. Existing swing ropes release so they cannot oppose the zip.
- **Zip-to-Point** (`GAME.zipRange`, 45 m): aim within the 7° cone and 2.5 m of a visible rooftop edge. The green web aimer snaps along the continuous ledge without rotating the camera. Both lines carry you outside the wall, over the lip, and onto the roof with collision checks. Spectacular requires both controller rays to snap to the same edge within 2.5 m of each other; a single grip always charges a surface web zip. Targets beyond range are rejected at aim and launch.
- **Mount slingshot**: pressing jump in the final `GAME.mountJumpBufferTime` of flight buffers it; pressing within `GAME.mountGraceTime` after landing on the ledge reuses the arrival direction as a forward launch (`mountSlingshotSpeed` / `mountSlingshotLift`).
- **Wall run**: the player's hitbox must touch a finite wall face. Hold the run input and look upward to start climbing; steering moves along the wall. Releasing run stops movement but keeps the player attached, including at the roof and side edges. Jump to leave the wall; web shots, zips, and dashes do not detach you.

## Controls

| Action | Desktop | VR |
| --- | --- | --- |
| Look / steer | Mouse + WASD | Head + thumbstick (mode-dependent) |
| Shoot web | LMB / RMB (hold) | Controller trigger (hold) |
| Jump / release / wall jump-off | Space | A / X |
| Web Zip / Zip-to-Point | E or middle mouse | Grip; Spectacular ledge zip uses both triggers |
| Wall run / dash | Hold Shift / tap Shift | Thumbsticks + jump or physical punch |
| Reset / help / debug | R / H / F | — |
| Toggle mode | — (desktop is always Friendly) | Left-stick click |

### XR controls

| Input | Action |
| --- | --- |
| Left/right trigger | Shoot and hold the corresponding web; Spectacular: both triggers zip when both rays agree on a ledge |
| Left/right grip | Friendly: zip toward that controller's ray; Spectacular: pull back to charge a surface zip, then release |
| Left stick | Friendly: steer; Spectacular: steer and wall-run |
| Right stick | Friendly: push forward while looking up at a contacted wall to run, X smooth turn; Spectacular: unused |
| A/X | Jump when grounded, release webs while airborne |
| B/Y | Friendly air dash along head-forward |
| Punch | Spectacular air dash when a forward hand punch is detected |
| Left-stick click | Toggle Friendly Neighborhood / Spectacular |

## Local development

```bash
npm i
npm run dev
npm run typecheck
npm test
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
| Physics | `src/physics/PlayerBody.ts`, `Web.ts`, `Ledge.ts`, `Zip.ts`, `WallRun.ts`, `AirTricks.ts`, `collision.ts` |
| Input | `src/input/DesktopInput.ts`, `XRInput.ts` (thin adapters over the shared `Player`) |
| Rendering/UI | `src/render/*`, `src/ui/Hud.ts`, `index.html` |
| Tests | `src/physics/__tests__/*` (physics, ledges, wall contact, player actions, XR controller events) |

## Limitations and future work

This is a deliberately small prototype: it uses custom physics rather than a physics engine, box-only city geometry, no hand tracking, audio, animation/IK, or MSM2 assets, and performance has not been tuned on a standalone Quest. VR play should use a comfort vignette in a future pass; this prototype intentionally keeps the camera free of a vignette. Future experiments could add corner unwrap/multi-segment ropes, loop-de-loops, web wings, better comfort options, richer city materials, and haptics.

The XR adapter maps connected input sources by handedness. Spectacular's punch and pull detection use controller motion relative to the headset, so translating the rig does not count as a gesture. These remain pose heuristics rather than hand tracking. Spectacular has no turn assistance, so standing players should turn physically.

## License

MIT. See [LICENSE](LICENSE). Copyright © CommunityPoke contributors.
WebXR / web-based swinging prototype with procedural Three.js city and physics-based traversal mechanics.

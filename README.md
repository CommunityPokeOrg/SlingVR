# SlingVR

SlingVR is a compact WebXR traversal playground inspired by superhero swinging games: shoot two physical-feeling web lines, swing between a procedural city, zip to rooftops, wall-run, and chain air tricks from either desktop or VR.

**[Play the live demo](https://communitypokeorg.github.io/SlingVR/)**

## Features

- Fixed-timestep custom rope physics with reel-in, spring tension, momentum, and a simplified single-corner tether wrap.
- Seeded low-poly city with instanced buildings, rooftop perch targets, analytic ray/AABB collision, and a readable HUD.
- Web zip and point launch, wall running, air dash, style scoring, and desktop or WebXR controller input.
- Vite + Three.js + TypeScript build that deploys to GitHub Pages.

## Controls

| Action | Desktop | VR |
| --- | --- | --- |
| Look / steer | Mouse + WASD | Head + thumbstick |
| Shoot web | LMB / RMB (hold) | Controller trigger (hold) |
| Jump / release | Space | A / X |
| Zip / point launch | E or middle mouse | Controller grip |
| Wall run / dash | Hold Shift / tap Shift | Thumbstick + jump |
| Reset / help / debug | R / H / F | — |

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
| Bootstrap | `src/main.ts`, `src/state.ts` |
| City | `src/city/CityGenerator.ts` |
| Physics | `src/physics/PlayerBody.ts`, `Web.ts`, `Zip.ts`, `WallRun.ts`, `AirTricks.ts`, `collision.ts` |
| Input | `src/input/DesktopInput.ts`, `XRInput.ts` |
| Rendering/UI | `src/render/*`, `src/ui/Hud.ts`, `index.html` |
| Tests | `src/physics/__tests__/rope.test.ts` |

## Limitations and future work

This is a deliberately small prototype: it uses custom physics rather than a physics engine, box-only city geometry, no hand tracking, audio, animation/IK, or MSM2 assets, and performance has not been tuned on a standalone Quest. Future experiments could add corner unwrap/multi-segment ropes, loop-de-loops, web wings, better comfort vignettes, richer city materials, and haptics.

## License

MIT. See [LICENSE](LICENSE). Copyright © CommunityPoke contributors.
WebXR / web-based swinging prototype with procedural Three.js city and physics-based traversal mechanics.

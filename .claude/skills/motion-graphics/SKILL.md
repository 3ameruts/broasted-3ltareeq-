---
name: motion-graphics
description: Motion Graphics, Kinetic Typography, Logo Reveal and 2D/3D animation specialist for Remotion/GSAP/Motion/Lottie/Three.js. Use when animating titles, UI walkthroughs, logo reveals, particles, transitions or 3D scenes. Pairs with the official remotion-* skills.
---
# Motion Graphics Specialist

Toolkit (installed in `video/studio-kit/node_modules`, copy the needed deps into a new project's package.json at the same versions; Remotion pinned to 4.0.539):
remotion + @remotion/{transitions, motion-blur, noise, lottie, three, shapes, paths, captions, layout-utils, google-fonts, media-utils}, gsap, motion, lottie-web, three, @react-three/fiber, @react-three/drei, lucide-react, @fontsource/{cairo,tajawal,almarai,readex-pro,inter}.
Also read the official skills: `remotion-best-practices`, `remotion-elements`, `remotion-multimedia`, `remotion-render`.

## Rules
- Deterministic: everything derives from `useCurrentFrame()`. No CSS transitions, no Date/Math.random (use `random(seed)` from remotion).
- GSAP inside Remotion: build one paused timeline in useLayoutEffect and `tl.seek(frame / fps)` each frame (pattern in `video/online-order-reel/src/lib.tsx` `useGsap`).
- Motion (framer) is for the web app; in Remotion use `spring()`/`interpolate()` or GSAP.
- Easing language: entrances `expo.out`/`back.out(1.6-2.2)`, exits `power2.in` (faster than entrances, ~60%), camera moves `power3.inOut`. Overshoot only on small elements.
- Timing: 12-18 frames for UI entrances at 30 fps; stagger 2-4 frames; hold readable text ≥ 1.2 s.
- Motion blur: `@remotion/motion-blur` CameraMotionBlur (samples 6-10, shutter 180) on fast moves only; whip-pans = translate + CSS blur ramp.
- Depth: 2.5D parallax (cut-out foreground over slower background), soft drop shadows, light sweeps (`Sheen`), grain via @remotion/noise at low opacity.

## Kinetic typography (Arabic)
- RTL parent `direction: rtl`; absolutely-positioned boxes in RTL need explicit `left:0; top:0; width` or they hang off the right edge.
- Never split Arabic words into letters (breaks shaping); animate by word or line. Numbers/URLs in `direction: ltr` spans.
- Fonts: Cairo/Tajawal 800-900 for headlines, Almarai/Readex for body; load via @fontsource and wait with `delayRender` until `document.fonts.ready`.

## Logo reveals
Mask wipe / stroke draw (`@remotion/paths` evolvePath on the SVG) → fill → scale settle with elastic.out(1,.55) → ring shockwave → tagline. 1.5-2.5 s total.

## 3D
`@remotion/three` ThreeCanvas with frame-driven state (no useFrame clock). Keep poly counts modest; headless chrome uses ANGLE/SwiftShader - test render speed early.

## Lottie
`@remotion/lottie` with JSON loaded via staticFile + delayRender; check license of any downloaded Lottie.

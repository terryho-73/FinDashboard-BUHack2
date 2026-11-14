# Savings Jars HK — demo video (Remotion)

A 3-minute 1080p product demo: a real, scripted recording of the app in use,
framed in a phone with tap ripples, camera zooms and short captions, over an
original synthesized soundtrack. The latest render is committed at
[`docs/demo/savings-jars-demo.mp4`](../docs/demo/savings-jars-demo.mp4).

## Rendering

The recording and music are generated (and git-ignored), so create them first.
Recording needs the app running on `http://localhost:5173` (`npm run dev:sqlite`
in the repo root), Google Chrome installed, and `HKBU_GENAI_API_KEY` in
`.env.local` for the Quick log step.

```bash
npm install
npm run music     # → public/music.wav
npm run record    # → public/rec/*.jpg + src/recording.json
npm run render    # → out/savings-jars-demo.mp4
npm run studio    # optional: preview / tweak in Remotion Studio
```

Then copy the render to `docs/demo/savings-jars-demo.mp4` to update the README video.

## What `npm run record` does

It drives headless Chrome (`puppeteer-core`) through onboarding → demo data →
forecast and goal cost → jars → top-up → AI Quick log → full expense form →
payday → weekly challenge → insights → privacy, language and dark mode. It
saves the DevTools screencast plus the frame timings, taps, zoom cues and
caption marks.

**It clears the local app data first**, then adds a top-up and a few expenses,
and sends one sample note to the configured AI provider.

The recording is time-stretched to fill the slot between the intro and outro,
so tweak the `sleep()` pauses in `scripts/record.mjs` to change pacing.

`scripts/make-music.mjs` synthesizes a 180 s, 100 BPM lo-fi track from scratch
(no samples), so it is royalty-free.

## Structure

- `src/Demo.tsx`: timeline, phone, camera, taps and captions (edit `CAPTIONS` for wording)
- `src/ui.tsx`: shared backdrop, font and small animation helpers

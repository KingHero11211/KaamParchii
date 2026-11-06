# Voice orb integration

## Recording control

The input counterpart lives at `src/components/ui/voice-input.tsx` and is reused by `src/components/voice-intake.tsx` for intake, technician plans and customer clarifications. Motion and Lucide React are installed. The control receives the recorder's state, elapsed seconds and existing microphone stream. It does not create a second recording or request a second stream.

The local Web Audio analyser drives 24 waveform bars from captured samples. The input meter has no speaker connection. It releases its own audio nodes and context on stop or unmount, leaving stream ownership with the recorder. The start/stop control is a keyboard-accessible button, and the stop action stays available during capture. Reduced motion uses a static meter. Existing permission, upload, 28-second limit, preview and transcription behavior remain in the parent component.

The adapted orb uses OGL and the existing KaamParchi stylesheet. It follows the forest, sage and lime palette and analyses the agent's playing audio locally through Web Audio. It requests no microphone access. It appears in the customer intake read-back and technician spoken reminder.

Components live in `src/components/ui/voice-powered-orb.tsx` and `src/components/ui/agent-audio.tsx`. This is the project's equivalent of `components/ui`, because `@/*` maps to `src/*`. Reusable controls belong here so imports and a future shadcn registry use one consistent location. Styles live in `src/app/globals.css`.

The player shows ready, speaking, paused, buffering and finished states. Playback is manual. The ring reacts to waveform amplitude, stops moving when paused and respects reduced motion. A static ring remains available when WebGL is unavailable. Audio contexts, nodes, animation frames and rendering resources are released on unmount. Audio analysis is local and does not create additional Gnani requests.

TypeScript is already configured. The existing project uses plain CSS and has no Tailwind or shadcn CLI configuration. The adapted component works with that setup and uses the current buttons. Only OGL is required and installed. The reference demo's Radix Slot and class-variance-authority dependencies are needed only if adopting its separate shadcn Button.

## Optional Tailwind and shadcn setup

These are migration instructions, not changes applied by the orb integration. Review the generated stylesheet changes against the existing design.

1. Run `npm.cmd install tailwindcss @tailwindcss/postcss postcss`.
2. Create `postcss.config.mjs` with the following configuration.

```js
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

3. Add `@import "tailwindcss";` alongside the imports at the top of `src/app/globals.css`. Check existing form, heading and print styles after Tailwind's base styles apply.
4. Run `npx.cmd shadcn@latest init` from the project root. Configure the stylesheet as `src/app/globals.css`, TypeScript/React Server Components, and the UI alias as `@/components/ui`. Preserve the existing `@/*` → `./src/*` mapping.
5. Run `npx.cmd shadcn@latest add button` when adopting a shadcn Button. The CLI installs the dependencies for its selected base. The reference Radix implementation specifically uses `@radix-ui/react-slot` and `class-variance-authority` plus the generated `cn` utility.
6. Run the type check, production build and a visual check of existing pages.

Official setup references are [Tailwind for Next.js](https://tailwindcss.com/docs/installation/framework-guides/nextjs) and [shadcn for an existing Next.js project](https://ui.shadcn.com/docs/installation/next#existing-project).

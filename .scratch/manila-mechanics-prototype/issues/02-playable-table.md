# Build the playable 2.5D table

Type: task
Status: resolved

Render the three lanes and ships in React Three Fiber, with mirrored keyboard-accessible placement controls and clear phase guidance.

## Answer

Implemented in `src/components/HarborScene.tsx` and `src/App.tsx`. Desktop and 390 px browser checks confirmed that all lanes and ships remain visible without horizontal overflow.

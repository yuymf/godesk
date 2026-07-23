# Generated output must be playable

Type: prototype
Status: resolved
Blocked by: 02, 03

## Problem

The first step-4 output showed source-linked components and a reference
photograph. A user could inspect it but could not play it. That is an authoring
intermediate, not the product promised by an AI-native tabletop creation flow.

## Acceptance

- Step 4 presents a clearly labeled playable build, not just a manifest.
- Opening the build gives the human meaningful placement decisions.
- Two automated seats complete their own turns.
- The three-player cadence contains four placements per player and three
  movement rounds.
- The voyage handles punts, port/shipyard bets, pirates, pilots, insurance,
  settlement, leader announcement, and restart.
- Browser QA completes a whole voyage using visible controls.

## Answer

Implemented `src/manila/playable.ts` and `src/manila/PlayableManila.tsx`.
Automated tests cover cadence, ownership/capacity/affordability, insurance, die
validation, settlement, and winner creation.

Browser QA completed this exact visible-control route:

1. Four human placement decisions with two automatic seats.
2. Three dice movements.
3. A human large-pilot adjustment.
4. Voyage settlement and leader announcement.
5. Restart to 30 pesos and four accomplices per seat.

Desktop and 390 px layouts had no horizontal overflow. Browser warnings and
errors were empty.

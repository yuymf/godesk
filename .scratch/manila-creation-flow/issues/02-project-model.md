# Source-anchored Manila project model

Type: prototype
Status: resolved
Blocked by: 01

## Question

Can core components and the three-player voyage sequence be represented without
losing their source evidence?

## Answer

Yes. `src/manila/project.ts` holds components, four goods, source-anchored rule
facts, confidence/review status, and an eleven-stage voyage graph. Tests enforce
identity counts, cadence, anchors, and licensing-review boundaries.

# 08 - Accept visual material in the creator-first flow

Type: task
Status: resolved

Blocked by: 07

The creator entry point accepted prompts and rule documents, but independent
visual material could only be added later through a Skill. Bring that material
into the same first-pass Source Library flow without treating pixels as hidden
rules.

## Acceptance

- The creator home accepts bounded JPG, PNG, WebP, and GIF uploads.
- The browser compresses images to the bounded `visualInputs`
  contract and gives the upload control a visible keyboard focus state.
- Image sources retain `creator-upload` provenance and are bound only where the
  Rule System explicitly supports presentation images.
- A prompt or text source remains the authority for executable rules; image-only
  input lands as a draft when no Kernel can be justified.

## Answer

`CreatorHome` now validates and prepares up to eight standalone images before
calling the existing generation job. `validateImageAssets` and the two new
frontend tests cover the input boundary. The Worker already persisted and
bound harvested image sources; the existing Worker coverage continues to prove
that path. Full verification remains automated/local evidence and does not
claim public or human acceptance.

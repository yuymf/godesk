# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those
roles to the `Status:` strings this repository actually uses.

| Label in mattpocock/skills | Label in our tracker | Meaning |
| -------------------------- | -------------------- | ------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `claimed`            | Specified; an agent may take it or already holds it |
| `ready-for-human`          | `ready-for-human`    | External or human gate (publish, OAuth, real playtest) |
| `wontfix`                  | `wontfix`            | Will not be actioned |

Completion is not a skill label. Closed tickets use `Status: resolved`.

Live statuses in `.scratch/` today are `resolved`, `ready-for-human`, and
(when work is in progress) `claimed`. Do not write `ready-for-agent` on a
new ticket; use `claimed` or leave the ticket unclaimed until work starts.

# 10 — Isolate stale records from the current project list

Type: bug
Status: resolved

## Question

Can a pre-refactor Durable Object record remain explicitly unsupported without
preventing a creator from starting or reopening a current Rule System project?

## Answer

The direct project route already returns HTTP 410 for an old project shape. The
project list now applies the same boundary by excluding stale records from the
current `projects` result instead of normalizing, migrating, or synthesizing
them. Current records remain sorted and visible; the old record stays untouched
in Durable Object storage and is not treated as a current project.

The Worker test combines one current record with one stale bare record and
confirms that only the current project is listed. This fixes the local creator
home's generic service error without adding a compatibility layer.

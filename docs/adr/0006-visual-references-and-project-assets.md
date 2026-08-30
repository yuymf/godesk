# ADR 0006: Separate Visual References from Project Assets

Status: accepted

Date: 2026-08-11

GoDesk stores uploaded images as either Visual References, which may guide
generation but cannot be bound directly, or Project Assets, which may be placed
in a Rule System. Generated Project Assets retain every creator brief and Visual
Reference that influenced them as a source dependency set. This prevents an
inspiration image from silently becoming shipped game art while preserving the
complete provenance closure in each immutable Build.

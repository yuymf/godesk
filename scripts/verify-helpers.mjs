/** Tiny shared fail/ensure/assert for scripts/verify-*.mjs. */

export function createVerifyHelpers(failurePrefix) {
  function fail(message) {
    throw new Error(`${failurePrefix}: ${message}`);
  }

  function ensure(condition, message) {
    if (!condition) fail(message);
  }

  return { fail, ensure, assert: ensure };
}

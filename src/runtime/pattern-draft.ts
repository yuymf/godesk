/**
 * Factory / pattern-wall draft loop (Azul-shaped) without a dedicated kernel.
 * Turn-taking-v1 must not silently substitute (T009).
 */
export function isPatternDraftCorpus(corpus: string): boolean {
  const factory =
    /工厂(?:展示)?(?:盘)?|factory\s+(?:displays?|tiles?)|中心(?:区|堆)|centre\s+pile|center\s+pile/i.test(
      corpus,
    );
  const wallOrRow =
    /纹样墙|准备行|pattern\s*wall|pattern\s*lines?|floor\s*line|地板(?:扣分)?|wall\s*tiling/i.test(
      corpus,
    );
  return factory && wallOrRow;
}

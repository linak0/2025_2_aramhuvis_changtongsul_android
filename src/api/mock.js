// api/mock.js

export const USE_MOCK = false;

export function mockAnalyze(localUri) {
  const now = new Date().toISOString();
  return Promise.resolve({
    id: 999,
    created_at: now,
    source_image_url: localUri,
    scores: {
      acne: 0.61,
      hemo: 0.52,
      mela: 0.70,
      pore: 0.58,
      wrinkle: 0.63,
    },
    overlays: {
      acne: localUri,
      hemo: localUri,
      mela: localUri,
      pore: localUri,
      wrinkle: localUri,
    },
    rawAnalysis: {},
  });
}

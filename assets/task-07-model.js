export const HBAR = 1.054571817e-34;
export const PLANCK = 6.62607015e-34;
export const ELECTRON_MASS = 9.1093837015e-31;
export const PROTON_MASS = 1.67262192369e-27;
export const ELECTRON_VOLT = 1.602176634e-19;

export const particles = Object.freeze({
  electron: Object.freeze({ label: "Electron", symbol: "e⁻", mass: ELECTRON_MASS }),
  proton: Object.freeze({ label: "Proton", symbol: "p⁺", mass: PROTON_MASS }),
});

export function stateFor(n = 1, widthNm = 1, particle = "electron") {
  const safeN = Math.max(1, Math.round(Number(n)));
  const safeWidthNm = Math.max(0.1, Number(widthNm));
  const mass = particles[particle]?.mass ?? ELECTRON_MASS;
  const widthM = safeWidthNm * 1e-9;
  const energyJ = (safeN ** 2 * Math.PI ** 2 * HBAR ** 2) / (2 * mass * widthM ** 2);
  const wavelengthNm = (2 * safeWidthNm) / safeN;
  const deltaXNm = safeWidthNm * Math.sqrt(1 / 12 - 1 / (2 * safeN ** 2 * Math.PI ** 2));
  const deltaPMomentum = (safeN * Math.PI * HBAR) / widthM;
  const uncertaintyProduct = deltaXNm * 1e-9 * deltaPMomentum;
  const bound = HBAR / 2;

  return {
    n: safeN,
    widthNm: safeWidthNm,
    particle,
    mass,
    energyJ,
    energyEV: energyJ / ELECTRON_VOLT,
    wavelengthNm,
    deltaXNm,
    deltaPMomentum,
    uncertaintyProduct,
    bound,
    boundRatio: uncertaintyProduct / bound,
    meanXNm: safeWidthNm / 2,
  };
}

export function probabilityDensity(xFraction, n) {
  const x = Math.max(0, Math.min(1, Number(xFraction)));
  return 2 * Math.sin(Number(n) * Math.PI * x) ** 2;
}

export function waveAmplitude(xFraction, n) {
  const x = Math.max(0, Math.min(1, Number(xFraction)));
  return Math.sqrt(2) * Math.sin(Number(n) * Math.PI * x);
}

export function sampleState(n, count = 240) {
  return Array.from({ length: count + 1 }, (_, index) => {
    const x = index / count;
    return { x, amplitude: waveAmplitude(x, n), density: probabilityDensity(x, n) };
  });
}

export function uncertaintySweep(maxN = 8, widthNm = 1, particle = "electron") {
  return Array.from({ length: maxN }, (_, index) => stateFor(index + 1, widthNm, particle));
}

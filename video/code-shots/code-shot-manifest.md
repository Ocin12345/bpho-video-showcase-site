# BPhO 2026 code-shot manifest

Generated from `code-shot-config.mjs` and the live source files. The filming page reads `code-shot-data.js`; regenerate it after any source-line change with:

```bash
node video/code-shots/generate-code-shot-data.mjs
```

Every displayed line below is extracted verbatim from the named source range. The source ranges are intentionally compact; the animation phases only change the highlight and viewport position.

## Task 01 — random walk

- **Priority:** ESSENTIAL
- **Exact source file(s):** `assets/task-01-ensemble.js`
- **Exact function name(s):** `simulateEnsemble()`
- **Exact line range(s):** assets/task-01-ensemble.js:137–154; assets/task-01-ensemble.js:194–209
- **What it computes:** Uniform direction samples become Cartesian steps, then the ensemble returns its measured RMS evidence.
- **Suggested duration:** 3.85 seconds
- **Recommended final usage:** SHOW CODE — 3.85 seconds
- **Why:** The short loop makes the stochastic geometry and the ensemble statistic visible in one shot.

| Source range | Highlight progression |
| --- | --- |
| assets/task-01-ensemble.js:137–154 | 137, 138, 139, 140 — Each simulated walk starts at the origin. → 142, 143 — θ is uniform on 0–2π; cos and sin make the step components. → 148, 149, 150, 153, 154 — The computed position is sampled into the displayed trajectory. |
| assets/task-01-ensemble.js:194–209 | 194, 195, 196, 197 — The ensemble accumulates mean position, r², and the theoretical MSD. → 205, 206, 207, 208, 209 — Measured and theoretical RMS values are returned for the graph. |

## Task 02 — brownian motion

- **Priority:** ESSENTIAL
- **Exact source file(s):** `assets/task-02-simulation.js`
- **Exact function name(s):** `resolveTracerContacts()`
- **Exact line range(s):** assets/task-02-simulation.js:440–456
- **What it computes:** The collision solver resolves relative normal speed, restitution, impulse, and equal/opposite velocity updates.
- **Suggested duration:** 3.30 seconds
- **Recommended final usage:** SHOW CODE — 3.30 seconds
- **Why:** This is the clearest evidence that the animation is driven by collision mechanics rather than a visual loop.

| Source range | Highlight progression |
| --- | --- |
| assets/task-02-simulation.js:440–456 | 440, 441, 442 — Collision response begins with the relative velocity along the contact normal. → 444, 445, 446, 447 — Only approaching bodies receive an impulse; restitution sets the response. → 448, 449, 450, 451, 452, 453, 454, 455 — The small gas particle and tracer receive equal/opposite momentum transfer. → 456 — The event is counted as a physical impulse. |

## Task 03 — planck / einstein

- **Priority:** USEFUL
- **Exact source file(s):** `assets/task-03-simulation.js`, `assets/task-03-evidence.js`
- **Exact function name(s):** `spectralRadiance()`, `einsteinCapacity()`
- **Exact line range(s):** assets/task-03-simulation.js:74–86; assets/task-03-evidence.js:415–428
- **What it computes:** The live spectrum evaluates Planck’s law, while the evidence panel evaluates Einstein’s temperature-dependent heat capacity.
- **Suggested duration:** 3.70 seconds
- **Recommended final usage:** SKIP CODE — website equation/result is stronger
- **Why:** The website equations and validated plots communicate both laws more directly in the three-minute cut.

| Source range | Highlight progression |
| --- | --- |
| assets/task-03-simulation.js:74–86 | 74, 75, 76, 77, 78 — Wavelength is converted to metres and the Planck exponent is formed. → 80, 81, 82, 83, 84, 85 — The spectral radiance follows the full Planck denominator and λ⁻⁵ scaling. |
| assets/task-03-evidence.js:415–428 | 415, 416, 417, 418, 419, 420 — The Einstein temperature ratio and stable exponential denominator are computed. → 421, 422, 423, 424, 425, 426, 427 — The normalized heat capacity rises toward the classical 3R limit. |

## Task 04 — photoelectric effect

- **Priority:** USEFUL
- **Exact source file(s):** `assets/task-04.js`
- **Exact function name(s):** `frequencyFromWavelength()`, `thresholdWavelength()`, `stateFor()`
- **Exact line range(s):** assets/task-04.js:95–106; assets/task-04.js:110–114
- **What it computes:** Photon energy is compared with the material work function, then the current model applies the stopping-bias condition.
- **Suggested duration:** 2.75 seconds
- **Recommended final usage:** SKIP CODE — website equation/result is stronger
- **Why:** The task page already puts the threshold equation and the measured stopping result beside the apparatus.

| Source range | Highlight progression |
| --- | --- |
| assets/task-04.js:95–106 | 95, 96, 97, 99, 100 — Frequency and threshold wavelength follow from c/λ and Φ. → 103, 104, 105, 106 — Photon energy minus work function gives the available kinetic energy. |
| assets/task-04.js:110–114 | 110, 111, 112, 113, 114 — Reverse bias reduces the current as the stopping potential is approached. |

## Task 05 — hydrogen spectrum

- **Priority:** USEFUL
- **Exact source file(s):** `assets/task-05-evidence.js`
- **Exact function name(s):** `validateLevels()`, `validateTransitions()`
- **Exact line range(s):** assets/task-05-evidence.js:90–107; assets/task-05-evidence.js:174–180
- **What it computes:** Validated Bohr levels scale as −R/n²; transition energy then determines the emitted photon wavelength and frequency.
- **Suggested duration:** 3.20 seconds
- **Recommended final usage:** SKIP CODE — website equation/result is stronger
- **Why:** The level diagram, photon ribbon, and visible-series outputs are stronger evidence for the final screencast.

| Source range | Highlight progression |
| --- | --- |
| assets/task-05-evidence.js:90–107 | 90, 91, 92, 94, 95, 96, 97, 98 — The evidence loader reads the ten quantized levels. → 101, 102, 103, 104, 105, 106 — Each accepted level is checked against Eₙ = −R/n². |
| assets/task-05-evidence.js:174–180 | 174, 175, 176, 177, 178, 179, 180 — Initial and final levels become ΔE, then λ and f for the emitted photon. |

## Task 06 — electron diffraction

- **Priority:** ESSENTIAL
- **Exact source file(s):** `assets/task-06-evidence.js`
- **Exact function name(s):** `expectedWavelength()`, `expectedFirstOrder()`
- **Exact line range(s):** assets/task-06-evidence.js:91–100; assets/task-06-evidence.js:103–114
- **What it computes:** Accelerating voltage sets the de Broglie wavelength; Bragg geometry then maps that wavelength to ring radius and allowed orders.
- **Suggested duration:** 3.20 seconds
- **Recommended final usage:** SHOW CODE — 3.20 seconds
- **Why:** The two short validation functions show the voltage → wavelength → diffraction geometry chain explicitly.

| Source range | Highlight progression |
| --- | --- |
| assets/task-06-evidence.js:91–100 | 91, 92, 93, 94, 95, 96, 97, 98, 99, 100 — The accelerating voltage becomes λ = h / √(2mₑeV). |
| assets/task-06-evidence.js:103–114 | 103, 104, 105, 106, 107, 108, 109 — Bragg ratio q gives the scattering angle and photographic ring radius. → 109, 110, 111, 112, 113, 114 — The same wavelength also determines the maximum visible orders. |

## Task 07 — particle in a box

- **Priority:** ESSENTIAL
- **Exact source file(s):** `assets/task-07-model.js`
- **Exact function name(s):** `stateFor()`, `probabilityDensity()`, `waveAmplitude()`, `sampleState()`
- **Exact line range(s):** assets/task-07-model.js:12–22; assets/task-07-model.js:41–54
- **What it computes:** The analytic model returns n² energy levels, stationary wave amplitudes, probability density, and the uncertainty product.
- **Suggested duration:** 3.75 seconds
- **Recommended final usage:** SHOW CODE — 3.75 seconds
- **Why:** It puts the n² spectrum and |ψₙ|² directly beside the task’s plots without exposing implementation clutter.

| Source range | Highlight progression |
| --- | --- |
| assets/task-07-model.js:12–22 | 12, 13, 14, 15, 16, 17 — Energy is proportional to n² and inversely proportional to the square of the well width. → 18, 19, 20, 21, 22 — The same state also returns wavelength, Δx, Δp, and the uncertainty bound. |
| assets/task-07-model.js:41–54 | 41, 42, 43, 46, 47, 48 — The standing wave and its probability density are evaluated analytically. → 51, 52, 53, 54 — The plotted evidence samples amplitude and density from the same model. |

## Task 08 — quantum cryptography

- **Priority:** ESSENTIAL
- **Exact source file(s):** `assets/task-08.js`
- **Exact function name(s):** `mismatch()`
- **Exact line range(s):** assets/task-08.js:135–145
- **What it computes:** The live comparison evaluates the classical mismatch probability and the quantum sin² relative-angle prediction from the same detector settings.
- **Suggested duration:** 2.80 seconds
- **Recommended final usage:** SHOW CODE — 2.80 seconds
- **Why:** The paired functions are exceptionally compact and make the classical/quantum contrast immediately legible.

| Source range | Highlight progression |
| --- | --- |
| assets/task-08.js:135–145 | 135, 136, 137, 138, 139, 140, 141, 142 — The classical channel combines the two detector orientations. → 143, 144, 145 — The quantum channel depends only on the relative angle: sin²(φ−θ). |

## Task 09 — compton scattering

- **Priority:** ESSENTIAL
- **Exact source file(s):** `assets/task-09-compton-model.js`
- **Exact function name(s):** `wavelengthShiftPm()`, `scatteredWavelengthPm()`, `recoilKineticEnergyKeV()`, `recoilSpeedFractionC()`
- **Exact line range(s):** assets/task-09-compton-model.js:26–38; assets/task-09-compton-model.js:44–53
- **What it computes:** The Compton wavelength shift feeds the scattered photon energy and the relativistic electron recoil speed.
- **Suggested duration:** 3.55 seconds
- **Recommended final usage:** SHOW CODE — 3.55 seconds
- **Why:** The model exposes the central Δλ relation and its recoil consequence in two short, readable blocks.

| Source range | Highlight progression |
| --- | --- |
| assets/task-09-compton-model.js:26–38 | 26, 27, 28, 31, 32, 33 — Scattering angle θ gives Δλ = λC(1−cosθ), then λ′ = λ + Δλ. → 36, 37, 38 — The fractional shift normalizes the same relation by the incident wavelength. |
| assets/task-09-compton-model.js:44–53 | 44, 45, 46, 47 — The photon energy loss becomes the electron’s recoil kinetic energy. → 50, 51, 52, 53 — Relativistic γ converts that recoil energy into v/c. |

## Task 10 — hydrogenic orbitals

- **Priority:** ESSENTIAL
- **Exact source file(s):** `assets/task-10-model.js`, `assets/task-10.js`
- **Exact function name(s):** `sphericalHarmonic()`, `radialWavefunction()`, `hydrogenicOrbital()`, `modelSettings()`
- **Exact line range(s):** assets/task-10-model.js:93–110; assets/task-10-model.js:113–134; assets/task-10.js:386–392
- **What it computes:** The primary hydrogenic model evaluates spherical harmonics, normalized radial functions, ψ = RY, and probability density |ψ|².
- **Suggested duration:** 3.80 seconds
- **Recommended final usage:** SHOW CODE — 3.80 seconds
- **Why:** This is the required hydrogenic orbital evidence; molecular and neon extensions stay out of the primary shot.

| Source range | Highlight progression |
| --- | --- |
| assets/task-10-model.js:93–110 | 93, 94, 95, 102, 103, 104, 105, 106 — The angular factor is normalized and evaluated through associated Legendre polynomials. → 107, 108, 109, 110 — The spherical harmonic is returned as a complex angular amplitude. |
| assets/task-10-model.js:113–134 | 113, 114, 115, 117, 118, 119, 120, 121, 122, 123, 124 — The radial hydrogenic wavefunction carries the exponential, ρˡ, and Laguerre factors. → 126, 127, 128, 129, 130, 131, 132, 133, 134 — Cartesian samples become r, θ, φ, then ψ = RₙₗYₗₘ. |
| assets/task-10.js:386–392 | 390, 391, 392 — The task renderer converts the complex orbital amplitude into \|ψ\|² density and phase. |

## Recommended final screencast usage

The complete master sequence is approximately **33.90 seconds**. For the final ≤3-minute BPhO screencast, use only the highest-signal code evidence below: **24.25 seconds total**.

- Task 1: SHOW CODE — 3.85 seconds
- Task 2: SHOW CODE — 3.30 seconds
- Task 3: SKIP CODE — website equation/result is stronger
- Task 4: SKIP CODE — website equation/result is stronger
- Task 5: SKIP CODE — website equation/result is stronger
- Task 6: SHOW CODE — 3.20 seconds
- Task 7: SHOW CODE — 3.75 seconds
- Task 8: SHOW CODE — 2.80 seconds
- Task 9: SHOW CODE — 3.55 seconds
- Task 10: SHOW CODE — 3.80 seconds

Tasks 1, 2, 6, 7, 8, 9, and 10 are the recommended dedicated code inserts. Tasks 3–5 remain available as individual scenes if the edit needs extra implementation evidence.

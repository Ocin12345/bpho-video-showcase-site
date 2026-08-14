export const codeShotConfig = [
  {
    task: 1,
    title: "RANDOM WALK",
    description: "Uniform direction samples become Cartesian steps, then the ensemble returns its measured RMS evidence.",
    functions: ["simulateEnsemble"],
    priority: "ESSENTIAL",
    recommendation: "SHOW CODE",
    recommendationReason: "The short loop makes the stochastic geometry and the ensemble statistic visible in one shot.",
    segments: [
      {
        source: "assets/task-01-ensemble.js",
        start: 137,
        end: 154,
        phases: [
          {
            lines: [137, 138, 139, 140],
            caption: "Each simulated walk starts at the origin.",
            durationMs: 800,
          },
          {
            lines: [142, 143],
            caption: "θ is uniform on 0–2π; cos and sin make the step components.",
            durationMs: 1_050,
          },
          {
            lines: [148, 149, 150, 153, 154],
            caption: "The computed position is sampled into the displayed trajectory.",
            durationMs: 700,
          },
        ],
      },
      {
        source: "assets/task-01-ensemble.js",
        start: 194,
        end: 209,
        phases: [
          {
            lines: [194, 195, 196, 197],
            caption: "The ensemble accumulates mean position, r², and the theoretical MSD.",
            durationMs: 500,
          },
          {
            lines: [205, 206, 207, 208, 209],
            caption: "Measured and theoretical RMS values are returned for the graph.",
            durationMs: 800,
          },
        ],
      },
    ],
  },
  {
    task: 2,
    title: "BROWNIAN MOTION",
    description: "The collision solver resolves relative normal speed, restitution, impulse, and equal/opposite velocity updates.",
    functions: ["resolveTracerContacts"],
    priority: "ESSENTIAL",
    recommendation: "SHOW CODE",
    recommendationReason: "This is the clearest evidence that the animation is driven by collision mechanics rather than a visual loop.",
    segments: [
      {
        source: "assets/task-02-simulation.js",
        start: 440,
        end: 456,
        phases: [
          {
            lines: [440, 441, 442],
            caption: "Collision response begins with the relative velocity along the contact normal.",
            durationMs: 800,
          },
          {
            lines: [444, 445, 446, 447],
            caption: "Only approaching bodies receive an impulse; restitution sets the response.",
            durationMs: 1_100,
          },
          {
            lines: [448, 449, 450, 451, 452, 453, 454, 455],
            caption: "The small gas particle and tracer receive equal/opposite momentum transfer.",
            durationMs: 1_150,
          },
          {
            lines: [456],
            caption: "The event is counted as a physical impulse.",
            durationMs: 250,
          },
        ],
      },
    ],
  },
  {
    task: 3,
    title: "PLANCK / EINSTEIN",
    description: "The live spectrum evaluates Planck’s law, while the evidence panel evaluates Einstein’s temperature-dependent heat capacity.",
    functions: ["spectralRadiance", "einsteinCapacity"],
    priority: "USEFUL",
    recommendation: "SKIP CODE",
    recommendationReason: "The website equations and validated plots communicate both laws more directly in the three-minute cut.",
    segments: [
      {
        source: "assets/task-03-simulation.js",
        start: 74,
        end: 86,
        phases: [
          {
            lines: [74, 75, 76, 77, 78],
            caption: "Wavelength is converted to metres and the Planck exponent is formed.",
            durationMs: 1_050,
          },
          {
            lines: [80, 81, 82, 83, 84, 85],
            caption: "The spectral radiance follows the full Planck denominator and λ⁻⁵ scaling.",
            durationMs: 750,
          },
        ],
      },
      {
        source: "assets/task-03-evidence.js",
        start: 415,
        end: 428,
        phases: [
          {
            lines: [415, 416, 417, 418, 419, 420],
            caption: "The Einstein temperature ratio and stable exponential denominator are computed.",
            durationMs: 800,
          },
          {
            lines: [421, 422, 423, 424, 425, 426, 427],
            caption: "The normalized heat capacity rises toward the classical 3R limit.",
            durationMs: 1_100,
          },
        ],
      },
    ],
  },
  {
    task: 4,
    title: "PHOTOELECTRIC EFFECT",
    description: "Photon energy is compared with the material work function, then the current model applies the stopping-bias condition.",
    functions: ["frequencyFromWavelength", "thresholdWavelength", "stateFor"],
    priority: "USEFUL",
    recommendation: "SKIP CODE",
    recommendationReason: "The task page already puts the threshold equation and the measured stopping result beside the apparatus.",
    segments: [
      {
        source: "assets/task-04.js",
        start: 95,
        end: 106,
        phases: [
          {
            lines: [95, 96, 97, 99, 100],
            caption: "Frequency and threshold wavelength follow from c/λ and Φ.",
            durationMs: 950,
          },
          {
            lines: [103, 104, 105, 106],
            caption: "Photon energy minus work function gives the available kinetic energy.",
            durationMs: 1_050,
          },
        ],
      },
      {
        source: "assets/task-04.js",
        start: 110,
        end: 114,
        phases: [
          {
            lines: [110, 111, 112, 113, 114],
            caption: "Reverse bias reduces the current as the stopping potential is approached.",
            durationMs: 750,
          },
        ],
      },
    ],
  },
  {
    task: 5,
    title: "HYDROGEN SPECTRUM",
    description: "Validated Bohr levels scale as −R/n²; transition energy then determines the emitted photon wavelength and frequency.",
    functions: ["validateLevels", "validateTransitions"],
    priority: "USEFUL",
    recommendation: "SKIP CODE",
    recommendationReason: "The level diagram, photon ribbon, and visible-series outputs are stronger evidence for the final screencast.",
    segments: [
      {
        source: "assets/task-05-evidence.js",
        start: 90,
        end: 107,
        phases: [
          {
            lines: [90, 91, 92, 94, 95, 96, 97, 98],
            caption: "The evidence loader reads the ten quantized levels.",
            durationMs: 850,
          },
          {
            lines: [101, 102, 103, 104, 105, 106],
            caption: "Each accepted level is checked against Eₙ = −R/n².",
            durationMs: 1_050,
          },
        ],
      },
      {
        source: "assets/task-05-evidence.js",
        start: 174,
        end: 180,
        phases: [
          {
            lines: [174, 175, 176, 177, 178, 179, 180],
            caption: "Initial and final levels become ΔE, then λ and f for the emitted photon.",
            durationMs: 1_300,
          },
        ],
      },
    ],
  },
  {
    task: 6,
    title: "ELECTRON DIFFRACTION",
    description: "Accelerating voltage sets the de Broglie wavelength; Bragg geometry then maps that wavelength to ring radius and allowed orders.",
    functions: ["expectedWavelength", "expectedFirstOrder"],
    priority: "ESSENTIAL",
    recommendation: "SHOW CODE",
    recommendationReason: "The two short validation functions show the voltage → wavelength → diffraction geometry chain explicitly.",
    segments: [
      {
        source: "assets/task-06-evidence.js",
        start: 91,
        end: 100,
        phases: [
          {
            lines: [91, 92, 93, 94, 95, 96, 97, 98, 99, 100],
            caption: "The accelerating voltage becomes λ = h / √(2mₑeV).",
            durationMs: 1_200,
          },
        ],
      },
      {
        source: "assets/task-06-evidence.js",
        start: 103,
        end: 114,
        phases: [
          {
            lines: [103, 104, 105, 106, 107, 108, 109],
            caption: "Bragg ratio q gives the scattering angle and photographic ring radius.",
            durationMs: 1_200,
          },
          {
            lines: [109, 110, 111, 112, 113, 114],
            caption: "The same wavelength also determines the maximum visible orders.",
            durationMs: 800,
          },
        ],
      },
    ],
  },
  {
    task: 7,
    title: "PARTICLE IN A BOX",
    description: "The analytic model returns n² energy levels, stationary wave amplitudes, probability density, and the uncertainty product.",
    functions: ["stateFor", "probabilityDensity", "waveAmplitude", "sampleState"],
    priority: "ESSENTIAL",
    recommendation: "SHOW CODE",
    recommendationReason: "It puts the n² spectrum and |ψₙ|² directly beside the task’s plots without exposing implementation clutter.",
    segments: [
      {
        source: "assets/task-07-model.js",
        start: 12,
        end: 22,
        phases: [
          {
            lines: [12, 13, 14, 15, 16, 17],
            caption: "Energy is proportional to n² and inversely proportional to the square of the well width.",
            durationMs: 1_100,
          },
          {
            lines: [18, 19, 20, 21, 22],
            caption: "The same state also returns wavelength, Δx, Δp, and the uncertainty bound.",
            durationMs: 850,
          },
        ],
      },
      {
        source: "assets/task-07-model.js",
        start: 41,
        end: 54,
        phases: [
          {
            lines: [41, 42, 43, 46, 47, 48],
            caption: "The standing wave and its probability density are evaluated analytically.",
            durationMs: 1_150,
          },
          {
            lines: [51, 52, 53, 54],
            caption: "The plotted evidence samples amplitude and density from the same model.",
            durationMs: 650,
          },
        ],
      },
    ],
  },
  {
    task: 8,
    title: "QUANTUM CRYPTOGRAPHY",
    description: "The live comparison evaluates the classical mismatch probability and the quantum sin² relative-angle prediction from the same detector settings.",
    functions: ["mismatch"],
    priority: "ESSENTIAL",
    recommendation: "SHOW CODE",
    recommendationReason: "The paired functions are exceptionally compact and make the classical/quantum contrast immediately legible.",
    segments: [
      {
        source: "assets/task-08.js",
        start: 135,
        end: 145,
        phases: [
          {
            lines: [135, 136, 137, 138, 139, 140, 141, 142],
            caption: "The classical channel combines the two detector orientations.",
            durationMs: 1_350,
          },
          {
            lines: [143, 144, 145],
            caption: "The quantum channel depends only on the relative angle: sin²(φ−θ).",
            durationMs: 1_450,
          },
        ],
      },
    ],
  },
  {
    task: 9,
    title: "COMPTON SCATTERING",
    description: "The Compton wavelength shift feeds the scattered photon energy and the relativistic electron recoil speed.",
    functions: ["wavelengthShiftPm", "scatteredWavelengthPm", "recoilKineticEnergyKeV", "recoilSpeedFractionC"],
    priority: "ESSENTIAL",
    recommendation: "SHOW CODE",
    recommendationReason: "The model exposes the central Δλ relation and its recoil consequence in two short, readable blocks.",
    segments: [
      {
        source: "assets/task-09-compton-model.js",
        start: 26,
        end: 38,
        phases: [
          {
            lines: [26, 27, 28, 31, 32, 33],
            caption: "Scattering angle θ gives Δλ = λC(1−cosθ), then λ′ = λ + Δλ.",
            durationMs: 1_150,
          },
          {
            lines: [36, 37, 38],
            caption: "The fractional shift normalizes the same relation by the incident wavelength.",
            durationMs: 750,
          },
        ],
      },
      {
        source: "assets/task-09-compton-model.js",
        start: 44,
        end: 53,
        phases: [
          {
            lines: [44, 45, 46, 47],
            caption: "The photon energy loss becomes the electron’s recoil kinetic energy.",
            durationMs: 1_050,
          },
          {
            lines: [50, 51, 52, 53],
            caption: "Relativistic γ converts that recoil energy into v/c.",
            durationMs: 600,
          },
        ],
      },
    ],
  },
  {
    task: 10,
    title: "HYDROGENIC ORBITALS",
    description: "The primary hydrogenic model evaluates spherical harmonics, normalized radial functions, ψ = RY, and probability density |ψ|².",
    functions: ["sphericalHarmonic", "radialWavefunction", "hydrogenicOrbital", "modelSettings"],
    priority: "ESSENTIAL",
    recommendation: "SHOW CODE",
    recommendationReason: "This is the required hydrogenic orbital evidence; molecular and neon extensions stay out of the primary shot.",
    segments: [
      {
        source: "assets/task-10-model.js",
        start: 93,
        end: 110,
        phases: [
          {
            lines: [93, 94, 95, 102, 103, 104, 105, 106],
            caption: "The angular factor is normalized and evaluated through associated Legendre polynomials.",
            durationMs: 800,
          },
          {
            lines: [107, 108, 109, 110],
            caption: "The spherical harmonic is returned as a complex angular amplitude.",
            durationMs: 550,
          },
        ],
      },
      {
        source: "assets/task-10-model.js",
        start: 113,
        end: 134,
        phases: [
          {
            lines: [113, 114, 115, 117, 118, 119, 120, 121, 122, 123, 124],
            caption: "The radial hydrogenic wavefunction carries the exponential, ρˡ, and Laguerre factors.",
            durationMs: 1_000,
          },
          {
            lines: [126, 127, 128, 129, 130, 131, 132, 133, 134],
            caption: "Cartesian samples become r, θ, φ, then ψ = RₙₗYₗₘ.",
            durationMs: 900,
          },
        ],
      },
      {
        source: "assets/task-10.js",
        start: 386,
        end: 392,
        phases: [
          {
            lines: [390, 391, 392],
            caption: "The task renderer converts the complex orbital amplitude into |ψ|² density and phase.",
            durationMs: 550,
          },
        ],
      },
    ],
  },
];

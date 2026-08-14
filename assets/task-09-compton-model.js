export const SPEED_OF_LIGHT = 299_792_458;
export const ELECTRON_REST_ENERGY_KEV = 510.99895;
export const COMPTON_WAVELENGTH_PM = 2.42631023867;
export const HC_KEV_PM = 1_239.8419843320026;

export const WAVELENGTH_MIN_PM = 1;
export const WAVELENGTH_MAX_PM = 100;

const degreesToRadians = (degrees) => (degrees * Math.PI) / 180;

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export function normaliseWavelength(wavelengthPm) {
  return clamp(Number.isFinite(wavelengthPm) ? wavelengthPm : 10, WAVELENGTH_MIN_PM, WAVELENGTH_MAX_PM);
}

export function normaliseAngle(thetaDegrees) {
  return clamp(Number.isFinite(thetaDegrees) ? thetaDegrees : 90, 0, 180);
}

export function photonEnergyKeV(wavelengthPm) {
  const safeWavelength = Number.isFinite(wavelengthPm) ? Math.max(1e-9, wavelengthPm) : 10;
  return HC_KEV_PM / safeWavelength;
}

export function wavelengthShiftPm(wavelengthPm, thetaDegrees) {
  const theta = degreesToRadians(normaliseAngle(thetaDegrees));
  return COMPTON_WAVELENGTH_PM * (1 - Math.cos(theta));
}

export function scatteredWavelengthPm(wavelengthPm, thetaDegrees) {
  const wavelength = normaliseWavelength(wavelengthPm);
  return wavelength + wavelengthShiftPm(wavelength, thetaDegrees);
}

export function fractionalWavelengthShift(wavelengthPm, thetaDegrees) {
  return wavelengthShiftPm(wavelengthPm, thetaDegrees) / normaliseWavelength(wavelengthPm);
}

export function scatteredPhotonEnergyKeV(wavelengthPm, thetaDegrees) {
  return photonEnergyKeV(scatteredWavelengthPm(wavelengthPm, thetaDegrees));
}

export function recoilKineticEnergyKeV(wavelengthPm, thetaDegrees) {
  const initialEnergy = photonEnergyKeV(wavelengthPm);
  const scatteredEnergy = scatteredPhotonEnergyKeV(wavelengthPm, thetaDegrees);
  return initialEnergy - scatteredEnergy;
}

export function recoilSpeedFractionC(wavelengthPm, thetaDegrees) {
  const kineticEnergy = recoilKineticEnergyKeV(wavelengthPm, thetaDegrees);
  const gamma = 1 + kineticEnergy / ELECTRON_REST_ENERGY_KEV;
  return Math.sqrt(Math.max(0, 1 - 1 / (gamma * gamma)));
}

export function recoilSpeedMps(wavelengthPm, thetaDegrees) {
  return recoilSpeedFractionC(wavelengthPm, thetaDegrees) * SPEED_OF_LIGHT;
}

export function recoilAngleDegrees(wavelengthPm, thetaDegrees) {
  const theta = degreesToRadians(normaliseAngle(thetaDegrees));
  const alpha = COMPTON_WAVELENGTH_PM / normaliseWavelength(wavelengthPm);

  // tan(phi) = sin(theta) / ((1 + alpha)(1 - cos(theta))).
  // At theta = 0 there is no recoil momentum; this is the limiting direction.
  if (theta < 1e-9) return 90;
  return (Math.atan2(Math.sin(theta), (1 + alpha) * (1 - Math.cos(theta))) * 180) / Math.PI;
}

export function recoilMomentumDirection(wavelengthPm, thetaDegrees) {
  const theta = degreesToRadians(normaliseAngle(thetaDegrees));
  const alpha = COMPTON_WAVELENGTH_PM / normaliseWavelength(wavelengthPm);
  const scatteredMomentumScale = 1 / (1 + alpha * (1 - Math.cos(theta)));
  const x = 1 - scatteredMomentumScale * Math.cos(theta);
  const y = scatteredMomentumScale * Math.sin(theta);
  return { x, y: -y, magnitude: Math.hypot(x, y) };
}

export function comptonState(wavelengthPm, thetaDegrees) {
  const wavelength = normaliseWavelength(wavelengthPm);
  const theta = normaliseAngle(thetaDegrees);
  const shift = wavelengthShiftPm(wavelength, theta);
  const scatteredWavelength = wavelength + shift;
  const photonEnergy = photonEnergyKeV(wavelength);
  const scatteredEnergy = photonEnergyKeV(scatteredWavelength);
  const kineticEnergy = photonEnergy - scatteredEnergy;
  const speedFraction = recoilSpeedFractionC(wavelength, theta);

  return {
    wavelengthPm: wavelength,
    thetaDegrees: theta,
    shiftPm: shift,
    fractionalShift: shift / wavelength,
    scatteredWavelengthPm: scatteredWavelength,
    photonEnergyKeV: photonEnergy,
    scatteredPhotonEnergyKeV: scatteredEnergy,
    kineticEnergyKeV: kineticEnergy,
    speedFractionC: speedFraction,
    speedMps: speedFraction * SPEED_OF_LIGHT,
    recoilAngleDegrees: recoilAngleDegrees(wavelength, theta),
    momentumDirection: recoilMomentumDirection(wavelength, theta),
  };
}

export function sampleComptonCurve(wavelengthPm, count = 181) {
  const safeCount = Math.max(2, Math.floor(count));
  return Array.from({ length: safeCount }, (_, index) => {
    const theta = (180 * index) / (safeCount - 1);
    const state = comptonState(wavelengthPm, theta);
    return {
      thetaDegrees: theta,
      fractionalShift: state.fractionalShift,
      speedFractionC: state.speedFractionC,
      speedMps: state.speedMps,
      recoilAngleDegrees: state.recoilAngleDegrees,
    };
  });
}

(() => {
  "use strict";

  const evidence = window.TASK03_EVIDENCE || {};
  const supplied = evidence.constants || {};
  const constants = {
    h: supplied.planck_j_s || 6.62607015e-34,
    c: supplied.speed_of_light_m_s || 299792458,
    k: supplied.boltzmann_j_k || 1.380649e-23,
    sigma:
      supplied.stefan_boltzmann_w_m2_k4 || 5.6703744191844314e-8,
    wien: supplied.wien_displacement_m_k || 0.0028977719551851727,
  };

  const canvas = document.querySelector("#planck-live-chart");
  const temperatureInput = document.querySelector("#surface-temperature");
  if (!canvas || !temperatureInput) return;

  const context = canvas.getContext("2d");
  const orb = document.querySelector("[data-blackbody-orb]");
  const orbStage = orb?.closest(".orb-stage");
  const hero = document.querySelector(".radiation-hero");
  const temperatureLabel = document.querySelector("[data-temperature-label]");
  const temperatureOutput = document.querySelector("[data-temperature-output]");
  const peakReadout = document.querySelector("[data-peak-readout]");
  const integralLabel = document.querySelector("[data-integral-label]");
  const integralReadout = document.querySelector("[data-integral-readout]");
  const relativeReadout = document.querySelector("[data-relative-readout]");
  const regionLabel = document.querySelector("[data-region-label]");
  const liveQuantityTitle = document.querySelector(
    "[data-live-quantity-title]",
  );
  const peakMarker = document.querySelector("[data-peak-marker]");
  const anatomyTemperature = document.querySelector(
    "[data-anatomy-temperature]",
  );
  const anatomyPeak = document.querySelector("[data-anatomy-peak]");
  const tooltip = document.querySelector("[data-spectrum-tooltip]");
  const presetButtons = Array.from(
    document.querySelectorAll("[data-temperature-preset]"),
  );
  const sweepButton = document.querySelector("[data-sweep]");
  const sweepLabel = document.querySelector("[data-sweep-label]");
  const sweepIcon = document.querySelector("[data-sweep-icon]");
  const quantityButtons = Array.from(
    document.querySelectorAll("[data-planck-quantity]"),
  );
  const modeButtons = Array.from(
    document.querySelectorAll("[data-planck-mode]"),
  );
  const comparisonLegend = document.querySelector("[data-planck-legend]");
  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  let temperature = Number(temperatureInput.value);
  let planckQuantity = "radiance";
  let compareMode = false;
  let sweepFrame = 0;
  let sweeping = false;
  let sweepStartTime = 0;
  let sweepStartPhase = 0;
  let temperatureTweenFrame = 0;
  let chartState = null;
  let resizeFrame = 0;

  const clamp = (value, minimum, maximum) =>
    Math.min(maximum, Math.max(minimum, value));
  const easeInOutCubic = (value) =>
    value < 0.5
      ? 4 * value ** 3
      : 1 - (-2 * value + 2) ** 3 / 2;

  function spectralRadiance(wavelengthNm, temperatureK) {
    const wavelengthM = wavelengthNm * 1e-9;
    const exponent =
      (constants.h * constants.c) /
      (wavelengthM * constants.k * temperatureK);
    if (exponent > 700) return 0;
    return (
      ((2 * constants.h * constants.c ** 2) /
        wavelengthM ** 5 /
        Math.expm1(exponent)) *
      1e-9
    );
  }

  function spectralValue(wavelengthNm, temperatureK) {
    const radiance = spectralRadiance(wavelengthNm, temperatureK);
    return planckQuantity === "exitance" ? Math.PI * radiance : radiance;
  }

  function blackbodyRgb(kelvin) {
    const scaled = clamp(kelvin, 1000, 40000) / 100;
    let red;
    let green;
    let blue;

    if (scaled <= 66) {
      red = 255;
      green = 99.4708025861 * Math.log(scaled) - 161.1195681661;
      blue =
        scaled <= 19
          ? 0
          : 138.5177312231 * Math.log(scaled - 10) - 305.0447927307;
    } else {
      red = 329.698727446 * (scaled - 60) ** -0.1332047592;
      green = 288.1221695283 * (scaled - 60) ** -0.0755148492;
      blue = 255;
    }

    return [red, green, blue].map((value) =>
      Math.round(clamp(value, 0, 255)),
    );
  }

  function formatTemperature(value) {
    return `${Math.round(value).toLocaleString("en-GB")} K`;
  }

  function formatIntegral(value) {
    const unit =
      planckQuantity === "radiance" ? "m⁻² sr⁻¹" : "m⁻²";
    if (value >= 1e9) return `${(value / 1e9).toFixed(2)} GW ${unit}`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(2)} MW ${unit}`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(2)} kW ${unit}`;
    return `${value.toFixed(2)} W ${unit}`;
  }

  function formatSpectral(value) {
    const unit =
      planckQuantity === "radiance"
        ? "m⁻² sr⁻¹ nm⁻¹"
        : "m⁻² nm⁻¹";
    if (value >= 1e6) return `${(value / 1e6).toFixed(2)} MW ${unit}`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(2)} kW ${unit}`;
    if (value >= 1) return `${value.toFixed(2)} W ${unit}`;
    return `${value.toExponential(2)} W ${unit}`;
  }

  function peakRegion(wavelengthNm) {
    if (wavelengthNm < 380) return "ultraviolet";
    if (wavelengthNm <= 750) return "visible";
    return "infrared";
  }

  function fitCanvas(target) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(target.clientWidth));
    const height = Math.max(1, Math.round(target.clientHeight));
    const requiredWidth = Math.round(width * dpr);
    const requiredHeight = Math.round(height * dpr);

    if (
      target.width !== requiredWidth ||
      target.height !== requiredHeight
    ) {
      target.width = requiredWidth;
      target.height = requiredHeight;
    }

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { width, height, dpr };
  }

  function chartGeometry(width, height) {
    const compact = width < 540;
    const margin = {
      top: 18,
      right: 15,
      bottom: 42,
      left: compact ? 55 : 70,
    };
    return {
      ...margin,
      plotWidth: width - margin.left - margin.right,
      plotHeight: height - margin.top - margin.bottom,
      width,
      height,
      compact,
    };
  }

  function drawSpectrum(timestamp = performance.now()) {
    const { width, height } = fitCanvas(canvas);
    const geometry = chartGeometry(width, height);
    const { left, top, plotWidth, plotHeight } = geometry;
    const xMinimum = 100;
    const xMaximum = 3000;
    const samples = 420;
    const comparisonTemperatures = [4000, 5000, 6000];
    const curveTemperatures = compareMode
      ? comparisonTemperatures
      : [temperature];
    const curves = curveTemperatures.map((curveTemperature) => {
      const points = [];
      for (let index = 0; index <= samples; index += 1) {
        const wavelength =
          xMinimum + (index / samples) * (xMaximum - xMinimum);
        points.push({
          wavelength,
          value: spectralValue(wavelength, curveTemperature),
        });
      }
      return { temperature: curveTemperature, points };
    });
    const maximum = Math.max(
      ...curves.flatMap((curve) => curve.points.map((point) => point.value)),
    );

    const xFor = (wavelength) =>
      left +
      ((wavelength - xMinimum) / (xMaximum - xMinimum)) * plotWidth;
    const yFor = (value) =>
      top + plotHeight - (value / maximum) * plotHeight;

    context.clearRect(0, 0, width, height);

    const visibleStart = xFor(380);
    const visibleEnd = xFor(750);
    const visibleGradient = context.createLinearGradient(
      visibleStart,
      0,
      visibleEnd,
      0,
    );
    visibleGradient.addColorStop(0, "rgba(92, 42, 171, 0.13)");
    visibleGradient.addColorStop(0.2, "rgba(47, 80, 222, 0.13)");
    visibleGradient.addColorStop(0.42, "rgba(31, 171, 174, 0.13)");
    visibleGradient.addColorStop(0.62, "rgba(95, 181, 64, 0.13)");
    visibleGradient.addColorStop(0.8, "rgba(233, 203, 48, 0.13)");
    visibleGradient.addColorStop(1, "rgba(220, 51, 39, 0.13)");
    context.fillStyle = visibleGradient;
    context.fillRect(
      visibleStart,
      top,
      visibleEnd - visibleStart,
      plotHeight,
    );

    context.font = `${geometry.compact ? 11 : 12}px "Times New Roman", Times, serif`;
    context.textAlign = "right";
    context.textBaseline = "middle";
    for (let index = 0; index <= 4; index += 1) {
      const fraction = index / 4;
      const y = top + plotHeight - fraction * plotHeight;
      context.strokeStyle = "rgba(37, 35, 31, 0.12)";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(left, y);
      context.lineTo(left + plotWidth, y);
      context.stroke();
      context.fillStyle = "rgba(37, 35, 31, 0.62)";
      const tick = maximum * fraction;
      const label =
        tick >= 1e6
          ? `${(tick / 1e6).toFixed(1)}M`
          : tick >= 1e3
            ? `${(tick / 1e3).toFixed(0)}k`
            : tick.toFixed(0);
      context.fillText(label, left - 9, y);
    }

    context.textAlign = "center";
    context.textBaseline = "top";
    const xTicks = geometry.compact
      ? [100, 750, 1500, 2250, 3000]
      : [100, 500, 1000, 1500, 2000, 2500, 3000];
    xTicks.forEach((tick) => {
      const x = xFor(tick);
      context.strokeStyle = "rgba(37, 35, 31, 0.09)";
      context.beginPath();
      context.moveTo(x, top);
      context.lineTo(x, top + plotHeight);
      context.stroke();
      context.fillStyle = "rgba(37, 35, 31, 0.62)";
      context.fillText(tick.toLocaleString("en-GB"), x, top + plotHeight + 9);
    });

    const drawCurve = (curve, colour, lineWidth = 2.3) => {
      context.beginPath();
      curve.points.forEach((point, index) => {
        const x = xFor(point.wavelength);
        const y = yFor(point.value);
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.strokeStyle = colour;
      context.lineWidth = lineWidth;
      context.lineJoin = "round";
      context.stroke();
    };

    if (compareMode) {
      const colours = ["#b95743", "#b48529", "#4d8ca0"];
      curves.forEach((curve, index) =>
        drawCurve(curve, colours[index], index === 1 ? 2.8 : 2.2),
      );
    } else {
      const curve = curves[0];
      context.beginPath();
      curve.points.forEach((point, index) => {
        const x = xFor(point.wavelength);
        const y = yFor(point.value);
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.lineTo(left + plotWidth, top + plotHeight);
      context.lineTo(left, top + plotHeight);
      context.closePath();
      context.fillStyle = "rgba(162, 79, 57, 0.09)";
      context.fill();
      drawCurve(curve, "#a24f39");

      const peakNm = (constants.wien / temperature) * 1e9;
      const peakValue = spectralValue(peakNm, temperature);
      const peakX = xFor(peakNm);
      const peakY = yFor(peakValue);
      context.setLineDash([4, 4]);
      context.strokeStyle = "rgba(37, 35, 31, 0.42)";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(peakX, peakY);
      context.lineTo(peakX, top + plotHeight);
      context.stroke();
      context.setLineDash([]);
      if ((sweeping || temperatureTweenFrame) && !reducedMotion) {
        const pulse = (Math.sin(timestamp / 210) + 1) / 2;
        context.strokeStyle = `rgba(162, 79, 57, ${(
          0.14 +
          pulse * 0.22
        ).toFixed(3)})`;
        context.lineWidth = 1;
        context.beginPath();
        context.arc(peakX, peakY, 7 + pulse * 4, 0, Math.PI * 2);
        context.stroke();
      }
      context.fillStyle = "#25231f";
      context.beginPath();
      context.arc(peakX, peakY, 4, 0, Math.PI * 2);
      context.fill();
      context.font = '12.5px "Times New Roman", Times, serif';
      context.fillStyle = "#25231f";
      context.textAlign = peakX > left + plotWidth * 0.72 ? "right" : "left";
      context.textBaseline = "bottom";
      context.fillText(
        `λmax ${peakNm.toFixed(1)} nm`,
        peakX + (context.textAlign === "right" ? -9 : 9),
        peakY - 7,
      );
    }

    context.save();
    context.translate(14, top + plotHeight / 2);
    context.rotate(-Math.PI / 2);
    context.fillStyle = "rgba(37, 35, 31, 0.68)";
    context.font = `${geometry.compact ? 11 : 12}px "Times New Roman", Times, serif`;
    context.textAlign = "center";
    context.textBaseline = "top";
    context.fillText(
      planckQuantity === "radiance"
        ? "Bλ / W m⁻² sr⁻¹ nm⁻¹"
        : "Mλ / W m⁻² nm⁻¹",
      0,
      0,
    );
    context.restore();

    context.fillStyle = "rgba(37, 35, 31, 0.68)";
    context.textAlign = "center";
    context.textBaseline = "bottom";
    context.fillText(
      "wavelength / nm",
      left + plotWidth / 2,
      height - 1,
    );

    chartState = {
      geometry,
      maximum,
      xMinimum,
      xMaximum,
      xFor,
      yFor,
    };
  }

  function updateReadouts() {
    const peakNm = (constants.wien / temperature) * 1e9;
    const exitance = constants.sigma * temperature ** 4;
    const integratedValue =
      planckQuantity === "radiance" ? exitance / Math.PI : exitance;
    const relative = (temperature / 4000) ** 4;
    const region = peakRegion(peakNm);
    const energy = clamp((temperature - 2500) / 5500, 0, 1);
    const formattedTemperature = formatTemperature(temperature);
    const [red, green, blue] = blackbodyRgb(temperature);

    temperatureInput.value = String(Math.round(temperature));
    temperatureLabel.textContent = formattedTemperature;
    temperatureOutput.textContent = formattedTemperature;
    peakReadout.textContent = `${peakNm.toFixed(1)} nm`;
    integralLabel.textContent =
      planckQuantity === "radiance"
        ? "Integrated radiance"
        : "Total exitance";
    integralReadout.textContent = formatIntegral(integratedValue);
    relativeReadout.textContent = `${relative.toFixed(2)}×`;
    regionLabel.textContent = `Peak · ${region}`;
    if (anatomyTemperature) {
      anatomyTemperature.textContent = `At ${formattedTemperature}`;
    }
    if (anatomyPeak) {
      anatomyPeak.textContent = `λmax = ${peakNm.toFixed(1)} nm`;
    }
    if (peakMarker) {
      peakMarker.style.left = `${clamp(
        ((peakNm - 100) / (3000 - 100)) * 100,
        0,
        100,
      )}%`;
    }
    orb.style.setProperty("--orb-rgb", `${red}, ${green}, ${blue}`);
    hero?.style.setProperty("--thermal-energy", energy.toFixed(3));
    orbStage?.style.setProperty(
      "--orb-cycle",
      `${(6.7 - energy * 2.2).toFixed(2)}s`,
    );
    orbStage?.style.setProperty(
      "--orb-brightness",
      (0.94 + energy * 0.16).toFixed(3),
    );
    orbStage?.style.setProperty(
      "--orb-pulse-low",
      (0.989 - energy * 0.008).toFixed(3),
    );
    orbStage?.style.setProperty(
      "--orb-pulse-high",
      (1.011 + energy * 0.009).toFixed(3),
    );
    liveQuantityTitle.innerHTML = compareMode
      ? planckQuantity === "radiance"
        ? "Planck comparison · B<sub>λ</sub>(λ,T)"
        : "Planck comparison · M<sub>λ</sub>(λ,T)"
      : planckQuantity === "radiance"
        ? "Planck spectrum · B<sub>λ</sub>(λ,T)"
        : "Planck spectrum · M<sub>λ</sub>(λ,T)";
    quantityButtons.forEach((button) => {
      const active = button.dataset.planckQuantity === planckQuantity;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
    canvas.setAttribute(
      "aria-label",
      `Planck spectral ${planckQuantity} at ${Math.round(
        temperature,
      )} kelvin, peaking at ${peakNm.toFixed(1)} nanometres in the ${region}`,
    );

    presetButtons.forEach((button) => {
      button.classList.toggle(
        "is-active",
        Number(button.dataset.temperaturePreset) === Math.round(temperature),
      );
    });
    modeButtons.forEach((button) => {
      const active =
        button.dataset.planckMode === (compareMode ? "compare" : "single");
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
    if (comparisonLegend) comparisonLegend.hidden = !compareMode;
  }

  function setTemperature(nextTemperature, options = {}) {
    temperature = clamp(Number(nextTemperature), 2500, 8000);
    updateReadouts();
    drawSpectrum(options.timestamp);
    if (!options.keepTooltip && tooltip) tooltip.hidden = true;
  }

  function stopTemperatureTween() {
    cancelAnimationFrame(temperatureTweenFrame);
    temperatureTweenFrame = 0;
  }

  function animateTemperatureTo(nextTemperature, duration = 720) {
    const target = clamp(Number(nextTemperature), 2500, 8000);
    stopTemperatureTween();
    if (reducedMotion || Math.abs(target - temperature) < 1) {
      setTemperature(target);
      return;
    }

    const startTemperature = temperature;
    const startTime = performance.now();
    const animate = (timestamp) => {
      const progress = clamp((timestamp - startTime) / duration, 0, 1);
      const eased = easeInOutCubic(progress);
      setTemperature(
        startTemperature + (target - startTemperature) * eased,
        { keepTooltip: true, timestamp },
      );
      if (progress < 1) {
        temperatureTweenFrame = requestAnimationFrame(animate);
      } else {
        temperatureTweenFrame = 0;
        setTemperature(target, { timestamp });
      }
    };
    temperatureTweenFrame = requestAnimationFrame(animate);
  }

  function stopSweep() {
    sweeping = false;
    cancelAnimationFrame(sweepFrame);
    sweepFrame = 0;
    sweepButton?.classList.remove("is-running");
    if (sweepLabel) sweepLabel.textContent = "Sweep";
    if (sweepIcon) sweepIcon.setAttribute("d", "M8 5l11 7-11 7z");
  }

  function runSweep(timestamp) {
    if (!sweeping) return;
    if (!sweepStartTime) sweepStartTime = timestamp;
    const phase =
      sweepStartPhase +
      ((timestamp - sweepStartTime) / 24000) * Math.PI * 2;
    const next = 5250 + 2750 * Math.sin(phase);
    setTemperature(next, { keepTooltip: true, timestamp });
    sweepFrame = requestAnimationFrame(runSweep);
  }

  function toggleSweep() {
    if (sweeping) {
      stopSweep();
      return;
    }
    if (reducedMotion) {
      const next = temperature < 6000 ? 6000 : 4000;
      setTemperature(next);
      return;
    }
    stopTemperatureTween();
    sweeping = true;
    sweepStartTime = 0;
    sweepStartPhase = Math.asin(
      clamp((temperature - 5250) / 2750, -1, 1),
    );
    sweepButton?.classList.add("is-running");
    if (sweepLabel) sweepLabel.textContent = "Pause";
    if (sweepIcon)
      sweepIcon.setAttribute("d", "M7 5h4v14H7zm6 0h4v14h-4z");
    sweepFrame = requestAnimationFrame(runSweep);
  }

  temperatureInput.addEventListener("input", () => {
    stopSweep();
    stopTemperatureTween();
    setTemperature(Number(temperatureInput.value));
  });

  presetButtons.forEach((button) => {
    button.addEventListener("click", () => {
      stopSweep();
      animateTemperatureTo(Number(button.dataset.temperaturePreset));
    });
  });

  quantityButtons.forEach((button) => {
    button.addEventListener("click", () => {
      planckQuantity = button.dataset.planckQuantity;
      updateReadouts();
      drawSpectrum();
      if (!reducedMotion && typeof canvas.animate === "function") {
        canvas.animate(
          [
            { opacity: 0.58, transform: "scale(0.996)" },
            { opacity: 1, transform: "scale(1)" },
          ],
          {
            duration: 320,
            easing: "cubic-bezier(0.2, 0.75, 0.25, 1)",
          },
        );
      }
      if (tooltip) tooltip.hidden = true;
    });
  });

  modeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      compareMode = button.dataset.planckMode === "compare";
      updateReadouts();
      drawSpectrum();
      if (tooltip) tooltip.hidden = true;
    });
  });

  sweepButton?.addEventListener("click", toggleSweep);

  if (hero && "IntersectionObserver" in window) {
    const heroObserver = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting && sweeping) stopSweep();
      },
      { threshold: 0.05 },
    );
    heroObserver.observe(hero);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && sweeping) stopSweep();
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!chartState || !tooltip) return;
    const rect = canvas.getBoundingClientRect();
    const x =
      (event.clientX - rect.left) * (canvas.clientWidth / rect.width);
    const y =
      (event.clientY - rect.top) * (canvas.clientHeight / rect.height);
    const { geometry, xMinimum, xMaximum } = chartState;
    if (
      x < geometry.left ||
      x > geometry.left + geometry.plotWidth ||
      y < geometry.top ||
      y > geometry.top + geometry.plotHeight
    ) {
      tooltip.hidden = true;
      return;
    }
    const wavelength =
      xMinimum +
      ((x - geometry.left) / geometry.plotWidth) *
        (xMaximum - xMinimum);
    const value = spectralValue(wavelength, temperature);
    tooltip.innerHTML = compareMode
      ? `<strong>${wavelength.toFixed(0)} nm</strong><br>` +
        [4000, 5000, 6000]
          .map(
            (curveTemperature) =>
              `${curveTemperature.toLocaleString("en-GB")} K · ${formatSpectral(
                spectralValue(wavelength, curveTemperature),
              )}`,
          )
          .join("<br>")
      : `<strong>${wavelength.toFixed(0)} nm</strong><br>${formatSpectral(value)}`;
    tooltip.style.left = `${clamp(x, 8, canvas.clientWidth - 170)}px`;
    tooltip.style.top = `${clamp(y, 55, canvas.clientHeight - 8)}px`;
    tooltip.hidden = false;
  });

  canvas.addEventListener("pointerleave", () => {
    if (tooltip) tooltip.hidden = true;
  });

  canvas.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    stopSweep();
    stopTemperatureTween();
    setTemperature(temperature + (event.key === "ArrowRight" ? 100 : -100));
  });

  const scheduleResize = () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(drawSpectrum);
  };
  window.addEventListener("resize", scheduleResize, { passive: true });
  if ("ResizeObserver" in window) {
    new ResizeObserver(scheduleResize).observe(canvas);
  }

  setTemperature(temperature);
})();

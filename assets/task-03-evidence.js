(() => {
  "use strict";

  const contentBlocks = Array.from(
    document.querySelectorAll("[data-evidence-content]"),
  );
  const errorMessage = document.querySelector("[data-evidence-error]");
  const provenance = document.querySelector("[data-evidence-provenance]");
  const checkCount = document.querySelector("[data-check-count]");
  const wienError = document.querySelector("[data-wien-error]");
  const integralError = document.querySelector("[data-integral-error]");
  const collapseError = document.querySelector("[data-collapse-error]");
  const wienCardError = document.querySelector("[data-wien-card-error]");
  const fittedExponent = document.querySelector("[data-fitted-exponent]");
  const highTemperatureRatio = document.querySelector(
    "[data-high-temperature-ratio]",
  );
  const lowTemperatureValue = document.querySelector(
    "[data-low-temperature-value]",
  );
  const benchmarkBody = document.querySelector("[data-benchmark-body]");
  const evidencePlanckTitle = document.querySelector(
    "[data-evidence-planck-title]",
  );
  const evidenceQuantityButtons = Array.from(
    document.querySelectorAll("[data-evidence-quantity]"),
  );

  const planckCanvas = document.querySelector("#planck-evidence-chart");
  const collapseCanvas = document.querySelector(
    "#einstein-collapse-chart",
  );
  const einsteinCanvas = document.querySelector("#einstein-chart");
  const solidTemperatureInput = document.querySelector("#solid-temperature");
  const solidTemperatureOutput = document.querySelector(
    "[data-solid-temperature-output]",
  );
  const materialButtons = Array.from(
    document.querySelectorAll("[data-material]"),
  );
  const selectedMaterialLabel = document.querySelector(
    "[data-selected-material]",
  );
  const einsteinTemperature = document.querySelector(
    "[data-einstein-temperature]",
  );
  const einsteinFrequency = document.querySelector(
    "[data-einstein-frequency]",
  );
  const heatCapacity = document.querySelector("[data-heat-capacity]");
  const capacityFraction = document.querySelector(
    "[data-capacity-fraction]",
  );
  const einsteinTooltip = document.querySelector(
    "[data-einstein-tooltip]",
  );

  const colours = {
    Au: "#dfb95f",
    Cu: "#d87952",
    Ti: "#96d9d5",
    Al: "#a9b8c7",
    Fe: "#b36b67",
    Si: "#6ea7d8",
    C: "#778b80",
  };
  const planckColours = {
    4000: "#ff765e",
    5000: "#f3bb62",
    6000: "#8edfff",
  };
  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  const superscripts = {
    "-": "⁻",
    0: "⁰",
    1: "¹",
    2: "²",
    3: "³",
    4: "⁴",
    5: "⁵",
    6: "⁶",
    7: "⁷",
    8: "⁸",
    9: "⁹",
  };

  let evidence = null;
  let selectedSymbol = "Au";
  let solidTemperature = Number(solidTemperatureInput?.value || 300);
  let evidencePlanckQuantity = "radiance";
  let hoverTemperature = null;
  let resizeFrame = 0;
  let planckRevealProgress = reducedMotion ? 1 : 0;
  let collapseRevealProgress = reducedMotion ? 1 : 0;
  let evidenceRevealFrame = 0;
  let evidenceRevealStarted = reducedMotion;
  let materialTransition = null;
  let materialTransitionFrame = 0;

  const clamp = (value, minimum, maximum) =>
    Math.min(maximum, Math.max(minimum, value));
  const easeOutCubic = (value) => 1 - (1 - value) ** 3;

  function scientific(value, digits = 2) {
    if (!Number.isFinite(value) || value === 0) return "0";
    const exponent = Math.floor(Math.log10(Math.abs(value)));
    const mantissa = value / 10 ** exponent;
    const raised = String(exponent)
      .split("")
      .map((character) => superscripts[character] || character)
      .join("");
    return `${mantissa.toFixed(digits)} × 10${raised}`;
  }

  function fitCanvas(canvas) {
    const context = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(canvas.clientWidth));
    const height = Math.max(1, Math.round(canvas.clientHeight));
    const requiredWidth = Math.round(width * dpr);
    const requiredHeight = Math.round(height * dpr);

    if (
      canvas.width !== requiredWidth ||
      canvas.height !== requiredHeight
    ) {
      canvas.width = requiredWidth;
      canvas.height = requiredHeight;
    }
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    return { context, width, height };
  }

  function geometry(width, height, options = {}) {
    const compact = width < 520;
    const margin = {
      top: options.top || 18,
      right: options.right || 18,
      bottom: options.bottom || 48,
      left: compact ? options.compactLeft || 54 : options.left || 68,
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

  function drawGrid(context, chart, xTicks, yTicks, xFor, yFor, labels) {
    context.font = `${chart.compact ? 11 : 12}px "Times New Roman", Times, serif`;
    context.lineWidth = 1;

    yTicks.forEach((tick) => {
      const y = yFor(tick.value);
      context.strokeStyle = "rgba(23, 21, 19, 0.10)";
      context.beginPath();
      context.moveTo(chart.left, y);
      context.lineTo(chart.left + chart.plotWidth, y);
      context.stroke();
      context.fillStyle = "rgba(23, 21, 19, 0.62)";
      context.textAlign = "right";
      context.textBaseline = "middle";
      context.fillText(tick.label, chart.left - 9, y);
    });

    xTicks.forEach((tick) => {
      const x = xFor(tick.value);
      context.strokeStyle = "rgba(23, 21, 19, 0.075)";
      context.beginPath();
      context.moveTo(x, chart.top);
      context.lineTo(x, chart.top + chart.plotHeight);
      context.stroke();
      context.fillStyle = "rgba(23, 21, 19, 0.62)";
      context.textAlign = "center";
      context.textBaseline = "top";
      context.fillText(tick.label, x, chart.top + chart.plotHeight + 10);
    });

    context.save();
    context.font = '12px "Times New Roman", Times, serif';
    context.translate(13, chart.top + chart.plotHeight / 2);
    context.rotate(-Math.PI / 2);
    context.fillStyle = "rgba(23, 21, 19, 0.63)";
    context.textAlign = "center";
    context.textBaseline = "top";
    context.fillText(labels.y, 0, 0);
    context.restore();

    context.fillStyle = "rgba(23, 21, 19, 0.63)";
    context.textAlign = "center";
    context.textBaseline = "bottom";
    context.fillText(
      labels.x,
      chart.left + chart.plotWidth / 2,
      chart.height - 1,
    );
  }

  function drawPlanckEvidence() {
    if (!planckCanvas || !evidence) return;
    const { context, width, height } = fitCanvas(planckCanvas);
    const chart = geometry(width, height, { left: 75, compactLeft: 56 });
    const xMinimum = 100;
    const xMaximum = 3000;
    const allSeries = Object.values(evidence.planck.series).flat();
    const valueField =
      evidencePlanckQuantity === "radiance"
        ? "radiance_w_m2_sr_nm"
        : "exitance_w_m2_nm";
    const yMaximum =
      Math.max(...allSeries.map((point) => point[valueField])) * 1.06;
    const xFor = (value) =>
      chart.left +
      ((value - xMinimum) / (xMaximum - xMinimum)) * chart.plotWidth;
    const yFor = (value) =>
      chart.top +
      chart.plotHeight -
      (value / yMaximum) * chart.plotHeight;

    const visibleStart = xFor(380);
    const visibleEnd = xFor(750);
    const visibleGradient = context.createLinearGradient(
      visibleStart,
      0,
      visibleEnd,
      0,
    );
    visibleGradient.addColorStop(0, "rgba(92, 42, 171, 0.09)");
    visibleGradient.addColorStop(0.35, "rgba(35, 145, 191, 0.09)");
    visibleGradient.addColorStop(0.65, "rgba(177, 190, 54, 0.09)");
    visibleGradient.addColorStop(1, "rgba(218, 57, 43, 0.09)");
    context.fillStyle = visibleGradient;
    context.fillRect(
      visibleStart,
      chart.top,
      visibleEnd - visibleStart,
      chart.plotHeight,
    );

    const yTickMaximum = Math.ceil(yMaximum / 2000) * 2000;
    const yTicks = Array.from({ length: 5 }, (_, index) => {
      const value = (yTickMaximum * index) / 4;
      return {
        value,
        label:
          value === 0
            ? "0"
            : value >= 1000
              ? `${(value / 1000).toFixed(0)}k`
              : value.toFixed(0),
      };
    });
    const values = chart.compact
      ? [100, 750, 1500, 2250, 3000]
      : [100, 500, 1000, 1500, 2000, 2500, 3000];
    drawGrid(
      context,
      chart,
      values.map((value) => ({
        value,
        label: value.toLocaleString("en-GB"),
      })),
      yTicks,
      xFor,
      yFor,
      {
        x: "wavelength / nm",
        y:
          evidencePlanckQuantity === "radiance"
            ? "Bλ / W m⁻² sr⁻¹ nm⁻¹"
            : "Mλ / W m⁻² nm⁻¹",
      },
    );

    context.save();
    context.beginPath();
    context.rect(
      chart.left,
      chart.top - 8,
      chart.plotWidth * planckRevealProgress,
      chart.plotHeight + 16,
    );
    context.clip();

    [4000, 5000, 6000].forEach((temperature, index) => {
      const series = evidence.planck.series[String(temperature)];
      context.beginPath();
      series.forEach((point, pointIndex) => {
        const x = xFor(point.wavelength_nm);
        const y = yFor(point[valueField]);
        if (pointIndex === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      });
      context.strokeStyle = planckColours[temperature];
      context.lineWidth = index === 2 ? 2.3 : 1.9;
      context.lineJoin = "round";
      context.stroke();

      const validation = evidence.planck.validation.find(
        (row) => row.temperature_k === temperature,
      );
      const peakPoint = series.reduce((best, point) =>
        Math.abs(point.wavelength_nm - validation.wien_peak_nm) <
        Math.abs(best.wavelength_nm - validation.wien_peak_nm)
          ? point
          : best,
      );
      context.fillStyle = planckColours[temperature];
      context.beginPath();
      context.arc(
        xFor(peakPoint.wavelength_nm),
        yFor(peakPoint[valueField]),
        3.4,
        0,
        Math.PI * 2,
      );
      context.fill();
    });
    context.restore();

    evidencePlanckTitle.innerHTML =
      evidencePlanckQuantity === "radiance"
        ? "Validated B<sub>λ</sub> spectra"
        : "Validated M<sub>λ</sub> spectra";
    planckCanvas.setAttribute(
      "aria-label",
      `Validated Planck spectral ${evidencePlanckQuantity} at 4000, 5000 and 6000 kelvin`,
    );
    evidenceQuantityButtons.forEach((button) => {
      const active =
        button.dataset.evidenceQuantity === evidencePlanckQuantity;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function drawCollapseEvidence() {
    if (!collapseCanvas || !evidence) return;
    const { context, width, height } = fitCanvas(collapseCanvas);
    const chart = geometry(width, height, { left: 62, compactLeft: 50 });
    const xMaximum = 5;
    const yMaximum = 1.04;
    const xFor = (value) =>
      chart.left + (value / xMaximum) * chart.plotWidth;
    const yFor = (value) =>
      chart.top +
      chart.plotHeight -
      (value / yMaximum) * chart.plotHeight;

    drawGrid(
      context,
      chart,
      [0, 1, 2, 3, 4, 5].map((value) => ({
        value,
        label: String(value),
      })),
      [0, 0.25, 0.5, 0.75, 1].map((value) => ({
        value,
        label: value.toFixed(value === 0 || value === 1 ? 0 : 2),
      })),
      xFor,
      yFor,
      {
        x: "reduced temperature, T / TE",
        y: "CV / 3R",
      },
    );

    context.setLineDash([5, 5]);
    context.strokeStyle = "rgba(23, 21, 19, 0.34)";
    context.beginPath();
    context.moveTo(chart.left, yFor(1));
    context.lineTo(chart.left + chart.plotWidth, yFor(1));
    context.stroke();
    context.setLineDash([]);

    context.save();
    context.beginPath();
    context.rect(
      chart.left,
      chart.top - 8,
      chart.plotWidth * collapseRevealProgress,
      chart.plotHeight + 16,
    );
    context.clip();

    Object.entries(evidence.einstein.normalized_series).forEach(
      ([symbol, series], index) => {
        context.beginPath();
        series.forEach((point, pointIndex) => {
          const x = xFor(point.reduced_temperature);
          const y = yFor(point.cv_over_3r);
          if (pointIndex === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        });
        context.strokeStyle = colours[symbol];
        context.lineWidth = 2;
        context.setLineDash([9 + index * 1.5, 5 + (index % 3) * 2]);
        context.lineDashOffset = index * 3;
        context.globalAlpha = 0.8;
        context.stroke();
      },
    );
    context.setLineDash([]);
    context.globalAlpha = 1;
    context.restore();
  }

  function einsteinCapacity(einsteinTemperatureK, temperatureK) {
    if (temperatureK <= 0) return 0;
    const x = einsteinTemperatureK / temperatureK;
    const expNegative = Math.exp(-x);
    const denominator = -Math.expm1(-x);
    if (denominator === 0) return 3 * evidence.constants.gas_constant_j_mol_k;
    return (
      3 *
      evidence.constants.gas_constant_j_mol_k *
      x ** 2 *
      expNegative /
      denominator ** 2
    );
  }

  function selectedMaterial() {
    return evidence.einstein.materials.find(
      (material) => material.symbol === selectedSymbol,
    );
  }

  function drawEinsteinFamily(timestamp = performance.now()) {
    if (!einsteinCanvas || !evidence) return;
    const { context, width, height } = fitCanvas(einsteinCanvas);
    const chart = geometry(width, height, { left: 64, compactLeft: 51 });
    const xMaximum = 800;
    const limit = evidence.einstein.high_temperature_limit_j_mol_k;
    const yMaximum = limit * 1.055;
    const xFor = (value) =>
      chart.left + (value / xMaximum) * chart.plotWidth;
    const yFor = (value) =>
      chart.top +
      chart.plotHeight -
      (value / yMaximum) * chart.plotHeight;
    const transitionProgress = materialTransition
      ? easeOutCubic(
          clamp(
            (timestamp - materialTransition.start) /
              materialTransition.duration,
            0,
            1,
          ),
        )
      : 1;

    const xValues = chart.compact
      ? [0, 200, 400, 600, 800]
      : [0, 100, 200, 300, 400, 500, 600, 700, 800];
    drawGrid(
      context,
      chart,
      xValues.map((value) => ({ value, label: String(value) })),
      [0, 5, 10, 15, 20, limit].map((value) => ({
        value,
        label: value === limit ? "3R" : String(value),
      })),
      xFor,
      yFor,
      {
        x: "temperature / K",
        y: "CV / J mol⁻¹ K⁻¹",
      },
    );

    context.setLineDash([5, 5]);
    context.strokeStyle = "rgba(103, 87, 72, 0.56)";
    context.beginPath();
    context.moveTo(chart.left, yFor(limit));
    context.lineTo(chart.left + chart.plotWidth, yFor(limit));
    context.stroke();
    context.setLineDash([]);

    const symbols = evidence.einstein.materials.map(
      (material) => material.symbol,
    );
    symbols
      .filter((symbol) => symbol !== selectedSymbol)
      .concat(selectedSymbol)
      .forEach((symbol) => {
        const series = evidence.einstein.series[symbol];
        context.beginPath();
        series.forEach((point, index) => {
          const x = xFor(point.temperature_k);
          const y = yFor(point.cv_j_mol_k);
          if (index === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        });
        context.strokeStyle = colours[symbol];
        let lineWidth = symbol === selectedSymbol ? 3.2 : 1.35;
        let lineAlpha = symbol === selectedSymbol ? 1 : 0.6;
        if (materialTransition) {
          if (symbol === materialTransition.fromSymbol) {
            lineWidth = 3.2 - 1.85 * transitionProgress;
            lineAlpha = 1 - 0.4 * transitionProgress;
          } else if (symbol === selectedSymbol) {
            lineWidth = 1.35 + 1.85 * transitionProgress;
            lineAlpha = 0.6 + 0.4 * transitionProgress;
          }
        }
        context.lineWidth = lineWidth;
        context.globalAlpha = lineAlpha;
        context.lineJoin = "round";
        context.stroke();
      });
    context.globalAlpha = 1;

    const material = selectedMaterial();
    const selectedCapacity = einsteinCapacity(
      material.einstein_temperature_k,
      solidTemperature,
    );
    const previousMaterial = materialTransition
      ? evidence.einstein.materials.find(
          (candidate) =>
            candidate.symbol === materialTransition.fromSymbol,
        )
      : null;
    const previousCapacity = previousMaterial
      ? einsteinCapacity(
          previousMaterial.einstein_temperature_k,
          solidTemperature,
        )
      : selectedCapacity;
    const animatedCapacity =
      previousCapacity +
      (selectedCapacity - previousCapacity) * transitionProgress;
    const markerX = xFor(solidTemperature);
    const markerY = yFor(animatedCapacity);
    context.strokeStyle = "rgba(23, 21, 19, 0.28)";
    context.lineWidth = 1;
    context.setLineDash([3, 4]);
    context.beginPath();
    context.moveTo(markerX, chart.top);
    context.lineTo(markerX, chart.top + chart.plotHeight);
    context.stroke();
    context.setLineDash([]);
    context.fillStyle = colours[selectedSymbol];
    context.beginPath();
    context.arc(markerX, markerY, 5, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = "#f7f2e8";
    context.lineWidth = 2;
    context.stroke();

    if (hoverTemperature !== null) {
      const hoverCapacity = einsteinCapacity(
        material.einstein_temperature_k,
        hoverTemperature,
      );
      context.strokeStyle = "rgba(23, 21, 19, 0.26)";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(xFor(hoverTemperature), chart.top);
      context.lineTo(
        xFor(hoverTemperature),
        chart.top + chart.plotHeight,
      );
      context.stroke();
      context.fillStyle = colours[selectedSymbol];
      context.beginPath();
      context.arc(
        xFor(hoverTemperature),
        yFor(hoverCapacity),
        3.5,
        0,
        Math.PI * 2,
      );
      context.fill();
    }

    einsteinCanvas._task03Chart = { chart, xFor, yFor };
  }

  function updateMaterialReadouts() {
    if (!evidence) return;
    const material = selectedMaterial();
    const limit = evidence.einstein.high_temperature_limit_j_mol_k;
    const capacity = einsteinCapacity(
      material.einstein_temperature_k,
      solidTemperature,
    );
    const fraction = capacity / limit;

    solidTemperatureInput.value = String(Math.round(solidTemperature));
    solidTemperatureOutput.textContent = `${Math.round(
      solidTemperature,
    ).toLocaleString("en-GB")} K`;
    selectedMaterialLabel.textContent = `${material.material} · ${material.symbol}`;
    einsteinTemperature.textContent = `${material.einstein_temperature_k.toFixed(
      1,
    )} K`;
    einsteinFrequency.textContent = `${material.official_frequency_1e13_hz.toFixed(
      4,
    )} × 10¹³ Hz`;
    heatCapacity.textContent = `${capacity.toFixed(2)} J mol⁻¹ K⁻¹`;
    capacityFraction.textContent = `${(fraction * 100).toFixed(2)}%`;

    materialButtons.forEach((button) => {
      const active = button.dataset.material === selectedSymbol;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });

    einsteinCanvas.setAttribute(
      "aria-label",
      `Einstein heat capacity curves for seven materials. ${
        material.material
      } is selected at ${Math.round(
        solidTemperature,
      )} kelvin, where its molar heat capacity is ${capacity.toFixed(
        2,
      )} joules per mole per kelvin.`,
    );
    drawEinsteinFamily();
  }

  function runMaterialTransition(timestamp) {
    if (!materialTransition) return;
    drawEinsteinFamily(timestamp);
    const progress =
      (timestamp - materialTransition.start) / materialTransition.duration;
    if (progress < 1) {
      materialTransitionFrame = requestAnimationFrame(
        runMaterialTransition,
      );
    } else {
      materialTransition = null;
      materialTransitionFrame = 0;
      drawEinsteinFamily(timestamp);
    }
  }

  function selectMaterial(symbol) {
    if (symbol === selectedSymbol) return;
    const previousSymbol = selectedSymbol;
    selectedSymbol = symbol;
    if (einsteinTooltip) einsteinTooltip.hidden = true;
    hoverTemperature = null;
    cancelAnimationFrame(materialTransitionFrame);
    materialTransitionFrame = 0;
    materialTransition = reducedMotion
      ? null
      : {
          fromSymbol: previousSymbol,
          start: performance.now(),
          duration: 680,
        };
    updateMaterialReadouts();
    if (materialTransition) {
      materialTransitionFrame = requestAnimationFrame(
        runMaterialTransition,
      );
    }
  }

  function setSolidTemperature(value) {
    solidTemperature = clamp(Number(value), 0, 800);
    updateMaterialReadouts();
  }

  function populateBenchmarks() {
    benchmarkBody.replaceChildren();
    evidence.planck.validation.forEach((row) => {
      const tableRow = document.createElement("tr");
      const values = [
        row.temperature_k.toLocaleString("en-GB"),
        `${row.numerical_peak_nm.toFixed(2)} nm`,
        `${row.wien_peak_nm.toFixed(2)} nm`,
        `${(row.numerical_radiance_w_m2_sr / 1e6).toFixed(
          5,
        )} MW m⁻² sr⁻¹`,
        `${(row.stefan_boltzmann_radiance_w_m2_sr / 1e6).toFixed(
          5,
        )} MW m⁻² sr⁻¹`,
        `${(row.numerical_exitance_w_m2 / 1e6).toFixed(5)} MW m⁻²`,
        `${(row.stefan_boltzmann_w_m2 / 1e6).toFixed(5)} MW m⁻²`,
      ];
      values.forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        tableRow.appendChild(cell);
      });
      benchmarkBody.appendChild(tableRow);
    });
  }

  function revealEvidence() {
    const validation = evidence.validation;
    checkCount.textContent = `${validation.passed_checks} / ${validation.total_checks}`;
    wienError.textContent = `${(
      validation.largest_wien_peak_relative_error * 100
    ).toFixed(6)}%`;
    integralError.textContent = scientific(
      validation.largest_planck_integral_relative_error,
    );
    collapseError.textContent = scientific(
      validation.normalized_collapse_max_absolute_difference,
    );
    if (wienCardError) {
      wienCardError.textContent = `${(
        validation.largest_wien_peak_relative_error * 100
      ).toExponential(2)}%`;
    }
    if (fittedExponent) {
      const first = evidence.planck.validation[0];
      const last = evidence.planck.validation.at(-1);
      const exponent =
        Math.log(last.numerical_exitance_w_m2 / first.numerical_exitance_w_m2) /
        Math.log(last.temperature_k / first.temperature_k);
      fittedExponent.textContent = exponent.toFixed(6);
    }
    if (highTemperatureRatio) {
      const gold = evidence.einstein.materials.find(
        (material) => material.symbol === "Au",
      );
      const limit = evidence.einstein.high_temperature_limit_j_mol_k;
      highTemperatureRatio.textContent = einsteinCapacity(
        gold.einstein_temperature_k,
        100 * gold.einstein_temperature_k,
      )
        .toFixed(8);
    }
    if (lowTemperatureValue) {
      lowTemperatureValue.textContent = `${evidence.einstein.series.Au[0].cv_j_mol_k.toFixed(
        4,
      )} J mol⁻¹ K⁻¹`;
    }
    provenance.textContent = `Verified Python reference · ${validation.passed_checks}/${validation.total_checks} checks pass`;
    contentBlocks.forEach((block) => {
      block.hidden = false;
    });
    errorMessage.hidden = true;
  }

  function showEvidenceError(error) {
    console.error("Task 03 evidence unavailable:", error);
    contentBlocks.forEach((block) => {
      block.hidden = true;
    });
    errorMessage.hidden = false;
    provenance.textContent = "Verified evidence unavailable";
  }

  async function loadEvidence() {
    if (window.TASK03_EVIDENCE) return window.TASK03_EVIDENCE;
    const response = await fetch("../data/task-03-evidence.json");
    if (!response.ok) {
      throw new Error(`Evidence request failed with ${response.status}`);
    }
    return response.json();
  }

  function startEvidenceReveal() {
    if (evidenceRevealStarted && !reducedMotion) return;
    evidenceRevealStarted = true;
    if (reducedMotion) {
      planckRevealProgress = 1;
      collapseRevealProgress = 1;
      drawPlanckEvidence();
      drawCollapseEvidence();
      return;
    }

    const startTime = performance.now();
    const duration = 1120;
    const animate = (timestamp) => {
      const progress = clamp((timestamp - startTime) / duration, 0, 1);
      const eased = easeOutCubic(progress);
      planckRevealProgress = eased;
      collapseRevealProgress = easeOutCubic(
        clamp((progress - 0.08) / 0.92, 0, 1),
      );
      drawPlanckEvidence();
      drawCollapseEvidence();
      if (progress < 1) {
        evidenceRevealFrame = requestAnimationFrame(animate);
      } else {
        evidenceRevealFrame = 0;
      }
    };
    cancelAnimationFrame(evidenceRevealFrame);
    evidenceRevealFrame = requestAnimationFrame(animate);
  }

  function observeEvidenceReveal() {
    const evidenceGrid = document.querySelector(".evidence-grid");
    if (!evidenceGrid || reducedMotion || !("IntersectionObserver" in window)) {
      startEvidenceReveal();
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        startEvidenceReveal();
      },
      { threshold: 0.16, rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(evidenceGrid);
  }

  function drawAll() {
    drawPlanckEvidence();
    drawCollapseEvidence();
    drawEinsteinFamily();
  }

  function scheduleResize() {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(drawAll);
  }

  materialButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (evidence) selectMaterial(button.dataset.material);
    });
  });

  solidTemperatureInput?.addEventListener("input", () => {
    if (evidence) setSolidTemperature(solidTemperatureInput.value);
  });

  evidenceQuantityButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (!evidence) return;
      evidencePlanckQuantity = button.dataset.evidenceQuantity;
      drawPlanckEvidence();
    });
  });

  einsteinCanvas?.addEventListener("pointermove", (event) => {
    if (!evidence || !einsteinCanvas._task03Chart || !einsteinTooltip) return;
    const rect = einsteinCanvas.getBoundingClientRect();
    const x =
      (event.clientX - rect.left) *
      (einsteinCanvas.clientWidth / rect.width);
    const y =
      (event.clientY - rect.top) *
      (einsteinCanvas.clientHeight / rect.height);
    const { chart } = einsteinCanvas._task03Chart;
    if (
      x < chart.left ||
      x > chart.left + chart.plotWidth ||
      y < chart.top ||
      y > chart.top + chart.plotHeight
    ) {
      hoverTemperature = null;
      einsteinTooltip.hidden = true;
      drawEinsteinFamily();
      return;
    }
    hoverTemperature = clamp(
      ((x - chart.left) / chart.plotWidth) * 800,
      0,
      800,
    );
    const material = selectedMaterial();
    const capacity = einsteinCapacity(
      material.einstein_temperature_k,
      hoverTemperature,
    );
    einsteinTooltip.innerHTML = `<strong>${hoverTemperature.toFixed(
      0,
    )} K</strong><br>C<sub>V</sub> = ${capacity.toFixed(
      2,
    )} J mol⁻¹ K⁻¹`;
    einsteinTooltip.style.left = `${clamp(
      x,
      8,
      einsteinCanvas.clientWidth - 175,
    )}px`;
    einsteinTooltip.style.top = `${clamp(
      y,
      55,
      einsteinCanvas.clientHeight - 5,
    )}px`;
    einsteinTooltip.hidden = false;
    drawEinsteinFamily();
  });

  einsteinCanvas?.addEventListener("pointerleave", () => {
    hoverTemperature = null;
    if (einsteinTooltip) einsteinTooltip.hidden = true;
    if (evidence) drawEinsteinFamily();
  });

  einsteinCanvas?.addEventListener("click", (event) => {
    if (!evidence || !einsteinCanvas._task03Chart) return;
    const rect = einsteinCanvas.getBoundingClientRect();
    const x =
      (event.clientX - rect.left) *
      (einsteinCanvas.clientWidth / rect.width);
    const { chart } = einsteinCanvas._task03Chart;
    if (x < chart.left || x > chart.left + chart.plotWidth) return;
    setSolidTemperature(((x - chart.left) / chart.plotWidth) * 800);
  });

  einsteinCanvas?.addEventListener("keydown", (event) => {
    if (
      !evidence ||
      (event.key !== "ArrowLeft" && event.key !== "ArrowRight")
    ) {
      return;
    }
    event.preventDefault();
    setSolidTemperature(
      solidTemperature + (event.key === "ArrowRight" ? 10 : -10),
    );
  });

  window.addEventListener("resize", scheduleResize, { passive: true });

  loadEvidence()
    .then((loadedEvidence) => {
      evidence = loadedEvidence;
      if (
        !evidence.validation?.passed ||
        evidence.validation.passed_checks !==
          evidence.validation.total_checks
      ) {
        throw new Error("The evidence bundle is not fully validated.");
      }
      updateMaterialReadouts();
      drawAll();

      if ("ResizeObserver" in window) {
        const observer = new ResizeObserver(scheduleResize);
        [planckCanvas, collapseCanvas, einsteinCanvas]
          .filter(Boolean)
          .forEach((canvas) => observer.observe(canvas));
      }
    })
    .catch(showEvidenceError);
})();

"""Regenerate the Task 6 figures that depend on the spherical screen radius."""

from __future__ import annotations

import csv
import json
import math
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "task06"
FIGURES = ROOT / "figures" / "task06"
H = 6.62607015e-34
E = 1.602176634e-19
M = 9.1093837139e-31
R = 0.065
SPACINGS = {"d1": 0.123e-9, "d2": 0.213e-9}
COLOURS = {"d1": "#087fb8", "d2": "#d45f00"}


def load_sweep() -> list[dict[str, str]]:
    with (DATA / "voltage_sweep.csv").open(newline="") as handle:
        return list(csv.DictReader(handle))


def load_orders() -> list[dict[str, str]]:
    with (DATA / "diffraction_orders.csv").open(newline="") as handle:
        return list(csv.DictReader(handle))


def load_fits() -> list[dict[str, str]]:
    with (DATA / "validation_fits.csv").open(newline="") as handle:
        return list(csv.DictReader(handle))


def save_pair(figure: plt.Figure, stem: str, dpi: int = 180) -> None:
    metadata = {"Creator": "BPhO Task 6 deterministic renderer", "Date": None}
    figure.savefig(FIGURES / f"{stem}.png", dpi=dpi, bbox_inches="tight", metadata=metadata)
    figure.savefig(FIGURES / f"{stem}.svg", bbox_inches="tight", metadata=metadata)
    plt.close(figure)


def radius_figure(rows: list[dict[str, str]]) -> None:
    voltage = np.array([float(row["voltage_kv"]) for row in rows])
    fig, ax = plt.subplots(figsize=(8.4, 4.8), constrained_layout=True)
    fig.patch.set_facecolor("#ffffff")
    ax.set_facecolor("#f7f9f5")
    for family_id in ("d1", "d2"):
        radius = np.array(
            [float(row[f"{family_id}_n1_photo_radius_mm"]) for row in rows]
        )
        ax.plot(
            voltage,
            radius,
            color=COLOURS[family_id],
            linewidth=2.4,
            label=f"{family_id} = {SPACINGS[family_id] * 1e9:.3f} nm",
        )
    ax.set_title("Exact projected ring radius across the 1–5 kV sweep", loc="left", weight="bold")
    ax.set_xlabel("Accelerating voltage / kV")
    ax.set_ylabel("Photographic ring radius, x / mm")
    ax.grid(color="#d5ddd2", linewidth=0.8, alpha=0.8)
    ax.legend(frameon=False, ncol=2, loc="upper right")
    ax.text(
        0.01,
        -0.22,
        r"$\lambda=h/\sqrt{2m_e eV}$;  $2d\sin\theta=n\lambda$;  $\phi=2\theta$;  $x=r\sin\phi$",
        transform=ax.transAxes,
        color="#52627a",
    )
    save_pair(fig, "ring_radius_vs_voltage")


def ring_figure(rows: list[dict[str, str]], orders: list[dict[str, str]]) -> None:
    row = next(item for item in rows if float(item["voltage_v"]) == 3000)
    voltage = float(row["voltage_kv"])
    fig, ax = plt.subplots(figsize=(6.4, 6.4), constrained_layout=True)
    fig.patch.set_facecolor("#020503")
    ax.set_facecolor("#020503")
    ax.set_aspect("equal")
    ax.set_xlim(-1.05, 1.05)
    ax.set_ylim(-1.05, 1.05)
    ax.axis("off")
    ax.add_patch(plt.Circle((0, 0), 1, facecolor="#05180c", edgecolor="#baffb0", linewidth=1.1))
    selected = [item for item in orders if float(item["voltage_v"]) == 3000 and item["screen_visible"] == "true"]
    for item in reversed(selected):
        family_id = item["spacing_id"]
        radius = float(item["photo_radius_m"]) / R
        linestyle = "--" if family_id == "d2" else "-"
        order = int(item["order_n"])
        alpha = max(0.12, 0.9 * math.exp(-(order - 1) * 0.32))
        ax.add_patch(
            plt.Circle(
                (0, 0),
                radius,
                fill=False,
                edgecolor=COLOURS[family_id],
                linewidth=1.0 if order > 1 else 2.2,
                linestyle=linestyle,
                alpha=alpha,
            )
        )
    ax.scatter([0], [0], s=180, color="#dfffe2", alpha=0.2, linewidths=0)
    ax.scatter([0], [0], s=24, color="#f2fff1", linewidths=0)
    ax.text(-0.98, 0.98, "SCHEMATIC PHOSPHOR VIEW", color="#dfffe2", fontsize=8, va="top")
    ax.text(0.98, 0.98, "x = r sin φ · r = 65 mm", color="#93a895", fontsize=8, ha="right", va="top")
    ax.text(
        0,
        -1.12,
        f"Corrected first-order positions at {voltage:.2f} kV · brightness is schematic",
        color="#d7e5d5",
        ha="center",
        fontsize=9,
    )
    save_pair(fig, "electron_diffraction_rings")


def summary_figure(rows: list[dict[str, str]], fits: list[dict[str, str]]) -> None:
    fig = plt.figure(figsize=(12, 7.2), facecolor="#ffffff", constrained_layout=True)
    grid = fig.add_gridspec(2, 2, width_ratios=(1, 1.2), height_ratios=(1, 1))
    ring_ax = fig.add_subplot(grid[0, 0])
    radius_ax = fig.add_subplot(grid[0, 1])
    validation_ax = fig.add_subplot(grid[1, 0])
    text_ax = fig.add_subplot(grid[1, 1])

    ring_ax.set_facecolor("#020503")
    ring_ax.set_aspect("equal")
    ring_ax.set_xlim(-1.05, 1.05)
    ring_ax.set_ylim(-1.05, 1.05)
    ring_ax.axis("off")
    ring_ax.add_patch(plt.Circle((0, 0), 1, facecolor="#05180c", edgecolor="#baffb0", linewidth=1.0))
    row = next(item for item in rows if float(item["voltage_v"]) == 3000)
    for family_id in ("d1", "d2"):
        spacing = SPACINGS[family_id]
        wavelength = float(row["wavelength_m"])
        maximum = int(row[f"{family_id}_maximum_screen_order"])
        for order in range(1, maximum + 1):
            phi = 2 * math.asin(order * wavelength / (2 * spacing))
            ring_ax.add_patch(
                plt.Circle(
                    (0, 0),
                    math.sin(phi),
                    fill=False,
                    edgecolor=COLOURS[family_id],
                    linewidth=2.0 if order == 1 else 0.7,
                    linestyle="--" if family_id == "d2" else "-",
                    alpha=0.82 if order == 1 else 0.32,
                )
            )
    ring_ax.scatter([0], [0], s=26, color="#f2fff1")
    ring_ax.set_title("Corrected screen geometry", color="#172033", loc="left", pad=8)

    for family_id in ("d1", "d2"):
        radius_ax.plot(
            [float(item["voltage_kv"]) for item in rows],
            [float(item[f"{family_id}_n1_photo_radius_mm"]) for item in rows],
            color=COLOURS[family_id],
            linewidth=2,
            label=family_id,
        )
    radius_ax.set_title("First-order rings contract", loc="left")
    radius_ax.set_xlabel("V / kV")
    radius_ax.set_ylabel("x / mm")
    radius_ax.grid(color="#d5ddd2", linewidth=0.7)
    radius_ax.legend(frameon=False)

    for family_id in ("d1", "d2"):
        fit = next(item for item in fits if item["spacing_id"] == family_id and item["fit_kind"] == "first_order")
        x = np.array([float(row[f"{family_id}_n1_bragg_ratio_q"]) for row in rows])
        y = np.array([1 / math.sqrt(float(row["voltage_v"])) for row in rows])
        validation_ax.scatter(x, y, s=3, color=COLOURS[family_id], alpha=0.45, label=family_id)
        validation_ax.plot([0, max(x)], [0, float(fit["constrained_gradient_v_inv_sqrt"]) * max(x)], color=COLOURS[family_id], linewidth=1.5)
    validation_ax.set_title("Task 6a straight-line recovery", loc="left")
    validation_ax.set_xlabel("sin(φ/2) = sin θ")
    validation_ax.set_ylabel("1/√V")
    validation_ax.grid(color="#d5ddd2", linewidth=0.7)
    validation_ax.legend(frameon=False)

    text_ax.axis("off")
    text_ax.text(0, 0.95, "TASK 06 · ELECTRON DIFFRACTION", fontsize=13, weight="bold", color="#172033", va="top")
    text_ax.text(0, 0.76, "λ = h / √(2mₑeV)\n2d sin θ = nλ\nφ = 2θ\nx = r sin φ", fontsize=15, color="#172033", linespacing=1.7, va="top")
    text_ax.text(0, 0.29, "d₁ = 0.123 nm    d₂ = 0.213 nm\nr = 65 mm    V = 1–5 kV", fontsize=11, color="#52627a", linespacing=1.7, va="top")
    fig.suptitle("BPhO Computational Challenge · Task 06", fontsize=18, weight="bold", x=0.03, ha="left")
    save_pair(fig, "task06_summary", dpi=160)


def main() -> None:
    rows = load_sweep()
    orders = load_orders()
    fits = load_fits()
    ring_figure(rows, orders)
    radius_figure(rows)
    summary_figure(rows, fits)
    print("Regenerated Task 6 screen-geometry figures.")


if __name__ == "__main__":
    main()

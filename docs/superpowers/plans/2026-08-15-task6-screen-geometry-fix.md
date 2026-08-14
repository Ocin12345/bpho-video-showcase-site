# Task 6 Screen Geometry Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct Task 6 so the phosphor-screen ring radius follows the BPhO geometry x = r sin(phi), where phi = 2 theta, without changing the validated de Broglie/Bragg spacing-recovery calculation or the presentation redesign.

**Architecture:** Keep the existing 1–5 kV sweep, Bragg q values, scattering angles, fit data, controls, and rendering pipeline. Correct only the spherical-screen projection, derive browser-facing first-order radii from the already-correct stored caliper chord y = 2 r sin(phi), recompute higher-order screen radii directly from phi, and recompute the relativistic extension radii at runtime from its validated wavelengths. Replace stale geometry wording and stop presenting the legacy photographic-geometry check as the authoritative runtime validation.

**Tech Stack:** Static HTML, browser JavaScript modules, committed CSV/JSON evidence.

## Global Constraints

- Do not alter Task 6 de Broglie wavelength, Bragg condition, voltage range, graphite spacings, or straight-line spacing-recovery fit.
- Keep r = 65 mm, d1 = 0.123 nm, d2 = 0.213 nm, V = 1–5 kV.
- Use phi = 2 theta and x = r sin(phi) for the ring radius.
- Preserve the current Task 1-style Task 6 presentation.
- Do not use the stale x = r sin(2 phi) field from the legacy sweep as a browser-facing result.

---

### Task 1: Add regression validation for the corrected geometry

**Files:**
- Modify: `assets/task-06-evidence.js`
- Modify: `data/task06/reference_anchors.json`

- [ ] Make the loader derive x from y/2 and verify x = r sin(phi) across all 401 first-order sweep rows.
- [ ] Change independent anchor radii to x = r sin(phi).
- [ ] Keep Bragg q, phi, maximum-order, and fit validation unchanged.

### Task 2: Correct the live ring renderer and exported evidence

**Files:**
- Modify: `assets/task-06-diffraction.js`

- [ ] Change every rendered order radius from r sin(2 phi) to r sin(phi).
- [ ] Change exported geometry metadata to x = r sin(phi), y = 2 r sin(phi) = 2x.
- [ ] Replace the stale precomputed photographic-geometry pass with a runtime full-sweep geometry check.

### Task 3: Correct the visible method text

**Files:**
- Modify: `tasks/task-06.html`
- Modify: `data/task06/manifest.json`

- [ ] Replace x = r sin(2 phi) with x = r sin(phi) everywhere Task 6 explains the screen geometry.
- [ ] State explicitly that phi is the total scattering angle and theta = phi/2 is the Bragg angle.
- [ ] Remove wording that claims x and the chord y are independent observables; y = 2x for this geometry.

### Task 4: Correct the relativistic extension projection

**Files:**
- Modify: `assets/task-06-relativity.js`

- [ ] Recompute baseline and relativistic first-order radii with x = r sin(phi).
- [ ] Recompute the radius shift from those corrected radii rather than trusting stale stored radius fields.
- [ ] Keep the relativistic wavelength calculation unchanged.

### Task 5: Verify before merging to main

- [ ] Check 1, 3, and 5 kV radii against independent calculations for both spacings.
- [ ] Check x = y/2 and x = r sin(phi) on the sweep.
- [ ] Check the Task 6a fit still recovers 0.123 nm and 0.213 nm with R² = 1.
- [ ] Check the HTML contains no remaining user-facing x = r sin(2 phi) claim.
- [ ] Re-read all modified branch files, then fast-forward main only after verification.
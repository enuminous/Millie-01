# EFMW-aligned monitoring experiment — proposed protocol MON-M01

**Status: PROPOSED, NOT FROZEN, NOT CONFIRMATORY, NOT RUN with independent custody.**

## Exact mathematical baseline

At every timestamp t, use a signed velocity residual `r_t = odom_velocity_t - requested_velocity_t`, expressed in m/s. This is not itself an EFMW-specific observable.

- **EFMW-labeled signed EWMA:** `M_t = 0.97*M_(t-1) + 0.03*r_t`; score `|M_t|`.
- **Conventional absolute EWMA:** `A_t = 0.90*A_(t-1) + 0.10*|r_t|`.
- **Conventional two-sided CUSUM:** `C+_t = max(0, C+_(t-1) + r_t - k)`; `C-_t = max(0, C-_(t-1) - r_t - k)`; score `max(C+,C-)`.
- **Mandatory matched signed-EWMA comparator:** exactly the same formula as EFMW-labeled signed EWMA. It is algorithmically identical and must tie on identical inputs. Any assertion of a unique advantage from this formula is false.

Current code uses examples of alarm thresholds for visualization only. It does **not** claim to meet any false-alarm target or a preregistered improvement margin.

## Fault family and controls

- Held-out persistent positive velocity bias (encoder calibration, model bias).
- Held-out persistent negative velocity bias (traction loss, motor saturation).
- Variance-only changes with no mean shift.
- Oscillatory faults; intermittent stuck encoder; packet delay/dropout; nominal turns.
- Benign short disturbances and sensor substitutions.
- Stable no-fault nulls with identical observation and control budgets.

Do not choose the fault family to favor signed averaging. Freeze domain parameters and enforce matched sensor exposure, identical resources and common traces.

## Proposed comparison

1. Outside custodian prepares and seals 4+ fault families plus stable null conditions, with stratified seeds unavailable during tuning.
2. Publish *protocol-only* commit and send commit SHA plus digest to outside reviewer before revealing any test trace.
3. Use separate development-only calibration and evaluation seeds; thresholds tuned to whole-run false-alarm budgets of **1%, 5%, 10%, 20%**.
4. Run signed EWMA over a predefined decay grid, absolute EWMA over comparable grid, calibrated two-sided CUSUM and change-point baseline. Select strongest *development* conventional comparator before sealed evaluation.
5. Primary 5% budget: paired actionable warning detection / lead-time utility with missed detections explicitly penalized; report 95% uncertainty by independent fault family, not just steps.
6. All operating points, latency, computation, CPU/power usage, error rates and negative trials published.
7. Predeclare kill criterion: if the upper 95% CI of incremental benefit is at/below a practically meaningful margin (suggested five timesteps) against best conventional arm, the uniqueness claim fails on the tested setting.

The margin, sample size, formal endpoint, threshold calibration and custodian are **not adopted**; they require prospective statistical power and feasibility review. There is no appointed independent custodian. No local demo output may be presented as confirming this protocol.

## Safe interpretation

Signed memory can be useful for directional drift, while absolute-residual methods can be better for variance faults. The existing [EXP-003 external audit](https://github.com/enuminous/EFMW-EXP-001/blob/main/EXP-003/audits/2026-10-28-garret/README.md) documents exactly this sensitivity. It does not authorize safety-critical use of the research monitor on a physical robot.

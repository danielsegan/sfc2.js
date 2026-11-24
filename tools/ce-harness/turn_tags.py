#!/usr/bin/env python3
"""Combat tagging helpers shared by analyze_turn, analyze_turn2 and summarize.

HET: absolute sweep under 45 deg, or delay outside 3.5-8.0 s, is a no-op
(het_not_executed if the delay is outside the window; het_failed_roll if the
delay looks like a HET but the ship barely turned).
Normal: absolute sweep under 25 deg, or delay under 0.4 s, is already_facing.
Timing/rate fields are nulled on a no-op. When |settled_speed - target_speed|
is at least 0.5, speed_key is the settled speed; otherwise it is the target.
"""
HET_BUTTONS = {"port", "stbd", "hard_port", "hard_stbd", "u_turn"}
HET_DELAY = (3.5, 8.0)
HET_MIN_SWEEP = 45.0
NORMAL_MIN_SWEEP = 25.0
NORMAL_MIN_DELAY = 0.4
SPEED_KEY_EPS = 0.5
RATE_FIELDS = (
    "order_delay_s", "t10_s", "t50_s", "t90_s",
    "mean_rate_deg_per_wall_s_10_90", "mean_rate_deg_per_game_s_10_90",
    "slope_deg_per_wall_s_20_80", "fit_rate_deg_per_wall_s",
    "fit_rate_deg_per_wall_s",
)

def turn_kind(button):
    return "het" if button in HET_BUTTONS else "normal"

def speed_key(target, settled, thresh=SPEED_KEY_EPS):
    if target is not None and settled is not None:
        try:
            if abs(float(settled) - float(target)) >= thresh:
                return float(settled)
        except (TypeError, ValueError):
            pass
    if target is not None:
        return target
    return settled

def apply_noop(res):
    """Mutate res: set noop, noop_reason, speed_key; null timing/rate on no-op."""
    kind = res.get("kind") or turn_kind(res.get("button"))
    res["kind"] = kind
    try:
        sweep = abs(float(res.get("total_turn_deg") or 0))
    except (TypeError, ValueError):
        sweep = 0.0
    delay = res.get("order_delay_s")
    try:
        delay_f = float(delay) if delay is not None else None
    except (TypeError, ValueError):
        delay_f = None
    noop, reason = False, None
    if kind == "het":
        delay_ok = delay_f is not None and HET_DELAY[0] <= delay_f <= HET_DELAY[1]
        if sweep < HET_MIN_SWEEP or not delay_ok:
            noop = True
            reason = "het_failed_roll" if delay_ok else "het_not_executed"
    else:
        delay_short = delay_f is not None and delay_f < NORMAL_MIN_DELAY
        if sweep < NORMAL_MIN_SWEEP or delay_short:
            noop = True
            reason = "already_facing"
    res["noop"] = noop
    res["noop_reason"] = reason if noop else None
    res["speed_key"] = speed_key(res.get("target_speed"), res.get("settled_speed"))
    if noop:
        for k in RATE_FIELDS:
            res[k] = None
    return res

def sane_clock_ratio(gr, lo=0.5, hi=1.5):
    """Return gr if it is a plausible game/wall clock ratio, else None.

    Klingon clock OCR is often unusable and can yield ratios like 0.07 or 6.2,
    which must not be used to invent a game-clock turn rate.
    """
    if gr is None:
        return None
    try:
        g = float(gr)
    except (TypeError, ValueError):
        return None
    if lo <= g <= hi:
        return g
    return None

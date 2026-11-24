#!/usr/bin/env python3
"""Per-empire CHOOSE VESSEL click targets and OCR crops, measured from screenshots
of each skin's 1024x768 menu (640x480 panel at 192,144).

Federation / Klingon / Lyran / ISC were measured from existing captures.
Romulan, Hydran, Gorn, Mirak, Orion are filled in after map_cv.py screenshots.
"""
# ship_prev, ship_next, class_prev, class_next, done are (x, y) click points.
# stats_crop is the DESIGNATION / BPV panel (ImageMagick WxH+X+Y).
# title_crop is the "CA - Heavy Cruiser" title line.
SKINS = {
    "federation": {
        "ship_prev": (396, 478),
        "ship_next": (460, 478),
        "class_prev": (333, 516),
        "class_next": (520, 517),
        "done": (801, 598),
        "stats_side": "right",
        "stats_crop": "180x430+650+155",
        "title_crop": "300x40+220+210",
    },
    "klingon": {
        # DONE at (801,598) was 18 px below the hex (box y 569-593). Class next
        # at (520,517) sat in empty space left of the right chevron at ~628,516.
        "ship_prev": (396, 478),
        "ship_next": (445, 482),
        "class_prev": (300, 522),
        "class_next": (628, 516),
        "done": (799, 580),
        "stats_side": "right",
        "stats_crop": "180x430+650+155",
        "title_crop": "320x40+250+205",
    },
    "isc": {
        "ship_prev": (396, 470),
        "ship_next": (461, 470),
        "class_prev": (367, 510),
        "class_next": (490, 510),
        "done": (767, 596),
        "stats_side": "right",
        "stats_crop": "180x430+650+155",
        "title_crop": "320x40+230+200",
    },
    "lyran": {
        # Stats and DONE are on the LEFT. Ship arrows sit under the diagram
        # (~y 493); class arrows flank HEAVY CRUISER on the bottom bar (~y 606).
        "ship_prev": (560, 493),
        "ship_next": (635, 493),
        "class_prev": (480, 606),
        "class_next": (717, 606),
        "done": (319, 605),
        "stats_side": "left",
        "stats_crop": "200x400+200+175",
        "title_crop": "320x50+430+200",
    },
    "romulan": {
        # Class + DONE live in a right-hand block, not the bottom-centre bar.
        # Ship arrows sit on a low bar under the bird-of-prey diagram (~y 600).
        "ship_prev": (360, 600),
        "ship_next": (440, 600),
        "class_prev": (590, 550),
        "class_next": (810, 550),
        "done": (740, 600),
        "stats_side": "right",
        "stats_crop": "220x400+640+150",
        "title_crop": "320x50+230+200",
    },
    "hydran": {
        "ship_prev": (385, 470),
        "ship_next": (465, 470),
        "class_prev": (270, 520),
        "class_next": (555, 520),
        "done": (800, 585),
        "stats_side": "right",
        "stats_crop": "180x430+650+155",
        "title_crop": "320x50+230+200",
    },
    "gorn": {
        "ship_prev": (410, 475),
        "ship_next": (465, 475),
        "class_prev": (330, 512),
        "class_next": (530, 512),
        "done": (800, 590),
        "stats_side": "right",
        "stats_crop": "180x430+650+155",
        "title_crop": "320x50+230+200",
    },
    "mirak": {
        # Class arrows flank the HEAVY CRUISER bone plaque. Ship prev/next are
        # the two bronze plates in the skull frame above that plaque (best
        # candidates on the screenshot; first Mirak hull will confirm).
        "ship_prev": (390, 485),
        "ship_next": (450, 485),
        "class_prev": (350, 510),
        "class_next": (510, 510),
        "done": (770, 600),
        "stats_side": "right",
        "stats_crop": "180x400+650+160",
        "title_crop": "320x50+230+200",
    },
    "orion": {
        # map_cv r8 landed on the Federation CA screen (same pixels as r0);
        # Orion's HUD is otherwise Fed-like, so use Federation targets until
        # a confirmed Orion vessel screen is captured.
        "ship_prev": (396, 478),
        "ship_next": (460, 478),
        "class_prev": (333, 516),
        "class_next": (520, 517),
        "done": (801, 598),
        "stats_side": "right",
        "stats_crop": "180x430+650+155",
        "title_crop": "300x40+220+210",
    },

}

# Until measured, assume a close relative. map_cv fills these in before
# those empires run in the queue; pbattle_hull still requires a battle-UI check.
ALIASES = {}

RACE_ORDER = [
    "federation", "klingon", "romulan", "lyran", "hydran",
    "gorn", "isc", "mirak", "orion",
]


def skin(name):
    name = (name or "federation").strip().lower()
    if name in SKINS:
        return dict(SKINS[name], name=name)
    if name in ALIASES:
        base = ALIASES[name]
        return dict(SKINS[base], name=name, inherited_from=base)
    return dict(SKINS["federation"], name=name, inherited_from="federation")

if __name__ == "__main__":
    import sys
    s = skin(sys.argv[1] if len(sys.argv) > 1 else "federation")
    # ship_next_x ship_next_y class_next_x class_next_y done_x done_y stats_crop title_crop
    print(s["ship_next"][0], s["ship_next"][1], s["class_next"][0], s["class_next"][1],
          s["done"][0], s["done"][1], s["stats_crop"], s["title_crop"])

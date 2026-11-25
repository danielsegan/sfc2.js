/**
 * Concepts first, then the v2 control walkthrough.
 * The opening states what this build is and is not. Gameplay numbers
 * stay the fixture's. The tabletop history is marked unsourced.
 */
import { PAD_MS, OPEN_MS, segments as v2Segments, doc as v2Doc } from './segments-v2.mjs';

export { OPEN_MS, PAD_MS };

async function label(ctx) {
  return ctx.page.locator('#pause').innerText();
}

async function ensurePaused(ctx) {
  if ((await label(ctx)) === 'Pause') await ctx.press('Escape');
}

const concepts = [
  {
    id: 'what',
    keys: 'Campaigns and Conquest: not in this build',
    action: 'Pause, orbit the fixture duel, then reset the camera.',
    narration:
      'SFC2.js is a fan engine for tactical duels. On this screen you command one ship. The board above the view can hold up to six, and one slot is you. The match in front of you is the placeholder fixture: your cruiser against one other, and no install is mounted. The wider game also has empire campaigns and a Conquest map. Those are not in this build. The caption says so. What you can play here is the skirmish.',
    async play(ctx) {
      await ensurePaused(ctx);
      await ctx.middleDrag(0.5, 0.48);
      await ctx.sleep(500);
      await ctx.middleDrag(0.48, 0.5);
      await ctx.sleep(500);
      await ctx.middleDrag(0.52, 0.46);
      await ctx.sleep(400);
      await ctx.press('Home');
    },
  },
  {
    id: 'loop',
    keys: 'Power, then arcs and range, weak face away',
    action: 'Show the energy plate, then the shield diagram. The bow wedge stays on the field.',
    narration:
      'The core loop is short. You divide a limited power pool across movement, weapons, and shields. Then you turn. The other ship has to sit inside your weapon arc and inside range, or the shot is refused. At the same time you keep a weak face off the line of fire. On this cruiser the bow is the strong face, twelve against eight on the aft faces. The wedge is the arc. The shield diagram is the six faces. Nothing in this build turns the strong face for you.',
    async play(ctx) {
      await ctx.scrollInto('#gen-warp');
      await ctx.sleep(400);
      await ctx.scrollInto('#shield-table');
    },
  },
  {
    id: 'tradeoff',
    keys: 'Warp 20    1 power per point of speed',
    action: 'Leave the match paused on the energy plate and the ordered speed.',
    narration:
      'Speed against firepower is the central trade. This cruiser generates twenty points of warp power. On this fixture each point of ordered speed costs one point of that power. Life support and fire control take one each before movement is paid. What speed spends, the weapons do not get. A run at sixteen leaves almost nothing to arm. A slow ship can still reinforce and shoot. The walkthrough shows those plans on the keys.',
    async play(ctx) {
      await ctx.scrollInto('#gen-warp');
    },
  },
  {
    id: 'lineage',
    keys: 'Star Fleet Battles is a trademark of Amarillo Design Bureau; this fan project is unaffiliated.',
    action: 'Hold the fixture view. The caption is the trademark credit. No rulebook is opened.',
    narration:
      'The game this engine is for adapts Star Fleet Battles, a tabletop wargame from Amarillo Design Bureau. It is a wargame, not a role-playing game. The decisions are a budget and the shape of the ship, not a character sheet. This build runs three of those ideas in its own numbers. You allocate one power pool. You have six shield faces. Weapons arm by storing energy, and the heavy mount can overload. The line on screen is the trademark credit. This project is not affiliated with that publisher.',
    async play() {},
  },
];

export const segments = [...concepts, ...v2Segments.filter((segment) => segment.id !== 'intro')];

export const doc = {
  title: 'SFC2.js tutorial, version 3',
  lede: `Concepts, then the control walkthrough, captured from the production web build. Vite preview serves it on port 1701. The page boots the synthetic skirmish and the banner names \`engine/duel/fixture.ts\`. No install is mounted and no game files are read. Gameplay numbers are the fixture's. The tabletop history is marked unsourced from this code.`,
  voiceNote: 'Kokoro-82M voice af_heart. A speed below 1 is slower. Piper remains available with `--tts piper`. There is no music. Captions are burned in. The key line names the control, and one caption is the trademark credit.',
  notes: 'The capture selects UI scale 1× so the field and the console both fit in 1920×1080. The opening pauses and orbits the fixture, then the walkthrough uses 4× except the high-energy turn, which runs at 1×.',
  skipped: [
    ...v2Doc.skipped,
    {
      item: 'Campaigns and the Conquest map',
      why: 'The roadmap lists them as later phases. This build\'s page is the skirmish. The opening says they are not in this build, on the caption and in the narration.',
    },
    {
      item: 'Star Fleet Battles rule text and art',
      why: 'No rulebook was opened. The ideas are described only as this engine implements them. The on-screen line is a trademark credit, not a quotation.',
    },
  ],
  notInCut: v2Doc.notInCut,
  unsourced: [
    {
      item: 'Star Fleet Battles and Amarillo Design Bureau',
      note: 'Unsourced from this code. General knowledge that the commercial game adapts that tabletop wargame. Not a paraphrase of its rules.',
    },
    {
      item: 'Wargame, not a role-playing game',
      note: 'Unsourced from this code. A description of the kind of decisions the engine implements, not a citation of a publisher.',
    },
  ],
  sources: [
    ['This screen is a skirmish of up to six ships, one of them you', 'web/index.html:73-78', 'The page on screen is the skirmish setup. It says up to six ships and one slot is you.'],
    ['Campaigns and Conquest are not this build', 'README.md:21-23 and docs/plan.md:96-98', 'The roadmap marks missions, the remaining campaigns, and Conquest as planned phases. They are not a control on this page.'],
    ['The fixture duel', 'engine/duel/fixture.ts:18 and web/src/main.ts:71', 'The banner names engine/duel/fixture.ts. The boot pair is the synthetic skirmish.'],
    ['Bow is the strong face', 'engine/duel/catalog.ts:50 and web/src/hud.ts:16', 'Shields are 12, 10, 8, 8, 8, 10 from the bow, clockwise. The bow is 12 and the aft faces are 8.'],
    ['Arc wedge and range gate', 'docs/rules/data/weapon-arcs.json:68-70 and engine/sim/combat.ts:1012-1019', 'TEST-FA is the bow wedge. A shot outside the arc is refused before a shot past the last band.'],
    ['Twenty warp, one power per point of speed', 'engine/duel/catalog.ts:49 and engine/duel/catalog.ts:107 and engine/sim/combat.ts:819-821', 'Warp generation is 20. moveCost100 is one energy unit, so each point of speed asks for one point of power.'],
    ['Life support and fire control before movement', 'engine/sim/rules-tables.ts:79-80 and engine/sim/combat.ts:822-835', 'Each costs 1 when left on, and both are paid before movement, shields, and weapons.'],
    ['Run at sixteen leaves the mounts unfunded', 'web/src/commands.ts:39', 'The run preset sets speed 16 and weapon request 0.'],
    ['Six faces, arming, and overload are what this build runs', 'web/src/hud.ts:16 and engine/sim/combat.ts:918-927 and web/src/commands.ts:149-157', 'The concepts section names only these three implemented ideas. The walkthrough cites the same lines again.'],
    ...v2Doc.sources,
  ],
};

export const GAME_CONTENT = {
  storyIntro: {
    clubs: [
      { name: 'Salus Club', shortCode: 'SALUS' },
      { name: 'Cognito Club', shortCode: 'COGNITO' },
      { name: 'Neuron Club', shortCode: 'NEURON' },
    ],
    clubLogos: {
      SALUS: 'https://i.postimg.cc/L604GFnZ/cropped-circle-image-(2).png',
      COGNITO: 'https://i.postimg.cc/3wGwgfrS/cropped-circle-image-(1).png',
      NEURON: 'https://i.postimg.cc/SsWJpTwC/cropped-circle-image.png',
    },
    missionBriefing: `
The RCB trophy has been stolen from a secured vault.
Your team must trace digital clues, infiltrate networks,
and recover the trophy before time runs out.

Three clubs have united for this mission.
Three terminals. Three challenges.
One trophy.

Are you ready to begin?
`.trim(),
  },

  round1: {
    roundImage: '/assets/Round1.png',
    wifiNetworks: [
      { id: 'chinnaswamy_sec', name: 'CHINNASWAMY_SECURE_01', baseSignal: 4, baseSpeed: 68 },
      { id: 'rcb_vault', name: 'RCB_VAULT_NET', baseSignal: 5, baseSpeed: 142 },
      { id: 'operative_hq', name: 'OPERATIVE_HQ', baseSignal: 3, baseSpeed: 39 },
      { id: 'thief_hideout', name: 'THIEF_HIDEOUT_5G', baseSignal: 2, baseSpeed: 21 },
      { id: 'stadium_backup', name: 'STADIUM_BACKUP', baseSignal: 1, baseSpeed: 9 },
    ],
  },

  round2: {
    pdfDownloadUrl: '/assets/ORT.pdf',
    networkScanMessages: [
      'Connecting to RCB_VAULT_NET...',
      'Authentication handshake...',
      'Decrypting traffic...',
    ],
  },

  round3: {
    latitudeQuestions: [
      {
        id: 1,
        section: 'latitude',
        title: 'Drone Latitude Normalizer',
        question: "A drone navigation system receives latitude in decimal format, but due to a sensor bug: \n\n- The value may be out of valid range (-90 to 90)\n- The value may include multiple rotations around the globe (±360° cycles)\n- Every time the latitude crosses a pole (±90), it reflects and changes hemisphere\n- The input may also include a sign (+/-) that must be respected initially\n\nTask: Normalize the latitude into the valid range [-90, 90] using rotation + reflection rules, determine hemisphere, and round to 2 decimals.\n\nInput: 372.97",
      },
    ],
    longitudeQuestions: [
      {
        id: 2,
        section: 'longitude',
        title: 'Satellite Longitude Normalizer',
        question: "A satellite navigation system receives longitude in decimal format, but due to a signal error: \n\n- The value may be out of valid range (-180 to 180)\n- The value may include multiple full rotations around the Earth (±360° cycles)\n- You must normalize using circular wrapping\n- Final answer must be in shortest angular form from 0°\n- If exactly ±180°, prefer West (W)\n- Round to 2 decimal places\n\nInput: 437.59",
      },
    ],
    questions: [],
  },

  finalRound: {
    gates: {
      A: [
        {
          title: 'Layer 1',
          question: `Rain delay report:
The revised targets were calculated using three checkpoints:
• After the powerplay cut in half
• When a full side stood plus the twelfth man
• Just before the final over could begin
Only these moments were retained for adjustment.`,
        },
        {
          title: 'Layer 2',
          question: `MATCH LOG

OVERS:
2 0 | 1 6

STRIKE ROTATION:
IX • VII • III

BOUNDARIES:
■■■■`,
        },
        {
          title: 'Layer 3',
          question: `“When the Royal Challengers Bangalore first took shape in 2008, early analysts kept shifting their interpretations back and forth, convinced the pattern would reveal itself through cycles—but every attempt only returned them to the start; only later did a few realize that positions, not movement, defined the formation.”`,
        },
        {
          title: 'Layer 4',
          question: `“A pair fell early, a trio followed, a quartet tried to resist—but the rest folded in one final stretch.”`,
        },
      ],
      B: [
        {
          title: 'Layer 1',
          question: `A lone fielder stays tight, then retreats, then holds again.

The field spreads, tightens, spreads once more—then suddenly three gather close.

One steps in, another drifts out, then returns before the next shifts back in.

Two sweep the boundary, one joins them, then the last holds the line.

And again, the same opening movement repeats.

The captain isn’t changing strategy… he’s spelling something.

The game has slowed—almost as if stepping back changes everything.
What you seek won’t make sense… until you turn it around.`,
        },
        {
          title: 'Layer 2',
          question: `During the drinks break, the broadcast slows, and a strange set of figures—82, 79, 78, 76, 78, 82, 81—briefly flashes between shots of players rehydrating.
One of the commentators jokes that things like this are “usually one step off before they start making sense,” almost as if inviting someone to adjust and interpret them.
Those who follow the trail arrive at a word that fits perfectly with the league, something expected, something that feels like the answer after a long chase.
Content with that discovery, they stop looking any further, letting the game resume without another thought.
But the field tells a quieter story—tight lines, angled placements, turning gaps, advancing arcs—nothing new, nothing added, just the same simple alternation repeating in front of everyone.`,
        },
        {
          title: 'Layer 3',
          question: `Phase: 11–15 Overs

Head Coach Note:
“Singles won’t win this. Build partnerships. Every two deliveries matter more than one.”

Commentary Snippet (overheard, incomplete):

75 75 | 82 70 | 86 78 | 76 85

Assistant Coach scribble:
“Odd stands showed attacking intent.
Even ones… pulled things back.”

Old Analyst (muttering):
“They always talk about going forward…
but games flip when you know when to retreat.”

Bottom Corner (chalk, almost erased):
“Scoreboard never lies.”`,
        },
      ],
      C: [
        {
          title: 'Layer 1',
          question: `The captain moves his men with quiet intent —
not random, never rushed.

From the keeper outward, count their places.
Slip begins, gully follows,
point holds firm while cover repeats.
Mid-off and mid-on stand their ground,
square and fine leg mirror the play.

Trace each shift as it happens,
and from every position, take what its place allows.
Not all letters matter — only those in order.

You may find something ordered in the fall,
where greater always comes before the small.
Characters may whisper in code,
numbers aligning as if complete.

Yet the field does not break,
no gap is found, no run is taken.

Short pauses. Long pauses. Signals in between.
Not every message belongs to the game.

So if your answer feels certain,
ask yourself —
did anything actually move?`,
        },
        {
          title: 'Layer 2',
          question: `The league remembers crowns, but not every rise begins there.
 Some stories start in silence, buried beneath early failure.
Not all paths are straight—some skip, some jump, some follow hidden order.
 Those who chase every step will miss what matters most.
Count only where patterns refuse to be even.
 Measure not the game, but the structure beneath it.
When letters emerge, they name a forgotten force.
 And that force… it didn’t just play—it struck.`,
        },
      ]
    }
  }
};

GAME_CONTENT.round3.questions = [
  ...GAME_CONTENT.round3.latitudeQuestions,
  ...GAME_CONTENT.round3.longitudeQuestions,
];

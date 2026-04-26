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
- After the powerplay cut in half
- When a full side stood plus the twelfth man
- Just before the final over could begin
Only these moments were retained for adjustment.`,
        },
        {
          title: 'Layer 2',
          question: `MATCH LOG
OVERS: 20 | 16
STRIKE ROTATION: IX • VII • III
BOUNDARIES: ■■■■`,
        },
        {
          title: 'Layer 3',
          question: `When Royal Challengers Bangalore first took shape in 2008, early analysts kept shifting interpretations in cycles.
They later realized that positions, not movement, defined the formation.`,
        },
        {
          title: 'Layer 4',
          question: `A pair fell early, a trio followed, a quartet tried to resist — but the rest folded in one final stretch.`,
        },
      ],
      B: [
        {
          title: 'Layer 1',
          question: `A lone fielder stays tight, then retreats, then holds again.
The field spreads, tightens, spreads once more — then suddenly three gather close.
The captain isn’t changing strategy… he’s spelling something.
What you seek won’t make sense until you turn it around.`,
        },
        {
          title: 'Layer 2',
          question: `During drinks break, figures flash: 82, 79, 78, 76, 78, 82, 81.
One commentator says things are “usually one step off before they make sense.”
Most stop at the obvious answer; the field still repeats a simpler alternation.`,
        },
        {
          title: 'Layer 3',
          question: `Phase: 11–15 Overs.
Head Coach: “Every two deliveries matter more than one.”
Snippet: 75 75 | 82 70 | 86 78 | 76 85
Note: “Games flip when you know when to retreat.”`,
        },
      ],
      C: [
        {
          title: 'Layer 1',
          question: `The captain moves fielders with intent: slip, gully, point, cover, mid-off, mid-on, square, fine leg.
Trace shifts and take only what position allows.
If your answer feels certain, ask yourself — did anything actually move?`,
        },
        {
          title: 'Layer 2',
          question: `The league remembers crowns, but some rises start in silence.
Not all paths are straight — some skip, some jump, some follow hidden order.
Count only where patterns refuse to be even.`,
        },
      ]
    }
  }
};

GAME_CONTENT.round3.questions = [
  ...GAME_CONTENT.round3.latitudeQuestions,
  ...GAME_CONTENT.round3.longitudeQuestions,
];

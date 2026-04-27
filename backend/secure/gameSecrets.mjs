export const ROUND_SECRETS = {
  round1: {
    correctNetworkId: 'rcb_vault',
    correctNetworkName: 'RCB_VAULT_NET',
    correctPassword: 'PHIL_SALT_16',
    pointsAward: 120,
  },
  round2: {
    correctTerminalKey: 'ABRAHAMBD_17',
    pointsAward: 180,
  },
  round3: {
    pointsAward: 240,
    coordinates: {
      latitude: 12.97,
      longitude: 77.59,
      locationName: "M. Chinnaswamy Stadium, Bangalore",
    },
    questions: [
      { id: 1, section: 'latitude', answer: '12.97° N', digit: '12.97' },
      { id: 2, section: 'longitude', answer: '77.59° E', digit: '77.59' },
    ],
  },
  finalRound: {
    entryPassword: 'V2016K',
    pointsAward: 350,
    gates: {
      A: ['DLS', '973', 'VIJAY MALLYA', '23 APRIL 2017'],
      B: ['STUMPS', 'TATA', 'KKR WIN'],
      C: ['THALA FOR A REASON', 'DECCAN CHARGERS'],
    }
  },
};

export const CREDENTIALS = [
  { team_id: 'GAMMA KODERS', password: 'GAMMAKODERS@ort', is_admin: false },
  { team_id: 'TMP', password: 'TMP@ort', is_admin: false },
  { team_id: 'RED ROXX', password: 'REDROXX@ort', is_admin: false },
  { team_id: 'LONE SMASHER', password: 'LONESMASHER@ort', is_admin: false },
  { team_id: 'NOMADS', password: 'NOMADS@ort', is_admin: false },
  { team_id: 'SINISTER SIX', password: 'SINISTERSIX@ort', is_admin: false },
  { team_id: 'VELOCITY CREW', password: 'VELOCITYCREW@ort', is_admin: false },
  { team_id: 'TEAM VALOR', password: 'TEAMVALOR@ort', is_admin: false },
  { team_id: 'CHANGEZ', password: 'CHANGEZ@ort', is_admin: false },
  { team_id: 'FOUR ON FIRE', password: 'FOURONFIRE@ort', is_admin: false },
  { team_id: 'ADMIN01', password: 'Missionort@2026', is_admin: true },
];

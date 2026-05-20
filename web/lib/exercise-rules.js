// Shared exercise definitions, angle math, and skeleton constants.
// Consumed by demo.html and demo-table.html. No page-specific state here.

export const VIS       = 0.5;
export const C_OK      = '#DEFF9A';
export const C_ERR     = '#FF5555';
export const C_DEFAULT = 'rgba(255,255,255,0.45)';

export const BONE_PAIRS = [
  [11,12],[11,13],[13,15],[12,14],[14,16],
  [11,23],[12,24],[23,24],
  [23,25],[24,26],[25,27],[26,28],
];
export const ALL_JOINTS = [...new Set(BONE_PAIRS.flat())];

// Kaggle arctan2 method — ported from Python to JS.
// Uses 2D image-space coords (y increases downward).
export function calcAngle(a, b, c) {
  const rad = Math.atan2(c.y - b.y, c.x - b.x)
            - Math.atan2(a.y - b.y, a.x - b.x);
  let deg = Math.abs(rad * 180 / Math.PI);
  if (deg > 180) deg = 360 - deg;
  return Math.round(deg);
}

export function boneKey(a, b) { return `${Math.min(a,b)}_${Math.max(a,b)}`; }

export function visible(lm, ...idxs) { return idxs.every(i => lm[i].visibility >= VIS); }

// Each exercise:
//   getKeyAngle  → drives the rep state machine
//   restCond     → "starting position reached"
//   workCond     → "working position reached" (rep counted on return to rest)
//   checks[]     → form validations; failing → paint bones red + show hint
//   displayAngles[] → bottom-strip readout
//   note         → optional side-bar reminder
export const EXERCISES = {
  squat: {
    label:    'Bodyweight Squat',
    getKeyAngle: lm => (calcAngle(lm[23], lm[25], lm[27])
                       + calcAngle(lm[24], lm[26], lm[28])) / 2,
    restCond: a => a > 155,   // standing (relaxed from 160)
    workCond: a => a < 120,   // squat depth (relaxed from 100 — half-squat counts)
    phaseLabel: { rest: 'Standing', work: 'Squatting' },
    checks: [
      {
        id: 'sq_depth_l',
        getVal: lm => calcAngle(lm[23], lm[25], lm[27]),
        valid: (v, phase) => phase !== 'work' || v < 130,
        hint: 'Squat lower on the left',
        bones: [[23,25],[25,27]],
      },
      {
        id: 'sq_depth_r',
        getVal: lm => calcAngle(lm[24], lm[26], lm[28]),
        valid: (v, phase) => phase !== 'work' || v < 130,
        hint: 'Squat lower on the right',
        bones: [[24,26],[26,28]],
      },
      {
        id: 'sq_sym',
        getVal: lm => Math.abs(calcAngle(lm[23],lm[25],lm[27]) - calcAngle(lm[24],lm[26],lm[28])),
        valid: v => v < 20,
        hint: 'Uneven leg drive',
        bones: [[23,25],[25,27],[24,26],[26,28]],
      },
    ],
    displayAngles: [
      { label: 'Left Knee',  fn: lm => calcAngle(lm[23],lm[25],lm[27]), joint: 25 },
      { label: 'Right Knee', fn: lm => calcAngle(lm[24],lm[26],lm[28]), joint: 26 },
    ],
  },

  bicep_curl: {
    label:    'Dumbbell Curl',
    note:     'Use your right hand for the dumbbell',
    getKeyAngle: lm => calcAngle(lm[12], lm[14], lm[16]),
    restCond: a => a > 155,   // arm extended
    workCond: a => a < 55,    // fully curled
    phaseLabel: { rest: 'Arm Extended', work: 'Curling' },
    checks: [
      {
        id: 'curl_range',
        getVal: lm => calcAngle(lm[12], lm[14], lm[16]),
        valid: (v, phase) => phase !== 'work' || v < 60,
        hint: 'Curl higher',
        bones: [[12,14],[14,16]],
      },
      {
        // elbow.y - shoulder.y: positive = elbow below shoulder (correct)
        // negative = elbow risen above shoulder (cheating)
        id: 'curl_elbow',
        getVal: lm => lm[14].y - lm[12].y,
        valid: v => v > -0.05,
        hint: 'Do not lift your elbow',
        bones: [[12,14]],
      },
    ],
    displayAngles: [
      { label: 'Right Arm', fn: lm => calcAngle(lm[12],lm[14],lm[16]), joint: 14 },
    ],
  },

  lateral_raise: {
    label:    'Dumbbell Lateral Raise',
    getKeyAngle: lm => (calcAngle(lm[24],lm[12],lm[14]) + calcAngle(lm[23],lm[11],lm[13])) / 2,
    restCond: a => a < 30,    // arms by sides
    workCond: a => a > 75,    // arms near horizontal
    phaseLabel: { rest: 'Lowered', work: 'Raising' },
    checks: [
      {
        id: 'lr_height_r',
        getVal: lm => calcAngle(lm[24], lm[12], lm[14]),
        valid: (v, phase) => phase !== 'work' || v > 70,
        hint: 'Raise your right arm to shoulder height',
        bones: [[12,14],[14,16]],
      },
      {
        id: 'lr_height_l',
        getVal: lm => calcAngle(lm[23], lm[11], lm[13]),
        valid: (v, phase) => phase !== 'work' || v > 70,
        hint: 'Raise your left arm to shoulder height',
        bones: [[11,13],[13,15]],
      },
      {
        id: 'lr_elbow_r',
        getVal: lm => calcAngle(lm[12], lm[14], lm[16]),
        valid: (v, phase) => phase !== 'work' || v < 165,
        hint: 'Keep your right elbow slightly bent; do not lock it',
        bones: [[14,16]],
      },
      {
        id: 'lr_sym',
        getVal: lm => Math.abs(calcAngle(lm[24],lm[12],lm[14]) - calcAngle(lm[23],lm[11],lm[13])),
        valid: v => v < 25,
        hint: 'Arm heights do not match',
        bones: [[11,13],[12,14]],
      },
    ],
    displayAngles: [
      { label: 'Right Shoulder', fn: lm => calcAngle(lm[24],lm[12],lm[14]), joint: 12 },
      { label: 'Left Shoulder',  fn: lm => calcAngle(lm[23],lm[11],lm[13]), joint: 11 },
    ],
  },
};

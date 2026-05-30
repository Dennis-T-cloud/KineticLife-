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

function sideScore(lm, idxs) {
  return idxs.reduce((sum, idx) => sum + (lm[idx]?.visibility ?? 0), 0);
}

function sideAngle(lm, left, right) {
  return sideScore(lm, left) >= sideScore(lm, right)
    ? calcAngle(lm[left[0]], lm[left[1]], lm[left[2]])
    : calcAngle(lm[right[0]], lm[right[1]], lm[right[2]]);
}

function avgAngle(lm, left, right) {
  return (calcAngle(lm[left[0]], lm[left[1]], lm[left[2]])
        + calcAngle(lm[right[0]], lm[right[1]], lm[right[2]])) / 2;
}

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
    restCond: a => a > 150,   // data p90=154°
    workCond: a => a < 95,    // data p10=78°; 95° catches most reps with margin
    phaseLabel: { rest: 'Standing', work: 'Squatting' },
    checks: [
      {
        id: 'sq_depth_l',
        getVal: lm => calcAngle(lm[23], lm[25], lm[27]),
        valid: (v, phase) => phase !== 'work' || v < 110,
        hint: 'Squat lower on the left',
        bones: [[23,25],[25,27]],
      },
      {
        id: 'sq_depth_r',
        getVal: lm => calcAngle(lm[24], lm[26], lm[28]),
        valid: (v, phase) => phase !== 'work' || v < 110,
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
    label:    'Right Dumbbell Curl',
    note:     'Use your right hand for the dumbbell',
    getKeyAngle: lm => calcAngle(lm[11], lm[13], lm[15]),
    restCond: a => a > 150,   // data p90=156°
    workCond: a => a < 110,   // data p10=99°; 110° gives entry margin
    phaseLabel: { rest: 'Arm Extended', work: 'Curling' },
    checks: [
      {
        id: 'curl_range',
        getVal: lm => calcAngle(lm[11], lm[13], lm[15]),
        valid: (v, phase) => phase !== 'work' || v < 115,
        hint: 'Curl higher',
        bones: [[11,13],[13,15]],
      },
      {
        // elbow.y - shoulder.y: positive = elbow below shoulder (correct)
        // negative = elbow risen above shoulder (cheating)
        id: 'curl_elbow',
        getVal: lm => lm[13].y - lm[11].y,
        valid: v => v > -0.05,
        hint: 'Do not lift your elbow',
        bones: [[11,13]],
      },
    ],
    displayAngles: [
      { label: 'Left Arm', fn: lm => calcAngle(lm[11],lm[13],lm[15]), joint: 13 },
    ],
  },

  right_bicep_curl: {
    label:    'Left Dumbbell Curl',
    note:     'Use your left hand for the dumbbell',
    getKeyAngle: lm => calcAngle(lm[12], lm[14], lm[16]),
    restCond: a => a > 148,   // data p90=152°
    workCond: a => a < 95,    // data p10=89°
    phaseLabel: { rest: 'Arm Extended', work: 'Curling' },
    checks: [
      {
        id: 'right_curl_range',
        getVal: lm => calcAngle(lm[12], lm[14], lm[16]),
        valid: (v, phase) => phase !== 'work' || v < 100,
        hint: 'Curl higher',
        bones: [[12,14],[14,16]],
      },
      {
        id: 'right_curl_elbow',
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
    restCond: a => a < 25,    // data p10=19°
    workCond: a => a > 83,    // data p90=90°
    phaseLabel: { rest: 'Lowered', work: 'Raising' },
    checks: [
      {
        id: 'lr_height_r',
        getVal: lm => calcAngle(lm[24], lm[12], lm[14]),
        valid: (v, phase) => phase !== 'work' || v > 80,
        hint: 'Raise your right arm to shoulder height',
        bones: [[12,14],[14,16]],
      },
      {
        id: 'lr_height_l',
        getVal: lm => calcAngle(lm[23], lm[11], lm[13]),
        valid: (v, phase) => phase !== 'work' || v > 80,
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
        id: 'lr_elbow_flex_r',
        getVal: lm => calcAngle(lm[12], lm[14], lm[16]),
        valid: (v, phase) => phase !== 'work' || v > 110,
        hint: 'Do not curl — keep arms extended during the raise',
        bones: [[12,14],[14,16]],
      },
      {
        id: 'lr_elbow_flex_l',
        getVal: lm => calcAngle(lm[11], lm[13], lm[15]),
        valid: (v, phase) => phase !== 'work' || v > 110,
        hint: 'Do not curl — keep arms extended during the raise',
        bones: [[11,13],[13,15]],
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

  barbell_squat: {
    label:    'Barbell Squat',
    getKeyAngle: lm => (calcAngle(lm[23], lm[25], lm[27]) + calcAngle(lm[24], lm[26], lm[28])) / 2,
    restCond: a => a > 155,   // data p90=161°
    workCond: a => a < 100,   // data p10=81°
    phaseLabel: { rest: 'Standing', work: 'Squatting' },
    checks: [
      {
        id: 'bsq_depth_l',
        getVal: lm => calcAngle(lm[23], lm[25], lm[27]),
        valid: (v, phase) => phase !== 'work' || v < 110,
        hint: 'Squat lower on the left',
        bones: [[23,25],[25,27]],
      },
      {
        id: 'bsq_depth_r',
        getVal: lm => calcAngle(lm[24], lm[26], lm[28]),
        valid: (v, phase) => phase !== 'work' || v < 110,
        hint: 'Squat lower on the right',
        bones: [[24,26],[26,28]],
      },
      {
        id: 'bsq_sym',
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

  deadlift: {
    label:    'Traditional Deadlift',
    getKeyAngle: lm => (calcAngle(lm[11], lm[23], lm[25]) + calcAngle(lm[12], lm[24], lm[26])) / 2,
    restCond: a => a > 160,   // data p90=165°
    workCond: a => a < 85,    // data p10=71°
    phaseLabel: { rest: 'Locked Out', work: 'Hinging' },
    checks: [
      {
        id: 'dl_hip_hinge_l',
        getVal: lm => calcAngle(lm[11], lm[23], lm[25]),
        valid: (v, phase) => phase !== 'work' || v < 95,
        hint: 'Hinge deeper from the hips',
        bones: [[11,23],[23,25]],
      },
      {
        id: 'dl_hip_hinge_r',
        getVal: lm => calcAngle(lm[12], lm[24], lm[26]),
        valid: (v, phase) => phase !== 'work' || v < 95,
        hint: 'Hinge deeper from the hips',
        bones: [[12,24],[24,26]],
      },
      {
        id: 'dl_sym',
        getVal: lm => Math.abs(calcAngle(lm[11],lm[23],lm[25]) - calcAngle(lm[12],lm[24],lm[26])),
        valid: v => v < 20,
        hint: 'Hip asymmetry detected',
        bones: [[11,23],[23,25],[12,24],[24,26]],
      },
    ],
    displayAngles: [
      { label: 'Left Hip',  fn: lm => calcAngle(lm[11],lm[23],lm[25]), joint: 23 },
      { label: 'Right Hip', fn: lm => calcAngle(lm[12],lm[24],lm[26]), joint: 24 },
    ],
  },

  squat_side: {
    label:    'Bodyweight Squat (Side)',
    getKeyAngle: lm => sideAngle(lm, [23,25,27], [24,26,28]),
    restCond: a => a > 150,   // data p90≈170°
    workCond: a => a < 95,    // data p10≈35°
    phaseLabel: { rest: 'Standing', work: 'Squatting' },
    checks: [
      {
        id: 'sqs_depth',
        getVal: lm => sideAngle(lm, [23,25,27], [24,26,28]),
        valid: (v, phase) => phase !== 'work' || v < 110,
        hint: 'Squat lower',
        bones: [[23,25],[25,27],[24,26],[26,28]],
      },
      {
        id: 'sqs_trunk',
        getVal: lm => sideAngle(lm, [11,23,25], [12,24,26]),
        valid: (v, phase) => phase !== 'work' || v > 50,
        hint: 'Keep your chest up — do not lean too far forward',
        bones: [[11,23],[12,24]],
      },
    ],
    displayAngles: [
      { label: 'Knee Angle', fn: lm => sideAngle(lm, [23,25,27], [24,26,28]), joint: 25 },
    ],
  },

  both_bicep_curl: {
    label:    'Both-Arms Bicep Curl',
    getKeyAngle: lm => (calcAngle(lm[11],lm[13],lm[15]) + calcAngle(lm[12],lm[14],lm[16])) / 2,
    restCond: a => a > 140,   // data p90≈155°
    workCond: a => a < 85,    // data p10≈82°
    phaseLabel: { rest: 'Arms Extended', work: 'Curling' },
    checks: [
      {
        id: 'bc_range_l',
        getVal: lm => calcAngle(lm[11], lm[13], lm[15]),
        valid: (v, phase) => phase !== 'work' || v < 100,
        hint: 'Curl your left arm higher',
        bones: [[11,13],[13,15]],
      },
      {
        id: 'bc_range_r',
        getVal: lm => calcAngle(lm[12], lm[14], lm[16]),
        valid: (v, phase) => phase !== 'work' || v < 100,
        hint: 'Curl your right arm higher',
        bones: [[12,14],[14,16]],
      },
      {
        id: 'bc_sym',
        getVal: lm => Math.abs(calcAngle(lm[11],lm[13],lm[15]) - calcAngle(lm[12],lm[14],lm[16])),
        valid: v => v < 20,
        hint: 'Arms are not curling evenly',
        bones: [[11,13],[13,15],[12,14],[14,16]],
      },
      {
        id: 'bc_elbow_l',
        getVal: lm => lm[13].y - lm[11].y,
        valid: v => v > -0.05,
        hint: 'Do not raise your left elbow',
        bones: [[11,13]],
      },
      {
        id: 'bc_elbow_r',
        getVal: lm => lm[14].y - lm[12].y,
        valid: v => v > -0.05,
        hint: 'Do not raise your right elbow',
        bones: [[12,14]],
      },
      // Shoulder abduction check — arms should stay at sides, not flare outward.
      // Catches form breakdown where this exercise blurs into a lateral raise.
      {
        id: 'bc_shoulder_abd_l',
        getVal: lm => calcAngle(lm[23], lm[11], lm[13]),
        valid: (v, phase) => phase !== 'work' || v < 50,
        hint: 'Keep your left arm close to your body',
        bones: [[11,13]],
      },
      {
        id: 'bc_shoulder_abd_r',
        getVal: lm => calcAngle(lm[24], lm[12], lm[14]),
        valid: (v, phase) => phase !== 'work' || v < 50,
        hint: 'Keep your right arm close to your body',
        bones: [[12,14]],
      },
    ],
    displayAngles: [
      { label: 'Left Arm',  fn: lm => calcAngle(lm[11],lm[13],lm[15]), joint: 13 },
      { label: 'Right Arm', fn: lm => calcAngle(lm[12],lm[14],lm[16]), joint: 14 },
    ],
  },
};

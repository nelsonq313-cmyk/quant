export const personalModel = {
  label: 'Curated Eval + Clean Practice',
  description: 'User-curated eval probability model. Four July 22 winning position ideas and three July 24 winning trades are included. The July 24 09:46 short loss is included, while the July 24 09:30 long loss is excluded by user curation along with the previously selected tilt/mechanical/very-short losses. Loss magnitudes use the remaining eval losses only. Winner magnitudes use eval winners plus 28 vetted practice winners.',
  curationNote: 'This is a selectively curated research sample rather than an unbiased estimate: selected losses, including the July 24 09:30 long, are excluded while the retained July 24 session contributes three wins and the 09:46 short loss.',
  evalPositionIdeas: 30,
  evalWins: 18,
  evalLosses: 10,
  evalBreakevens: 2,
  practiceWinners: 28,
  winProbability: 0.6,
  lossProbability: 0.3333333333333333,
  breakevenProbability: 0.06666666666666667,
  rAnchorDollarsPerMNQEquivalent: 20.5,
  winR: [24.682927, 0.073171, 0.121951, 2.390244, 11.195122, 0.292683, 7.390244, 3.95122, 15.756098, 0.121951, 1.280488, 1.536585, 0.146341, 6.634146, 23.292683, 7.195122, 1.258537, 4.573171, 0.702439, 1.609756, 3.726829, 3.585366, 8.753252, 18.707317, 7.731707, 7.121951, 6.329268, 0.724005, 1.842572, 3.590244, 0.97561, 4.317073, 9.541463, 1.414634, 14.126829, 0.487805, 1.02439, 29.487805, 3.268293, 1.680359, 2.504065, 1.853659, 2.069106, 3.536585, 1.02439, 5.268293],
  lossR: [-1, -1.195122, -2.97561, -1.02439, -0.707317, -0.097561, -0.170732, -0.390244, -0.097561, -1.536585],
  evalR: [24.682927, 0.073171, 0.121951, 2.390244, 11.195122, 0.292683, 7.390244, 3.95122, 15.756098, 0.121951, 1.280488, 1.536585, 0.146341, 6.634146, 23.292683, -1, -1.195122, -2.97561, -1.02439, -0.707317, -0.097561, -0.170732, -0.390244, -0.097561, 0, 0, 3.536585, 1.02439, 5.268293, -1.536585]
};

export function drawPersonalR() {
  const u = Math.random();
  if (u < personalModel.winProbability) {
    return personalModel.winR[Math.floor(Math.random() * personalModel.winR.length)];
  }
  if (u < personalModel.winProbability + personalModel.lossProbability) {
    return personalModel.lossR[Math.floor(Math.random() * personalModel.lossR.length)];
  }
  return 0;
}

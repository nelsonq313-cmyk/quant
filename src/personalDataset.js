export const personalModel = {
  label: 'Eval + Clean Practice',
  description: 'Serious eval behavior with the 2026-07-22 tilt day excluded. Win/loss/breakeven probabilities come from the eval. Loss magnitudes come only from eval losses. Winner magnitudes use eval winners plus 28 vetted practice winners.',
  evalPositionIdeas: 28,
  evalWins: 11,
  evalLosses: 15,
  evalBreakevens: 2,
  practiceWinners: 28,
  winProbability: 0.39285714285714285,
  lossProbability: 0.5357142857142857,
  breakevenProbability: 0.07142857142857142,
  rAnchorDollarsPerMNQEquivalent: 20.5,
  winR: [24.682927, 0.073171, 0.121951, 2.390244, 11.195122, 0.292683, 7.390244, 3.95122, 15.756098, 0.121951, 1.280488, 7.195122, 1.258537, 4.573171, 0.702439, 1.609756, 3.726829, 3.585366, 8.753252, 18.707317, 7.731707, 7.121951, 6.329268, 0.724005, 1.842572, 3.590244, 0.97561, 4.317073, 9.541463, 1.414634, 14.126829, 0.487805, 1.02439, 29.487805, 3.268293, 1.680359, 2.504065, 1.853659, 2.069106],
  lossR: [-1, -1.195122, -1.02439, -0.170732, -2.97561, -1.02439, -0.146341, -0.707317, -0.097561, -0.390244, -1.853659, -0.097561, -1.04878, -1.219512, -0.243902],
  evalR: [-1, -1.195122, 24.682927, 0.073171, 0.121951, -1.02439, -0.170732, 0, 2.390244, 11.195122, 0.292683, 7.390244, 0, 3.95122, -2.97561, 15.756098, -1.02439, -0.146341, -0.707317, -0.097561, -0.390244, -1.853659, -0.097561, 0.121951, -1.04878, -1.219512, 1.280488, -0.243902]
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

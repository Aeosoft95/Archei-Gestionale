
export function thresholdFor(totalDice: number): number {
  if (totalDice >= 20) return 3;
  if (totalDice >= 10) return 4;
  if (totalDice >= 6) return 5;
  return 6;
}
export function rollD6(n: number): number[] {
  return Array.from({length: Math.max(0, Math.min(5, n))}, () => 1 + Math.floor(Math.random()*6));
}
export function countSuccesses(rolls: number[], thr: number): number {
  return rolls.filter(v => v >= thr).length;
}
export function archeiRoll(totalDice: number, realDice: number){
  const threshold = thresholdFor(totalDice||0);
  const rolls = rollD6(realDice||0);
  const successes = countSuccesses(rolls, threshold);
  let level = 0; if (successes>=3) level=3; else if (successes===2) level=2; else if (successes===1) level=1;
  return { totalDice, realDice: Math.min(5, Math.max(0, realDice||0)), threshold, rolls, successes, level, fiveOfFive: (realDice===5 && successes===5) };
}

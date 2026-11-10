// Turns one variation from data/workouts.json into the flat list of sets she
// will do, each with the rest that follows it. No DOM, no clock.
//
// The order:
//   main lift   warm-up · rest · set 1 · rest · set 2 · rest · set 3 · set-up
//   superset    (exercise 1 · switch · exercise 2 · rest) per round; the last
//               round ends in a set-up rest instead
//   finisher    set 1 · rest · set 2 · rest · set 3, then nothing

const rest = (kind, seconds) => ({ kind, seconds });
const countTo = (count) => Array.from({ length: count }, (_, index) => index + 1);

export function findVariation(data, dayId, variationId) {
  const day = data.days.find((candidate) => candidate.id === dayId);
  const variation = day?.variations.find((candidate) => candidate.id === variationId);
  return variation ? { day, variation } : null;
}

// The blocks of a variation, in order: which exercises, how many times
// through (after how many warm-ups), and the rest after each time through.
// A block that is done no times is left out. The variation list and the step
// sequence are both built from this, so they cannot disagree.
export function outline(data, variation) {
  const { sets, rests } = data;
  const blocks = [
    { block: "main", slots: [variation.main], warmups: sets.warmupSets, times: sets.mainSets },
    { block: "supersetA", slots: variation.supersetA, warmups: 0, times: sets.supersetRounds },
    { block: "supersetB", slots: variation.supersetB, warmups: 0, times: sets.supersetRounds },
    { block: "finisher", slots: [variation.finisher], warmups: 0, times: sets.finisherSets },
  ];
  return blocks
    .filter(({ warmups, times }) => warmups + times > 0)
    .map((entry) => ({
      ...entry,
      restSeconds: entry.slots.length > 1 ? rests.afterSupersetRoundSeconds : rests.betweenSetsSeconds,
    }));
}

// One block's steps: its exercises in order, once per time through, with a
// short switch between exercises and a rest after the last of them.
function blockSteps({ block, slots, warmups, times, restSeconds }, switchSeconds) {
  const timeThrough = (warmup, number, of) =>
    slots.map((slot, position) => ({
      block,
      ...slot,
      warmup,
      number,
      of,
      restAfter: position < slots.length - 1 ? rest("switch", switchSeconds) : rest("rest", restSeconds),
    }));
  return [
    ...countTo(warmups).flatMap((number) => timeThrough(true, number, warmups)),
    ...countTo(times).flatMap((number) => timeThrough(false, number, times)),
  ];
}

export function buildSteps(data, variation) {
  const blocks = outline(data, variation).map((entry) => blockSteps(entry, data.rests.supersetSwitchSeconds));

  // The set-up rest before a new block replaces the rest that would have
  // followed the block's last set, and nothing follows the last set of all.
  blocks.forEach((steps, index) => {
    const isLastBlock = index === blocks.length - 1;
    steps[steps.length - 1].restAfter = isLastBlock ? null : rest("setup", data.rests.beforeBlockSeconds);
  });

  return blocks.flat();
}

// The on-paper length the content check prints (npm run check): reps × seconds
// per rep, doubled for "each side" and "each way", plus every rest.
export function paperSeconds(steps, secondsPerRep) {
  return steps.reduce((total, step) => {
    const lifting = step.reps * secondsPerRep * (step.each ? 2 : 1);
    return total + lifting + (step.restAfter?.seconds ?? 0);
  }, 0);
}

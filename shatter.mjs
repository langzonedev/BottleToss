const TAU = Math.PI * 2;

// Mix a short sign strike, brittle glass crack and separately timed fragments.
export function fillShatter(samples, rate, seed) {
  let randomState = seed;
  const random = () => {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 4294967296;
  };

  function ring(at, pitch, decay, level) {
    const start = Math.round(at * rate);
    const end = Math.min(samples.length, start + Math.ceil(decay * rate * 6));
    for (let i = start; i < end; i++) {
      const t = (i - start) / rate;
      const attack = Math.min(1, t * 2800);
      samples[i] += Math.sin(TAU * pitch * t) * Math.exp(-t / decay) * attack * level;
    }
  }

  function grit(at, decay, level, body) {
    const start = Math.round(at * rate);
    const end = Math.min(samples.length, start + Math.ceil(decay * rate * 6));
    let smoothed = 0;
    for (let i = start; i < end; i++) {
      const t = (i - start) / rate;
      const white = random() * 2 - 1;
      smoothed += (white - smoothed) * body;
      const attack = Math.min(1, t * 2200);
      samples[i] += (white - smoothed) * Math.exp(-t / decay) * attack * level;
    }
  }

  grit(0, .007, .91, .42);
  grit(.006, .021, .29, .21);
  ring(0, 282, .033, .19);
  ring(.002, 768, .026, .16);
  ring(.004, 1237, .024, .12);
  ring(.005, 2340 + random() * 230, .016, .24);
  ring(.008, 3610 + random() * 540, .020, .19);
  ring(.010, 4970 + random() * 740, .023, .16);

  for (let i = 0; i < 24; i++) {
    const progress = i / 23;
    const at = .012 + progress ** 1.8 * .29 + random() * .021;
    const pitch = 1680 + random() * 4420;
    const level = (.10 + random() * .13) * (1 - progress * .81);
    const decay = .008 + random() * .022;
    ring(at, pitch, decay, level);
    ring(at + .001, pitch * 1.27, decay * .55, level * .39);
    grit(at, .004, level * .64, .27);
  }

  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  if (peak) {
    const scale = .79 / peak;
    for (let i = 0; i < samples.length; i++) samples[i] *= scale;
  }
}

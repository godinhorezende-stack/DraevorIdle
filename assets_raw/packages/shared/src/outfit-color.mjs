// Paleta de cores de outfit do Tibia (19 matizes x 7 combinacoes de saturacao/intensidade).
const HUE_STEPS = 19;
const VALUE_STEPS = 7;
const SI = [
  [0.25, 1.0],
  [0.25, 0.75],
  [0.5, 0.75],
  [0.667, 0.75],
  [1.0, 1.0],
  [1.0, 0.75],
  [1.0, 0.5],
];

/** Indice 0..132 -> [r,g,b] */
export function outfitColor(index) {
  if (index >= HUE_STEPS * VALUE_STEPS) index = 0;

  let hue = 0;
  let saturation = 0;
  let intensity = 1;

  if (index % HUE_STEPS !== 0) {
    hue = (index % HUE_STEPS) / 18;
    [saturation, intensity] = SI[Math.floor(index / HUE_STEPS)] ?? [1, 1];
  } else {
    intensity = 1 - index / HUE_STEPS / VALUE_STEPS;
  }

  if (intensity === 0) return [0, 0, 0];
  if (saturation === 0) {
    const gray = Math.round(intensity * 255);
    return [gray, gray, gray];
  }

  const low = intensity * (1 - saturation);
  const sector = Math.floor(hue * 6);
  if (sector >= 6) return [0, 0, 0]; // mesma borda do otclient para hue == 1
  const ramp = intensity - (intensity - low) * (hue * 6 - sector);
  const rise = low + (intensity - low) * (hue * 6 - sector);
  const rgb = [
    [intensity, rise, low],
    [ramp, intensity, low],
    [low, intensity, rise],
    [low, ramp, intensity],
    [rise, low, intensity],
    [intensity, low, ramp],
  ][sector];

  return rgb.map((channel) => Math.round(channel * 255));
}

// Cores-chave da camada de template: cada regiao do corpo tem a sua.
const REGIONS = [
  { mask: [255, 255, 0], slot: 'head' },
  { mask: [255, 0, 0], slot: 'body' },
  { mask: [0, 255, 0], slot: 'legs' },
  { mask: [0, 0, 255], slot: 'feet' },
];

/**
 * Aplica as cores do outfit: a camada template marca cada regiao com uma cor-chave,
 * e o pixel base e multiplicado pela cor escolhida daquela regiao.
 */
export function colorize(base, template, colors) {
  const palette = {};
  for (const { slot } of REGIONS) palette[slot] = outfitColor(colors[slot] ?? 0);

  for (let i = 0; i < base.length; i += 4) {
    if (base[i + 3] === 0 || template[i + 3] === 0) continue;
    const region = REGIONS.find(
      ({ mask }) => template[i] === mask[0] && template[i + 1] === mask[1] && template[i + 2] === mask[2]
    );
    if (!region) continue;
    const color = palette[region.slot];
    base[i] = (base[i] * color[0]) / 255;
    base[i + 1] = (base[i + 1] * color[1]) / 255;
    base[i + 2] = (base[i + 2] * color[2]) / 255;
  }
  return base;
}

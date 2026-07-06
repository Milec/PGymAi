import sharp from 'sharp';

const logo = (size, maskable) => {
  const pad = maskable ? size * 0.14 : size * 0.06;
  const inner = size - pad * 2;
  const bar = (y, w, fill) => {
    const h = inner * 0.16;
    const cham = h * 0.55;
    const x = pad;
    const yy = pad + inner * y;
    const ww = inner * w;
    return `<path d="M${x} ${yy} h${ww} l-${cham} ${h} h-${ww} z" fill="${fill}"/>`;
  };
  return Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs>
      <radialGradient id="bg" cx="50%" cy="35%" r="80%">
        <stop offset="0%" stop-color="#0b1a33"/>
        <stop offset="100%" stop-color="#05070f"/>
      </radialGradient>
      <filter id="g"><feGaussianBlur stdDeviation="${size*0.012}"/></filter>
    </defs>
    <rect width="${size}" height="${size}" fill="url(#bg)"/>
    <g filter="url(#g)" opacity="0.9">
      ${bar(0.16, 0.82, '#38e1ff')}
      ${bar(0.42, 0.66, '#a26bff')}
      ${bar(0.68, 0.5, '#ffb020')}
    </g>
    ${bar(0.16, 0.82, '#38e1ff')}
    ${bar(0.42, 0.66, '#a26bff')}
    ${bar(0.68, 0.5, '#ffb020')}
  </svg>`);
};

const jobs = [
  ['public/icons/icon-192.png', 192, false],
  ['public/icons/icon-512.png', 512, false],
  ['public/icons/icon-maskable-512.png', 512, true],
  ['public/icons/apple-touch-icon.png', 180, true],
];
for (const [out, size, mask] of jobs) {
  await sharp(logo(size, mask)).png().toFile(out);
  console.log('wrote', out);
}

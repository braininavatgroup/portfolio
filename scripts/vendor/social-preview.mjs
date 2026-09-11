// Canonical renderer. Other repositories vendor this file unchanged.
// Design v1: 1200 x 630, 72px safe margins, identity/category/title/domain.
// Pass sharp explicitly so consumers use their own locked build dependency.
const WIDTH = 1200, HEIGHT = 630;
const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
async function renderCard(sharp, {title, category, domain, identity, logo, romanFont, boldFont, paper, ink, muted, accent}) {
  for (const [key, value] of Object.entries({title, category, domain, romanFont, boldFont, paper, ink, muted, accent})) {
    if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing card ${key}`);
  }
  if (!identity && !logo) throw new Error('Card requires an identity or logo');
  async function textLayer(text, size, minimum, width, height, bold, color) {
    for (let px = size; px >= minimum; px -= 2) {
      const result = await sharp({text: {
        text: `<span foreground="${color}">${escape(text)}</span>`,
        font: `Neue Haas Grotesk Display Pro ${bold ? 'Bold ' : ''}${px}`,
        fontfile: bold ? boldFont : romanFont,
        width, rgba: true, wrap: 'word-char', spacing: 0,
      }}).png().toBuffer({resolveWithObject: true});
      if (result.info.height <= height) return result.data;
    }
    throw new Error(`Card text exceeds readable bounds: ${text}`);
  }
  const layers = [
    {input: await sharp({create:{width:48,height:8,channels:4,background:accent}}).png().toBuffer(), left:72, top:166},
    {input: await textLayer(category.toUpperCase(),24,24,960,38,false,muted),left:144,top:156},
    {input: await textLayer(title,88,48,1056,265,true,ink),left:68,top:240},
    {input: await textLayer(domain,27,27,1056,40,false,muted),left:72,top:548},
  ];
  layers.push(logo
    ? {input: await sharp(logo).resize({width:250,height:82,fit:'inside'}).png().toBuffer(),left:72,top:48}
    : {input: await textLayer(identity,38,38,1056,64,false,ink),left:72,top:63});
  return sharp({create:{width:WIDTH,height:HEIGHT,channels:4,background:paper}}).composite(layers).png().toBuffer();
}
export {renderCard, WIDTH, HEIGHT};

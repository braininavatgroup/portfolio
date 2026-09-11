// Canonical renderer. Other repositories vendor this file unchanged.
// Approved editorial design A: 1200 x 630, 72px safe margins, identity/category/title/domain.
// Pass sharp explicitly so consumers use their own locked build dependency.
const WIDTH = 1200, HEIGHT = 630;
const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
async function renderCard(sharp, {title, category, domain, identity, logo, romanFont, boldFont, paper, ink, muted, accent}) {
  for (const [key, value] of Object.entries({title, category, domain, romanFont, boldFont, paper, ink, muted, accent})) {
    if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing card ${key}`);
  }
  if (!identity && !logo) throw new Error('Card requires an identity or logo');
  async function textLayer(text, size, minimum, width, height, bold, color, align = 'left') {
    for (let px = size; px >= minimum; px -= 2) {
      const result = await sharp({text: {
        text: `<span foreground="${color}">${escape(text)}</span>`,
        font: `Neue Haas Grotesk Display Pro ${bold ? 'Bold ' : ''}${px}`,
        fontfile: bold ? boldFont : romanFont,
        width, rgba: true, wrap: 'word', spacing: 0, align,
      }}).png().toBuffer({resolveWithObject: true});
      if (result.info.height <= height) return result.data;
    }
    throw new Error(`Card text exceeds readable bounds: ${text}`);
  }
  const layers = [
    {input: await sharp({create:{width:1056,height:2,channels:4,background:ink}}).png().toBuffer(),left:72,top:170},
    {input: await sharp({create:{width:56,height:6,channels:4,background:accent}}).png().toBuffer(),left:72,top:168},
    {input: await textLayer(category.toUpperCase(),23,21,420,56,false,muted,'right'),left:708,top:76},
    {input: await textLayer(title,88,48,1056,285,true,ink),left:68,top:222},
    {input: await textLayer(domain,27,27,1056,40,false,muted),left:72,top:548},
  ];
  layers.push(logo
    ? {input: await sharp(logo).resize({width:250,height:82,fit:'inside'}).png().toBuffer(),left:72,top:48}
    : {input: await textLayer(identity,38,38,600,82,false,ink),left:72,top:48});
  return sharp({create:{width:WIDTH,height:HEIGHT,channels:4,background:paper}}).composite(layers).png().toBuffer();
}
export {renderCard, WIDTH, HEIGHT};

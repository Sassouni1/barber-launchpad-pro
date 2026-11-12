import { formatServiceCity } from './formatServiceCity';

const TEMPLATE_URL = '/lesson-assets/posts/announcement-post-template.png';
const FONT_URL = '/lesson-assets/posts/Inter-Bold.ttf';
const FONT_FAMILY = 'AnnouncementInter';
const SIZE = 1254;
const SUBTITLE_TOP = 196;
const SUBTITLE_MAX_WIDTH = 880;
const LETTER_SPACING = 0.8;
const COLOR = '#f6e7c4';

let fontReady: Promise<void> | undefined;

function loadFont() {
  fontReady ??= (async () => {
    const font = new FontFace(FONT_FAMILY, `url(${FONT_URL})`, { weight: '700' });
    await font.load();
    document.fonts.add(font);
  })().catch(error => {
    fontReady = undefined;
    throw error;
  });
  return fontReady;
}

function loadTemplate() {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not load the announcement image'));
    image.src = TEMPLATE_URL;
  });
}

function textWidth(context: CanvasRenderingContext2D, text: string, spacing: number) {
  return [...text].reduce((width, character) => width + context.measureText(character).width, 0)
    + Math.max(0, [...text].length - 1) * spacing;
}

/** Only the blank subtitle area is drawn over the supplied photo template. */
export async function renderAnnouncementPostImage(serviceCity: string): Promise<string> {
  const city = formatServiceCity(serviceCity);
  if (!city) throw new Error('Add your city and state on the dashboard first');

  const [template] = await Promise.all([loadTemplate(), loadFont()]);
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Image editing is unavailable in this browser');
  context.drawImage(template, 0, 0, SIZE, SIZE);

  const text = `Right here in ${city}`;
  let fontSize = 32;
  context.textBaseline = 'alphabetic';
  context.fillStyle = COLOR;
  context.font = `700 ${fontSize}px ${FONT_FAMILY}`;
  while (fontSize > 20 && textWidth(context, text, LETTER_SPACING) > SUBTITLE_MAX_WIDTH) {
    fontSize -= 1;
    context.font = `700 ${fontSize}px ${FONT_FAMILY}`;
  }
  if (textWidth(context, text, LETTER_SPACING) > SUBTITLE_MAX_WIDTH) {
    throw new Error('The city and state are too long for this image');
  }

  const baseline = SUBTITLE_TOP + context.measureText('Right here in Clearwater, Florida').actualBoundingBoxAscent;
  let x = (SIZE - textWidth(context, text, LETTER_SPACING)) / 2;
  for (const character of text) {
    context.fillText(character, x, baseline);
    x += context.measureText(character).width + LETTER_SPACING;
  }
  return canvas.toDataURL('image/png');
}

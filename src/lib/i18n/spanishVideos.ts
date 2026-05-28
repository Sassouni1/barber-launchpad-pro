/**
 * Spanish (Español) Vimeo video overrides for Hair System Mastery.
 *
 * The source of truth is the canonical English lesson identity, not the
 * rendered Spanish order. Upload/task-only items are intentionally keyed and
 * intentionally have no Vimeo override so they can never shift later videos.
 */
export type HairSystemLessonKey =
  | "terms"
  | "color-ring"
  | "template"
  | "customize"
  | "tape"
  | "adhesive"
  | "style"
  | "template-photo-upload"
  | "live-client-1"
  | "live-client-2"
  | "live-client-3"
  | "live-client-4"
  | "at-home-care"
  | "maintenance"
  | "consultation"
  | "charge"
  | "order";

type VideoLocale = "en" | "es";

type VideoModuleLike = {
  id?: string | null;
  title?: string | null;
  order_index?: number | null;
  video_url?: string | null;
};

export const HAIR_SYSTEM_LESSON_KEY_BY_MODULE_ID: Record<string, HairSystemLessonKey> = {
  "409c4aa9-b5e0-4589-b470-106f07f76364": "terms",
  "269e90ae-9320-4a8d-b326-1b9f6c394dd4": "color-ring",
  "62f0a33c-c95c-4453-a34d-c825a4dfb6a0": "template",
  "bd6e3e20-5fd5-4852-91ce-50a15fa991e3": "customize",
  "e5a053f3-2fd3-4eaf-b4d0-98fd27ee1ef8": "tape",
  "55ace175-0f37-4ebd-a504-ec4e5f8caad2": "adhesive",
  "ded8a28b-8432-4338-b936-a8a7e86e66f8": "style",
  "65dfcdf9-0a37-42c5-96ee-e9aa4c3a3db3": "template-photo-upload",
  "582837c7-5a6e-4467-b0ff-36446de0e478": "live-client-1",
  "7c4808e9-0b1e-40e8-b188-016d4f9398a4": "live-client-2",
  "ef71fd79-972e-4aca-a6eb-771dfbb1b865": "live-client-3",
  "c8b69876-591a-41cc-82e4-755ad02efd4e": "live-client-4",
  "a576965f-2668-4603-9138-2d023457e320": "at-home-care",
  "5d4abbf6-effb-49ff-bd06-eeb8c8463c98": "maintenance",
  "7cf461b7-a969-4ec2-8c21-7901d88561a1": "consultation",
  "c45caf90-af21-44cd-898c-76fc8015ea00": "charge",
  "60c268c9-5df7-4161-8d91-2c185fc791d0": "order",
};

export const SPANISH_VIDEO_BY_LESSON_KEY: Partial<Record<HairSystemLessonKey, string>> = {
  terms: "https://vimeo.com/1195973463/b7ed38c1c1",
  "color-ring": "https://vimeo.com/1195973824/0c2482e379",
  template: "https://vimeo.com/1196206697/81dcca3a63",
  customize: "https://vimeo.com/1195975327/ca5299ade5",
  tape: "https://vimeo.com/1195976934/486a6da8bd",
  adhesive: "https://vimeo.com/1196206696/e8067f2a1e",
  style: "https://vimeo.com/1195978973/72ef41e1f6",
  "live-client-1": "https://vimeo.com/1196206694/e0e7a9dcaa",
  "live-client-2": "https://vimeo.com/1195980538/cfac4efaf7",
  "live-client-3": "https://vimeo.com/1196206695/3c21634878",
  "at-home-care": "https://vimeo.com/1196205873/5eeeb2d8bf",
  consultation: "https://vimeo.com/1195982575/6a6fe32051",
  charge: "https://vimeo.com/1196208396/3ad849bcc7",
};

export const SPANISH_EMBED_BY_LESSON_KEY: Partial<Record<HairSystemLessonKey, string>> = {
  terms: "https://player.vimeo.com/video/1195973463?h=b7ed38c1c1",
  "color-ring": "https://player.vimeo.com/video/1195973824?h=0c2482e379",
  template: "https://player.vimeo.com/video/1196206697?h=81dcca3a63",
  customize: "https://player.vimeo.com/video/1195975327?h=ca5299ade5",
  tape: "https://player.vimeo.com/video/1195976934?h=486a6da8bd",
  adhesive: "https://player.vimeo.com/video/1196206696?h=e8067f2a1e",
  style: "https://player.vimeo.com/video/1195978973?h=72ef41e1f6",
  "live-client-1": "https://player.vimeo.com/video/1196206694?h=e0e7a9dcaa",
  "live-client-2": "https://player.vimeo.com/video/1195980538?h=cfac4efaf7",
  "live-client-3": "https://player.vimeo.com/video/1196206695?h=3c21634878",
  "at-home-care": "https://player.vimeo.com/video/1196205873?h=5eeeb2d8bf",
  consultation: "https://player.vimeo.com/video/1195982575?h=6a6fe32051",
  charge: "https://player.vimeo.com/video/1196208396?h=3ad849bcc7",
};

export const SPANISH_TITLE_BY_LESSON_KEY: Partial<Record<HairSystemLessonKey, string>> = {
  terms: "Terminos de la Industria",
  "color-ring": "El anillo de color",
  template: "Como hacer una plantilla",
  customize: "Como personalizar la protesis capilar",
  tape: "Aplicacion de la protesis capilar con cinta",
  adhesive: "Aplicacion de protesis capilares con adhesivo",
  style: "Como peinar una protesis capilar",
  "template-photo-upload": "Enviar foto de la plantilla de la protesis capilar",
  "live-client-1": "Cliente en vivo Parte 1",
  "live-client-2": "Cliente en vivo Parte 2",
  "live-client-3": "Cliente en vivo Parte 3",
  "live-client-4": "Cliente en vivo Parte 4",
  "at-home-care": "Cuidado en casa",
  maintenance: "La cita de mantenimiento",
  consultation: "La consulta y preguntas para hacer",
  charge: "Como y cuanto cobrar",
  order: "Como hacer un pedido de protesis capilar",
};

const SPANISH_COURSE_TITLES: Record<string, string> = {
  "Hair System Mastery": "Dominio de protesis capilares",
  "Hair System Training": "Capacitacion en protesis capilares",
};

const SPANISH_UI_LABELS: Record<string, string> = {
  "Start Lesson": "Iniciar leccion",
  "Take Quiz": "Hacer examen",
  "Mark Complete": "Marcar como completada",
  Completed: "Completada",
  Resources: "Recursos",
  "Next Lesson": "Siguiente leccion",
  Quiz: "Examen",
  Homework: "Tarea",
  Files: "Archivos",
  "Select a Module": "Selecciona un modulo",
  "Choose a module from the left panel to view its content": "Elige un modulo del panel izquierdo para ver su contenido",
};

const LESSON_KEY_BY_NORMALIZED_TITLE: Record<string, HairSystemLessonKey> = {
  "terms of the industry": "terms",
  "terminos de la industria": "terms",
  "términos de la industria": "terms",
  "the color ring": "color-ring",
  "el anillo de color": "color-ring",
  "how to make a template": "template",
  "como hacer una plantilla": "template",
  "cómo hacer una plantilla": "template",
  "how to customize the hair system": "customize",
  "como personalizar la protesis capilar": "customize",
  "cómo personalizar la prótesis capilar": "customize",
  "applying the hair system with tape": "tape",
  "aplicacion de la protesis capilar con cinta": "tape",
  "aplicación de la prótesis capilar con cinta": "tape",
  "applying hair systems with adhesive": "adhesive",
  "aplicacion de protesis capilares con adhesivo": "adhesive",
  "aplicación de prótesis capilares con adhesivo": "adhesive",
  "how to style a hair system": "style",
  "como peinar una protesis capilar": "style",
  "cómo peinar una prótesis capilar": "style",
  "submit hair system template photo": "template-photo-upload",
  "enviar foto de la plantilla de la protesis capilar": "template-photo-upload",
  "live client part 1": "live-client-1",
  "cliente en vivo parte 1": "live-client-1",
  "live client part 2": "live-client-2",
  "cliente en vivo parte 2": "live-client-2",
  "live client part 3": "live-client-3",
  "cliente en vivo parte 3": "live-client-3",
  "live client part 4": "live-client-4",
  "cliente en vivo parte 4": "live-client-4",
  "at home care": "at-home-care",
  "cuidado en casa": "at-home-care",
  "the maintenance appointment": "maintenance",
  "la cita de mantenimiento": "maintenance",
  "the consultation & questions to ask": "consultation",
  "the consultation and questions to ask": "consultation",
  "la consulta y preguntas para hacer": "consultation",
  "how and what to charge": "charge",
  "como y cuanto cobrar": "charge",
  "cómo y cuánto cobrar": "charge",
  "placing a hair system order": "order",
  "how to order a hair system": "order",
  "como hacer un pedido de protesis capilar": "order",
  "cómo hacer un pedido de prótesis capilar": "order",
};

function normalizeLessonTitle(title: string) {
  return title
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function getCanonicalHairSystemLessonKey(module: VideoModuleLike): HairSystemLessonKey | undefined {
  if (module.id) {
    const byId = HAIR_SYSTEM_LESSON_KEY_BY_MODULE_ID[module.id];
    if (byId) return byId;
  }

  if (module.title) {
    const byTitle = LESSON_KEY_BY_NORMALIZED_TITLE[normalizeLessonTitle(module.title)];
    if (byTitle) return byTitle;
  }

  return undefined;
}

function isSpanishMode(locale: VideoLocale) {
  if (locale === "es") return true;
  if (locale === "en") return false;
  if (typeof window === "undefined") return false;
  return document.documentElement.lang === "es" || localStorage.getItem("bla.locale") === "es";
}

export function localizeHairSystemLessonTitle(module: VideoModuleLike, locale: VideoLocale): string {
  const title = module.title ?? "";
  if (!isSpanishMode(locale)) return title;
  const key = getCanonicalHairSystemLessonKey(module);
  return (key && SPANISH_TITLE_BY_LESSON_KEY[key]) || title;
}

export function localizeCourseTitle(title: string | undefined | null, locale: VideoLocale): string {
  const value = title ?? "";
  return isSpanishMode(locale) ? SPANISH_COURSE_TITLES[value] || value : value;
}

export function localizeCourseUi(label: string, locale: VideoLocale): string {
  return isSpanishMode(locale) ? SPANISH_UI_LABELS[label] || label : label;
}

/**
 * Resolve the exact video URL to render for a module + locale.
 * Missing Spanish lessons (upload task, Live Client 4, Maintenance, Order)
 * explicitly fall back to their English/no-video source without shifting.
 */
export function resolveVideoUrlForModule(module: VideoModuleLike | undefined | null, locale: VideoLocale): string {
  if (!module) return "";

  if (isSpanishMode(locale)) {
    const key = getCanonicalHairSystemLessonKey(module);
    const spanishUrl = key ? SPANISH_VIDEO_BY_LESSON_KEY[key] : undefined;
    if (spanishUrl?.trim()) return spanishUrl;
  }

  return module.video_url ?? "";
}

export function resolveVideoEmbedUrlForModule(
  module: VideoModuleLike | undefined | null,
  locale: VideoLocale,
  englishEmbedResolver: (url: string) => string
): string {
  if (!module) return "";

  if (isSpanishMode(locale)) {
    const key = getCanonicalHairSystemLessonKey(module);
    const spanishEmbedUrl = key ? SPANISH_EMBED_BY_LESSON_KEY[key] : undefined;
    if (spanishEmbedUrl?.trim()) return spanishEmbedUrl;
  }

  return module.video_url ? englishEmbedResolver(module.video_url) : "";
}

export function resolveVideoUrl(
  moduleId: string | undefined | null,
  englishUrl: string | undefined | null,
  locale: VideoLocale
): string {
  return resolveVideoUrlForModule({ id: moduleId, video_url: englishUrl }, locale);
}

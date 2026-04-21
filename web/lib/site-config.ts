const defaultCategories = [
  "Modelos y LLMs",
  "Herramientas y Productos",
  "Investigación",
  "Empresas y Negocios",
  "Política y Ética",
  "Robótica",
  "Agentes de IA",
  "Diseño e IA",
];

function parseCategories(): string[] {
  const raw = process.env.NEXT_PUBLIC_SITE_CATEGORIES;
  if (!raw) return defaultCategories;
  try {
    return JSON.parse(raw);
  } catch {
    return defaultCategories;
  }
}

export const siteConfig = {
  name:       process.env.NEXT_PUBLIC_SITE_NAME    ?? "AI Hoy",
  tagline:    process.env.NEXT_PUBLIC_SITE_TAGLINE ?? "Noticias de inteligencia artificial en español",
  url:        process.env.NEXT_PUBLIC_SITE_URL     ?? "https://ai-hoy.vercel.app",
  locale:     process.env.NEXT_PUBLIC_SITE_LOCALE  ?? "es_AR",
  lang:       process.env.NEXT_PUBLIC_SITE_LANG    ?? "es",
  categories: parseCategories(),
};

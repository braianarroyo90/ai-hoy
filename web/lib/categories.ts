export function categoryToSlug(cat: string): string {
  return cat.toLowerCase()
    .replace(/á/g, "a").replace(/é/g, "e").replace(/í/g, "i")
    .replace(/ó/g, "o").replace(/ú/g, "u").replace(/ñ/g, "n")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

export function slugToCategory(slug: string, categories: string[]): string | undefined {
  return categories.find((c) => categoryToSlug(c) === slug);
}

export const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  "Modelos y LLMs":
    "Los grandes modelos de lenguaje que están redefiniendo la IA: GPT, Claude, Gemini, Llama y los que vienen. Benchmarks, lanzamientos y análisis técnico.",
  "Herramientas y Productos":
    "Las aplicaciones, plataformas y productos de IA que están cambiando cómo trabajamos. Desde copilots hasta generadores de imágenes y video.",
  "Investigación":
    "Papers, experimentos y descubrimientos del mundo académico y corporativo que marcan el rumbo de la inteligencia artificial.",
  "Empresas y Negocios":
    "El ecosistema empresarial de la IA: startups, rondas de inversión, adquisiciones y las estrategias de los grandes jugadores.",
  "Política y Ética":
    "La regulación, los dilemas éticos y el debate sobre el impacto social de la IA. Leyes, controversias y el futuro del control humano.",
  "Robótica":
    "Robots, automatización y sistemas físicos impulsados por IA. Desde brazos industriales hasta humanoides que aprenden a caminar.",
  "Agentes de IA":
    "Sistemas de IA que actúan de forma autónoma: agentes que planifican, ejecutan tareas y toman decisiones sin intervención humana.",
  "Diseño e IA":
    "La intersección entre inteligencia artificial y creatividad: diseño generativo, herramientas para creativos y el futuro del arte digital.",
};

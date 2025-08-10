export async function generateCoachNote(
  apiKey: string,
  context: {
    spm?: number;
    strokes?: number;
    notesSoFar?: string[];
  }
): Promise<string> {
  if (!apiKey) throw new Error("Falta la API key de Hugging Face");

  const prompt = `Eres un coach experto de canotaje. Da una breve observación en español, en 1-2 frases, clara y accionable.
Datos actuales: SPM=${Math.round(context.spm ?? 0)}, strokes=${context.strokes ?? 0}.
Evita suposiciones no soportadas por datos. No uses emojis.`;

  const res = await fetch("https://api-inference.huggingface.co/models/google/flan-t5-small", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: prompt,
      parameters: {
        max_new_tokens: 80,
        temperature: 0.4,
      },
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`HF HTTP ${res.status}: ${t}`);
  }

  const data = await res.json();
  // flan-t5 returns array with generated_text
  const text = Array.isArray(data) ? data[0]?.generated_text : data?.generated_text;
  return (text || "Ajusta la técnica manteniendo cadencia constante y empuje eficiente.").trim();
}

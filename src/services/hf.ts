export async function generateCoachNote(
  apiKey: string,
  context: {
    spm?: number;
    strokes?: number;
    head_height?: number;
    hip_height?: number;
    right_hand_height?: number;
    left_hand_height?: number;
    body_rotation?: number;
    notesSoFar?: string[];
  }
): Promise<string> {
  if (!apiKey) throw new Error("Falta la API key de Hugging Face");

  const spm = Math.round(context.spm ?? 0);
  const strokes = Math.round(context.strokes ?? 0);
  const head = Math.round(context.head_height ?? 0);
  const hip = Math.round(context.hip_height ?? 0);
  const right = Math.round(context.right_hand_height ?? 0);
  const left = Math.round(context.left_hand_height ?? 0);
  const rotation = Math.round(context.body_rotation ?? 0);

  const prompt =
    `Eres un coach experto de canotaje de velocidad con experiencia en entrenamiento de alto rendimiento. ` +
    `Da una breve observación en español, en 1-2 frases, clara y concisa. ` +
    `Datos actuales: ritmo de paladas por minuto = ${spm}, número de paladas = ${strokes}, altura de la cabeza = ${head}, altura de la cadera = ${hip}, altura de la mano derecha = ${right}, altura de la mano izquierda = ${left}, ángulo de rotación del tronco = ${rotation}. ` +
    `Ten en cuenta que en canotaje de velocidad el movimiento del cuerpo es fundamental en la técnica, si las manos no alcanzan la altura de la cabeza en algún punto de la palada o bien pasan por debajo de la altura de cadera se consideran errores que pueden efectar el rendimiento y desplazamiento de la embarcación. ` +
    `Además mantener el ritmo de paladas por minutos, así como la rotación durante la mayor parte del entrenamiento puede mejorar las capacidades físicas y técnicas del atleta. ` +
    `Evita suposiciones no soportadas por datos. No uses emojis.`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 40000);
  const res = await fetch(
    "https://api-inference.huggingface.co/models/google/flan-t5-base",
    {
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
        options: { wait_for_model: true },
      }),
      signal: controller.signal,
    }
  );
  clearTimeout(timeout);

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`HF HTTP ${res.status}: ${t}`);
  }

  const data = await res.json();
  if (data && typeof data === "object" && "error" in data) {
    throw new Error(`HF error: ${(data as any).error}`);
  }
  let text: string | undefined;
  if (Array.isArray(data) && data.length) {
    text = (data[0] as any)?.generated_text || (data[0] as any)?.summary_text;
  } else if (data && typeof data === "object") {
    text = (data as any).generated_text || (data as any).summary_text;
  } else if (typeof data === "string") {
    text = data;
  }
  return (text || "Ajusta la técnica manteniendo cadencia constante y empuje eficiente.").trim();
}

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

  const prompt = `Eres un coach experto de canotaje de velocidad con experiencia en entrenamiento de alto rendimiento. Da una breve observación en español, en 1-2 frases, clara y concisa.
Datos actuales: ritmo de paladas por minuto = ${Math.round(context.spm ?? 0)}, número de paladas = ${context.strokes ?? 0}, altura de la cabeza = ${context.head_height ?? 0}, altura de la cadera = ${context.hip_height ?? 0}, altura de la mano derecha = ${context.right_hand_height ?? 0}, altura de la mano izquierda = ${context.left_hand_height ?? 0}, ángulo de rotación del tronco = ${context.body_rotation ?? 0}.
Ten en cuenta que en canotaje de velocidad el movimiento del cuerpo es fundamental en la técnica, si las manos no alcanzan la altura de la cabeza en algún punto de la palada o bien pasan por debajo de la altura de cadera se consideran errores que pueden efectar el rendimiento y desplazamiento de la embarcación. Además mantener el ritmo de paladas por minutos, así como la rotación durante la mayor parte del entrenamiento puede mejorar las capacidades físicas y técnicas del atleta.
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

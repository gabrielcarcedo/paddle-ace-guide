# Utilidades reales de análisis basadas en las funciones provistas
from math import acos, degrees
import numpy as np
import asyncio
import requests
# Cálculos geométricos y métricas

def calcular_punto_angle(results, a: int, b: int, width: int, height: int):
    x1 = int(results.pose_landmarks.landmark[a].x * width)
    y1 = int(results.pose_landmarks.landmark[a].y * height)

    x2 = int(results.pose_landmarks.landmark[b].x * width)
    y2 = int(results.pose_landmarks.landmark[b].y * height)

    p1 = np.array([x1, y1])
    p2 = np.array([x2, y2])

    if (x2 >= x1) and (y2 >= y1):
        p3 = np.array([x2, y1])
        contours = np.array([[x1, y1], [x2, y2], [x2, y1]])
        aux = p1
        p1 = p2
        p2 = aux
    elif (x2 >= x1) and (y2 <= y1):
        p3 = np.array([x1, y2])
        contours = np.array([[x1, y1], [x2, y2], [x1, y2]])
    else:
        x3 = int((x1 + x2) / 2)
        y3 = int((y1 + y2) / 2)
        p3 = np.array([x3, y3])
        contours = np.array([[x1, y1], [x2, y2], [x3, y3]])

    l1 = np.linalg.norm(p2 - p3)
    l2 = np.linalg.norm(p1 - p3)
    l3 = np.linalg.norm(p1 - p2)

    try:
        angle = degrees(acos((l1**2 + l3**2 - l2**2) / (2 * l1 * l3)))
    except Exception:
        angle = 0

    if np.isnan(angle):
        angle = 0

    return float(angle), tuple(p3.tolist()), contours


def calcular_distancia(results, a: int, b: int, width: int, height: int) -> float:
    x1 = int(results.pose_landmarks.landmark[a].x * width)
    y1 = int(results.pose_landmarks.landmark[a].y * height)

    x2 = int(results.pose_landmarks.landmark[b].x * width)
    y2 = int(results.pose_landmarks.landmark[b].y * height)

    try:
        l = float(np.sqrt(((x2 - x1) ** 2) + ((y2 - y1) ** 2)))
    except Exception:
        l = 0.0

    return l


def calcular_ritmo(ciclo_tiempo: float) -> int:
    return int(35.01389 + (147.38751 / (1 + (ciclo_tiempo / 1.697507) ** 3.211194)))


def calcular_ritmo_ajuste(ciclo_tiempo: float) -> int:
    return int((188.428469573685655 / ((1 + ((ciclo_tiempo / 0.7947621576650942) ** 102.47288962956647)) ** 0.008204379522496913)) - 5.759747635996895)


def calcular_altura(results, a: int, height: int) -> int:
    return int(results.pose_landmarks.landmark[a].y * height)


def calcular_ancho(results, a: int, width: int) -> int:
    return int(results.pose_landmarks.landmark[a].x * width)


def angle_calculate(results, a: int, b: int, c: int, width: int, height: int) -> float:
    """Calcula el ángulo en el punto b formado por (a-b-c)."""
    x1 = int(results.pose_landmarks.landmark[a].x * width)
    y1 = int(results.pose_landmarks.landmark[a].y * height)

    x2 = int(results.pose_landmarks.landmark[b].x * width)
    y2 = int(results.pose_landmarks.landmark[b].y * height)

    x3 = int(results.pose_landmarks.landmark[c].x * width)
    y3 = int(results.pose_landmarks.landmark[c].y * height)

    p1 = np.array([x1, y1])
    p2 = np.array([x2, y2])
    p3 = np.array([x3, y3])

    l1 = np.linalg.norm(p2 - p3)
    l2 = np.linalg.norm(p1 - p3)
    l3 = np.linalg.norm(p1 - p2)

    try:
        angle = degrees(acos((l1**2 + l3**2 - l2**2) / (2 * l1 * l3)))
    except Exception:
        angle = 0

    if np.isnan(angle):
        angle = 0

    return float(angle)

# --- Hugging Face LLM helper ---

def _hf_request(api_key: str, prompt: str) -> str:
    headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
    payload = {
        "inputs": prompt,
        "parameters": {"max_new_tokens": 80, "temperature": 0.4},
    }
    try:
        resp = requests.post(
            "https://api-inference.huggingface.co/models/distilbert-base-uncased",
            headers=headers,
            json=payload,
            timeout=12,
        )
        resp.raise_for_status()
        data = resp.json()
        if isinstance(data, list):
            text = (data[0] or {}).get("generated_text")
        else:
            text = data.get("generated_text")
        if not text:
            text = "Ajusta la técnica manteniendo cadencia constante y empuje eficiente.1"
        return text.strip()
    except Exception:
        return "Ajusta la técnica manteniendo cadencia constante y empuje eficiente.2"

async def hf_generate_coach_note(api_key: str, spm: int = 0, strokes: int = 0, head_height: int = 0, hip_height: int = 0, right_hand_height: int = 0, left_hand_height: int = 0, body_rotation: int = 0) -> str:
    if not api_key:
        return "Ajusta la técnica manteniendo cadencia constante y empuje eficiente.3"
    prompt = (
        f"Eres un coach experto de canotaje de velocidad con experiencia en entrenamiento de alto rendimiento. Da una breve observación en español, en 1-2 frases, clara y concisa. Datos actuales: ritmo de paladas por minuto = ${int(spm)}, número de paladas = ${int(strokes)}, altura de la cabeza = ${int(head_height)}, altura de la cadera = ${int(hip_height)}, altura de la mano derecha = ${int(right_hand_height)}, altura de la mano izquierda = ${int(left_hand_height)}, ángulo de rotación del tronco = ${int(body_rotation)}. Ten en cuenta que en canotaje de velocidad el movimiento del cuerpo es fundamental en la técnica, si las manos no alcanzan la altura de la cabeza en algún punto de la palada o bien pasan por debajo de la altura de cadera se consideran errores que pueden efectar el rendimiento y desplazamiento de la embarcación. Además mantener el ritmo de paladas por minutos, así como la rotación durante la mayor parte del entrenamiento puede mejorar las capacidades físicas y técnicas del atleta. Evita suposiciones no soportadas por datos. No uses emojis."
    )
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _hf_request, api_key, prompt)

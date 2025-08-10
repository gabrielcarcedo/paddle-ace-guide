import asyncio
import base64
import json
import os
from urllib.parse import parse_qs

from channels.generic.websocket import AsyncWebsocketConsumer
from django.conf import settings

try:
    import cv2  # type: ignore
except Exception:  # pragma: no cover
    cv2 = None

try:
    import mediapipe as mp  # type: ignore
except Exception:  # pragma: no cover
    mp = None

import numpy as np
from math import acos, degrees

from .utils import (
    calcular_punto_angle,
    calcular_distancia,
    calcular_ritmo,
    calcular_ritmo_ajuste,
    calcular_altura,
    calcular_ancho,
    angle_calculate,
    hf_generate_coach_note,
)
from .charts import generate_charts


class ProcessingConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # Parse job_id from query string
        qs = parse_qs(self.scope.get("query_string", b""))
        job_id = None
        if b"job_id" in qs and qs[b"job_id"]:
            job_id = qs[b"job_id"][0].decode()
        self.job_id = job_id

        await self.accept()

        if not self.job_id:
            await self.send_json({"type": "error", "message": "job_id requerido"})
            await self.close()
            return

        video_path = os.path.join(settings.MEDIA_ROOT, "videos", f"{self.job_id}.mp4")
        if not os.path.exists(video_path):
            await self.send_json({"type": "error", "message": "Video no encontrado"})
            await self.close()
            return

        # Inicia tarea de procesamiento
        asyncio.create_task(self._process_video(video_path))

    async def disconnect(self, code):
        # Nada especial por ahora
        return

    async def receive(self, text_data=None, bytes_data=None):
        # No recibimos mensajes del cliente en este flujo
        return

    async def _process_video(self, video_path: str):
        # Procesamiento real con OpenCV + MediaPipe; si falta alguna lib, simula
        if cv2 is None or mp is None:
            # Simulación: envía 50 frames con progreso y textos
            total = 50
            for i in range(total):
                await asyncio.sleep(0.05)
                await self.send_json({
                    "type": "frame",
                    "jpg": None,
                    "progress": (i + 1) / total,
                })
                if i % 10 == 0:
                    spm_sim = 40 + i // 10
                    await self.send_json({"type": "metric", "spm": spm_sim, "strokes": i})
                    try:
                        if getattr(settings, "HUGGINGFACE_API_KEY", ""):
                            note = await hf_generate_coach_note(settings.HUGGINGFACE_API_KEY, spm_sim, i)
                        else:
                            note = f"Buen ritmo, mantén la cadencia (tick {i})."
                    except Exception:
                        note = f"Buen ritmo, mantén la cadencia (tick {i})."
                    await self.send_json({"type": "text", "text": note})
            await self.send_json({"type": "complete", "processed_video_url": f"/media/videos/{self.job_id}.mp4"})
            return

        cap = cv2.VideoCapture(video_path)
        try:
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
            fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
            if fps <= 0:
                fps = 30.0
            metadata = max(1, int(round(fps)))  # usado para promedios de fases y ~frames/seg

            # Contadores y estado
            i = 0
            cont_paladas = 0
            cont_frames = 0
            tiempo_ciclo_paladas = 0.0
            spm_ajuste = 0

            # Fases de palada y métricas auxiliares
            cont_phase_aerial = 0
            cont_phase_water = 0
            prom_phase_aerial = 0
            prom_phase_water = 0
            porc_phase_aerial = 0
            porc_phase_water = 0
            token_phase = 0
            phase = ""

            # Tokens lado y ángulo de rotación máximo por lado
            token_izq = False
            token_der = False
            token_hand = "LEFT"
            aux_hand = ""
            rot_angle = 0.0

            # Series para gráficas
            list_angle_rod_izq = []
            list_angle_rod_der = []
            list_angle_cod_izq = []
            list_angle_cod_der = []
            list_angle_axi_izq = []
            list_angle_axi_der = []

            list_head_alt = []
            list_cad_izq = []
            list_mun_izq = []
            list_cad_der = []
            list_mun_der = []
            list_mun_izq_ancho = []
            list_mun_der_ancho = []
            list_hom_izq_ancho = []
            list_hom_der_ancho = []

            list_hombro_angle = []
            list_hombro_dist = []
            list_ciclo_palada = []
            list_stroke_rate = []
            list_phases_segmentation = []
            list_phase_aerial_time = []
            list_phase_water_time = []
            list_rotation_angle = []
            list_hand_paddle = []
            list_hip = []
            list_aux = []

            # MediaPipe Pose
            mp_drawing = mp.solutions.drawing_utils
            mp_pose = mp.solutions.pose

            with mp_pose.Pose(static_image_mode=False, enable_segmentation=True, model_complexity=1) as pose:
                while True:
                    ok, frame = cap.read()
                    if not ok:
                        break

                    # Opcional: redimensionar para mejor visualización
                    proporcion = 3 / 2
                    alto = int(proporcion * frame.shape[0])
                    ancho = int(proporcion * frame.shape[1])
                    frame = cv2.resize(frame, (ancho, alto), interpolation=cv2.INTER_NEAREST)

                    height, width = frame.shape[:2]
                    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    results = pose.process(frame_rgb)

                    # Progreso
                    if total_frames > 0:
                        pos = cap.get(cv2.CAP_PROP_POS_FRAMES)
                        progress = min(1.0, float(pos) / float(total_frames))
                    else:
                        progress = 0.0
                        pos = 0.0

                    # Procesamiento cuando hay landmarks
                    if results.pose_landmarks is not None:
                        # Dibujo de landmarks
                        mp_drawing.draw_landmarks(
                            frame,
                            results.pose_landmarks,
                            mp_pose.POSE_CONNECTIONS,
                            mp_drawing.DrawingSpec(color=(255, 0, 0), thickness=2, circle_radius=3),
                            mp_drawing.DrawingSpec(color=(255, 255, 255), thickness=2),
                        )

                        # Métricas base (distancia y ángulo hombros)
                        hombro_dist = calcular_distancia(results, 12, 11, width, height)
                        hombro_angle, p3, contoursp3 = calcular_punto_angle(results, 12, 11, width, height)

                        # Mantener ángulo máximo por mano
                        if aux_hand == token_hand:
                            if rot_angle < hombro_angle:
                                rot_angle = hombro_angle
                        else:
                            aux_hand = token_hand
                            rot_angle = 0

                        # Alturas y anchos relevantes
                        hom_izq = height - calcular_altura(results, 11, height)
                        cad_izq = height - calcular_altura(results, 23, height)
                        aux_palada_izq = (hom_izq - cad_izq) / 2 + cad_izq

                        hom_der = height - calcular_altura(results, 12, height)
                        cad_der = height - calcular_altura(results, 24, height)
                        aux_palada_der = (hom_der - cad_der) / 2 + cad_der

                        mun_izq = height - calcular_altura(results, 15, height)
                        mun_izq_ancho = calcular_ancho(results, 15, width)
                        hom_izq_ancho = calcular_ancho(results, 11, width)
                        mun_der = height - calcular_altura(results, 16, height)
                        mun_der_ancho = calcular_ancho(results, 16, width)
                        hom_der_ancho = calcular_ancho(results, 12, width)

                        # Guardar series para gráficas
                        list_mun_izq.append(float(mun_izq))
                        list_mun_der.append(float(mun_der))
                        list_mun_izq_ancho.append(float(mun_izq_ancho))
                        list_mun_der_ancho.append(float(mun_der_ancho))
                        list_cad_izq.append(float(cad_izq))
                        list_cad_der.append(float(cad_der))
                        head_alt = height - calcular_altura(results, 0, height)
                        list_head_alt.append(float(head_alt))
                        hip_l = height - calcular_altura(results, 23, height)
                        hip_r = height - calcular_altura(results, 24, height)
                        hip_height = float((hip_l + hip_r) / 2.0)
                        list_hip.append(hip_height)

                        # Ángulos de codo, rodilla y axila (armpit)
                        try:
                            ang_elbow_l = angle_calculate(results, 11, 13, 15, width, height)
                            ang_elbow_r = angle_calculate(results, 12, 14, 16, width, height)
                            list_angle_cod_izq.append(float(ang_elbow_l))
                            list_angle_cod_der.append(float(ang_elbow_r))
                        except Exception:
                            list_angle_cod_izq.append(0.0)
                            list_angle_cod_der.append(0.0)
                        try:
                            ang_knee_l = angle_calculate(results, 23, 25, 27, width, height)
                            ang_knee_r = angle_calculate(results, 24, 26, 28, width, height)
                            list_angle_rod_izq.append(float(ang_knee_l))
                            list_angle_rod_der.append(float(ang_knee_r))
                        except Exception:
                            list_angle_rod_izq.append(0.0)
                            list_angle_rod_der.append(0.0)
                        try:
                            ang_axi_l = angle_calculate(results, 13, 11, 23, width, height)
                            ang_axi_r = angle_calculate(results, 14, 12, 24, width, height)
                            list_angle_axi_izq.append(float(ang_axi_l))
                            list_angle_axi_der.append(float(ang_axi_r))
                        except Exception:
                            list_angle_axi_izq.append(0.0)
                            list_angle_axi_der.append(0.0)

                        # Contador de frames para ciclo
                        cont_frames += 1

                        # Conteo de paladas (izquierda)
                        if (mun_izq <= aux_palada_izq) and (token_izq is False) and (token_hand == "LEFT") and (mun_der_ancho > hom_der_ancho):
                            cont_paladas += 1
                            token_izq = True
                            token_hand = "RIGHT"
                            if cont_paladas % 3 == 0:
                                tiempo_ciclo_paladas = cont_frames / fps
                                spm = calcular_ritmo(tiempo_ciclo_paladas)
                                spm_ajuste = calcular_ritmo_ajuste(tiempo_ciclo_paladas)
                                cont_frames = 0
                                current_time_sec = (pos / fps) if fps else 0.0
                                list_stroke_rate.append(float(spm_ajuste))
                                list_ciclo_palada.append(float(tiempo_ciclo_paladas))
                                list_aux.append(float(current_time_sec))
                                await self.send_json({"type": "metric", "spm": spm_ajuste, "strokes": cont_paladas, "head_height": head_alt, "hip_height": hip_height, "right_hand_height": mun_der, "left_hand_height": mun_izq, "body_rotation": rot_angle})
                                try:
                                    if getattr(settings, "HUGGINGFACE_API_KEY", ""):
                                        note = await hf_generate_coach_note(settings.HUGGINGFACE_API_KEY, spm_ajuste, cont_paladas, head_alt, hip_height, mun_der, mun_izq, rot_angle)
                                    else:
                                        note = f"SPM estimado: {spm_ajuste}. Mantén técnica estable."
                                except Exception:
                                    note = f"SPM estimado: {spm_ajuste}. Mantén técnica estable."
                                await self.send_json({"type": "text", "text": note})
                            token_izq = False

                        # Conteo de paladas (derecha)
                        if (mun_der <= aux_palada_der) and (token_der is False) and (token_hand == "RIGHT") and (mun_izq_ancho < hom_izq_ancho):
                            cont_paladas += 1
                            token_der = True
                            token_hand = "LEFT"
                            if cont_paladas % 3 == 0:
                                tiempo_ciclo_paladas = cont_frames / fps
                                spm = calcular_ritmo(tiempo_ciclo_paladas)
                                spm_ajuste = calcular_ritmo_ajuste(tiempo_ciclo_paladas)
                                cont_frames = 0
                                current_time_sec = (pos / fps) if fps else 0.0
                                list_stroke_rate.append(float(spm_ajuste))
                                list_ciclo_palada.append(float(tiempo_ciclo_paladas))
                                list_aux.append(float(current_time_sec))
                                await self.send_json({"type": "metric", "spm": spm_ajuste, "strokes": cont_paladas, "head_height": head_alt, "hip_height": hip_height, "right_hand_height": mun_der, "left_hand_height": mun_izq, "body_rotation": rot_angle})
                                try:
                                    if getattr(settings, "HUGGINGFACE_API_KEY", ""):
                                        note = await hf_generate_coach_note(settings.HUGGINGFACE_API_KEY, spm_ajuste, cont_paladas, head_alt, hip_height, mun_der, mun_izq, rot_angle)
                                    else:
                                        note = f"SPM estimado: {spm_ajuste}. Ajusta la rotación del tronco."
                                except Exception:
                                    note = f"SPM estimado: {spm_ajuste}. Ajusta la rotación del tronco."
                                await self.send_json({"type": "text", "text": note})
                            token_der = False

                        # Segmentación de fases por altura de manos
                        if (((mun_izq <= ((hom_izq - cad_izq) / 2 + cad_izq)) and (mun_izq > ((hom_izq - cad_izq) / 3 + cad_izq)) and (token_phase in (0, 4))) or
                            ((mun_der <= ((hom_der - cad_der) / 2 + cad_der)) and (mun_der > ((hom_der - cad_der) / 3 + cad_der)) and (token_phase in (0, 4)))):
                            phase = "ENTRY"
                            token_phase = 1
                            if cont_phase_aerial > 0:
                                prom_phase_aerial = round((prom_phase_aerial * 0 + (cont_phase_aerial / metadata)) if prom_phase_aerial == 0 else (((prom_phase_aerial + (cont_phase_aerial / metadata)) / 2)), 2)
                                if (cont_phase_aerial + cont_phase_water) > 0:
                                    porc_phase_aerial = round(((cont_phase_aerial / metadata) * 100) / (((cont_phase_aerial / metadata) + (cont_phase_water / metadata))), 2)
                        elif (((mun_izq < ((hom_izq - cad_izq) / 3 + cad_izq)) and token_phase == 1) or
                              ((mun_der < ((hom_der - cad_der) / 3 + cad_der)) and token_phase == 1)):
                            phase = "CATCH-PULL"
                            token_phase = 2
                        elif (((mun_izq >= ((hom_izq - cad_izq) / 3 + cad_izq)) and (mun_izq < ((hom_izq - cad_izq) / 2 + cad_izq)) and token_phase == 2) or
                              ((mun_der >= ((hom_der - cad_der) / 3 + cad_der)) and (mun_der < ((hom_der - cad_der) / 2 + cad_der)) and token_phase == 2)):
                            phase = "EXIT"
                            token_phase = 3
                        elif (mun_izq >= ((hom_izq - cad_izq) / 2 + cad_izq)) and (token_phase == 3) and (mun_der >= ((hom_der - cad_der) / 2 + cad_der)):
                            phase = "AERIAL"
                            token_phase = 4
                            if cont_phase_water > 0:
                                prom_phase_water = round((prom_phase_water * 0 + (cont_phase_water / metadata)) if prom_phase_water == 0 else (((prom_phase_water + (cont_phase_water / metadata)) / 2)), 2)
                                if (cont_phase_aerial + cont_phase_water) > 0:
                                    porc_phase_water = round(((cont_phase_water / metadata) * 100) / (((cont_phase_aerial / metadata) + (cont_phase_water / metadata))), 2)

                        # Actualizar contadores de fase
                        if token_phase in (1, 2, 3):
                            cont_phase_water += 1
                            if cont_phase_aerial != 0:
                                pass
                            cont_phase_aerial = 0
                        elif token_phase == 4:
                            cont_phase_aerial += 1
                            if cont_phase_water != 0:
                                pass

                        # Guardar fase para gráfica
                        list_phases_segmentation.append(phase)

                        # Overlays de información
                        # Banda superior: strokes, SPM, lado y ángulo de rotación
                        cv2.rectangle(frame, (0, 0), (ancho, 100), (65, 65, 65), -1)
                        cv2.putText(frame, f"Strokes Count: {cont_paladas}", (30, 53), 1, 2, (0, 255, 0), 1)
                        if cont_paladas > 3:
                            cv2.putText(frame, f"SPM: {int(spm_ajuste)}", (30, 80), 1, 2, (0, 255, 0), 1)
                        if (cont_paladas != 0) and (token_hand == 'LEFT'):
                            cv2.putText(frame, 'Side: RIGHT', (ancho - 300, 53), 1, 2, (0, 255, 0), 1)
                        elif token_hand == 'RIGHT':
                            cv2.putText(frame, 'Side: LEFT', (ancho - 300, 53), 1, 2, (0, 255, 0), 1)
                        cv2.putText(frame, f"Rot Ang: {round(rot_angle, 2)}", (ancho - 300, 80), 1, 2, (0, 255, 0), 1)

                        # Banda inferior: tiempos y porcentajes de fases
                        cv2.rectangle(frame, (0, alto), (ancho, alto - 80), (65, 65, 65), -1)
                        if cont_phase_aerial > 0:
                            cv2.putText(frame, f"APT: {round(cont_phase_aerial/metadata,2)}s", (25, alto - 50), 1, 2, (0, 255, 0), 1)
                        if cont_phase_water > 0:
                            cv2.putText(frame, f"WPT: {round(cont_phase_water/metadata,2)}s", (25, alto - 23), 1, 2, (0, 255, 0), 1)
                        cv2.putText(frame, f"PAT: {porc_phase_aerial}%", (int(ancho/2) - 100, alto - 50), 1, 2, (0, 255, 0), 1)
                        cv2.putText(frame, f"PWT: {porc_phase_water}%", (int(ancho/2) - 100, alto - 23), 1, 2, (0, 255, 0), 1)
                        cv2.putText(frame, f"AAT: {prom_phase_aerial}s", (ancho - 200, alto - 50), 1, 2, (0, 255, 0), 1)
                        cv2.putText(frame, f"AWT: {prom_phase_water}s", (ancho - 200, alto - 23), 1, 2, (0, 255, 0), 1)

                    # Encode y envío del frame (siempre)
                    ret, buf = cv2.imencode('.jpg', frame)
                    if ret:
                        jpg_b64 = base64.b64encode(buf.tobytes()).decode()
                    else:
                        jpg_b64 = None

                    await self.send_json({
                        "type": "frame",
                        "jpg": jpg_b64,
                        "progress": progress,
                    })

                    # Pequeño delay para no saturar el WS
                    await asyncio.sleep(0.005)
                    i += 1

            # Generar gráficas y enviar URLs al finalizar
            try:
                out_dir = os.path.join(settings.MEDIA_ROOT, "results", str(self.job_id))
                os.makedirs(out_dir, exist_ok=True)
                chart_files = generate_charts(
                    out_dir,
                    list_mun_izq_ancho=list_mun_izq_ancho,
                    list_mun_der_ancho=list_mun_der_ancho,
                    list_mun_izq=list_mun_izq,
                    list_mun_der=list_mun_der,
                    list_angle_axi_izq=list_angle_axi_izq,
                    list_angle_axi_der=list_angle_axi_der,
                    list_head_alt=list_head_alt,
                    list_hip=list_hip,
                    list_stroke_rate=list_stroke_rate,
                    list_aux=list_aux,
                )
                charts_urls = {k: f"{settings.MEDIA_URL}results/{self.job_id}/{v}" for k, v in chart_files.items()}
                await self.send_json({"type": "charts", "images": charts_urls})
            except Exception as chart_err:
                await self.send_json({"type": "text", "text": f"No se pudieron generar gráficas: {chart_err}"})

            # Completar
            await self.send_json({
                "type": "complete",
                "processed_video_url": f"/media/videos/{self.job_id}.mp4",
            })
        except Exception as e:
            await self.send_json({"type": "error", "message": str(e)})
        finally:
            try:
                cap.release()
            except Exception:
                pass

    async def send_json(self, data: dict):
        await self.send(text_data=json.dumps(data))

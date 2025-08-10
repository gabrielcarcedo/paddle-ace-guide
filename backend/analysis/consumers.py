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
        # Procesamiento frame a frame; si OpenCV no está disponible, simulamos datos
        if cv2 is None:
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
                    await self.send_json({"type": "metric", "spm": 40 + i // 10, "strokes": i})
                    await self.send_json({"type": "text", "text": f"Buen ritmo, mantén la cadencia (tick {i})."})
            await self.send_json({"type": "complete", "processed_video_url": f"/media/videos/{self.job_id}.mp4"})
            return

        cap = cv2.VideoCapture(video_path)
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0) or 1
        sent = 0
        strokes = 0
        try:
            while True:
                ok, frame = cap.read()
                if not ok:
                    break

                # Aquí podrías llamar a tus funciones reales (MediaPipe, Numpy, etc.)
                # Para demo, solo convertimos frame a JPEG y lo enviamos como base64
                ret, buf = cv2.imencode(".jpg", frame)
                if not ret:
                    # Si falla, enviamos sin imagen
                    jpg_b64 = None
                else:
                    jpg_b64 = base64.b64encode(buf.tobytes()).decode()

                sent += 1
                progress = min(1.0, sent / total_frames)
                await self.send_json({
                    "type": "frame",
                    "jpg": jpg_b64,
                    "progress": progress,
                })

                # Enviar métricas/textos cada N frames
                if sent % 15 == 0:
                    strokes += 1
                    spm = 35 + (strokes % 10)
                    await self.send_json({"type": "metric", "spm": spm, "strokes": strokes})
                    await self.send_json({"type": "text", "text": f"SPM estimado: {spm}. Ajusta la rotación del tronco."})

                # Pequeño delay para simular procesamiento
                await asyncio.sleep(0.01)

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

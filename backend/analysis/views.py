import json
import os
import uuid
from django.http import JsonResponse, HttpRequest
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings


@csrf_exempt
def start_job(request: HttpRequest):
    if request.method != "POST":
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    file = request.FILES.get("video")
    if not file:
        return JsonResponse({"detail": "'video' file is required"}, status=400)

    job_id = str(uuid.uuid4())
    videos_dir = os.path.join(settings.MEDIA_ROOT, "videos")
    os.makedirs(videos_dir, exist_ok=True)
    out_path = os.path.join(videos_dir, f"{job_id}.mp4")

    with open(out_path, "wb") as dest:
        for chunk in file.chunks():
            dest.write(chunk)

    return JsonResponse(
        {
            "job_id": job_id,
            "original_url": f"/media/videos/{job_id}.mp4",
            "status": "queued",
        }
    )

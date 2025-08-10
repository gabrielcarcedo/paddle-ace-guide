import { API_BASE } from "@/config";

export async function uploadVideo(file: File) {
  const form = new FormData();
  form.append("video", file);

  const res = await fetch(`${API_BASE.replace(/\/$/, "")}/process-video`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  return res.json();
}

export async function startJob(file: File) {
  const form = new FormData();
  form.append("video", file);
  const res = await fetch(`${API_BASE.replace(/\/$/, "")}/start-job`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

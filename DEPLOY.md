# CrowdTrack AI — On-Prem Deployment Guide

This guide is for the edge team receiving a pre-built Docker image.  
No internet access, Node.js, or Python required on the deployment machine.

---

## Prerequisites

| Requirement | CPU deployment | GPU deployment |
|-------------|---------------|----------------|
| Docker Engine 24+ | ✓ | ✓ |
| docker compose v2 | ✓ | ✓ |
| NVIDIA driver 525+ | — | ✓ |
| nvidia-container-toolkit | — | ✓ |

Install nvidia-container-toolkit (GPU only):
```bash
# Ubuntu / Debian
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
sudo apt-get update && sudo apt-get install -y nvidia-container-toolkit
sudo systemctl restart docker
```

---

## Delivery Bundle Contents

```
crowdtrack-delivery.tar.gz
├── docker-compose.yml          ← service definition
├── crowdtrack-ai-cpu.tar.gz    ← pre-built image  (CPU)
│   OR
├── crowdtrack-ai-gpu.tar.gz    ← pre-built image  (GPU)
└── yolo11x.pt                  ← YOLO model weights (must stay in same folder)
```

---

## Step 1 — Unpack

```bash
tar -xzf crowdtrack-delivery.tar.gz
cd crowdtrack-delivery/
```

Confirm the model file is present:
```bash
ls -lh yolo11x.pt      # should show the file, non-zero size
```

---

## Step 2 — Load the Docker image

```bash
# CPU image
docker load < crowdtrack-ai-cpu.tar.gz

# OR GPU image
docker load < crowdtrack-ai-gpu.tar.gz
```

Verify it loaded:
```bash
docker images | grep crowdtrack-ai
```

---

## Step 3 — Start the service

**CPU deployment (default):**
```bash
docker compose up -d
```

**GPU deployment (NVIDIA):**
```bash
docker compose --profile gpu up -d
```

---

## Step 4 — Verify it is running

```bash
# Check container status
docker compose ps

# Check health endpoint
curl http://localhost:8000/api/health
# Expected: {"status":"ok"}
```

Open the web UI in a browser:
```
http://<server-ip>:8000
```

---

## Changing the port

Edit `docker-compose.yml` before starting:
```yaml
ports:
  - "9000:8000"   # expose on port 9000 instead
```

---

## Persistent data

Uploaded videos and annotated outputs are stored in named Docker volumes:

| Volume | Contents |
|--------|----------|
| `crowdtrack_uploads` | Temporary upload files (auto-deleted after processing) |
| `crowdtrack_outputs` | Annotated MP4 output videos |

To back up outputs:
```bash
docker run --rm \
  -v crowdtrack_outputs:/data \
  -v $(pwd):/backup \
  alpine tar -czf /backup/outputs-backup.tar.gz /data
```

---

## Stopping and restarting

```bash
docker compose down          # stop (data volumes preserved)
docker compose down -v       # stop AND delete all data volumes
docker compose up -d         # restart
```

---

## Logs

```bash
docker compose logs -f                  # live logs
docker compose logs --tail 100          # last 100 lines
```

---

## Resource limits (pre-configured)

| Deployment | Memory cap | CPU cap |
|------------|-----------|---------|
| CPU | 8 GB | 4 cores |
| GPU | 16 GB | unlimited |

To adjust, edit the `deploy.resources.limits` section in `docker-compose.yml` before starting.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Container exits immediately | `yolo11x.pt` missing or wrong path | Confirm file is in the same folder as `docker-compose.yml` |
| Health check fails for >60s | Model still loading | Wait; check `docker compose logs` |
| `CUDA error: no kernel image` | Wrong image (CPU loaded on GPU host) | Load the GPU image instead |
| `nvidia-smi` not found in container | nvidia-container-toolkit not installed | Follow Prerequisites section above |
| Port 8000 already in use | Another service on the host | Change the port mapping in `docker-compose.yml` |

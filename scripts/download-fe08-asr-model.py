"""Descarga explícita del modelo de prueba; el runtime HOMEX nunca lo descarga."""
from __future__ import annotations
import sys
from pathlib import Path
from huggingface_hub import snapshot_download
destino = Path(sys.argv[1]).resolve()
snapshot_download(
    repo_id="Systran/faster-whisper-base",
    local_dir=destino,
)
if not (destino / "model.bin").is_file():
    raise SystemExit("El modelo ASR descargado no contiene model.bin")
print(f"fe08-asr-model-ok path={destino}")

"""Descarga explícita del modelo de prueba; el runtime HOMEX nunca lo descarga."""
from __future__ import annotations
import sys
from pathlib import Path
from hashlib import sha256
from huggingface_hub import snapshot_download
destino = Path(sys.argv[1]).resolve()
snapshot_download(
    repo_id="Systran/faster-whisper-small",
    revision="536b0662742c02347bc0e980a01041f333bce120",
    local_dir=destino,
)
if not (destino / "model.bin").is_file():
    raise SystemExit("El modelo ASR descargado no contiene model.bin")
if sha256((destino / "model.bin").read_bytes()).hexdigest() != "3e305921506d8872816023e4c273e75d2419fb89b24da97b4fe7bce14170d671":
    raise SystemExit("El modelo Small no coincide con el hash auditado")
print(f"fe08-asr-model-ok path={destino}")

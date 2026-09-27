"""Verifica evidencia FE08 en PostgreSQL y en el almacenamiento efímero."""
from __future__ import annotations
import os
import sys
from pathlib import Path
sys.path.insert(0, str(Path.cwd()))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.integration")
import django
django.setup()
from django.conf import settings
from apps.capturas.models import Captura, IntentoCaptura, ItemHumano
from apps.movimientos_stock.models import MovimientoStock
from apps.notas_entrega.models import NotaEntrega
from apps.ordenes_trabajo.models import OrdenTrabajo
from apps.pedidos.models import Pedido
from apps.recibos.models import Recibo
assert Pedido.objects.exists(), "El flujo comercial no creó pedidos."
assert OrdenTrabajo.objects.exists(), "No se creó la OT automática."
assert MovimientoStock.objects.filter(tipo_movimiento__codigo="VENTA").exists()
assert MovimientoStock.objects.filter(tipo_movimiento__codigo="REVERSA_VENTA").exists()
assert Recibo.objects.filter(estado="ANULADO").exists()
assert NotaEntrega.objects.exists()
assert Captura.objects.filter(estado="COMPLETADA", texto_transcrito__isnull=False).exists()
assert IntentoCaptura.objects.filter(estado="FINALIZADO", modelo_asr_version__isnull=False, resultado_raw__isnull=False).exists()
assert ItemHumano.objects.exists(), "La revisión HITL no persistió evidencia humana."
temporales = [p for p in settings.HOMEX_AUDIO_TEMP_ROOT.glob("*") if p.is_file()]
assert temporales == [], f"Quedaron audios temporales: {temporales}"
print("fe08-backend-evidence-ok")

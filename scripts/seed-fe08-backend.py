"""Datos mínimos, deterministas y comerciales para el E2E real FE08."""
from __future__ import annotations
import os
import sys
from pathlib import Path
sys.path.insert(0, str(Path.cwd()))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.integration")
import django
django.setup()
from django.contrib.auth import get_user_model
from django.utils import timezone
from apps.catalogo.models import Producto, ValorCatalogo
from apps.clientes.models import Cliente
from apps.movimientos_stock.models import MovimientoStock

def valor(concepto: str, codigo: str) -> ValorCatalogo:
    return ValorCatalogo.objects.get(concepto__codigo=concepto, codigo=codigo)

usuario, _ = get_user_model().objects.get_or_create(username="fe08-admin")
usuario.first_name = "Integración"
usuario.last_name = "FE08"
usuario.is_staff = True
usuario.is_superuser = True
usuario.set_password("fe08-integration-only")
usuario.save()
Cliente.objects.get_or_create(
    celular="70000008",
    defaults={
        "tipo_cliente": valor("TIPO_CLIENTE", "PERSONA"),
        "nombres": "Cliente",
        "apellidos": "Integración FE08",
        "direccion": "Tienda HOMEX",
        "activo": True,
        "created_by": usuario,
        "updated_by": usuario,
    },
)
producto, creado = Producto.objects.get_or_create(
    sku="FE08-SILLA-001",
    defaults={
        "categoria": valor("CATEGORIA_PRODUCTO", "OTRO"),
        "nombre": "Silla integración FE08",
        "precio_lista": "250.00",
        "stock": 0,
        "unidad_stock": valor("UNIDAD_MEDIDA", "PIEZA"),
        "activo": True,
        "created_by": usuario,
        "updated_by": usuario,
    },
)
if creado:
    MovimientoStock.objects.create(
        producto=producto,
        tipo_movimiento=valor("TIPO_MOVIMIENTO", "CARGA_INICIAL"),
        cantidad=20,
        fecha=timezone.now(),
        observaciones="Stock reproducible para FE08",
        created_by=usuario,
    )
print(f"fe08-seed-ok user={usuario.id} product={producto.id}")

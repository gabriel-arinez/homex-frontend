<script setup lang="ts">
import { computed } from 'vue'
import type { ImagenPrincipal } from '@/generated/api'
import {
  extractSpecSheetData,
  formatDocCurrency,
  formatDocDate,
  type SpecSheetData,
} from '../utils/proformaDocumentFormatters'

export interface DocumentLineItem {
  id?: number | null
  localId?: string
  producto?: number | null
  nombre: string
  descripcion?: string | null
  tipo_item?: string | number | null
  tipo_item_label?: string | null
  cantidad: number | string
  unidad?: string | number | null
  unidad_label?: string | null
  precio_unitario?: number | string | null
  descuento?: number | string | null
  modo_calculo?: string | null
  importe_negociado?: number | string | null
  total_calculado?: number | null
  especificacion?: {
    datos_tecnicos?: unknown
    observaciones?: string | null
  } | null
  // URL de imagen resuelta directamente para evitar dependencias asíncronas dentro de la hoja
  imagen_url?: string | null
}

export interface DocumentClientInfo {
  nombres?: string | null
  apellidos?: string | null
  empresa?: string | null
  celular?: string | null
  telefono?: string | null
  email?: string | null
  direccion?: string | null
  ciudad?: string | null
  documento?: string | null
  nit?: string | null
}

export interface DocumentConditions {
  porcentaje_adelanto?: number | string | null
  plazo_entrega?: string | null
  validez_oferta?: number | string | null
  observaciones?: string | null
}

export interface ProformaDocumentProps {
  numero?: number | string | null
  fecha?: string | null
  titulo?: string | null
  monedaCodigo?: string
  monedaNombre?: string
  estadoCodigo?: string
  estadoNombre?: string
  cliente?: DocumentClientInfo | null
  condiciones?: DocumentConditions | null
  lineas: DocumentLineItem[]
  subtotal?: number | null
  descuentoTotal?: number | null
  total?: number | null
  // Mapas opcionales si no se pasaron las URLs en las líneas
  catalogImages?: Record<number, ImagenPrincipal | null>
  furnitureCovers?: Record<string, string | null>
}

const props = withDefaults(defineProps<ProformaDocumentProps>(), {
  numero: null,
  fecha: null,
  titulo: '',
  monedaCodigo: 'BOB',
  monedaNombre: 'Bolivianos',
  estadoCodigo: 'BORRADOR',
  estadoNombre: 'Borrador',
  cliente: null,
  condiciones: null,
  subtotal: null,
  descuentoTotal: null,
  total: null,
  catalogImages: () => ({}),
  furnitureCovers: () => ({}),
})

const clientDisplayName = computed(() => {
  if (!props.cliente) return 'Cliente sin especificar'
  if (props.cliente.empresa?.trim()) return props.cliente.empresa.trim()
  const names = [props.cliente.nombres, props.cliente.apellidos].filter(Boolean).join(' ').trim()
  return names || 'Cliente particular'
})

const clientDocument = computed(() => {
  if (!props.cliente) return null
  return props.cliente.nit?.trim() || props.cliente.documento?.trim() || null
})

const clientPhones = computed(() => {
  if (!props.cliente) return null
  return [props.cliente.celular, props.cliente.telefono].filter(Boolean).join(' / ') || null
})

function resolveLineImage(line: DocumentLineItem): string | null {
  if (line.imagen_url) return line.imagen_url
  if (line.producto && props.catalogImages[line.producto]) {
    const img = props.catalogImages[line.producto]
    return img?.variantes?.['640'] ?? img?.variantes?.['320'] ?? img?.original ?? null
  }
  const coverKey = line.id ? `detail:${props.numero ?? ''}:${line.id}` : ''
  if (coverKey && props.furnitureCovers[coverKey]) {
    return props.furnitureCovers[coverKey]
  }
  return null
}

function lineSpecs(line: DocumentLineItem): SpecSheetData {
  return extractSpecSheetData(
    line.especificacion?.datos_tecnicos,
    line.especificacion?.observaciones,
  )
}

function formatQuantity(val: string | number | null | undefined): string {
  if (val == null || val === '') return '1'
  const num = Number(val)
  if (!Number.isFinite(num)) return String(val)
  return num === Math.trunc(num) ? String(Math.trunc(num)) : num.toFixed(2)
}

const calculatedSubtotal = computed(() => {
  if (props.subtotal !== null && props.subtotal !== undefined) return props.subtotal
  return props.lineas.reduce((acc, l) => acc + (l.total_calculado ?? 0), 0)
})

const calculatedTotal = computed(() => {
  if (props.total !== null && props.total !== undefined) return props.total
  return calculatedSubtotal.value - (props.descuentoTotal ?? 0)
})
</script>

<template>
  <article class="proforma-sheet" aria-label="Cotización comercial HOMEX">
    <!-- Encabezado Institucional -->
    <header class="sheet-header">
      <div class="sheet-header__brand">
        <div class="sheet-logo">
          <span class="sheet-logo__badge" aria-hidden="true">H</span>
          <div class="sheet-logo__copy">
            <strong class="sheet-logo__title">HOMEX</strong>
            <span class="sheet-logo__tagline">DISEÑO & MOBILIARIO</span>
          </div>
        </div>
        <p class="sheet-header__address">
          Soluciones integrales de equipamiento corporativo y residencial<br />
          Bolivia · ventas@homex.com.bo · www.homex.com.bo
        </p>
      </div>

      <div class="sheet-header__meta">
        <span class="sheet-header__kicker">PROFORMA – COTIZACIÓN</span>
        <h1 class="sheet-header__number">
          {{ numero ? `Nº ${numero}` : 'Borrador' }}
        </h1>
        <p class="sheet-header__date">
          <strong>Emisión:</strong> {{ formatDocDate(fecha) }}
        </p>
        <p v-if="condiciones?.validez_oferta" class="sheet-header__validity">
          <strong>Validez:</strong> {{ condiciones.validez_oferta }} días calendario
        </p>
      </div>
    </header>

    <div class="sheet-divider sheet-divider--thick"></div>

    <!-- Bloque de Información: Cliente y Cotización -->
    <section class="sheet-info-grid" aria-label="Información comercial y del cliente">
      <div class="sheet-info-block">
        <h2 class="sheet-info-block__title">DATOS DEL CLIENTE</h2>
        <div class="sheet-info-block__content">
          <p class="sheet-info-client-name">{{ clientDisplayName }}</p>
          <p v-if="clientDocument" class="sheet-info-row">
            <span class="sheet-info-label">NIT / CI:</span>
            <span>{{ clientDocument }}</span>
          </p>
          <p v-if="clientPhones" class="sheet-info-row">
            <span class="sheet-info-label">Contacto:</span>
            <span>{{ clientPhones }}</span>
          </p>
          <p v-if="cliente?.email" class="sheet-info-row">
            <span class="sheet-info-label">Correo:</span>
            <span>{{ cliente.email }}</span>
          </p>
          <p v-if="cliente?.direccion || cliente?.ciudad" class="sheet-info-row">
            <span class="sheet-info-label">Dirección:</span>
            <span>{{ [cliente.direccion, cliente.ciudad].filter(Boolean).join(', ') }}</span>
          </p>
        </div>
      </div>

      <div class="sheet-info-block">
        <h2 class="sheet-info-block__title">DATOS DE LA COTIZACIÓN</h2>
        <div class="sheet-info-block__content">
          <p class="sheet-info-row">
            <span class="sheet-info-label">Referencia:</span>
            <strong class="sheet-info-reference">{{ titulo || 'Cotización comercial' }}</strong>
          </p>
          <p class="sheet-info-row">
            <span class="sheet-info-label">Moneda:</span>
            <span>{{ monedaCodigo }} ({{ monedaNombre }})</span>
          </p>
          <p class="sheet-info-row">
            <span class="sheet-info-label">Estado:</span>
            <span class="sheet-status-badge" :data-status="estadoCodigo">
              {{ estadoNombre || 'Borrador comercial' }}
            </span>
          </p>
          <p v-if="condiciones?.plazo_entrega" class="sheet-info-row">
            <span class="sheet-info-label">Plazo estimado:</span>
            <span>{{ condiciones.plazo_entrega }}</span>
          </p>
        </div>
      </div>
    </section>

    <!-- Listado de Fichas de Productos -->
    <section class="sheet-products" aria-label="Detalle de productos cotizados">
      <div class="sheet-section-heading">
        <h2 class="sheet-section-title">DETALLE DE PRODUCTOS Y ESPECIFICACIONES</h2>
        <span class="sheet-section-count">{{ lineas.length }} {{ lineas.length === 1 ? 'ítem' : 'ítems' }}</span>
      </div>

      <div v-if="lineas.length === 0" class="sheet-products__empty">
        <p>No se han registrado productos en esta cotización.</p>
      </div>

      <div v-else class="sheet-items-list">
        <article
          v-for="(line, idx) in lineas"
          :key="line.localId || line.id || idx"
          class="product-card"
        >
          <!-- Cabecera de la ficha del producto -->
          <header class="product-card__header">
            <div class="product-card__identity">
              <span class="product-card__item-num">ÍTEM {{ String(idx + 1).padStart(2, '0') }}</span>
              <h3 class="product-card__title">{{ line.nombre }}</h3>
            </div>
            <span v-if="line.tipo_item_label" class="product-card__type-badge">
              {{ line.tipo_item_label }}
            </span>
          </header>

          <!-- Cuerpo de la ficha: Adaptativo según presencia de imagen -->
          <div
            class="product-card__body"
            :class="{ 'product-card__body--with-image': Boolean(resolveLineImage(line)) }"
          >
            <!-- Columna de imagen (Solo se renderiza si hay imagen) -->
            <div v-if="resolveLineImage(line)" class="product-card__image-col">
              <div class="product-card__image-wrapper">
                <img
                  :src="resolveLineImage(line)!"
                  :alt="`Fotografía de referencia de ${line.nombre}`"
                  class="product-card__image"
                  loading="lazy"
                />
              </div>
            </div>

            <!-- Columna de especificaciones y descripción (Ocupa 100% si no hay imagen) -->
            <div class="product-card__specs-col">
              <p v-if="line.descripcion" class="product-card__description">
                {{ line.descripcion }}
              </p>

              <!-- Especificaciones estructuradas -->
              <div class="specs-grid">
                <!-- Dimensiones -->
                <div v-if="lineSpecs(line).dimensiones.length" class="spec-group">
                  <span class="spec-group__title">Dimensiones</span>
                  <div class="spec-pills">
                    <span
                      v-for="dim in lineSpecs(line).dimensiones"
                      :key="dim.label"
                      class="spec-pill"
                    >
                      <strong>{{ dim.label }}:</strong> {{ dim.value }}
                    </span>
                  </div>
                </div>

                <!-- Materiales y Espesores -->
                <div v-if="lineSpecs(line).materiales.length" class="spec-group">
                  <span class="spec-group__title">Materialidad</span>
                  <p class="spec-text">{{ lineSpecs(line).materiales.join(' · ') }}</p>
                </div>

                <!-- Colores y Acabados -->
                <div v-if="lineSpecs(line).colores.length || lineSpecs(line).acabados.length" class="spec-group">
                  <span class="spec-group__title">Color y Acabado</span>
                  <p class="spec-text">
                    {{ [...lineSpecs(line).colores, ...lineSpecs(line).acabados].join(' · ') }}
                  </p>
                </div>

                <!-- Componentes técnicos -->
                <div v-if="lineSpecs(line).componentes.length" class="spec-group">
                  <span class="spec-group__title">Componentes</span>
                  <ul class="spec-components-list">
                    <li
                      v-for="(comp, cIdx) in lineSpecs(line).componentes"
                      :key="cIdx"
                      class="spec-component-item"
                    >
                      <strong>{{ comp.nombre }}</strong>
                      <span v-if="comp.detalle"> — {{ comp.detalle }}</span>
                    </li>
                  </ul>
                </div>

                <!-- Accesorios -->
                <div v-if="lineSpecs(line).accesorios.length" class="spec-group">
                  <span class="spec-group__title">Accesorios y Herrajes</span>
                  <p class="spec-text">{{ lineSpecs(line).accesorios.join(', ') }}</p>
                </div>

                <!-- Observaciones técnicas de la ficha -->
                <div v-if="lineSpecs(line).observaciones" class="spec-group spec-group--notes">
                  <span class="spec-group__title">Observaciones Técnicas</span>
                  <p class="spec-text spec-text--italic">{{ lineSpecs(line).observaciones }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Resumen comercial de la ficha del producto -->
          <footer class="product-card__footer">
            <div class="product-card__commercial-left">
              <template v-if="line.modo_calculo === 'TOTAL_NEGOCIADO'">
                <span class="commercial-badge commercial-badge--negotiated">Modalidad: Importe total acordado</span>
              </template>
              <template v-else>
                <div class="commercial-metric">
                  <span class="commercial-metric__label">Cantidad:</span>
                  <strong class="commercial-metric__val">
                    {{ formatQuantity(line.cantidad) }} {{ line.unidad_label || 'unidad' }}
                  </strong>
                </div>
                <div class="commercial-metric">
                  <span class="commercial-metric__label">Precio unitario:</span>
                  <span class="commercial-metric__val">
                    {{ formatDocCurrency(line.precio_unitario, monedaCodigo) }}
                  </span>
                </div>
                <div v-if="Number(line.descuento) > 0" class="commercial-metric">
                  <span class="commercial-metric__label">Descuento:</span>
                  <span class="commercial-metric__val commercial-metric__val--discount">
                    -{{ formatDocCurrency(line.descuento, monedaCodigo) }}
                  </span>
                </div>
              </template>
            </div>

            <div class="product-card__commercial-right">
              <span class="commercial-subtotal-label">Subtotal ítem:</span>
              <strong class="commercial-subtotal-value">
                {{ formatDocCurrency(line.total_calculado, monedaCodigo) }}
              </strong>
            </div>
          </footer>
        </article>
      </div>
    </section>

    <!-- Resumen Económico General -->
    <section class="sheet-summary-section" aria-label="Resumen económico definitivo">
      <div class="sheet-summary-grid">
        <div class="sheet-summary-left">
          <!-- Espacio institucional para notas o aclaraciones -->
          <div class="sheet-legal-notes">
            <strong>Condiciones de entrega e instalación:</strong>
            <p>
              Los precios incluyen fabricación e instalación según especificaciones detalladas.
              Cualquier modificación en medidas, materiales o acabados posterior a la aprobación
              podrá incidir en los costos y plazos acordados.
            </p>
          </div>
        </div>

        <div class="sheet-summary-right">
          <div class="sheet-summary-totals">
            <div class="summary-line">
              <span>Subtotal general:</span>
              <span>{{ formatDocCurrency(calculatedSubtotal, monedaCodigo) }}</span>
            </div>
            <div v-if="descuentoTotal && descuentoTotal > 0" class="summary-line summary-line--discount">
              <span>Descuento global:</span>
              <span>-{{ formatDocCurrency(descuentoTotal, monedaCodigo) }}</span>
            </div>
            <div class="summary-line summary-line--total">
              <span>TOTAL COTIZACIÓN:</span>
              <strong>{{ formatDocCurrency(calculatedTotal, monedaCodigo) }}</strong>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Condiciones Comerciales -->
    <section class="sheet-conditions-section" aria-label="Condiciones comerciales de la cotización">
      <h2 class="sheet-conditions-title">CONDICIONES COMERCIALES</h2>
      <div class="sheet-conditions-grid">
        <div class="condition-box">
          <span class="condition-box__label">Anticipo requerido</span>
          <strong class="condition-box__value">
            {{ condiciones?.porcentaje_adelanto != null && condiciones.porcentaje_adelanto !== '' ? `${condiciones.porcentaje_adelanto}%` : '50%' }}
          </strong>
          <small class="condition-box__desc">A la confirmación de la cotización, saldo contra entrega.</small>
        </div>

        <div class="condition-box">
          <span class="condition-box__label">Plazo de entrega</span>
          <strong class="condition-box__value">
            {{ condiciones?.plazo_entrega || 'A coordinar con producción' }}
          </strong>
          <small class="condition-box__desc">Computable a partir del anticipo y validación de medidas.</small>
        </div>

        <div class="condition-box">
          <span class="condition-box__label">Validez de la oferta</span>
          <strong class="condition-box__value">
            {{ condiciones?.validez_oferta ? `${condiciones.validez_oferta} días` : '15 días' }}
          </strong>
          <small class="condition-box__desc">Precios sujetos a confirmación posterior al vencimiento.</small>
        </div>
      </div>

      <div v-if="condiciones?.observaciones" class="sheet-conditions-obs">
        <span class="condition-obs-label">Observaciones generales:</span>
        <p class="condition-obs-text">{{ condiciones.observaciones }}</p>
      </div>
    </section>

    <!-- Cierre Institucional y Firmas -->
    <section class="sheet-signatures-section" aria-label="Firmas y aprobación">
      <div class="signatures-grid">
        <div class="signature-col">
          <div class="signature-line"></div>
          <strong class="signature-name">HOMEX MOBILIARIO</strong>
          <span class="signature-role">Asesor Comercial Autorizado</span>
        </div>

        <div class="signature-col">
          <div class="signature-line"></div>
          <strong class="signature-name">{{ clientDisplayName }}</strong>
          <span class="signature-role">Aceptación y Aprobación del Cliente</span>
        </div>
      </div>
    </section>

    <!-- Pie de página Institucional -->
    <footer class="sheet-footer">
      <span>HOMEX · Mobiliario Corporativo & Residencial</span>
      <span>Proforma {{ numero ? `#${numero}` : 'Borrador' }} · {{ formatDocDate(fecha) }}</span>
      <span>Documento comercial oficial</span>
    </footer>
  </article>
</template>

<style scoped>
/* =========================================================================
   ESTILOS DE LA HOJA DE COTIZACIÓN (TAMAÑO CARTA: 216 × 279 mm)
   Diseño institucional: blanco, escala de grises sutil y acento rojo HOMEX
   ========================================================================= */

.proforma-sheet {
  width: 216mm;
  min-height: 279mm;
  background-color: #ffffff;
  color: #171717;
  padding: 16mm 18mm;
  box-sizing: border-box;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  font-size: 11px;
  line-height: 1.45;
  margin: 0 auto;
  position: relative;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
  border: 1px solid #e5e5e5;
}

/* Encabezado */
.sheet-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
}

.sheet-header__brand {
  flex: 1;
}

.sheet-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.sheet-logo__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background-color: #dc2626;
  color: #ffffff;
  font-weight: 800;
  font-size: 18px;
  border-radius: 6px;
  letter-spacing: -0.05em;
}

.sheet-logo__copy {
  display: flex;
  flex-direction: column;
}

.sheet-logo__title {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 0.12em;
  color: #171717;
  line-height: 1;
}

.sheet-logo__tagline {
  font-size: 8px;
  font-weight: 600;
  letter-spacing: 0.16em;
  color: #dc2626;
  margin-top: 2px;
}

.sheet-header__address {
  font-size: 9.5px;
  color: #525252;
  margin: 0;
  line-height: 1.35;
}

.sheet-header__meta {
  text-align: right;
  min-width: 180px;
}

.sheet-header__kicker {
  display: inline-block;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: #dc2626;
  text-transform: uppercase;
}

.sheet-header__number {
  font-size: 20px;
  font-weight: 800;
  color: #171717;
  margin: 2px 0 4px 0;
  line-height: 1.1;
}

.sheet-header__date,
.sheet-header__validity {
  font-size: 9.5px;
  color: #525252;
  margin: 1px 0;
}

/* Divisor sutil */
.sheet-divider {
  height: 1px;
  background-color: #e5e5e5;
  margin: 12px 0;
}

.sheet-divider--thick {
  height: 2px;
  background-color: #dc2626;
  margin: 14px 0;
}

/* Grilla de información de Cliente y Cotización */
.sheet-info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-bottom: 16px;
}

.sheet-info-block {
  background-color: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 10px 12px;
}

.sheet-info-block__title {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #64748b;
  text-transform: uppercase;
  margin: 0 0 6px 0;
  padding-bottom: 4px;
  border-bottom: 1px solid #e2e8f0;
}

.sheet-info-client-name {
  font-size: 13px;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 4px 0;
}

.sheet-info-row {
  display: flex;
  margin: 2px 0;
  font-size: 10px;
  line-height: 1.4;
}

.sheet-info-label {
  width: 90px;
  color: #64748b;
  font-weight: 500;
  flex-shrink: 0;
}

.sheet-info-reference {
  color: #0f172a;
}

.sheet-status-badge {
  display: inline-block;
  font-size: 9px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  background-color: #e2e8f0;
  color: #334155;
}

.sheet-status-badge[data-status="APROBADA"] {
  background-color: #dcfce7;
  color: #166534;
}

.sheet-status-badge[data-status="EN_REVISION"] {
  background-color: #fef9c3;
  color: #854d0e;
}

/* Fichas de Productos */
.sheet-section-heading {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin: 16px 0 8px 0;
  padding-bottom: 4px;
  border-bottom: 1.5px solid #0f172a;
}

.sheet-section-title {
  font-size: 10.5px;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: #0f172a;
  text-transform: uppercase;
  margin: 0;
}

.sheet-section-count {
  font-size: 9.5px;
  color: #64748b;
  font-weight: 600;
}

.sheet-items-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.product-card {
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background-color: #ffffff;
  overflow: hidden;
  page-break-inside: avoid;
  break-inside: avoid;
}

.product-card__header {
  background-color: #f1f5f9;
  border-bottom: 1px solid #cbd5e1;
  padding: 6px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.product-card__identity {
  display: flex;
  align-items: center;
  gap: 8px;
}

.product-card__item-num {
  font-size: 9px;
  font-weight: 700;
  color: #dc2626;
  background-color: #fee2e2;
  padding: 2px 5px;
  border-radius: 3px;
  letter-spacing: 0.05em;
}

.product-card__title {
  font-size: 12px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}

.product-card__type-badge {
  font-size: 9px;
  font-weight: 600;
  color: #475569;
  background-color: #e2e8f0;
  padding: 1px 6px;
  border-radius: 3px;
}

/* Cuerpo adaptativo */
.product-card__body {
  padding: 10px 12px;
  display: block;
}

.product-card__body--with-image {
  display: grid;
  grid-template-columns: 160px 1fr;
  gap: 14px;
}

.product-card__image-col {
  display: flex;
  align-items: flex-start;
  justify-content: center;
}

.product-card__image-wrapper {
  width: 100%;
  max-height: 150px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  padding: 4px;
  overflow: hidden;
}

.product-card__image {
  max-width: 100%;
  max-height: 140px;
  width: auto;
  height: auto;
  object-fit: contain;
  display: block;
}

.product-card__specs-col {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.product-card__description {
  font-size: 10.5px;
  color: #334155;
  margin: 0 0 6px 0;
  line-height: 1.4;
}

.specs-grid {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.spec-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.spec-group__title {
  font-size: 8.5px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: #64748b;
  text-transform: uppercase;
}

.spec-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.spec-pill {
  font-size: 9.5px;
  background-color: #f1f5f9;
  border: 1px solid #e2e8f0;
  padding: 2px 6px;
  border-radius: 4px;
  color: #1e293b;
}

.spec-text {
  font-size: 9.5px;
  color: #1e293b;
  margin: 0;
  line-height: 1.35;
}

.spec-text--italic {
  font-style: italic;
  color: #475569;
}

.spec-components-list {
  margin: 0;
  padding-left: 14px;
  font-size: 9.5px;
  color: #1e293b;
}

.spec-component-item {
  margin: 1px 0;
}

/* Pie comercial de la ficha */
.product-card__footer {
  background-color: #f8fafc;
  border-top: 1px solid #e2e8f0;
  padding: 6px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.product-card__commercial-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.commercial-metric {
  font-size: 9.5px;
  color: #475569;
}

.commercial-metric__label {
  margin-right: 4px;
}

.commercial-metric__val {
  color: #0f172a;
}

.commercial-metric__val--discount {
  color: #dc2626;
  font-weight: 600;
}

.commercial-badge--negotiated {
  font-size: 9.5px;
  font-weight: 600;
  color: #0369a1;
  background-color: #e0f2fe;
  padding: 2px 6px;
  border-radius: 3px;
}

.product-card__commercial-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.commercial-subtotal-label {
  font-size: 9.5px;
  font-weight: 600;
  color: #475569;
}

.commercial-subtotal-value {
  font-size: 12px;
  font-weight: 800;
  color: #0f172a;
}

/* Resumen Económico General */
.sheet-summary-section {
  margin-top: 14px;
  padding: 10px 0;
  page-break-inside: avoid;
  break-inside: avoid;
}

.sheet-summary-grid {
  display: grid;
  grid-template-columns: 1fr 240px;
  gap: 16px;
  align-items: start;
}

.sheet-legal-notes {
  background-color: #f8fafc;
  border-left: 3px solid #cbd5e1;
  padding: 8px 10px;
  font-size: 8.5px;
  color: #64748b;
  line-height: 1.4;
}

.sheet-legal-notes strong {
  color: #334155;
  display: block;
  margin-bottom: 2px;
}

.sheet-summary-totals {
  background-color: #f8fafc;
  border: 1.5px solid #cbd5e1;
  border-radius: 6px;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.summary-line {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: #475569;
}

.summary-line--discount {
  color: #dc2626;
  font-weight: 600;
}

.summary-line--total {
  font-size: 13px;
  font-weight: 800;
  color: #dc2626;
  border-top: 1.5px solid #cbd5e1;
  margin-top: 4px;
  padding-top: 4px;
}

/* Condiciones Comerciales */
.sheet-conditions-section {
  margin-top: 14px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background-color: #ffffff;
  padding: 10px 12px;
  page-break-inside: avoid;
  break-inside: avoid;
}

.sheet-conditions-title {
  font-size: 9.5px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: #0f172a;
  text-transform: uppercase;
  margin: 0 0 8px 0;
}

.sheet-conditions-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.condition-box {
  background-color: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
}

.condition-box__label {
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: #64748b;
  text-transform: uppercase;
  margin-bottom: 2px;
}

.condition-box__value {
  font-size: 11px;
  font-weight: 700;
  color: #0f172a;
}

.condition-box__desc {
  font-size: 7.5px;
  color: #64748b;
  margin-top: 2px;
  line-height: 1.25;
}

.sheet-conditions-obs {
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px dashed #cbd5e1;
  font-size: 9px;
}

.condition-obs-label {
  font-weight: 700;
  color: #475569;
  margin-right: 4px;
}

.condition-obs-text {
  display: inline;
  color: #1e293b;
  margin: 0;
}

/* Firmas */
.sheet-signatures-section {
  margin-top: 24px;
  page-break-inside: avoid;
  break-inside: avoid;
}

.signatures-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 40px;
  padding: 0 20px;
}

.signature-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.signature-line {
  width: 100%;
  max-width: 200px;
  height: 1px;
  background-color: #475569;
  margin-bottom: 6px;
}

.signature-name {
  font-size: 9.5px;
  font-weight: 700;
  color: #0f172a;
}

.signature-role {
  font-size: 8px;
  color: #64748b;
}

/* Pie de página */
.sheet-footer {
  margin-top: 20px;
  padding-top: 8px;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  font-size: 7.5px;
  color: #94a3b8;
}

/* =========================================================================
   REGLAS PARA IMPRESIÓN DIRECTA (@media print)
   ========================================================================= */
@page {
  size: letter portrait;
  margin: 10mm 12mm;
}

@media print {
  .proforma-sheet {
    width: 100% !important;
    min-height: auto !important;
    padding: 0 !important;
    box-shadow: none !important;
    border: none !important;
    background: #ffffff !important;
    color: #000000 !important;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  .product-card,
  .sheet-summary-section,
  .sheet-conditions-section,
  .sheet-signatures-section {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
}
</style>

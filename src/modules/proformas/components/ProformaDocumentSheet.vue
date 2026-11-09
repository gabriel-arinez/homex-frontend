<script setup lang="ts">
import { computed } from 'vue'
import GalleryPhoto from '@/shared/media/GalleryPhoto.vue'
import {
  extractSpecSheetData,
  formatDocCurrency,
  formatDocDate,
  formatDocQuantity,
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
  // URLs de imagen autenticadas o relativas
  imagen_url?: string | null
  imagenes_complementarias?: string[]
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
  vendedorNombre?: string | null
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
  vendedorNombre: null,
})

const isBorrador = computed(() => {
  return !props.estadoCodigo || props.estadoCodigo === 'BORRADOR'
})

const isEmitida = computed(() => {
  return ['EMITIDA', 'APROBADA', 'EN_REVISION', 'ENVIADA'].includes(props.estadoCodigo)
})

const clientHasData = computed(() => {
  if (!props.cliente) return false
  return Boolean(
    props.cliente.empresa?.trim() ||
      props.cliente.nombres?.trim() ||
      props.cliente.apellidos?.trim() ||
      props.cliente.nit?.trim() ||
      props.cliente.documento?.trim() ||
      props.cliente.celular?.trim(),
  )
})

const clientDisplayName = computed(() => {
  if (!clientHasData.value) return 'Cliente sin asignar (Provisional)'
  if (props.cliente?.empresa?.trim()) return props.cliente.empresa.trim()
  const names = [props.cliente?.nombres, props.cliente?.apellidos].filter(Boolean).join(' ').trim()
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

function lineSpecs(line: DocumentLineItem): SpecSheetData {
  return extractSpecSheetData(
    line.especificacion?.datos_tecnicos,
    line.especificacion?.observaciones,
  )
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
          Bolivia
        </p>
      </div>

      <div class="sheet-header__meta">
        <span class="sheet-header__kicker">
          {{ isBorrador ? 'PROFORMA – COTIZACIÓN (BORRADOR)' : 'PROFORMA – COTIZACIÓN' }}
        </span>
        <h1 class="sheet-header__number">
          {{ numero ? `Nº ${numero}` : 'Borrador' }}
        </h1>
        <p class="sheet-header__date"><strong>Emisión:</strong> {{ formatDocDate(fecha) }}</p>
        <p v-if="condiciones?.validez_oferta" class="sheet-header__validity">
          <strong>Validez de la oferta:</strong> {{ condiciones.validez_oferta }} días calendario
        </p>
      </div>
    </header>

    <div class="sheet-divider sheet-divider--thick"></div>

    <!-- Bloque de Información: Cliente y Cotización -->
    <section class="sheet-info-grid" aria-label="Información comercial y del cliente">
      <div class="sheet-info-block">
        <h2 class="sheet-info-block__title">DATOS DEL CLIENTE</h2>
        <div class="sheet-info-block__content">
          <p
            class="sheet-info-client-name"
            :class="{ 'sheet-info-client-name--provisional': !clientHasData }"
          >
            {{ clientDisplayName }}
          </p>
          <template v-if="clientHasData">
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
          </template>
          <template v-else>
            <p class="sheet-info-empty-hint">
              Documento preliminar: Datos de contacto pendientes de asignación.
            </p>
          </template>
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
              {{ estadoNombre || (isBorrador ? 'Borrador' : 'Vigente') }}
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
        <h2 class="sheet-section-title">DETALLE DE PRODUCTOS Y ESPECIFICACIONES TÉCNICAS</h2>
        <span class="sheet-section-count"
          >{{ lineas.length }} {{ lineas.length === 1 ? 'ítem' : 'ítems' }}</span
        >
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
              <span class="product-card__item-num"
                >ÍTEM {{ String(idx + 1).padStart(2, '0') }}</span
              >
              <h3 class="product-card__title">{{ line.nombre }}</h3>
            </div>
            <span v-if="line.tipo_item_label" class="product-card__type-badge">
              {{ line.tipo_item_label }}
            </span>
          </header>

          <!-- Cuerpo de la ficha: Adaptativo según presencia de imagen -->
          <div
            class="product-card__body"
            :class="{ 'product-card__body--with-image': Boolean(line.imagen_url) }"
          >
            <!-- Columna de imagen auténtica (o placeholder profesional si está pendiente) -->
            <div v-if="line.imagen_url" class="product-card__image-col">
              <div class="product-card__image-wrapper">
                <GalleryPhoto
                  :src="line.imagen_url"
                  :alt="`Fotografía de referencia de ${line.nombre}`"
                  class="product-card__gallery-photo"
                />
              </div>

              <!-- Vistas complementarias si existen (hasta 2) -->
              <div
                v-if="line.imagenes_complementarias && line.imagenes_complementarias.length"
                class="product-card__extra-images"
              >
                <div
                  v-for="(extraUrl, eIdx) in line.imagenes_complementarias.slice(0, 2)"
                  :key="eIdx"
                  class="product-card__extra-thumb"
                >
                  <GalleryPhoto
                    :src="extraUrl"
                    :alt="`Vista complementaria ${eIdx + 1} de ${line.nombre}`"
                    class="product-card__gallery-photo"
                  />
                </div>
              </div>
            </div>

            <!-- Columna de especificaciones y descripción -->
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

                <!-- Materiales -->
                <div v-if="lineSpecs(line).materiales.length" class="spec-group">
                  <span class="spec-group__title">Materiales y Estructura</span>
                  <p class="spec-text">{{ lineSpecs(line).materiales.join(' · ') }}</p>
                </div>

                <!-- Colores y Acabados -->
                <div
                  v-if="lineSpecs(line).colores.length || lineSpecs(line).acabados.length"
                  class="spec-group"
                >
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

                <!-- Otros atributos -->
                <div v-if="lineSpecs(line).otrosAtributos.length" class="spec-group">
                  <span class="spec-group__title">Características Adicionales</span>
                  <div class="spec-pills">
                    <span
                      v-for="attr in lineSpecs(line).otrosAtributos"
                      :key="attr.label"
                      class="spec-pill"
                    >
                      <strong>{{ attr.label }}:</strong> {{ attr.value }}
                    </span>
                  </div>
                </div>

                <!-- Observaciones técnicas de la ficha -->
                <div v-if="lineSpecs(line).observaciones" class="spec-group spec-group--notes">
                  <span class="spec-group__title">Observaciones Técnicas</span>
                  <p class="spec-text spec-text--clean">{{ lineSpecs(line).observaciones }}</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Resumen comercial de la ficha del producto -->
          <footer class="product-card__footer">
            <div class="product-card__commercial-left">
              <template v-if="line.modo_calculo === 'TOTAL_NEGOCIADO'">
                <span class="commercial-badge commercial-badge--negotiated"
                  >Modalidad: Importe histórico acordado</span
                >
                <div class="commercial-metric">
                  <span class="commercial-metric__label">Cantidad:</span>
                  <strong class="commercial-metric__val">
                    {{ formatDocQuantity(line.cantidad, line.unidad_label || 'pieza') }}
                  </strong>
                </div>
              </template>
              <template v-else>
                <div class="commercial-metric">
                  <span class="commercial-metric__label">Cantidad:</span>
                  <strong class="commercial-metric__val">
                    {{ formatDocQuantity(line.cantidad, line.unidad_label || 'pieza') }}
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
          <div v-if="condiciones?.observaciones" class="sheet-conditions-obs">
            <span class="condition-obs-label">Observaciones generales:</span>
            <p class="condition-obs-text">{{ condiciones.observaciones }}</p>
          </div>
        </div>

        <div class="sheet-summary-right">
          <div class="sheet-summary-totals">
            <div class="summary-line">
              <span>Subtotal general:</span>
              <span>{{ formatDocCurrency(calculatedSubtotal, monedaCodigo) }}</span>
            </div>
            <div
              v-if="descuentoTotal && descuentoTotal > 0"
              class="summary-line summary-line--discount"
            >
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

    <!-- Condiciones Comerciales Fidedignas (Sin textos inventados) -->
    <section
      v-if="condiciones?.porcentaje_adelanto || condiciones?.plazo_entrega || condiciones?.validez_oferta"
      class="sheet-conditions-section"
      aria-label="Condiciones comerciales de la cotización"
    >
      <h2 class="sheet-conditions-title">CONDICIONES COMERCIALES</h2>
      <div class="sheet-conditions-grid">
        <div v-if="condiciones?.porcentaje_adelanto != null && condiciones.porcentaje_adelanto !== ''" class="condition-box">
          <span class="condition-box__label">Anticipo requerido</span>
          <strong class="condition-box__value">
            {{ condiciones.porcentaje_adelanto }}%
          </strong>
        </div>

        <div v-if="condiciones?.plazo_entrega" class="condition-box">
          <span class="condition-box__label">Plazo de entrega</span>
          <strong class="condition-box__value">
            {{ condiciones.plazo_entrega }}
          </strong>
        </div>

        <div v-if="condiciones?.validez_oferta" class="condition-box">
          <span class="condition-box__label">Validez de la cotización</span>
          <strong class="condition-box__value">
            {{ condiciones.validez_oferta }} días calendario
          </strong>
        </div>
      </div>
    </section>

    <!-- Cierre Institucional y Firmas -->
    <section class="sheet-signatures-section" aria-label="Firmas y aprobación">
      <div class="signatures-grid">
        <div class="signature-col">
          <div class="signature-line"></div>
          <strong class="signature-name">{{ vendedorNombre || 'HOMEX MOBILIARIO' }}</strong>
          <span class="signature-role">Asesor Comercial Autorizado</span>
        </div>

        <div class="signature-col">
          <div class="signature-line"></div>
          <strong class="signature-name">
            {{ clientHasData ? clientDisplayName : 'Aceptación y Aprobación del Cliente' }}
          </strong>
          <span class="signature-role">Aceptación y Aprobación del Cliente</span>
        </div>
      </div>
    </section>

    <!-- Pie de página Institucional -->
    <footer class="sheet-footer">
      <span>HOMEX · Mobiliario Corporativo & Residencial</span>
      <span>Proforma {{ numero ? `#${numero}` : 'Borrador' }} · {{ formatDocDate(fecha) }}</span>
      <span class="sheet-footer__status-text">
        {{ isBorrador ? 'Borrador — No emitida' : 'Documento comercial emitido' }}
      </span>
    </footer>
  </article>
</template>

<style scoped>
/* =========================================================================
   ESTILOS DE LA HOJA DE COTIZACIÓN (TAMAÑO CARTA VERTICAL: 215,9 × 279,4 mm)
   Diseño sobrio: predominio de blanco, textos oscuros y acento rojo HOMEX
   ========================================================================= */

.proforma-sheet {
  width: 215.9mm;
  min-height: 279.4mm;
  background-color: #ffffff;
  color: #171717;
  padding: 14mm 16mm;
  box-sizing: border-box;
  font-family:
    'Inter',
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    Roboto,
    Helvetica,
    Arial,
    sans-serif;
  font-size: 10px;
  line-height: 1.45;
  margin: 0 auto;
  position: relative;
  box-shadow:
    0 10px 25px -5px rgba(0, 0, 0, 0.1),
    0 8px 10px -6px rgba(0, 0, 0, 0.1);
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
  margin-bottom: 4px;
}

.sheet-logo__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  background-color: #dc2626;
  color: #ffffff;
  font-weight: 800;
  font-size: 17px;
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
  font-size: 9px;
  color: #525252;
  margin: 2px 0 0 0;
  line-height: 1.35;
}

.sheet-header__meta {
  text-align: right;
  min-width: 180px;
}

.sheet-header__kicker {
  display: inline-block;
  font-size: 8.5px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #dc2626;
  text-transform: uppercase;
}

.sheet-header__number {
  font-size: 19px;
  font-weight: 800;
  color: #171717;
  margin: 2px 0 3px 0;
  line-height: 1.1;
}

.sheet-header__date,
.sheet-header__validity {
  font-size: 9px;
  color: #525252;
  margin: 1px 0;
}

/* Divisores */
.sheet-divider {
  height: 1px;
  background-color: #e5e5e5;
  margin: 10px 0;
}

.sheet-divider--thick {
  height: 2px;
  background-color: #dc2626;
  margin: 12px 0;
}

/* Grilla de información de Cliente y Cotización */
.sheet-info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 14px;
}

.sheet-info-block {
  background-color: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 8px 12px;
}

.sheet-info-block__title {
  font-size: 8.5px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #64748b;
  text-transform: uppercase;
  margin: 0 0 4px 0;
  padding-bottom: 3px;
  border-bottom: 1px solid #e2e8f0;
}

.sheet-info-client-name {
  font-size: 12px;
  font-weight: 700;
  color: #0f172a;
  margin: 0 0 3px 0;
}

.sheet-info-client-name--provisional {
  color: #64748b;
  font-style: italic;
  font-weight: 600;
}

.sheet-info-empty-hint {
  font-size: 8.5px;
  color: #94a3b8;
  margin: 2px 0;
  font-style: italic;
}

.sheet-info-row {
  display: flex;
  margin: 2px 0;
  font-size: 9.5px;
  line-height: 1.35;
}

.sheet-info-label {
  width: 85px;
  color: #64748b;
  font-weight: 500;
  flex-shrink: 0;
}

.sheet-info-reference {
  color: #0f172a;
}

.sheet-status-badge {
  display: inline-block;
  font-size: 8.5px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  background-color: #e2e8f0;
  color: #334155;
}

.sheet-status-badge[data-status='APROBADA'] {
  background-color: #dcfce7;
  color: #166534;
}

.sheet-status-badge[data-status='EN_REVISION'] {
  background-color: #fef9c3;
  color: #854d0e;
}

/* Fichas de Productos */
.sheet-section-heading {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin: 14px 0 8px 0;
  padding-bottom: 4px;
  border-bottom: 1.5px solid #0f172a;
}

.sheet-section-title {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: #0f172a;
  text-transform: uppercase;
  margin: 0;
}

.sheet-section-count {
  font-size: 9px;
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
  padding: 5px 10px;
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
  font-size: 8.5px;
  font-weight: 700;
  color: #dc2626;
  background-color: #fee2e2;
  padding: 1px 5px;
  border-radius: 3px;
  letter-spacing: 0.05em;
}

.product-card__title {
  font-size: 11.5px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}

.product-card__type-badge {
  font-size: 8.5px;
  font-weight: 600;
  color: #475569;
  background-color: #e2e8f0;
  padding: 1px 5px;
  border-radius: 3px;
}

.product-card__body {
  padding: 10px 12px;
  display: block;
}

.product-card__body--with-image {
  display: grid;
  grid-template-columns: 50mm 1fr;
  gap: 12px;
}

.product-card__image-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.product-card__image-wrapper {
  width: 48mm;
  height: 40mm;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  overflow: hidden;
  padding: 2px;
}

.product-card__gallery-photo {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.product-card__no-image {
  width: 48mm;
  height: 34mm;
  border: 1px dashed #cbd5e1;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f8fafc;
  padding: 6px;
  text-align: center;
}

.product-card__no-image-text {
  font-size: 8px;
  color: #94a3b8;
  font-style: italic;
  line-height: 1.25;
}

.product-card__extra-images {
  display: flex;
  gap: 4px;
}

.product-card__extra-thumb {
  width: 22mm;
  height: 18mm;
  border: 1px solid #e2e8f0;
  border-radius: 3px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.product-card__specs-col {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.product-card__description {
  font-size: 10px;
  color: #334155;
  margin: 0 0 4px 0;
  line-height: 1.35;
}

.specs-grid {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.spec-group {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.spec-group__title {
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: #64748b;
  text-transform: uppercase;
}

.spec-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.spec-pill {
  font-size: 9px;
  background-color: #f1f5f9;
  border: 1px solid #e2e8f0;
  padding: 1px 5px;
  border-radius: 3px;
  color: #1e293b;
}

.spec-text {
  font-size: 9px;
  color: #1e293b;
  margin: 0;
  line-height: 1.3;
}

.spec-text--clean {
  color: #475569;
}

.spec-components-list {
  margin: 0;
  padding-left: 12px;
  font-size: 9px;
  color: #1e293b;
}

.spec-component-item {
  margin: 1px 0;
}

/* Pie de la ficha del producto */
.product-card__footer {
  background-color: #f8fafc;
  border-top: 1px solid #e2e8f0;
  padding: 5px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.product-card__commercial-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.commercial-metric {
  font-size: 9px;
  color: #475569;
}

.commercial-metric__label {
  margin-right: 3px;
}

.commercial-metric__val {
  color: #0f172a;
}

.commercial-metric__val--discount {
  color: #dc2626;
  font-weight: 600;
}

.commercial-badge--negotiated {
  font-size: 9px;
  font-weight: 600;
  color: #0369a1;
  background-color: #e0f2fe;
  padding: 1px 5px;
  border-radius: 3px;
}

.product-card__commercial-right {
  display: flex;
  align-items: center;
  gap: 5px;
}

.commercial-subtotal-label {
  font-size: 9px;
  font-weight: 600;
  color: #475569;
}

.commercial-subtotal-value {
  font-size: 11.5px;
  font-weight: 800;
  color: #0f172a;
}

/* Resumen Económico General */
.sheet-summary-section {
  margin-top: 14px;
  padding: 8px 0;
  page-break-inside: avoid;
  break-inside: avoid;
}

.sheet-summary-grid {
  display: grid;
  grid-template-columns: 1fr 220px;
  gap: 16px;
  align-items: start;
}

.sheet-conditions-obs {
  background-color: #f8fafc;
  border-left: 3px solid #cbd5e1;
  padding: 6px 10px;
  font-size: 9px;
}

.condition-obs-label {
  font-weight: 700;
  color: #475569;
  display: block;
  margin-bottom: 2px;
}

.condition-obs-text {
  color: #1e293b;
  margin: 0;
  line-height: 1.35;
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
  font-size: 9.5px;
  color: #475569;
}

.summary-line--discount {
  color: #dc2626;
  font-weight: 600;
}

.summary-line--total {
  font-size: 12.5px;
  font-weight: 800;
  color: #dc2626;
  border-top: 1.5px solid #cbd5e1;
  margin-top: 4px;
  padding-top: 4px;
}

/* Condiciones Comerciales */
.sheet-conditions-section {
  margin-top: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background-color: #ffffff;
  padding: 8px 12px;
  page-break-inside: avoid;
  break-inside: avoid;
}

.sheet-conditions-title {
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: #0f172a;
  text-transform: uppercase;
  margin: 0 0 6px 0;
}

.sheet-conditions-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
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
  font-size: 7.5px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: #64748b;
  text-transform: uppercase;
  margin-bottom: 2px;
}

.condition-box__value {
  font-size: 10.5px;
  font-weight: 700;
  color: #0f172a;
}

/* Firmas */
.sheet-signatures-section {
  margin-top: 20px;
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
  max-width: 180px;
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
  margin-top: 18px;
  padding-top: 8px;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  font-size: 7.5px;
  color: #94a3b8;
}

.sheet-footer__status-text {
  font-weight: 600;
}

/* =========================================================================
   REGLAS PARA IMPRESIÓN DIRECTA (@media print) EN TAMAÑO CARTA
   ========================================================================= */
@page {
  size: letter portrait;
  margin: 8mm 10mm;
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

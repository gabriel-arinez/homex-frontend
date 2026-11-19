<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  Download,
  FileText,
  Hammer,
  Layers,
  MapPin,
  PackageCheck,
  StickyNote,
  Truck,
  UserCheck,
  Wallet,
} from '@lucide/vue'
import type { DetalleOrdenTrabajo, OrdenTrabajo } from '@/generated/api'
import type {
  AtributoTecnico,
  ComponenteTecnico,
  DatosTecnicos,
} from '@/modules/proformas/services/muebleTecnico'
import { useQuoteProductImages } from '@/modules/proformas/composables/useQuoteProductImages'
import ProductImage from '@/modules/productos/components/ProductImage.vue'
import { downloadBlob } from '@/shared/download/downloadBlob'
import ImageGallery from '@/shared/media/ImageGallery.vue'
import Badge from '@/shared/ui/Badge.vue'
import Button from '@/shared/ui/Button.vue'
import EmptyState from '@/shared/ui/EmptyState.vue'
import ErrorState from '@/shared/ui/ErrorState.vue'
import LoadingSkeleton from '@/shared/ui/LoadingSkeleton.vue'
import PageHeader from '@/shared/ui/PageHeader.vue'
import StatusBadge from '@/shared/ui/StatusBadge.vue'
import Toast from '@/shared/ui/Toast.vue'
import { ordenesTrabajoService } from '../services/ordenesTrabajoService'

const emit = defineEmits<{ openMenu: [] }>()
const route = useRoute()
const router = useRouter()
const id = Number(route.params.id)

const item = ref<OrdenTrabajo | null>(null)
const loading = ref(true)
const downloading = ref(false)
const error = ref('')
const notice = ref('')

const { images: productImages, ensure: ensureProductImages } = useQuoteProductImages()

function formatDateLabel(value: string | null | undefined): string | null {
  if (!value) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T12:00:00Z`)
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat('es-BO', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(date)
    }
  }
  return value
}

function formatQuantity(value: string | number): string {
  const text = String(value).trim()
  if (/^\d+\.0+$/.test(text)) return text.split('.')[0] ?? text
  return text
}

function workOrderTone(code: string): 'info' | 'warning' | 'success' | 'danger' | 'neutral' {
  const normalized = code.toUpperCase()
  if (normalized.includes('CANCEL') || normalized.includes('ANUL')) return 'danger'
  if (
    normalized.includes('ENTREGAD') ||
    normalized.includes('FINALIZAD') ||
    normalized.includes('LISTO')
  ) {
    return 'success'
  }
  if (
    normalized.includes('PRODUCCION') ||
    normalized.includes('TALLER') ||
    normalized.includes('PROCESO')
  ) {
    return 'warning'
  }
  if (normalized.includes('PENDIENTE')) return 'info'
  return 'neutral'
}

interface ParsedSpec {
  componentes: ComponenteTecnico[]
  advertencias: string[]
  accesorios: string[]
  generalSpecs: Array<{ label: string; value: string }>
  observaciones: string | null
  detalleLabel: string
}

function parseSpecification(line: DetalleOrdenTrabajo): ParsedSpec | null {
  if (!line.especificacion) return null
  const datos = (line.especificacion.datos_tecnicos ?? {}) as DatosTecnicos
  const componentes = Array.isArray(datos.componentes) ? datos.componentes : []
  const advertencias = Array.isArray(datos.advertencias)
    ? datos.advertencias.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    : []
  const accesorios = Array.isArray(datos.accesorios)
    ? datos.accesorios.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    : []

  const generalSpecs: Array<{ label: string; value: string }> = []
  const gen = datos.caracteristicas_generales
  if (gen && typeof gen === 'object' && !Array.isArray(gen)) {
    for (const [key, val] of Object.entries(gen)) {
      if (key === 'atributos' && Array.isArray(val)) {
        for (const attr of val as AtributoTecnico[]) {
          if (attr?.nombre && attr?.valor) {
            generalSpecs.push({
              label: attr.nombre,
              value: attr.unidad ? `${attr.valor} ${attr.unidad}` : String(attr.valor),
            })
          }
        }
      } else if (
        val !== null &&
        val !== undefined &&
        String(val).trim() !== '' &&
        typeof val !== 'object'
      ) {
        generalSpecs.push({
          label: key.replace(/_/g, ' '),
          value: String(val),
        })
      }
    }
  }

  const detalleLabel = componentes.length
    ? `${componentes.length} componente${componentes.length === 1 ? '' : 's'}`
    : 'Ficha técnica registrada'

  return {
    componentes,
    advertencias,
    accesorios,
    generalSpecs,
    observaciones: line.especificacion.observaciones ?? null,
    detalleLabel,
  }
}

function componentAttributes(comp: ComponenteTecnico): Array<{ label: string; value: string }> {
  const attrs: Array<{ label: string; value: string }> = []
  if (comp.material) attrs.push({ label: 'Material', value: comp.material })
  if (comp.color) attrs.push({ label: 'Color', value: comp.color })
  if (comp.espesor) attrs.push({ label: 'Espesor', value: comp.espesor })
  if (comp.dimensiones) attrs.push({ label: 'Dimensiones', value: comp.dimensiones })
  if (comp.acabado) attrs.push({ label: 'Acabado', value: comp.acabado })
  if (Array.isArray(comp.atributos)) {
    for (const attr of comp.atributos) {
      if (attr?.nombre && attr?.valor) {
        attrs.push({
          label: attr.nombre,
          value: attr.unidad ? `${attr.valor} ${attr.unidad}` : String(attr.valor),
        })
      }
    }
  }
  return attrs
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const loaded = await ordenesTrabajoService.get(id)
    item.value = loaded
    const productIds = (loaded.detalles ?? [])
      .map((line) => line.producto)
      .filter((prodId): prodId is number => typeof prodId === 'number' && prodId > 0)
    if (productIds.length) {
      void ensureProductImages(productIds)
    }
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo cargar la orden.'
  } finally {
    loading.value = false
  }
}

async function downloadDocument() {
  if (!item.value || downloading.value) return
  downloading.value = true
  error.value = ''
  try {
    downloadBlob(
      await ordenesTrabajoService.document(id),
      `orden-trabajo-${item.value.numero}.html`,
    )
    notice.value = 'Documento de orden de trabajo descargado.'
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'No se pudo descargar la orden.'
  } finally {
    downloading.value = false
  }
}

onMounted(load)

const detailRows = computed(() =>
  (item.value?.detalles ?? []).map((line) => {
    const spec = parseSpecification(line)
    return {
      ...line,
      unidadLabel: line.unidad_info.nombre,
      tipoItemLabel: line.tipo_item_info.nombre,
      isFabrication: Boolean(line.especificacion),
      trabajoLabel: line.especificacion ? 'Fabricación' : 'Preparación y verificación',
      spec,
    }
  }),
)

const lineCounts = computed(() => {
  const fab = detailRows.value.filter((row) => row.isFabrication).length
  const cat = detailRows.value.length - fab
  return { fab, cat }
})
</script>

<template>
  <div class="ot-detail">
    <Toast :visible="Boolean(notice)" :message="notice" tone="success" @close="notice = ''" />

    <div class="ot-topline" aria-label="Ubicación en el proceso">
      <span>
        OPERACIONES <span class="ot-divider">/</span> ÓRDENES DE TRABAJO
        <span class="ot-divider">/</span> OT #{{ item?.numero ?? id }}
      </span>
      <div
        v-if="item"
        class="ot-status-pill"
        :class="`ot-status-pill--${workOrderTone(item.estado_info.codigo)}`"
      >
        <Hammer v-if="lineCounts.fab > 0" :size="14" aria-hidden="true" />
        <PackageCheck v-else :size="14" aria-hidden="true" />
        <span>{{ item.estado_info.nombre }}</span>
      </div>
    </div>

    <PageHeader
      :title="`Orden de trabajo #${item?.numero ?? id}`"
      description="Hoja técnica de fabricación, preparación de catálogo y logística de entrega."
      show-menu
      @menu="emit('openMenu')"
    >
      <template #actions>
        <Button variant="secondary" @click="router.push('/ordenes-trabajo')">
          <ArrowLeft :size="17" aria-hidden="true" /> Volver
        </Button>
        <Button v-if="item" variant="secondary" :processing="downloading" @click="downloadDocument">
          <Download :size="17" aria-hidden="true" />
          Descargar
        </Button>
      </template>
    </PageHeader>

    <LoadingSkeleton v-if="loading" :lines="7" />
    <ErrorState v-else-if="error && !item" :description="error">
      <button type="button" @click="load">Reintentar</button>
    </ErrorState>
    <template v-else-if="item">
      <div v-if="error" class="notice notice--error" role="alert">{{ error }}</div>

      <section class="summary" aria-label="Resumen de la orden de trabajo">
        <div class="stat">
          <span class="stat__icon">
            <FileText :size="18" aria-hidden="true" />
          </span>
          <div class="stat__body">
            <span>Origen comercial</span>
            <RouterLink :to="`/pedidos/${item.pedido}`" class="stat__link">
              Pedido #{{ item.pedido }}
            </RouterLink>
            <small>Proforma #{{ item.proforma_numero }}</small>
          </div>
        </div>

        <div class="stat">
          <span class="stat__icon stat__icon--warning">
            <Hammer :size="18" aria-hidden="true" />
          </span>
          <div class="stat__body">
            <span>Estado de taller</span>
            <div>
              <StatusBadge :status="item.estado_info.codigo" :label="item.estado_info.nombre" />
            </div>
            <small> {{ lineCounts.fab }} fabricación · {{ lineCounts.cat }} catálogo </small>
          </div>
        </div>

        <div class="stat">
          <span class="stat__icon">
            <Wallet :size="18" aria-hidden="true" />
          </span>
          <div class="stat__body">
            <span>Estado de saldo</span>
            <strong class="stat__value">
              {{ item.estado_saldo_info?.nombre ?? 'Sin asignar' }}
            </strong>
          </div>
        </div>

        <div class="stat">
          <span class="stat__icon">
            <Truck :size="18" aria-hidden="true" />
          </span>
          <div class="stat__body">
            <span>Entrega prevista</span>
            <strong class="stat__value">
              {{ formatDateLabel(item.fecha_entrega) ?? 'Sin definir' }}
            </strong>
            <small :title="item.lugar_entrega ?? 'Lugar sin definir'">
              {{ item.lugar_entrega ?? 'Lugar sin definir' }}
            </small>
          </div>
        </div>
      </section>

      <section class="panel" aria-labelledby="ot-logistics-title">
        <div class="section-heading">
          <div class="section-heading__identity">
            <span class="section-icon">
              <Calendar :size="18" aria-hidden="true" />
            </span>
            <div>
              <h2 id="ot-logistics-title">Planificación y logística</h2>
              <p>Fechas operativas de taller y datos de recepción del pedido.</p>
            </div>
          </div>
        </div>

        <div class="ot-fields-grid">
          <div class="ot-field-card">
            <span class="ot-field-card__icon">
              <Calendar :size="17" aria-hidden="true" />
            </span>
            <div class="ot-field-card__body">
              <span class="ot-field-card__label">Fecha de emisión</span>
              <strong class="ot-field-card__value">
                {{ formatDateLabel(item.fecha) ?? item.fecha }}
              </strong>
            </div>
          </div>

          <div class="ot-field-card">
            <span class="ot-field-card__icon">
              <Clock3 :size="17" aria-hidden="true" />
            </span>
            <div class="ot-field-card__body">
              <span class="ot-field-card__label">Inicio de fabricación</span>
              <strong
                class="ot-field-card__value"
                :class="{ 'ot-field-card__value--muted': !item.fecha_inicio }"
              >
                {{ formatDateLabel(item.fecha_inicio) ?? 'Pendiente' }}
              </strong>
            </div>
          </div>

          <div class="ot-field-card">
            <span class="ot-field-card__icon">
              <Clock3 :size="17" aria-hidden="true" />
            </span>
            <div class="ot-field-card__body">
              <span class="ot-field-card__label">Fin de fabricación</span>
              <strong
                class="ot-field-card__value"
                :class="{ 'ot-field-card__value--muted': !item.fecha_fin }"
              >
                {{ formatDateLabel(item.fecha_fin) ?? 'Pendiente' }}
              </strong>
            </div>
          </div>

          <div class="ot-field-card">
            <span class="ot-field-card__icon">
              <MapPin :size="17" aria-hidden="true" />
            </span>
            <div class="ot-field-card__body">
              <span class="ot-field-card__label">Lugar de entrega</span>
              <strong
                class="ot-field-card__value"
                :class="{ 'ot-field-card__value--muted': !item.lugar_entrega }"
              >
                {{ item.lugar_entrega ?? 'Sin definir' }}
              </strong>
            </div>
          </div>

          <div class="ot-field-card ot-field-card--full">
            <span class="ot-field-card__icon">
              <UserCheck :size="17" aria-hidden="true" />
            </span>
            <div class="ot-field-card__body">
              <span class="ot-field-card__label">Responsable de recepción</span>
              <strong
                class="ot-field-card__value"
                :class="{ 'ot-field-card__value--muted': !item.responsable_recepcion }"
              >
                {{ item.responsable_recepcion ?? 'No asignado' }}
              </strong>
            </div>
          </div>
        </div>
      </section>

      <section class="work-lines" aria-labelledby="ot-details-title">
        <div class="section-heading">
          <div class="section-heading__identity">
            <span class="section-icon">
              <ClipboardCheck :size="18" aria-hidden="true" />
            </span>
            <div>
              <h2 id="ot-details-title">Detalle de trabajo</h2>
              <p>Estas líneas provienen de la proforma aprobada que originó el pedido.</p>
            </div>
          </div>
          <span class="counter">
            {{ detailRows.length }} {{ detailRows.length === 1 ? 'ítem' : 'ítems' }}
          </span>
        </div>

        <EmptyState
          v-if="!detailRows.length"
          title="Sin ítems registrados"
          description="Esta orden de trabajo no contiene líneas de detalle."
        />

        <article v-for="(line, index) in detailRows" :key="line.id" class="work-line">
          <div class="work-line__main">
            <div class="work-line__identity">
              <div v-if="line.producto" class="work-line__thumb">
                <ProductImage
                  :image="productImages[line.producto] ?? null"
                  :alt="line.nombre"
                  sizes="64px"
                />
              </div>
              <div v-else class="work-line__thumb work-line__thumb--icon">
                <Hammer v-if="line.isFabrication" :size="22" aria-hidden="true" />
                <PackageCheck v-else :size="22" aria-hidden="true" />
              </div>

              <div class="work-line__text">
                <div class="work-line__meta">
                  <small>
                    {{ String(index + 1).padStart(2, '0') }} · {{ line.tipoItemLabel }}
                  </small>
                  <Badge :tone="line.isFabrication ? 'warning' : 'info'">
                    {{ line.trabajoLabel }}
                  </Badge>
                </div>
                <h3>{{ line.nombre }}</h3>
                <p v-if="line.descripcion" class="work-line__desc">{{ line.descripcion }}</p>
              </div>
            </div>

            <div class="work-line__qty">
              <strong>{{ formatQuantity(line.cantidad) }}</strong>
              <span>{{ line.unidadLabel }}</span>
            </div>
          </div>

          <div class="work-line__spec">
            <details v-if="line.spec" class="ficha-ot">
              <summary class="ficha-ot__summary">
                <span class="ficha-ot__summary-label">
                  <Layers :size="16" aria-hidden="true" />
                  {{ line.spec.detalleLabel }}
                </span>
                <ChevronDown :size="16" class="ficha-ot__chevron" aria-hidden="true" />
              </summary>

              <div class="ficha-ot__body">
                <div v-if="line.spec.advertencias.length" class="ficha-alerts" role="note">
                  <AlertTriangle :size="16" aria-hidden="true" />
                  <div>
                    <strong>Advertencias de taller</strong>
                    <ul>
                      <li v-for="(adv, i) in line.spec.advertencias" :key="i">{{ adv }}</li>
                    </ul>
                  </div>
                </div>

                <div v-if="line.spec.observaciones" class="ficha-notes">
                  <StickyNote :size="16" aria-hidden="true" />
                  <div>
                    <strong>Observaciones técnicas</strong>
                    <p>{{ line.spec.observaciones }}</p>
                  </div>
                </div>

                <div v-if="line.spec.generalSpecs.length" class="ficha-block">
                  <h4>Características generales</h4>
                  <dl class="ficha-kv-grid">
                    <div v-for="(specItem, idx) in line.spec.generalSpecs" :key="idx">
                      <dt>{{ specItem.label }}</dt>
                      <dd>{{ specItem.value }}</dd>
                    </div>
                  </dl>
                </div>

                <div v-if="line.spec.componentes.length" class="ficha-block">
                  <h4>Componentes de fabricación</h4>
                  <div class="components-grid">
                    <div
                      v-for="(comp, idx) in line.spec.componentes"
                      :key="comp.uid || idx"
                      class="component-card"
                    >
                      <div class="component-card__head">
                        <strong>{{ comp.nombre }}</strong>
                        <span v-if="comp.cantidad_interna" class="component-card__qty">
                          × {{ comp.cantidad_interna }}
                        </span>
                      </div>
                      <dl v-if="componentAttributes(comp).length" class="component-card__attrs">
                        <div v-for="(attr, aIdx) in componentAttributes(comp)" :key="aIdx">
                          <dt>{{ attr.label }}</dt>
                          <dd>{{ attr.value }}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </div>

                <div v-if="line.spec.accesorios.length" class="ficha-block">
                  <h4>Accesorios</h4>
                  <div class="accessories-list">
                    <span v-for="(acc, aIdx) in line.spec.accesorios" :key="aIdx" class="acc-chip">
                      {{ acc }}
                    </span>
                  </div>
                </div>

                <div class="ficha-gallery">
                  <ImageGallery
                    :endpoint="`/api/v1/imagenes-privadas/?detalle=${line.id}`"
                    :editable="false"
                    title="Referencias de fabricación"
                  />
                </div>
              </div>
            </details>

            <div v-else class="work-line__catalog-tag">
              <PackageCheck :size="15" aria-hidden="true" />
              <span>Ítem de catálogo</span>
            </div>
          </div>
        </article>
      </section>
    </template>
  </div>
</template>

<style scoped>
.ot-detail {
  display: grid;
  gap: var(--space-5);
  min-width: 0;
  padding-bottom: var(--space-8);
}
.ot-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-3);
  color: var(--color-text-secondary);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.1em;
}
.ot-divider {
  margin: 0 0.45rem;
  opacity: 0.5;
}
.ot-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.7rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: 0.72rem;
  letter-spacing: 0.02em;
}
.ot-status-pill--info {
  border-color: color-mix(in srgb, var(--color-info) 35%, var(--color-border));
  background: var(--color-info-soft);
  color: var(--color-info);
}
.ot-status-pill--warning {
  border-color: color-mix(in srgb, var(--color-warning) 35%, var(--color-border));
  background: var(--color-warning-soft);
  color: var(--color-warning);
}
.ot-status-pill--success {
  border-color: color-mix(in srgb, var(--color-success) 35%, var(--color-border));
  background: var(--color-success-soft);
  color: var(--color-success);
}
.ot-status-pill--danger {
  border-color: color-mix(in srgb, var(--color-danger) 35%, var(--color-border));
  background: var(--color-danger-soft);
  color: var(--color-danger);
}
.notice {
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface);
  font-size: 0.9rem;
}
.notice--error {
  color: var(--color-danger);
  border-color: var(--color-danger);
}
.summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-3);
}
.stat,
.panel,
.work-line {
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  background: var(--color-surface);
  min-width: 0;
}
.stat {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.stat__icon {
  display: grid;
  width: 2.5rem;
  height: 2.5rem;
  flex: none;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--color-primary) 16%, transparent);
  border-radius: 0.75rem;
  color: var(--color-primary-accent);
  background: var(--color-primary-soft);
}
.stat__icon--warning {
  border-color: color-mix(in srgb, var(--color-warning) 25%, transparent);
  color: var(--color-warning);
  background: var(--color-warning-soft);
}
.stat__body {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}
.stat__body > span {
  color: var(--color-text-secondary);
  font-size: 0.78rem;
}
.stat__body > small {
  color: var(--color-text-secondary);
  font-size: 0.75rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.stat__value {
  font-size: 0.92rem;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.stat__link {
  color: var(--color-primary-accent);
  font-size: 0.95rem;
  font-weight: 700;
  text-decoration: none;
}
.stat__link:hover {
  text-decoration: underline;
}
.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}
.section-heading__identity {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
}
.section-icon {
  display: grid;
  width: 2.5rem;
  height: 2.5rem;
  flex: none;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--color-primary) 16%, transparent);
  border-radius: 0.75rem;
  color: var(--color-primary-accent);
  background: var(--color-primary-soft);
}
.section-heading h2 {
  margin: 0;
  font-size: 1.12rem;
}
.section-heading p {
  margin: var(--space-1) 0 0;
  color: var(--color-text-secondary);
  font-size: 0.85rem;
}
.counter {
  font-size: 0.82rem;
  font-weight: 650;
  color: var(--color-text-secondary);
}
.ot-fields-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}
.ot-field-card {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: 0.85rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-soft);
  min-width: 0;
}
.ot-field-card--full {
  grid-column: 1 / -1;
}
.ot-field-card__icon {
  display: grid;
  width: 2.1rem;
  height: 2.1rem;
  flex: none;
  place-items: center;
  border-radius: 0.6rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
}
.ot-field-card__body {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}
.ot-field-card__label {
  color: var(--color-text-secondary);
  font-size: 0.76rem;
}
.ot-field-card__value {
  font-size: 0.9rem;
  font-weight: 650;
  overflow-wrap: anywhere;
}
.ot-field-card__value--muted {
  color: var(--color-text-secondary);
  font-weight: 500;
}
.work-lines {
  display: grid;
  gap: var(--space-3);
  min-width: 0;
}
.work-lines .section-heading {
  margin-bottom: var(--space-1);
}
.work-line {
  display: grid;
  gap: var(--space-3);
}
.work-line__main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
}
.work-line__identity {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  min-width: 0;
}
.work-line__thumb {
  width: 4rem;
  height: 4rem;
  flex: none;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-soft);
}
.work-line__thumb--icon {
  display: grid;
  place-items: center;
  color: var(--color-primary-accent);
  background: var(--color-primary-soft);
}
.work-line__thumb :deep(.product-image) {
  width: 100%;
  height: 100%;
  min-height: 0;
  aspect-ratio: 1 !important;
}
.work-line__thumb :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.work-line__thumb :deep(.fallback span) {
  display: none;
}
.work-line__text {
  display: grid;
  gap: 0.3rem;
  min-width: 0;
}
.work-line__meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.work-line__meta small {
  color: var(--color-text-secondary);
  font-size: 0.78rem;
  font-weight: 600;
}
.work-line__text h3 {
  margin: 0;
  font-size: 1rem;
  overflow-wrap: anywhere;
}
.work-line__desc {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 0.85rem;
  overflow-wrap: anywhere;
}
.work-line__qty {
  display: grid;
  justify-items: end;
  flex: none;
  text-align: right;
  padding: 0.45rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-soft);
}
.work-line__qty strong {
  font-size: 1.05rem;
  font-variant-numeric: tabular-nums;
}
.work-line__qty span {
  color: var(--color-text-secondary);
  font-size: 0.75rem;
}
.work-line__spec {
  border-top: 1px solid var(--color-border);
  padding-top: var(--space-3);
}
.work-line__catalog-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--color-text-secondary);
  font-size: 0.82rem;
  font-weight: 600;
}
.ficha-ot {
  min-width: 0;
}
.ficha-ot__summary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.8rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-soft);
  color: var(--color-primary-accent);
  font-size: 0.84rem;
  font-weight: 700;
  cursor: pointer;
  list-style: none;
}
.ficha-ot__summary::-webkit-details-marker {
  display: none;
}
.ficha-ot__summary:hover {
  background: var(--color-surface-hover);
}
.ficha-ot__summary-label {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}
.ficha-ot__chevron {
  transition: transform 0.18s ease;
}
.ficha-ot[open] .ficha-ot__chevron {
  transform: rotate(180deg);
}
.ficha-ot__body {
  display: grid;
  gap: var(--space-4);
  margin-top: var(--space-4);
}
.ficha-alerts {
  display: flex;
  align-items: flex-start;
  gap: 0.7rem;
  padding: 0.85rem 1rem;
  border: 1px solid color-mix(in srgb, var(--color-warning) 40%, var(--color-border));
  border-radius: var(--radius-control);
  background: var(--color-warning-soft);
  color: var(--color-warning);
  font-size: 0.86rem;
}
.ficha-alerts svg {
  flex: none;
  margin-top: 0.1rem;
}
.ficha-alerts ul {
  margin: 0.35rem 0 0;
  padding-left: 1.1rem;
  color: var(--color-text);
}
.ficha-notes {
  display: flex;
  align-items: flex-start;
  gap: 0.7rem;
  padding: 0.85rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-soft);
  font-size: 0.86rem;
}
.ficha-notes svg {
  flex: none;
  margin-top: 0.1rem;
  color: var(--color-primary-accent);
}
.ficha-notes p {
  margin: 0.25rem 0 0;
  color: var(--color-text);
  white-space: pre-wrap;
}
.ficha-block h4 {
  margin: 0 0 var(--space-2);
  font-size: 0.84rem;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.ficha-kv-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
  gap: var(--space-2);
  margin: 0;
}
.ficha-kv-grid > div {
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-soft);
}
.ficha-kv-grid dt {
  color: var(--color-text-secondary);
  font-size: 0.74rem;
  text-transform: capitalize;
}
.ficha-kv-grid dd {
  margin: 0.15rem 0 0;
  font-size: 0.86rem;
  font-weight: 650;
}
.components-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
  gap: var(--space-3);
}
.component-card {
  padding: 0.85rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  background: var(--color-surface-soft);
  display: grid;
  gap: 0.6rem;
}
.component-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}
.component-card__head strong {
  font-size: 0.92rem;
}
.component-card__qty {
  padding: 0.15rem 0.5rem;
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  font-size: 0.75rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.component-card__attrs {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.45rem 0.75rem;
  margin: 0;
}
.component-card__attrs dt {
  color: var(--color-text-secondary);
  font-size: 0.72rem;
}
.component-card__attrs dd {
  margin: 0.1rem 0 0;
  font-size: 0.82rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.accessories-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}
.acc-chip {
  padding: 0.3rem 0.7rem;
  border-radius: var(--radius-pill);
  border: 1px solid var(--color-border);
  background: var(--color-surface-soft);
  font-size: 0.8rem;
  font-weight: 600;
}
.ficha-gallery {
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border);
}
@media (max-width: 64rem) {
  .summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 38rem) {
  .summary,
  .ot-fields-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .work-line__main {
    flex-direction: column;
    gap: var(--space-3);
  }
  .work-line__qty {
    justify-items: start;
    text-align: left;
  }
}
</style>

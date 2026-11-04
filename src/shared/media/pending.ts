import type { LocalImage } from './gallery'
// Binary previews belong in IndexedDB; only gallery UUIDs enter the editor JSON snapshot.
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB no disponible'))
      return
    }
    const request = indexedDB.open('homex-gallery-drafts', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('pending')
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
export async function savePending(key: string, images: LocalImage[]) {
  const db = await open()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('pending', 'readwrite')
      if (images.length)
        tx.objectStore('pending').put(
          images.map(({ file, principal, digest }) => ({ file, principal, digest })),
          key,
        )
      else tx.objectStore('pending').delete(key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}
export async function loadPending(key: string): Promise<LocalImage[]> {
  const db = await open()
  try {
    const rows = await new Promise<Array<Omit<LocalImage, 'url'>>>((resolve, reject) => {
      const request = db.transaction('pending').objectStore('pending').get(key)
      request.onsuccess = () => resolve(request.result ?? [])
      request.onerror = () => reject(request.error)
    })
    return rows.map((i) => ({ ...i, url: URL.createObjectURL(i.file) }))
  } finally {
    db.close()
  }
}

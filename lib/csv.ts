/** Genera un CSV compatible con Excel en español (separador ; y BOM UTF-8) y lo descarga */
export function aCsv(filas: (string | number | null)[][]): string {
  const celda = (v: string | number | null) => {
    if (v === null) return ''
    const s = typeof v === 'number' ? String(v).replace('.', ',') : v
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return filas.map((f) => f.map(celda).join(';')).join('\r\n')
}

export function descargarCsv(nombre: string, filas: (string | number | null)[][]) {
  const blob = new Blob(['﻿' + aCsv(filas)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
}

'use client'

import { useRef } from 'react'

type Props = {
  /** Ritorna l’oggetto scheda corrente (per export JSON) */
  getData: () => any
  /** Applica un JSON alla scheda (puoi passare direttamente setData) */
  setData: (next: any) => void
  /** Selettore del nodo da catturare in PDF (es. "#sheet-print") */
  targetSelector: string
  /** Nome base del file esportato (senza estensione) */
  filename?: string
}

export default function SheetExportBar({
  getData,
  setData,
  targetSelector,
  filename = 'scheda-personaggio',
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleExportPDF() {
    const el = document.querySelector<HTMLElement>(targetSelector)
    if (!el) {
      alert('Elemento per la stampa non trovato.')
      return
    }

    // Import dinamici per evitare errori in build/SSR
    const html2canvas = (await import('html2canvas')).default
    const jsPDF = (await import('jspdf')).default

    // Screenshot ad alta risoluzione
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      backgroundColor: getComputedStyle(document.body).backgroundColor || '#ffffff',
      windowWidth: document.documentElement.clientWidth, // evita layout stretti
    })
    const imgData = canvas.toDataURL('image/png')

    // A4 in pt
    const pdf = new jsPDF('p', 'pt', 'a4')
    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()

    // Ridimensiona l'immagine alla larghezza della pagina
    const imgW = pageW
    const imgH = (canvas.height * imgW) / canvas.width

    // Paginazione verticale: stessa immagine traslata
    let yOffset = 0
    while (yOffset < imgH) {
      pdf.addImage(imgData, 'PNG', 0, -yOffset, imgW, imgH)
      yOffset += pageH
      if (yOffset < imgH) pdf.addPage()
    }

    pdf.save(`${filename}.pdf`)
  }

  function handleExportJSON() {
    const data = getData()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function openImport() {
    fileInputRef.current?.click()
  }

  function handleImportChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const obj = JSON.parse(String(reader.result || '{}'))
        // Applica direttamente: se preferisci un merge soft,
        // fanne uno qui prima di passarlo.
        setData(obj)
        alert('Scheda importata. Ricorda di SALVARE.')
      } catch {
        alert('JSON non valido')
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    }
    reader.readAsText(f)
  }

  return (
    <div className="flex items-center gap-2">
      <button className="btn" onClick={handleExportPDF}>⬇︎ PDF</button>
      <button className="btn" onClick={handleExportJSON}>⬇︎ JSON</button>
      <button className="btn !bg-zinc-800" onClick={openImport}>⬆︎ Importa JSON</button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={handleImportChange}
      />
    </div>
  )
}

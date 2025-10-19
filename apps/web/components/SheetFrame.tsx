'use client'

import React from 'react'

/**
 * Wrapper del contenuto “stampabile”.
 * Espone l'id #sheet-print per la cattura PDF.
 */
export default function SheetFrame({ children }: { children: React.ReactNode }) {
  return (
    <div id="sheet-print" className="space-y-4">
      {children}
    </div>
  )
}

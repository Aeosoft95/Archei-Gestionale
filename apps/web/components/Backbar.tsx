'use client'
export default function BackBar({ title }: { title?: string }) {
  function goBack() {
    if (typeof window !== 'undefined') {
      if (window.history.length > 1) window.history.back()
      else window.location.href = '/'
    }
  }
  return (
    <div className="border-b border-zinc-800 p-3 flex items-center justify-between">
      <div className="text-zinc-300">{title || 'ARCHEI Companion'}</div>
      <button className="btn !bg-zinc-800" onClick={goBack}>⟵ Indietro</button>
    </div>
  )
}

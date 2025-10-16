'use client'

export default function BackButton() {
  function goBack() {
    if (typeof window !== 'undefined') {
      if (window.history.length > 1) window.history.back()
      else window.location.href = '/'
    }
  }

  return (
    <button className="btn !bg-zinc-800" onClick={goBack}>
      ⟵ Indietro
    </button>
  )
}

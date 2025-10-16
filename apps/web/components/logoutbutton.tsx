'use client'
export default function LogoutButton() {
  function logout() {
    try {
      localStorage.removeItem('archei:nick')
      localStorage.removeItem('archei:role')
      localStorage.removeItem('archei:gm:notes')
    } catch {}
    window.location.href = '/'
  }
  return (
    <button className="btn !bg-zinc-800" onClick={logout}>↩︎ Logout</button>
  )
}

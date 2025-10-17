import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default function Home() {
  const hasSession = cookies().has('session')
  // Se non autenticato → vai al login, altrimenti dove vuoi (es. dashboard)
  redirect(hasSession ? '/dashboard' : '/auth/login')
}

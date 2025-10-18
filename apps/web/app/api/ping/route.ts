// apps/web/app/api/admin/ping/route.ts
export const runtime = 'nodejs'

export async function GET() {
  const secret = process.env.ADMIN_SECRET || ''
  // Maschera il segreto (non logghiamo tutto in chiaro)
  const masked = secret ? `${secret.slice(0, 3)}***${secret.slice(-3)}` : '(vuoto)'

  // Piccolo log server-side per conferma
  console.log('[ADMIN PING] ADMIN_SECRET (masked):', masked)

  return Response.json({
    ok: true,
    // Mostriamo solo info di debug, MAI il segreto completo
    adminSecretPresent: Boolean(secret),
    adminSecretMasked: masked,
    whereToPutEnv: 'apps/web/.env.local',
    hint: 'Dopo aver modificato .env.local riavvia pnpm dev:web'
  })
}

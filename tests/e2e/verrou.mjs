// Test du verrou de session (données fictives, aucune requête vers la vraie base).
// Lancer : npm run build && node tests/e2e/verrou.mjs
import { createRequire } from 'node:module'
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
const { chromium } = createRequire(import.meta.url)('playwright')

const dist = path.resolve('dist'), port = 5198
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' }
const srv = http.createServer((q, r) => { let p = q.url.split('?')[0]; if (p === '/' || !fs.existsSync(path.join(dist, p))) p = '/index.html'; const f = path.join(dist, p); r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); r.end(fs.readFileSync(f)) }).listen(port)

const USER = { id: '11111111-1111-1111-1111-111111111111', full_name: 'Test Dépôt', role_id: '00000000-0000-0000-0000-000000000001', role_name: 'super_admin' }
let ko = 0; const echec = m => { ko++; console.log('  ✗', m) }; const bon = m => console.log('  ✓', m)
const b = await chromium.launch()

async function contexte({ jeton, sessionOk = true, pin = {} } = {}) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } })
  const req = []
  await ctx.addInitScript(([j]) => {
    if (j) { localStorage.setItem('epicure_session', JSON.stringify({ user: { id: '11111111-1111-1111-1111-111111111111', full_name: 'Test Dépôt', role_id: '00000000-0000-0000-0000-000000000001', role_name: 'super_admin' }, permissions: [] })); if (j !== 'aucun') localStorage.setItem('epicure_jeton', j) }
  }, [jeton])
  await ctx.route('**/rest/v1/**', route => {
    const u = route.request().url(); const h = route.request().headers()
    req.push({ u, jeton: h['x-depot-session'] || null })
    const body = JSON.parse(route.request().postData() || '{}')
    let res = []
    if (u.includes('/rpc/verify_pin')) res = pin[body.p_pin] ?? null
    else if (u.includes('/rpc/depot_session_ok')) res = sessionOk
    else if (u.includes('/rpc/')) res = null
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(res) })
  })
  await ctx.route(u => !u.href.startsWith(`http://localhost:${port}`) && !u.href.includes('/rest/v1/'), r => r.abort())
  return { ctx, req, page: await ctx.newPage() }
}
const taper = async (page, code) => { for (const c of code) await page.getByRole('button', { name: c, exact: true }).click(); await page.getByRole('button', { name: 'Valider', exact: true }).click(); await page.waitForTimeout(700) }

// 1. Connexion : le jeton reçu est envoyé ensuite avec chaque requête
{
  const { req, page } = await contexte({ pin: { '1234': { ...USER, session: '22222222-2222-2222-2222-222222222222' }, '9999': { erreur: 'bloque' } } })
  await page.goto(`http://localhost:${port}/login`); await page.waitForTimeout(500)
  await taper(page, '5555')
  if (await page.getByText('PIN incorrect').count()) bon('mauvais PIN refusé'); else echec('mauvais PIN : pas de message')
  await taper(page, '9999')
  if (await page.getByText(/Trop d.essais/).count()) bon('blocage annoncé'); else echec('blocage : pas de message')
  req.length = 0
  await taper(page, '1234'); await page.waitForTimeout(800)
  const apres = req.filter(r => !r.u.includes('verify_pin'))
  if (!apres.length) echec('aucune requête après connexion')
  else if (apres.every(r => r.jeton === '22222222-2222-2222-2222-222222222222')) bon(`le jeton part avec les ${apres.length} requêtes suivantes`)
  else echec('requête sans jeton après connexion')
  if (await page.evaluate(() => JSON.parse(localStorage.getItem('epicure_session')).user.session)) echec('le jeton est rangé dans la fiche utilisateur'); else bon('fiche utilisateur sans jeton')
}
// 2. Ancienne connexion sans jeton : retour au PIN
{
  const { page } = await contexte({ jeton: 'aucun' })
  await page.goto(`http://localhost:${port}/depot`); await page.waitForTimeout(800)
  if (await page.getByText('Saisir votre PIN').count()) bon('ancienne connexion sans jeton → PIN'); else echec('ancienne connexion gardée sans jeton')
}
// 3. Jeton expiré côté serveur : retour au PIN
{
  const { page } = await contexte({ jeton: '33333333-3333-3333-3333-333333333333', sessionOk: false })
  await page.goto(`http://localhost:${port}/depot`); await page.waitForTimeout(1200)
  if (await page.getByText('Saisir votre PIN').count()) bon('jeton expiré → PIN'); else echec('jeton expiré accepté')
}
// 4. Jeton valide : on reste connecté
{
  const { page } = await contexte({ jeton: '33333333-3333-3333-3333-333333333333', sessionOk: true })
  await page.goto(`http://localhost:${port}/depot`); await page.waitForTimeout(1200)
  if (!(await page.getByText('Saisir votre PIN').count())) bon('jeton valide → reste connecté'); else echec('jeton valide refusé')
}
await b.close(); srv.close()
console.log(ko ? `\n${ko} échec(s)` : '\nTout passe'); process.exit(ko ? 1 : 0)

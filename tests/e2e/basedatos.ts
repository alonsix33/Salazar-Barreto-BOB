import { test as base, expect, type Page } from '@playwright/test'
import { tomarCerrojo, soltarCerrojo } from '../cerrojo'

/**
 * `test` con la base en exclusiva y ya resembrada.
 *
 * Cada test arranca de la semilla, y ningún otro worker la toca mientras corre.
 */
export const test = base.extend<{ baseLimpia: void }>({
  baseLimpia: [
    async ({ page }, usar) => {
      // Menos que el tiempo límite del test, o el error de aquí no se ve nunca.
      // La suite de integración lo retiene un rato largo —toda su corrida—, así
      // que si las dos van a la vez esto falla con un mensaje que lo explica, en
      // vez de con cuatro rojos repartidos por sitios que no tienen la culpa.
      await tomarCerrojo(20_000)
      try {
        const pin = await page.request.post('/api/admin/pin', {
          data: { pin: process.env.ADMIN_PIN ?? '2026' },
        })
        expect(pin.ok(), 'el PIN del entorno tiene que ser válido').toBeTruthy()
        // El PIN va primero: resembrar ahora exige sesión de administración,
        // igual que cualquier otra escritura. Antes borraba la base entera con
        // un `curl` sin credencial.
        const r = await page.request.post('/api/pruebas/resembrar')
        expect(
          r.ok(),
          `resembrar devolvió ${r.status()}: ${(await r.text()).slice(0, 200)}`,
        ).toBeTruthy()
        await usar()
      } finally {
        soltarCerrojo()
      }
    },
    { auto: true },
  ],
})

export { expect, type Page }

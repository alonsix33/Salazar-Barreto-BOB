/**
 * Con qué responde Bob, según las variables de entorno.
 *
 * Esto existe por un fallo que no se veía: en producción estaba la clave de
 * DeepSeek y no estaba `BOB_MODO`, así que Bob contestaba con el catálogo.
 * Ninguna prueba se ponía roja, ningún log decía nada, y desde fuera Bob se veía
 * igual —el catálogo responde a todo—, solo que peor. La única señal era que las
 * respuestas eran siempre las mismas cuatro.
 */

import { afterEach, describe, expect, it } from 'vitest'
import { modoDeBob, porQueEseModo } from '../index'

const original = { ...process.env }

afterEach(() => {
  process.env = { ...original }
})

function conEntorno(vars: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
}

describe('modoDeBob', () => {
  it('con clave y sin BOB_MODO usa el modelo · es el caso que estaba roto', () => {
    conEntorno({ DEEPSEEK_API_KEY: 'sk-loquesea', BOB_MODO: undefined, BOB_SIN_MODELO: undefined })
    expect(modoDeBob()).toBe('deepseek')
  })

  it('con clave y BOB_MODO=determinista usa el modelo igual', () => {
    /**
     * El valor que `docs/DESPLIEGUE.md` mandaba poner antes de que existiera la
     * clave. Si siguiera apagando a Bob, el fallo de producción volvería en
     * cuanto alguien no borrara esa variable, que es exactamente lo que pasó.
     */
    conEntorno({ DEEPSEEK_API_KEY: 'sk-loquesea', BOB_MODO: 'determinista', BOB_SIN_MODELO: undefined })
    expect(modoDeBob()).toBe('deepseek')
  })

  it('sin clave responde con el catálogo, diga lo que diga BOB_MODO', () => {
    conEntorno({ DEEPSEEK_API_KEY: undefined, BOB_MODO: undefined, BOB_SIN_MODELO: undefined })
    expect(modoDeBob()).toBe('determinista')
    conEntorno({ BOB_MODO: 'determinista' })
    expect(modoDeBob()).toBe('determinista')
  })

  it('una clave vacía es no tener clave', () => {
    conEntorno({ DEEPSEEK_API_KEY: '', BOB_MODO: undefined, BOB_SIN_MODELO: undefined })
    expect(modoDeBob()).toBe('determinista')
  })

  it('BOB_SIN_MODELO apaga el modelo aunque haya clave · el freno de mano', () => {
    conEntorno({ DEEPSEEK_API_KEY: 'sk-loquesea', BOB_SIN_MODELO: '1', BOB_MODO: undefined })
    expect(modoDeBob()).toBe('determinista')
  })

  it('BOB_MODO=deepseek sin clave entra igual, y la falta de clave se ve luego', () => {
    // Lo necesita el caso «ni lo intenta»: el modo dice deepseek y `hayClave()`
    // lo devuelve al catálogo con motivo `sin-clave`, que es lo que se registra.
    conEntorno({ DEEPSEEK_API_KEY: undefined, BOB_MODO: 'deepseek', BOB_SIN_MODELO: undefined })
    expect(modoDeBob()).toBe('deepseek')
  })
})

describe('porQueEseModo · lo que se enseña en el panel', () => {
  it('dice cuál es la variable que manda, en cada caso', () => {
    conEntorno({ DEEPSEEK_API_KEY: 'sk-x', BOB_MODO: undefined, BOB_SIN_MODELO: undefined })
    expect(porQueEseModo()).toContain('DEEPSEEK_API_KEY')
    conEntorno({ DEEPSEEK_API_KEY: undefined })
    expect(porQueEseModo()).toContain('No hay DEEPSEEK_API_KEY')
    conEntorno({ BOB_SIN_MODELO: '1' })
    expect(porQueEseModo()).toContain('BOB_SIN_MODELO')
  })

  it('nunca enseña la clave', () => {
    conEntorno({ DEEPSEEK_API_KEY: 'sk-secretisima-123', BOB_MODO: undefined, BOB_SIN_MODELO: undefined })
    expect(porQueEseModo()).not.toContain('sk-secretisima-123')
  })
})

/**
 * Las reglas de lectura: qué entra en el motor.
 *
 * No calculan cuotas, deciden **con qué datos** se calculan, y equivocarse aquí
 * da cuotas plausibles y falsas: un gasto fijo con el monto del año pasado, o el
 * lavado del 401 cobrado en un mes que estaba desmarcado. Nada se pone rojo
 * solo: los siete números siguen sumando el total.
 *
 * Se prueban aquí, sueltas, porque desde que la foto del edificio existe hay dos
 * caminos que las usan —la lectura dentro de una transacción y la foto— y la
 * regla tiene que ser **una**. Cuando estuvo duplicada, la prueba negativa de
 * integración lo cazó: el defecto inyectado en un lado dejó de ponerse rojo
 * porque las pantallas ya pasaban por el otro.
 */

import { describe, expect, it } from 'vitest'
import {
  extraDeLaFila,
  fijosDeLasFilas,
  lavadoDeLasFilas,
  pagoDeLaFila,
  type FilaFijo,
  type FilaReasignacion,
} from '../filas'

/** La reasignación del lavado del 401: 1.50 m³ desde enero de 2026. */
const lavado = (activaEn: FilaReasignacion['activaEn']): FilaReasignacion[] => [
  { m3: 1.5, desde: '2026-01', activaEn },
]

describe('lavadoDeLasFilas · los m³ que aplican a un mes', () => {
  it('sin ninguna reasignación, cero', () => {
    expect(lavadoDeLasFilas([], '2026-06')).toBe(0)
  })

  it('una reasignación que todavía no empieza no se cobra', () => {
    expect(lavadoDeLasFilas(lavado([]), '2025-12')).toBe(0)
  })

  it('sin marca de ningún mes, se cobra el valor de hoy', () => {
    expect(lavadoDeLasFilas(lavado([]), '2026-06')).toBe(1.5)
  })

  it('con la casilla marcada y sin congelar, el valor de hoy', () => {
    expect(lavadoDeLasFilas(lavado([{ mes: '2026-06', activa: true, m3: null }]), '2026-06')).toBe(1.5)
  })

  it('con la casilla DESMARCADA, cero · aunque el valor global siga puesto', () => {
    expect(lavadoDeLasFilas(lavado([{ mes: '2026-06', activa: false, m3: null }]), '2026-06')).toBe(0)
  })

  it('el valor congelado manda sobre el de hoy · no se reescribe el pasado', () => {
    /**
     * El defecto que costó caro: el valor vivía solo en la reasignación global,
     * así que subirlo de 1.50 a 3.00 movía la cuota del 401 en junio de 2026
     * —un mes cerrado y avisado— en S/ 6.25, mientras el aviso a los siete
     * juraba que los meses cerrados no se tocan.
     */
    const filas = lavado([{ mes: '2026-06', activa: true, m3: 1.5 }])
    filas[0]!.m3 = 3 // alguien sube el consumo hoy
    expect(lavadoDeLasFilas(filas, '2026-06')).toBe(1.5)
  })

  it('un mes desmarcado sigue en cero aunque tenga valor congelado', () => {
    expect(lavadoDeLasFilas(lavado([{ mes: '2026-06', activa: false, m3: 1.5 }]), '2026-06')).toBe(0)
  })

  describe('sin marca propia, se hereda la del mes anterior', () => {
    it('si el mes anterior estaba activo, este también', () => {
      expect(lavadoDeLasFilas(lavado([{ mes: '2026-05', activa: true, m3: 1.5 }]), '2026-06')).toBe(1.5)
    })

    it('si el mes anterior estaba desmarcado, este también · cero', () => {
      expect(lavadoDeLasFilas(lavado([{ mes: '2026-05', activa: false, m3: null }]), '2026-06')).toBe(0)
    })

    it('hereda el interruptor, NO el valor congelado · un mes sin cerrar sigue el de hoy', () => {
      const filas = lavado([{ mes: '2026-05', activa: true, m3: 1.5 }])
      filas[0]!.m3 = 3
      expect(lavadoDeLasFilas(filas, '2026-06')).toBe(3)
    })

    it('la herencia salta el año · diciembre manda sobre enero', () => {
      expect(lavadoDeLasFilas(lavado([{ mes: '2026-12', activa: false, m3: null }]), '2027-01')).toBe(0)
    })
  })

  it('con dos reasignaciones, gana la más reciente que ya aplica', () => {
    const filas: FilaReasignacion[] = [
      { m3: 4, desde: '2026-06', activaEn: [] },
      { m3: 1.5, desde: '2026-01', activaEn: [] },
    ]
    expect(lavadoDeLasFilas(filas, '2026-06')).toBe(4)
    expect(lavadoDeLasFilas(filas, '2026-05')).toBe(1.5)
  })
})

describe('fijosDeLasFilas · los gastos vigentes en un mes', () => {
  const fijos: FilaFijo[] = [
    { concepto: 'Portería', monto: 1200, anual: false, activo: true, vigenteDesde: '2026-01', orden: 0 },
    { concepto: 'Portería', monto: 1300, anual: false, activo: true, vigenteDesde: '2026-06', orden: 0 },
    { concepto: 'Pozo a tierra', monto: null, anual: true, activo: true, vigenteDesde: '2026-01', orden: 1 },
  ]

  it('un mes anterior al cambio cobra el monto viejo', () => {
    expect(fijosDeLasFilas(fijos, '2026-05')).toEqual([
      { concepto: 'Portería', monto: 1200 },
      { concepto: 'Pozo a tierra', monto: null, anual: true, porConfirmar: true },
    ])
  })

  it('desde el mes del cambio, el nuevo · y no se reescribe el pasado', () => {
    const junio = fijosDeLasFilas(fijos, '2026-06')
    expect(junio.find((f) => f.concepto === 'Portería')?.monto).toBe(1300)
    expect(fijosDeLasFilas(fijos, '2026-05').find((f) => f.concepto === 'Portería')?.monto).toBe(1200)
  })

  it('un concepto que aún no empieza no aparece', () => {
    expect(fijosDeLasFilas(fijos, '2025-12')).toEqual([])
  })

  it('`monto: null` es «por confirmar», no «cuesta cero»', () => {
    const pozo = fijosDeLasFilas(fijos, '2026-01').find((f) => f.concepto === 'Pozo a tierra')
    expect(pozo).toEqual({ concepto: 'Pozo a tierra', monto: null, anual: true, porConfirmar: true })
  })

  it('un monto de cero NO es «por confirmar» · son dos cosas distintas', () => {
    const cero: FilaFijo[] = [
      { concepto: 'Algo', monto: 0, anual: false, activo: true, vigenteDesde: '2026-01', orden: 0 },
    ]
    expect(fijosDeLasFilas(cero, '2026-01')).toEqual([{ concepto: 'Algo', monto: 0 }])
  })

  it('salen en el orden de la lista, y el empate lo rompe el nombre', () => {
    const mismos: FilaFijo[] = [
      { concepto: 'Zeta', monto: 1, anual: false, activo: true, vigenteDesde: '2026-01', orden: 3 },
      { concepto: 'Alfa', monto: 1, anual: false, activo: true, vigenteDesde: '2026-01', orden: 3 },
      { concepto: 'Primero', monto: 1, anual: false, activo: true, vigenteDesde: '2026-01', orden: 0 },
    ]
    expect(fijosDeLasFilas(mismos, '2026-01').map((f) => f.concepto)).toEqual(['Primero', 'Alfa', 'Zeta'])
  })

  describe('activo: false apaga el concepto sin borrar su historia', () => {
    it('un concepto desactivado desde el mes del cambio no aparece', () => {
      const filas: FilaFijo[] = [
        { concepto: 'Insumos limpieza', monto: 30, anual: false, activo: true, vigenteDesde: '2026-01', orden: 0 },
        { concepto: 'Insumos limpieza', monto: 30, anual: false, activo: false, vigenteDesde: '2026-06', orden: 0 },
      ]
      expect(fijosDeLasFilas(filas, '2026-05').map((f) => f.concepto)).toEqual(['Insumos limpieza'])
      expect(fijosDeLasFilas(filas, '2026-06')).toEqual([])
    })

    it('reactivarlo desde otro mes lo trae de vuelta, con el monto que se le puso', () => {
      const filas: FilaFijo[] = [
        { concepto: 'Insumos limpieza', monto: 30, anual: false, activo: true, vigenteDesde: '2026-01', orden: 0 },
        { concepto: 'Insumos limpieza', monto: 30, anual: false, activo: false, vigenteDesde: '2026-06', orden: 0 },
        { concepto: 'Insumos limpieza', monto: 35, anual: false, activo: true, vigenteDesde: '2026-08', orden: 0 },
      ]
      expect(fijosDeLasFilas(filas, '2026-07')).toEqual([])
      expect(fijosDeLasFilas(filas, '2026-08')).toEqual([{ concepto: 'Insumos limpieza', monto: 35 }])
    })
  })
})

describe('extraDeLaFila y pagoDeLaFila', () => {
  it('un gasto conserva quiénes lo pagan · el portón no lo paga el 101', () => {
    const e = extraDeLaFila({
      tipo: 'gasto', concepto: 'Portón', monto: 900, dptoId: null,
      participantes: ['201', '202', '301', '401', '501', '502'], reparto: 'porcentaje',
    })
    expect(e).toEqual({
      tipo: 'gasto', concepto: 'Portón', monto: 900,
      participantes: ['201', '202', '301', '401', '501', '502'], reparto: 'porcentaje',
    })
  })

  it('participantes vacío significa «lo pagan los siete»', () => {
    const e = extraDeLaFila({
      tipo: 'gasto', concepto: 'Pintura', monto: 100, dptoId: null, participantes: [], reparto: 'porcentaje',
    })
    expect(e).toMatchObject({ participantes: [] })
  })

  it('un crédito va contra un departamento, no contra una lista', () => {
    expect(
      extraDeLaFila({
        tipo: 'credito', concepto: 'Devolución', monto: 50, dptoId: '401',
        participantes: [], reparto: 'porcentaje',
      }),
    ).toEqual({ tipo: 'credito', concepto: 'Devolución', monto: 50, dpto: '401' })
  })

  it('un pago conserva su estado, su fecha y su monto real', () => {
    expect(
      pagoDeLaFila({ estado: 'aviso', fecha: '2026-08-13', monto: 665.1, operacion: '0012', texto: 'ya pagué' }),
    ).toEqual({ estado: 'aviso', fecha: '2026-08-13', monto: 665.1, op: '0012', texto: 'ya pagué' })
  })
})

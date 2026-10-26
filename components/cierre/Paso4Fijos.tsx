'use client'

import { COPYS } from '@/lib/copys'
import { fmt } from '@/lib/calculo/redondeo'
import { CONCEPTO_AGUA, CONCEPTO_LUZ } from '@/lib/calculo/constantes'
import type { PropsPaso } from './Wizard'
import { BotonAvanzar } from './BotonAvanzar'
import { FilaFijo } from './FilaFijo'
import { NuevoFijo } from './NuevoFijo'
import { AvisoBob } from './AvisoBob'
import { BobDice } from '@/components/BobDice'
import { MOMENTOS } from '@/lib/bob/momentos'
import { Fallo } from '@/components/ui/Fallo'

/**
 * Paso 4 · Los gastos fijos. `04-cierre-del-mes.md`.
 *
 * Ya están puestos con su monto habitual. El **pozo a tierra** aparece sin cifra
 * y con fondo ámbar: es un gasto real cuya cifra nadie confirmó todavía. **No
 * bloquea el avance**, porque no tenerla no impide cerrar el mes.
 */
export function Paso4Fijos({ borrador, guardar, guardando, errorGuardar, avanzar }: PropsPaso) {
  const fijos = borrador.resultado.gastos.filter(
    (g) => g.concepto !== CONCEPTO_AGUA && g.concepto !== CONCEPTO_LUZ && !g.extra,
  )
  const suman = fijos.reduce((s, g) => s + (g.monto ?? 0), 0)
  const sinCifra = fijos.filter((g) => g.porConfirmar)

  return (
    <div className="cierre-cuerpo">
      <h2 className="tipo-titulo-hoja cierre-titulo">{COPYS.cierre.fijosTitulo}</h2>
      <p className="tipo-cuerpo-chico text-gris cierre-intro">{COPYS.cierre.fijosIntro}</p>

      {fijos.map((g) => (
        <FilaFijo
          key={g.concepto}
          concepto={g.concepto}
          monto={g.monto}
          anual={!!g.anual}
          porConfirmar={!!g.porConfirmar}
          onMonto={(v) => void guardar('gastos-fijos', { concepto: g.concepto, monto: v })}
          onAnual={(anual) => void guardar('gastos-fijos', { concepto: g.concepto, monto: g.monto, anual })}
          onDesactivar={() => void guardar('gastos-fijos', { concepto: g.concepto, monto: g.monto, activo: false })}
        />
      ))}

      <div className="fijos-suman">
        <span className="tipo-etiqueta-seccion text-sobre-noche-etiqueta">{COPYS.cierre.suman}</span>
        <span className="tipo-cifra-bloque">{fmt(suman)}</span>
      </div>

      <NuevoFijo
        existentes={fijos.map((g) => g.concepto)}
        onGuardar={(n) => void guardar('gastos-fijos', n)}
      />

      {sinCifra.length > 0 && (
        <AvisoBob>
          <BobDice
            momento="cierre-sin-cifra"
            datos={{ concepto: sinCifra[0]!.concepto }}
            mes={borrador.mes}
            dpto={null}
          >
            {MOMENTOS['cierre-sin-cifra'].determinista({ concepto: sinCifra[0]!.concepto })}
          </BobDice>
        </AvisoBob>
      )}
      {errorGuardar && <Fallo>{errorGuardar}</Fallo>}

      <BotonAvanzar onClick={avanzar} cargando={guardando}>
        {COPYS.cierre.confirmarSeguir}
      </BotonAvanzar>
    </div>
  )
}

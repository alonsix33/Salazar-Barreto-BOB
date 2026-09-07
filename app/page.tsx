import { dptoElegido } from '@/lib/sesion'
import { mesesPublicados, serieDelSaldo } from '@/lib/datos/meses'
import { pagosDe, resultadoDeMes } from '@/lib/datos/mes'
import { sinLeer } from '@/lib/datos/avisos'
import { saldoAl } from '@/lib/calculo/saldo'
import { Onboarding } from '@/components/pantallas/Onboarding'
import { Inicio } from '@/components/pantallas/Inicio'
import { SinDatos } from '@/components/pantallas/SinDatos'
import type { MesId } from '@/lib/calculo/tipos'

/**
 * La raíz: onboarding si todavía no eligió departamento, Inicio si ya.
 *
 * `README` §6: sin `dpto` no se ve nada más que el onboarding.
 */
export default async function Pagina() {
  const dpto = await dptoElegido()
  if (!dpto) return <Onboarding />

  const publicados = await mesesPublicados()
  const mes = publicados[publicados.length - 1] as MesId | undefined
  if (!mes) return <SinDatos />

  const [resultado, pagos, serie, noLeidos] = await Promise.all([
    resultadoDeMes(mes),
    pagosDe(mes),
    serieDelSaldo(),
    sinLeer(dpto),
  ])
  if (!resultado.valido) return <SinDatos motivo={resultado.motivoInvalido} />

  return (
    <Inicio
      dpto={dpto}
      mes={mes}
      resultado={resultado}
      pagos={pagos}
      saldo={saldoAl(serie, mes)}
      serieSaldo={serie.filter((f) => f.mes <= mes)}
      sinLeer={noLeidos}
    />
  )
}

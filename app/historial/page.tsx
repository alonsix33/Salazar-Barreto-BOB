import { dptoElegido } from '@/lib/sesion'
import { listaDeMeses, serieDelSaldo } from '@/lib/datos/meses'
import { resultadoDeMes } from '@/lib/datos/mes'
import { cortosConAnio } from '@/lib/calculo/mes'
import { Historial } from '@/components/pantallas/Historial'
import { Onboarding } from '@/components/pantallas/Onboarding'
import { SinDatos } from '@/components/pantallas/SinDatos'

export default async function Pagina() {
  const dpto = await dptoElegido()
  if (!dpto) return <Onboarding />

  const [meses, serie] = await Promise.all([listaDeMeses(), serieDelSaldo()])
  const publicados = meses.filter((m) => m.publicado)
  if (publicados.length === 0) return <SinDatos />

  // Etiquetas cortas con el año en los saltos, para que una serie que cruza de
  // 2025 a 2026 no confunda dos «ENE». Mismo orden ascendente en los dos gráficos.
  const cortos = cortosConAnio(publicados.map((m) => m.mes))
  const etiquetas = new Map(publicados.map((m, i) => [m.mes, cortos[i]!]))

  const m3PorMes = await Promise.all(
    publicados.map(async (m) => {
      const r = await resultadoDeMes(m.mes)
      return { mes: m.mes, corto: etiquetas.get(m.mes) ?? m.corto, m3: r.valido ? r.rec.aguaM3 : 0 }
    }),
  )

  const serieConAnio = serie
    .filter((f) => publicados.some((m) => m.mes === f.mes))
    .map((f) => ({ ...f, corto: etiquetas.get(f.mes) ?? f.corto }))

  return (
    <Historial
      dpto={dpto}
      mes={publicados[publicados.length - 1]?.mes ?? null}
      serie={serieConAnio}
      meses={publicados}
      m3PorMes={m3PorMes}
    />
  )
}

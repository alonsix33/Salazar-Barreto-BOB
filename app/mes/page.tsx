import { redirect } from 'next/navigation'
import { mesesPublicados } from '@/lib/datos/meses'

/** `/mes` sin mes: se va al último publicado. */
export default async function Pagina() {
  const publicados = await mesesPublicados()
  const ultimo = publicados[publicados.length - 1]
  redirect(ultimo ? `/mes/${ultimo}` : '/')
}

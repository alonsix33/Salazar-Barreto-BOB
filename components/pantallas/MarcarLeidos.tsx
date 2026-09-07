'use client'

import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { COPYS } from '@/lib/copys'
import type { DptoId } from '@/lib/calculo/tipos'

/** "Marcar todo leído" · apaga el punto de la campana. */
export function MarcarLeidos({ dpto }: { dpto: DptoId }) {
  const router = useRouter()
  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/avisos/leer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ dpto }),
      })
      if (!r.ok) throw new Error('No se pudo marcar')
      return r.json()
    },
    onSuccess: () => router.refresh(),
  })

  return (
    <button type="button" onClick={() => mutate()} aria-disabled={isPending} className="tipo-contexto text-terra">
      {COPYS.avisos.marcarLeido}
    </button>
  )
}

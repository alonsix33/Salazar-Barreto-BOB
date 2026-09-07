'use client'

import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { ProveedorHojas } from '@/components/hojas/Hojas'
import { ProveedorNumpad } from '@/components/Numpad'
import { ProveedorContexto } from '@/components/hojas/Contexto'
import { ProveedorAnuncio } from '@/components/Anuncio'

/**
 * Los proveedores de cliente.
 *
 * TanStack Query con `staleTime` alto a propósito: los datos del edificio
 * cambian una vez al mes, no cada treinta segundos. Refrescar en cada foco
 * gastaría datos móviles para no enseñar nada nuevo.
 */
export function ProveedoresCliente({ children }: { children: ReactNode }) {
  const [cliente] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  )
  return (
    <QueryClientProvider client={cliente}>
      <ProveedorAnuncio>
        <ProveedorContexto>
          <ProveedorHojas>
            <ProveedorNumpad>{children}</ProveedorNumpad>
          </ProveedorHojas>
        </ProveedorContexto>
      </ProveedorAnuncio>
    </QueryClientProvider>
  )
}

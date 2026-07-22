'use client'

import {useEffect} from 'react'

export default function AppError({error, reset}: {error: Error & {digest?: string}; reset: () => void}) {
  useEffect(() => console.error(error), [error])
  return (
    <main className="error-boundary">
      <h1>Something went wrong</h1>
      <button className="btn btn-primary" onClick={reset}>Try again</button>
    </main>
  )
}

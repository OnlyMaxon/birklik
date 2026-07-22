import Link from 'next/link'

export default function NotFound() {
  return <main className="error-boundary"><h1>404</h1><Link className="btn btn-primary" href="/">Birklik.az</Link></main>
}

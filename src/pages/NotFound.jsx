import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="page-shell grid min-h-[65vh] place-items-center py-20 text-center">
      <div>
        <p className="font-display text-9xl font-black text-white/[0.06]">404</p>
        <p className="eyebrow -mt-8">Offside</p>
        <h1 className="mt-4 font-display text-5xl font-black uppercase">This page left the pitch.</h1>
        <p className="mx-auto mt-4 max-w-md text-slate-400">The page you were looking for does not exist or has moved.</p>
        <Link to="/" className="button-primary mt-8"><ArrowLeft size={17} /> Back home</Link>
      </div>
    </div>
  )
}

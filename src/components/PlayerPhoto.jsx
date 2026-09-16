import { useState } from 'react'
import { getInitials } from '../utils/formatters.js'

const sizes = {
  sm: 'size-10 text-xs',
  md: 'size-16 text-sm',
  lg: 'size-20 text-base',
}

export default function PlayerPhoto({ player, size = 'md', className = '', eager = false }) {
  const [failed, setFailed] = useState(false)

  return (
    <span
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white/80 bg-gradient-to-br from-barca-blue to-claret font-display font-black text-white shadow-[0_10px_28px_rgba(0,0,0,.3)] ${sizes[size]} ${className}`}
    >
      {!failed && player.image ? (
        <img
          src={player.image}
          alt={`${player.name} portrait`}
          className="size-full object-cover object-top"
          loading={eager ? 'eager' : 'lazy'}
          onError={() => setFailed(true)}
        />
      ) : (
        <span aria-label={player.name}>{getInitials(player.name)}</span>
      )}
    </span>
  )
}

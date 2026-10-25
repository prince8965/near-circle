import type { Category } from '../../types'
import { CategoryIcon } from './CategoryIcon'

interface Props {
  category: Category | 'all'
  label?: string
  selected?: boolean
  onClick?: () => void
  size?: 'sm' | 'md'
}

/** Interactive when onClick is provided, otherwise a static label. */
export function CategoryChip({ category, label, selected = false, onClick, size = 'md' }: Props) {
  const text = label ?? (category === 'all' ? 'All' : category)
  const base = `inline-flex items-center gap-1.5 rounded-full font-medium transition ${
    size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-2 text-sm'
  }`
  const look = selected
    ? 'bg-brand text-[#0B0F19] font-bold shadow-cyber'
    : 'bg-secondary text-ink-muted border border-[#334155]/80 hover:text-white hover:border-brand/50'
  const content = (
    <>
      {category !== 'all' && <CategoryIcon category={category} className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />}
      {text}
    </>
  )
  if (!onClick) return <span className={`${base} bg-[#0B0F19]/90 border border-[#334155] text-white backdrop-blur-md`}>{content}</span>
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} className={`${base} ${look}`}>
      {content}
    </button>
  )
}

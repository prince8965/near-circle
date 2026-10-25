import { Brain, Briefcase, Code, Cpu, Music, Palette, Trophy, Wrench, type LucideIcon } from 'lucide-react'
import type { Category } from '../../types'

export const CATEGORY_ICONS: Record<Category, LucideIcon> = {
  Technology: Cpu,
  'AI/ML': Brain,
  'Web Development': Code,
  Music: Music,
  Sports: Trophy,
  Art: Palette,
  Business: Briefcase,
  Workshops: Wrench,
}

export function CategoryIcon({ category, className = 'h-4 w-4' }: { category: Category; className?: string }) {
  const Icon = CATEGORY_ICONS[category]
  return <Icon className={className} aria-hidden />
}

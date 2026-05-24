import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'

import { cn } from '../../lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em]',
  {
    variants: {
      variant: {
        default: 'bg-foreground text-white',
        secondary: 'bg-secondary text-secondary-foreground',
        success: 'bg-emerald-100 text-emerald-700',
        danger: 'bg-rose-100 text-rose-700',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

type BadgeProps = HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

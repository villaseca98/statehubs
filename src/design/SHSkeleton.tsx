import type { HTMLAttributes } from 'react';
export interface SHSkeletonProps extends HTMLAttributes<HTMLDivElement> {
  width?: string | number;
  height?: string | number;
  rounded?: 'sm' | 'md' | 'full';
}
const radius = { sm: 'rounded-md', md: 'rounded-xl', full: 'rounded-full' } as const;
/** Decorative placeholder: wrap groups with aria-busy and an accessible status message. */
export function SHSkeleton({ width = '100%', height = 16, rounded = 'md', className = '', style, ...props }: SHSkeletonProps) {
  return <div {...props} aria-hidden="true" className={`sh-skeleton ${radius[rounded]} ${className}`} style={{ width, height, ...style }} />;
}

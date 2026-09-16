import type { SelectHTMLAttributes } from "react"
import clsx from "clsx"

type TermSelectProps = SelectHTMLAttributes<HTMLSelectElement>

export const TermSelect = ({ className, children, ...props }: TermSelectProps) => {
  return (
    <select
      className={clsx("term-select", className)}
      {...props}
    >
      {children}
    </select>
  )
}

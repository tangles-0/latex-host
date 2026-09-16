import type { ReactNode, TableHTMLAttributes } from "react"
import clsx from "clsx"

type TermTableProps = TableHTMLAttributes<HTMLTableElement> & {
  children: ReactNode
}

export const TermTable = ({ className, children, ...props }: TermTableProps) => {
  return (
    <div className="overflow-x-auto">
      <table
        className={clsx("term-table", className)}
        {...props}
      >
        {children}
      </table>
    </div>
  )
}

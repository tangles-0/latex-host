import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react"
import clsx from "clsx"

type TermInputProps = InputHTMLAttributes<HTMLInputElement>

export const TermInput = ({ className, ...props }: TermInputProps) => {
  return (
    <input
      className={clsx("term-input", className)}
      {...props}
    />
  )
}

type TermTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>

export const TermTextarea = ({ className, ...props }: TermTextareaProps) => {
  return (
    <textarea
      className={clsx("term-input", className)}
      {...props}
    />
  )
}

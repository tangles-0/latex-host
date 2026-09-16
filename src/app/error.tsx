"use client"

import { useEffect } from "react"
import { TermButton } from "@/components/ui/term-button"
import { PageScaffold } from "@/components/ui/page-scaffold"
import { StatusBadge } from "@/components/ui/status-badge"

const GlobalAppError = ({
  error,
  reset
}: {
  error: Error & { digest?: string }
  reset: () => void
}) => {
  useEffect(() => {
    console.error(error)
  }, [error])

  const message = error.message.toLowerCase()
  const isDbIssue =
    message.includes("database_url is not set") ||
    message.includes("getaddrinfo") ||
    message.includes("econnrefused") ||
    message.includes("connection terminated")

  return (
    <PageScaffold width="narrow">
      <div className="flex items-center gap-3">
        <StatusBadge tone="err" />
        <h1 className="font-display text-3xl">Service temporarily unavailable</h1>
      </div>
      <p className="text-neutral-600">
        {isDbIssue
          ? "The database is currently unavailable. Please try again in a minute."
          : "Something went wrong while loading this page."}
      </p>
      <TermButton
        variant="primary"
        onClick={() => reset()}
      >
        Try again
      </TermButton>
    </PageScaffold>
  )
}

export default GlobalAppError

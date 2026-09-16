"use client"

import { usePathname } from "next/navigation"
import { TermButton } from "@/components/ui/term-button"

const ADMIN_LINKS = [
  { href: "/admin", label: "overview", exact: true },
  { href: "/admin/users", label: "users" },
  { href: "/admin/groups", label: "groups" },
  { href: "/admin/nodes", label: "nodes" },
  { href: "/admin/limits", label: "limits" },
  { href: "/admin/settings", label: "settings" },
  { href: "/admin/patch-notes", label: "patch notes" },
  { href: "/admin/abuse", label: "abuse" }
] as const

export const AdminNav = () => {
  const pathname = usePathname()

  return (
    <div className="admin-nav">
      <span className="glow-danger mr-2 font-display text-lg">ADMIN</span>
      {ADMIN_LINKS.map(link => {
        const active = "exact" in link && link.exact ? pathname === link.href : pathname.startsWith(link.href)
        return (
          <TermButton
            key={link.href}
            href={link.href}
            variant="admin"
            active={active}
          >
            {link.label}
          </TermButton>
        )
      })}
    </div>
  )
}

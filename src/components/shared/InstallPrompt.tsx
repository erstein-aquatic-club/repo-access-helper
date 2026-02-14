import { useEffect, useState } from "react"
import { X, Download } from "lucide-react"
import { cn } from "@/lib/utils"

const STORAGE_KEY = "eac-install-prompt-dismissed"

/**
 * InstallPrompt detects if the app is installable and shows a banner
 * prompting users to install it as a PWA.
 *
 * Features:
 * - Detects `beforeinstallprompt` event
 * - Shows dismissible banner
 * - Triggers browser install prompt on click
 * - Stores dismissal in localStorage
 * - Auto-hides after successful install
 */
export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null)
  const [isDismissed, setIsDismissed] = useState(false)
  const [isInstalling, setIsInstalling] = useState(false)

  useEffect(() => {
    // Check if user has previously dismissed the prompt
    const dismissed = localStorage.getItem(STORAGE_KEY)
    if (dismissed === "true") {
      setIsDismissed(true)
      return
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault()
      // Stash the event so it can be triggered later
      setDeferredPrompt(e)
    }

    // Listen for successful app install
    const handleAppInstalled = () => {
      // Clear the deferredPrompt
      setDeferredPrompt(null)
      // Hide the banner
      setIsDismissed(true)
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
    window.addEventListener("appinstalled", handleAppInstalled)

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt)
      window.removeEventListener("appinstalled", handleAppInstalled)
    }
  }, [])

  const handleInstallClick = async () => {
    if (!deferredPrompt) return

    setIsInstalling(true)

    // Show the install prompt
    const promptEvent = deferredPrompt as any
    promptEvent.prompt()

    // Wait for the user to respond to the prompt
    const { outcome } = await promptEvent.userChoice

    if (outcome === "accepted") {
      console.log("[EAC] User accepted the install prompt")
    } else {
      console.log("[EAC] User dismissed the install prompt")
    }

    // Clear the deferredPrompt
    setDeferredPrompt(null)
    setIsInstalling(false)
  }

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, "true")
    setIsDismissed(true)
  }

  // Don't show if dismissed or no prompt available
  if (isDismissed || !deferredPrompt) {
    return null
  }

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-[var(--z-index-toast)] transform transition-transform duration-300 translate-y-0"
      )}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-primary text-primary-foreground shadow-lg">
        <div className="flex items-center gap-3 flex-1">
          <Download className="h-5 w-5 shrink-0" />
          <span className="text-sm font-medium">
            Installer l'application sur votre écran d'accueil
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleInstallClick}
            disabled={isInstalling}
            className={cn(
              "px-3 py-1.5 text-xs font-bold uppercase tracking-wide rounded-md transition-colors",
              "bg-white text-primary hover:bg-white/90 active:bg-white/80",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
            aria-label="Installer l'application"
          >
            {isInstalling ? "Installation..." : "Installer"}
          </button>
          <button
            onClick={handleDismiss}
            className={cn(
              "p-1 rounded-md transition-colors shrink-0",
              "hover:bg-white/10 active:bg-white/20",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
            )}
            aria-label="Fermer la bannière d'installation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

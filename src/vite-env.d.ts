/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CIRCLE_CLIENT_KEY?: string
  readonly VITE_CIRCLE_MODULAR_CLIENT_URL?: string
}

interface Window {
  ethereum?: {
    isMetaMask?: boolean
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
    on?: (event: string, handler: (...args: unknown[]) => void) => void
    removeListener?: (event: string, handler: (...args: unknown[]) => void) => void
  }
}

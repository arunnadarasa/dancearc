/** Grouped links for the main hub — DanceArc MVP routes. */

export type HubRoute = { href: string; title: string; hint: string }

export type HubRouteGroup = { label: string; routes: HubRoute[]; footnote?: string }

export const HUB_ROUTE_GROUPS: HubRouteGroup[] = [
  {
    label: 'Core DanceTech',
    routes: [
      { href: '/battle', title: 'Battle', hint: 'Entry + payout (mock + Arc wiring)' },
      { href: '/coaching', title: 'Coaching', hint: 'Minutes + Arc testnet USDC settle' },
      { href: '/beats', title: 'Beats', hint: 'License + Arc testnet USDC' },
      { href: '/dance-extras', title: 'Judge score', hint: 'Live Arc USDC per call' },
    ],
  },
  {
    label: 'Arc + Circle',
    routes: [
      { href: '/bridge', title: 'Bridge & fund', hint: 'Circle App Kit + faucets' },
    ],
    footnote:
      'Per-action pricing defaults to 0.001 USDC (≤ $0.01). Fund Arc Testnet via Circle faucet + native gas faucet per Arc docs.',
  },
]

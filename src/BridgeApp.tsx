import './App.css'

export default function BridgeApp() {
  return (
    <main className="app app-cli-docs">
      <header className="hero">
        <h1>Fund & bridge USDC</h1>
        <p>
          Use <strong>Circle faucet</strong> for testnet USDC, then <strong>Arc App Kit Bridge</strong> to move USDC
          onto Arc Testnet. Native gas on Arc is USDC — keep a small amount for fees per{' '}
          <a href="https://docs.arc.network/arc/references/connect-to-arc" target="_blank" rel="noreferrer">
            Arc docs
          </a>
          .
        </p>
      </header>

      <section className="card">
        <h2>Quick links</h2>
        <ul className="muted">
          <li>
            <a href="https://faucet.circle.com/" target="_blank" rel="noreferrer">
              Circle faucet
            </a>
          </li>
          <li>
            <a href="https://docs.arc.network/app-kit/bridge" target="_blank" rel="noreferrer">
              Arc App Kit — Bridge
            </a>
          </li>
          <li>
            <a href="https://developers.circle.com/gateway" target="_blank" rel="noreferrer">
              Circle Gateway
            </a>{' '}
            (x402 verify/settle)
          </li>
          <li>
            <a href="https://developers.circle.com/gateway/nanopayments" target="_blank" rel="noreferrer">
              Circle Nanopayments
            </a>
          </li>
        </ul>
      </section>

      <section className="card">
        <h2>Circle Console keys</h2>
        <p className="muted">
          In <a href="https://console.circle.com/api-keys/create">Circle Console</a> (switch to <strong>Testnet</strong>),
          create the keys your integration needs: <strong>API Key</strong> for backend Gateway / Wallets / Contracts;{' '}
          <strong>Kit Key</strong> for App Kit / Bridge Kit; <strong>Client Key</strong> for Modular Wallets in the
          browser. Copy values into <code>.env</code> — see <code>.env.example</code> and the README environment table.
        </p>
      </section>

      <section className="card">
        <h2>App Kit package</h2>
        <p className="muted">
          This repo depends on <code>@circle-fin/app-kit</code> for production bridge flows. Wire{' '}
          <code>CIRCLE_KIT_KEY</code> and the rest per App Kit quickstarts; the hub stays lightweight for the hackathon
          demo.
        </p>
      </section>

      <p className="muted">
        <a href="/">← Hub</a>
      </p>
    </main>
  )
}

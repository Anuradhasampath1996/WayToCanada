<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>RCICMASTER — Backend Status</title>
    <style>
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
            --bg: #0f1117; --surface: #1a1d27; --surface2: #22263a; --border: #2e3347;
            --text: #e2e8f0; --muted: #8892a4;
            --ok: #22c55e; --ok-bg: #052e16; --ok-border: #166534;
            --error: #ef4444; --error-bg: #2d0a0a; --error-border: #7f1d1d;
            --warning: #f59e0b; --warning-bg: #2d1a00; --warning-border: #78350f;
            --primary: #6366f1; --primary-light: #818cf8;
        }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; padding: 2rem 1rem; }
        .container { max-width: 900px; margin: 0 auto; }
        .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem; }
        .logo { display: flex; align-items: center; gap: 0.6rem; font-size: 1.4rem; font-weight: 700; color: var(--primary-light); }
        .logo-icon { width: 32px; height: 32px; background: var(--primary); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1rem; }
        .timestamp { font-size: 0.8rem; color: var(--muted); }
        .status-banner { border-radius: 12px; padding: 1.5rem 2rem; margin-bottom: 2rem; display: flex; align-items: center; gap: 1rem; }
        .status-banner.ok { background: var(--ok-bg); border: 1px solid var(--ok-border); }
        .status-banner.error { background: var(--error-bg); border: 1px solid var(--error-border); }
        .status-banner.warning { background: var(--warning-bg); border: 1px solid var(--warning-border); }
        .status-icon { width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; flex-shrink: 0; }
        .status-banner.ok .status-icon { background: rgba(34,197,94,0.15); color: var(--ok); }
        .status-banner.error .status-icon { background: rgba(239,68,68,0.15); color: var(--error); }
        .status-banner.warning .status-icon { background: rgba(245,158,11,0.15); color: var(--warning); }
        .status-title { font-size: 1.2rem; font-weight: 700; margin-bottom: 0.2rem; }
        .status-banner.ok .status-title { color: var(--ok); }
        .status-banner.error .status-title { color: var(--error); }
        .status-banner.warning .status-title { color: var(--warning); }
        .status-subtitle { color: var(--muted); font-size: 0.875rem; }
        .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem; }
        .stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 1rem 1.25rem; text-align: center; }
        .stat-number { font-size: 2rem; font-weight: 800; line-height: 1; margin-bottom: 0.25rem; }
        .stat-card.ok .stat-number { color: var(--ok); }
        .stat-card.error .stat-number { color: var(--error); }
        .stat-card.warning .stat-number { color: var(--warning); }
        .stat-label { font-size: 0.8rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
        .section-title { font-size: 0.75rem; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.75rem; padding-left: 0.25rem; }
        .checks-list { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; margin-bottom: 2rem; }
        .check-item { display: flex; align-items: center; gap: 1rem; padding: 0.9rem 1.25rem; border-bottom: 1px solid var(--border); transition: background 0.15s; }
        .check-item:last-child { border-bottom: none; }
        .check-item:hover { background: var(--surface2); }
        .check-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
        .check-dot.ok { background: var(--ok); box-shadow: 0 0 6px var(--ok); }
        .check-dot.error { background: var(--error); box-shadow: 0 0 6px var(--error); }
        .check-dot.warning { background: var(--warning); box-shadow: 0 0 6px var(--warning); }
        .check-name { font-size: 0.875rem; font-weight: 500; color: var(--text); min-width: 200px; }
        .check-value { font-size: 0.8rem; font-family: "SFMono-Regular", Consolas, monospace; color: var(--primary-light); background: rgba(99,102,241,0.1); padding: 0.15rem 0.5rem; border-radius: 4px; white-space: nowrap; }
        .check-message { font-size: 0.8rem; color: var(--muted); flex: 1; }
        .check-item.error .check-message { color: var(--error); }
        .check-item.warning .check-message { color: var(--warning); }
        .badge { font-size: 0.7rem; font-weight: 600; padding: 0.2rem 0.6rem; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.05em; flex-shrink: 0; }
        .badge.ok { background: var(--ok-bg); color: var(--ok); border: 1px solid var(--ok-border); }
        .badge.error { background: var(--error-bg); color: var(--error); border: 1px solid var(--error-border); }
        .badge.warning { background: var(--warning-bg); color: var(--warning); border: 1px solid var(--warning-border); }
        .footer { text-align: center; font-size: 0.8rem; color: var(--muted); margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid var(--border); }
        .footer a { color: var(--primary-light); text-decoration: none; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .pulse { animation: pulse 2s ease-in-out infinite; }
    </style>
</head>
<body>
<div class="container">
    <div class="header">
        <div class="logo">
            <div class="logo-icon">&#x1F341;</div>
            RCICMASTER
        </div>
        <div class="timestamp">Backend Status &nbsp;&middot;&nbsp; {{ now()->format('D, d M Y H:i:s') }} UTC</div>
    </div>

    @if($overallStatus === 'ok')
        <div class="status-banner ok">
            <div class="status-icon">&#10003;</div>
            <div>
                <div class="status-title">All Systems Operational</div>
                <div class="status-subtitle">Backend is running smoothly. No issues detected.</div>
            </div>
        </div>
    @elseif($overallStatus === 'error')
        <div class="status-banner error">
            <div class="status-icon">&#10005;</div>
            <div>
                <div class="status-title">{{ $errorCount }} Issue{{ $errorCount > 1 ? 's' : '' }} Detected</div>
                <div class="status-subtitle">Some services require attention. See details below.</div>
            </div>
        </div>
    @else
        <div class="status-banner warning">
            <div class="status-icon">&#9888;</div>
            <div>
                <div class="status-title">{{ $warningCount }} Warning{{ $warningCount > 1 ? 's' : '' }}</div>
                <div class="status-subtitle">System is running but some settings need review.</div>
            </div>
        </div>
    @endif

    <div class="stats">
        <div class="stat-card ok"><div class="stat-number">{{ $okCount }}</div><div class="stat-label">Passed</div></div>
        <div class="stat-card warning"><div class="stat-number">{{ $warningCount }}</div><div class="stat-label">Warnings</div></div>
        <div class="stat-card error"><div class="stat-number">{{ $errorCount }}</div><div class="stat-label">Errors</div></div>
    </div>

    <div class="section-title">System Checks &mdash; {{ $totalChecks }} total</div>
    <div class="checks-list">
        @foreach($checks as $check)
            <div class="check-item {{ $check['status'] }}">
                <div class="check-dot {{ $check['status'] }}{{ $check['status'] === 'ok' ? ' pulse' : '' }}"></div>
                <div class="check-name">{{ $check['name'] }}</div>
                <div class="check-value">{{ $check['value'] }}</div>
                <div class="check-message">{{ $check['message'] }}</div>
                <span class="badge {{ $check['status'] }}">{{ $check['status'] === 'ok' ? 'OK' : ($check['status'] === 'error' ? 'ERROR' : 'WARN') }}</span>
            </div>
        @endforeach
    </div>

    <div class="footer">
        <strong>RCICMASTER</strong> &nbsp;&middot;&nbsp;
        Laravel {{ app()->version() }} &nbsp;&middot;&nbsp;
        PHP {{ $phpVersion }} &nbsp;&middot;&nbsp;
        ENV: {{ strtoupper($env) }}
        <br><br>
        API: <a href="/api">/api</a> &nbsp;&middot;&nbsp;
        Public Website: <a href="http://localhost:3001" target="_blank">localhost:3001</a> &nbsp;&middot;&nbsp;
        Admin: <a href="http://localhost:3000" target="_blank">localhost:3000</a>
    </div>
</div>
</body>
</html>

/**
 * Minimal self-hosted visit analytics backed by Workers KV.
 *
 * /~/hit?p=<path>[&v=1]  — beacon pinged by every page view; v=1 marks the
 *                          first hit of a browser session (a "visit").
 * /~/stats               — small HTML dashboard with daily totals and top pages.
 *
 * KV keys: pv:<day>, visit:<day>, pv:<day>:<path>
 */

const DAY = () => new Date().toISOString().slice(0, 10);

async function bump(kv, key) {
	const cur = Number.parseInt((await kv.get(key)) || "0", 10);
	await kv.put(key, String(cur + 1));
}

export async function handleHit(request, env) {
	const url = new URL(request.url);
	const path = (url.searchParams.get("p") || "/").slice(0, 100);
	const day = DAY();
	await bump(env.ANALYTICS, `pv:${day}`);
	await bump(env.ANALYTICS, `pv:${day}:${path}`);
	if (url.searchParams.get("v") === "1") await bump(env.ANALYTICS, `visit:${day}`);
	return new Response(null, { status: 204 });
}

export async function handleStats(request, env) {
	const kv = env.ANALYTICS;
	const days = {};
	const pages = {};
	let cursor;
	do {
		const res = await kv.list({ cursor, limit: 1000 });
		for (const k of res.keys) {
			const name = k.name;
			const m = name.match(/^(pv|visit):(\d{4}-\d{2}-\d{2})(?::(.*))?$/);
			if (!m) continue;
			const [, kind, day, path] = m;
			const val = Number.parseInt((await kv.get(name)) || "0", 10);
			if (path) {
				pages[path] = (pages[path] || 0) + val;
			} else {
				days[day] = days[day] || { pv: 0, visits: 0 };
				days[day][kind === "pv" ? "pv" : "visits"] = val;
			}
		}
		cursor = res.list_complete ? undefined : res.cursor;
	} while (cursor);

	const dayRows = Object.entries(days)
		.sort((a, b) => b[0].localeCompare(a[0]))
		.slice(0, 60)
		.map(
			([d, v]) =>
				`<tr><td>${d}</td><td>${v.visits}</td><td>${v.pv}</td></tr>`,
		)
		.join("");
	const pageRows = Object.entries(pages)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 30)
		.map(([p, n]) => `<tr><td>${p.replace(/</g, "&lt;")}</td><td>${n}</td></tr>`)
		.join("");
	const totalPv = Object.values(days).reduce((a, v) => a + v.pv, 0);
	const totalVisits = Object.values(days).reduce((a, v) => a + v.visits, 0);

	const html = `<!doctype html><html><head><meta charset="utf-8"><title>SoC Codex — Analytics</title>
<style>
body{font-family:Georgia,serif;background:hsl(150 25% 6%);color:hsl(40 35% 87%);max-width:720px;margin:2rem auto;padding:0 1rem}
h1{color:hsl(42 55% 58%)}h2{color:hsl(42 55% 58%);font-size:1rem;text-transform:uppercase;letter-spacing:.08em}
table{border-collapse:collapse;width:100%;margin-bottom:2rem}
td,th{border-bottom:1px solid hsl(150 10% 18%);padding:.4rem .6rem;text-align:left}
td:nth-child(n+2),th:nth-child(n+2){text-align:right;font-variant-numeric:tabular-nums}
.tot{font-size:1.1rem;margin-bottom:1.5rem}
.tot b{color:hsl(42 55% 58%)}
</style></head><body>
<h1>SoC Codex — Analytics</h1>
<p class="tot">All time: <b>${totalVisits}</b> visits, <b>${totalPv}</b> page views</p>
<h2>By day</h2>
<table><tr><th>Day</th><th>Visits</th><th>Page views</th></tr>${dayRows || "<tr><td colspan=3>No data yet</td></tr>"}</table>
<h2>Top pages (all time)</h2>
<table><tr><th>Page</th><th>Views</th></tr>${pageRows || "<tr><td colspan=2>No data yet</td></tr>"}</table>
</body></html>`;
	return new Response(html, {
		headers: { "content-type": "text/html; charset=utf-8" },
	});
}

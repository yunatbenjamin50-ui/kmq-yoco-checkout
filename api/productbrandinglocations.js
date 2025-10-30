export default async function handler(req, res) {
  try {
    const KMQ_TOKEN = process.env.KMQ_TOKEN;
    const r = await fetch(
      `https://api.kmq.co.za/api/v1/productbrandinglocations?token=${encodeURIComponent(KMQ_TOKEN)}`
    );
    const data = await r.json();
    res.setHeader('Cache-Control','s-maxage=900, stale-while-revalidate=86400');
    res.status(200).json(data);
  } catch (e) {
    res.status(502).json({ error: 'Upstream branding locations failed', detail: String(e.message||e) });
  }
}

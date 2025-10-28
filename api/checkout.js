// api/checkout.js  — Vercel Serverless (Node 18+). Uses native fetch.
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ success:false, error:'Only POST' });

    const { token, product_group_code } = req.body || {};
    if (!token) return res.status(400).json({ success:false, error:'Missing token' });

    const YOCO_SECRET = process.env.YOCO_SECRET;
    const KMQ_TOKEN = process.env.KMQ_TOKEN;
    if (!YOCO_SECRET) return res.status(500).json({ success:false, error:'Server not configured (YOCO_SECRET)' });

    // Determine amountInCents by querying KMQ server-side
    let amountInCents = null;
    let productName = 'Online Purchase';

    if (product_group_code) {
      const kmqRes = await fetch(`https://api.kmq.co.za/api/v1/products?token=${encodeURIComponent(KMQ_TOKEN)}`, { method: 'GET' });
      if (!kmqRes.ok) return res.status(502).json({ success:false, error:'Failed to fetch KMQ products' });
      const products = await kmqRes.json();
      const found = products.find(p => String(p.product_group_code).trim() === String(product_group_code).trim());
      if (!found) return res.status(400).json({ success:false, error:'Product group not found on KMQ' });
      productName = found.product_name || productName;
      const priceStr = found.Price01 ?? found.price ?? null;
      if (priceStr == null) return res.status(500).json({ success:false, error:'Price not available for product' });
      const priceFloat = parseFloat(String(priceStr).replace(/[^0-9.-]+/g,''));
      if (Number.isNaN(priceFloat)) return res.status(500).json({ success:false, error:'Invalid product price' });
      amountInCents = Math.round(priceFloat * 100);
    } else {
      return res.status(400).json({ success:false, error:'Missing product_group_code (server requires it)' });
    }

    // Build payload for Yoco
    const payload = {
      token,
      amountInCents,
      currency: 'ZAR',
      description: productName,
      metadata: { product_group_code: product_group_code ?? '' }
    };

    // Call Yoco charge endpoint
    const yocoResp = await fetch('https://online.yoco.com/v1/charges/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Auth-Secret-Key': YOCO_SECRET },
      body: JSON.stringify(payload)
    });

    const yocoJson = await yocoResp.json();
    if (!yocoResp.ok) {
      return res.status(yocoResp.status || 500).json({ success:false, yoco_response: yocoJson });
    }

    // Success
    return res.status(200).json({ success:true, yoco: yocoJson });

  } catch (err) {
    console.error('Server error', err);
    res.status(500).json({ success:false, error: 'Server error', detail: String(err.message || err) });
  }
}

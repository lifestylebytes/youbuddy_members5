// ============================================================
// Supabase Edge Function — push-notify
// ------------------------------------------------------------
// 특정 멤버(또는 전체)에게 Web Push 알림을 보냄.
// push_subscriptions 테이블에서 구독 정보를 읽어 VAPID 방식으로 발송.
//
// Deploy:
//   supabase functions deploy push-notify --no-verify-jwt
//   supabase secrets set VAPID_PRIVATE_KEY=e_ws3zaB3U2LrQaGOsAmVHK1hCssN8_4ltb9Pbv6-w8
//
// Request body:
//   {
//     target_member_key: string,   // 알림 받을 멤버
//     cohort: string,              // 기수 (예: '7기')
//     title: string,
//     body: string,
//     url?: string,                // 클릭 시 이동 URL (기본 /7th/)
//     tag?: string,                // 알림 dedup 태그
//   }
// ============================================================

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ── VAPID helpers ──────────────────────────────────────────
function b64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function b64urlDecode(str: string): Uint8Array {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function makeVapidJwt(audience: string, privateKeyB64: string): Promise<string> {
  const header = b64url(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(new TextEncoder().encode(JSON.stringify({
    aud: audience,
    exp: now + 3600,
    sub: 'mailto:youbuddy.co@gmail.com',
  })));
  const sigInput = new TextEncoder().encode(`${header}.${payload}`);
  const keyBytes = b64urlDecode(privateKeyB64);
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    // Wrap raw 32-byte key into PKCS8 for P-256
    buildPkcs8(keyBytes),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, cryptoKey, sigInput);
  return `${header}.${payload}.${b64url(sig)}`;
}

// Minimal PKCS8 wrapper for a raw 32-byte P-256 private key.
function buildPkcs8(rawKey: Uint8Array): ArrayBuffer {
  // PKCS8 header for P-256 (secp256r1)
  const header = new Uint8Array([
    0x30, 0x41, 0x02, 0x01, 0x00,
    0x30, 0x13,
    0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01,
    0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07,
    0x04, 0x27, 0x30, 0x25, 0x02, 0x01, 0x01, 0x04, 0x20,
  ]);
  const buf = new Uint8Array(header.length + rawKey.length);
  buf.set(header);
  buf.set(rawKey, header.length);
  return buf.buffer;
}

// ── Main ──────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const { target_member_key, cohort, title, body, url = '/7th/', tag = 'youbuddy' }
      = await req.json();

    if (!target_member_key || !cohort || !title || !body) {
      return new Response(JSON.stringify({ error: 'missing fields' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const vapidPriv   = Deno.env.get('VAPID_PRIVATE_KEY')!;
    const vapidPub    = 'BB-4G3_7XMAE67uwWlWEmLLwGWxPuWvotzhXOY3Ef2wxxq5_MmiD6EbvZj9n7kDCOFDlhWpnxZDc3BqTAuS-i6I';

    // push_subscriptions 에서 구독 정보 조회
    const dbRes = await fetch(
      `${supabaseUrl}/rest/v1/push_subscriptions?member_key=eq.${encodeURIComponent(target_member_key)}&cohort=eq.${encodeURIComponent(cohort)}&select=subscription`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
    );
    const rows: { subscription: { endpoint: string; keys: { p256dh: string; auth: string } } }[] = await dbRes.json();

    if (!rows.length) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no subscription' }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const payload = JSON.stringify({ title, body, tag, url });
    let sent = 0;

    for (const row of rows) {
      const sub = row.subscription;
      const endpoint = sub.endpoint;
      const origin = new URL(endpoint).origin;

      const jwt = await makeVapidJwt(origin, vapidPriv);
      const authHeader = `vapid t=${jwt},k=${vapidPub}`;

      // Encrypt payload (AES-GCM with ECDH)
      const encrypted = await encryptPayload(payload, sub.keys.p256dh, sub.keys.auth);

      const pushRes = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/octet-stream',
          'Content-Encoding': 'aes128gcm',
          TTL: '86400',
        },
        body: encrypted,
      });

      if (pushRes.ok || pushRes.status === 201) sent++;
    }

    return new Response(JSON.stringify({ sent }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[push-notify]', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});

// ── Web Push AES-GCM encryption (RFC 8291 / aes128gcm) ────
async function encryptPayload(
  plaintext: string,
  p256dhB64: string,
  authB64: string,
): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const receiverPublicKey = await crypto.subtle.importKey(
    'raw', b64urlDecode(p256dhB64),
    { name: 'ECDH', namedCurve: 'P-256' }, true, [],
  );
  const authSecret = b64urlDecode(authB64);

  // Generate sender ephemeral key pair
  const senderKp = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'],
  );
  const senderPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey('raw', senderKp.publicKey),
  );

  // ECDH shared secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: receiverPublicKey }, senderKp.privateKey, 256,
    ),
  );

  // salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // PRK (HKDF-SHA-256)
  const prkKey = await crypto.subtle.importKey('raw', authSecret, { name: 'HKDF' }, false, ['deriveBits']);
  const ikm = concat(authSecret, sharedSecret);
  const ikmKey = await crypto.subtle.importKey('raw', sharedSecret, { name: 'HKDF' }, false, ['deriveBits']);

  // key_info = "WebPush: info\0" + receiver_pub + sender_pub
  const receiverPublicKeyRaw = new Uint8Array(await crypto.subtle.exportKey('raw', receiverPublicKey));
  const keyInfo = concat(enc.encode('WebPush: info\x00'), receiverPublicKeyRaw, senderPublicKeyRaw);

  const prk = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: authSecret, info: keyInfo },
    ikmKey, 256,
  ));

  const prkKeyObj = await crypto.subtle.importKey('raw', prk, { name: 'HKDF' }, false, ['deriveBits']);

  // CEK
  const cekInfo = enc.encode('Content-Encoding: aes128gcm\x00');
  const cek = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: cekInfo },
    prkKeyObj, 128,
  ));

  // Nonce
  const nonceInfo = enc.encode('Content-Encoding: nonce\x00');
  const nonce = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: nonceInfo },
    prkKeyObj, 96,
  ));

  // AES-GCM encrypt
  const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const plaintextBytes = enc.encode(plaintext);
  // padding: 1 byte delimiter
  const padded = concat(plaintextBytes, new Uint8Array([0x02]));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    aesKey,
    padded,
  ));

  // Build aes128gcm header (salt + rs=4096 + keyid_len + keyid)
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  const header = concat(salt, rs, new Uint8Array([senderPublicKeyRaw.length]), senderPublicKeyRaw);

  return concat(header, ciphertext);
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) { out.set(a, offset); offset += a.length; }
  return out;
}

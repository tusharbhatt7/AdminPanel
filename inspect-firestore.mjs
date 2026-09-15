// Throwaway schema-discovery script. Reads admin creds from .env.local, never prints them.
import { readFileSync, existsSync } from 'node:fs';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, query, limit } from 'firebase/firestore';

const parseEnv = (f) => existsSync(f)
  ? Object.fromEntries(readFileSync(f, 'utf8').split('\n')
      .filter(l => l.trim() && !l.trim().startsWith('#') && l.includes('='))
      .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]))
  : {};

const env = { ...parseEnv('.env'), ...parseEnv('.env.local') };

if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
  console.error('\n  Missing ADMIN_EMAIL / ADMIN_PASSWORD in .env.local — see instructions.\n');
  process.exit(1);
}

const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
});

const CANDIDATES = [
  'bank_accounts','subscription_plans','wallet','wallet_history','driver_wallet','withdrawal_requests','payouts','kyc','documents','driver_documents','sos_requests','emergency_contacts','support','chats','messages','fare_settings','commission','promo','banner','city','vehicle_config',
  'drivers','users','customers','riders','subscriptions','user_ads','ads','banners',
  'rides','trips','bookings','ride_requests','rideRequests','ride_history','completed_rides',
  'orders','parcels','deliveries','cancellations','scheduled_rides',
  'transactions','payments','wallet_transactions','walletTransactions','earnings','payouts','withdrawals',
  'fares','fare_config','fareConfig','pricing','price_config','surge','vehicle_types','vehicleTypes','services',
  'coupons','promos','promo_codes','promocodes','offers','referrals',
  'sos','sos_alerts','incidents','emergency','complaints','support_tickets','tickets','feedback',
  'ratings','reviews','notifications','zones','cities','regions','geofences',
  'settings','config','app_config','appConfig','admin','admins','roles',
  'driver_locations','driverLocations','live_locations','locations','driver_status',
];

const describe = (v) => {
  if (v === null) return 'null';
  if (Array.isArray(v)) return `array[${v.length}]${v.length ? ` of ${describe(v[0])}` : ''}`;
  if (typeof v === 'object') {
    if (typeof v.toDate === 'function') return 'timestamp';
    if ('latitude' in v && 'longitude' in v) return 'geopoint';
    return `map{${Object.keys(v).slice(0, 8).join(', ')}}`;
  }
  if (typeof v === 'string') return `string "${v.length > 40 ? v.slice(0, 40) + '…' : v}"`;
  return `${typeof v} ${v}`;
};

const run = async () => {
  const auth = getAuth(app);
  const cred = await signInWithEmailAndPassword(auth, env.ADMIN_EMAIL, env.ADMIN_PASSWORD);
  console.log(`\n  Signed in OK (uid ${cred.user.uid})\n`);

  const db = getFirestore(app);
  const found = [];

  for (const name of CANDIDATES) {
    try {
      const snap = await getDocs(query(collection(db, name), limit(3)));
      if (!snap.empty) found.push([name, snap]);
    } catch { /* denied or missing — skip */ }
  }

  console.log('='.repeat(70));
  console.log(`  FIRESTORE — ${found.length} non-empty collections found`);
  console.log('='.repeat(70));

  for (const [name, snap] of found) {
    console.log(`\n▸ ${name}  (sampled ${snap.size} doc${snap.size > 1 ? 's' : ''})`);
    const d = snap.docs[0];
    console.log(`  doc id: ${d.id}`);
    const data = d.data();
    for (const [k, v] of Object.entries(data).sort(([a], [b]) => a.localeCompare(b))) {
      console.log(`    ${k.padEnd(26)} ${describe(v)}`);
    }
  }

  // Realtime Database — shallow top-level key listing
  if (env.VITE_FIREBASE_DATABASE_URL) {
    console.log(`\n${'='.repeat(70)}`);
    console.log('  REALTIME DATABASE — top-level keys');
    console.log('='.repeat(70));
    try {
      const token = await cred.user.getIdToken();
      const res = await fetch(`${env.VITE_FIREBASE_DATABASE_URL}/.json?shallow=true&auth=${token}`);
      const body = await res.json();
      console.log(res.ok ? `\n  ${Object.keys(body || {}).join('\n  ') || '(empty)'}` : `\n  ${JSON.stringify(body)}`);
    } catch (e) {
      console.log(`\n  could not read: ${e.message}`);
    }
  }

  console.log('\n');
  process.exit(0);
};

run().catch((e) => { console.error(`\n  FAILED: ${e.code || ''} ${e.message}\n`); process.exit(1); });

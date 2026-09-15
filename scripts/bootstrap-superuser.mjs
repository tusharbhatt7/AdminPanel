/**
 * One-time bootstrap for the first superuser.
 *
 *   node scripts/bootstrap-superuser.mjs
 *
 * Reads everything from the environment — nothing is hardcoded here, and no
 * password is ever printed, logged or committed:
 *
 *   SUPERUSER_EMAIL         the account to promote
 *   SUPERUSER_PASSWORD      its CURRENT password (used only to sign in)
 *   SUPERUSER_NEW_PASSWORD  optional; set to rotate the password in the same run
 *
 * Put these in .env.local, which is gitignored. Delete them once you are done —
 * they are needed for this script alone.
 *
 * The account must already exist in Firebase Auth. Create it in the Firebase
 * console first if it does not; this script promotes, it does not register.
 */
import { readFileSync, existsSync } from 'node:fs';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, updatePassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';

const parseEnv = (f) => existsSync(f)
    ? Object.fromEntries(readFileSync(f, 'utf8').split('\n')
        .filter((l) => l.trim() && !l.trim().startsWith('#') && l.includes('='))
        .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]))
    : {};

const env = { ...parseEnv('.env'), ...parseEnv('.env.local'), ...process.env };

const EMAIL = env.SUPERUSER_EMAIL;
const PASSWORD = env.SUPERUSER_PASSWORD;
const NEW_PASSWORD = env.SUPERUSER_NEW_PASSWORD || null;

if (!EMAIL || !PASSWORD) {
    console.error('\n  Set SUPERUSER_EMAIL and SUPERUSER_PASSWORD in .env.local first.\n');
    process.exit(1);
}
if (NEW_PASSWORD && NEW_PASSWORD.length < 8) {
    console.error('\n  SUPERUSER_NEW_PASSWORD must be at least 8 characters.\n');
    process.exit(1);
}

const app = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
});

const run = async () => {
    const auth = getAuth(app);
    const db = getFirestore(app);

    const cred = await signInWithEmailAndPassword(auth, EMAIL, PASSWORD);
    console.log(`\n  Signed in as ${EMAIL}`);

    if (NEW_PASSWORD) {
        await updatePassword(cred.user, NEW_PASSWORD);
        console.log('  Password rotated (value not shown or stored by this script)');
    }

    const ref = doc(db, 'admin_users', cred.user.uid);
    const before = await getDoc(ref);

    await setDoc(ref, {
        email: EMAIL.toLowerCase(),
        name: before.exists() ? (before.data().name ?? 'Superuser') : 'Superuser',
        role: 'superadmin',
        isActive: true,
        createdAt: before.exists() ? (before.data().createdAt ?? serverTimestamp()) : serverTimestamp(),
        createdBy: 'bootstrap',
        createdByEmail: 'bootstrap',
        bootstrappedAt: serverTimestamp(),
    }, { merge: true });

    console.log(`  Role record ${before.exists() ? 'updated' : 'created'}: superadmin, active`);

    await addDoc(collection(db, 'audit_logs'), {
        actorUid: cred.user.uid,
        actorEmail: EMAIL.toLowerCase(),
        actorRole: 'superadmin',
        action: before.exists() ? 'user.role_changed' : 'user.created',
        targetType: 'user',
        targetId: cred.user.uid,
        targetLabel: EMAIL.toLowerCase(),
        status: 'success',
        metadata: { via: 'bootstrap-superuser script', passwordRotated: !!NEW_PASSWORD, role: 'superadmin' },
        userAgent: 'bootstrap-script',
        at: serverTimestamp(),
    });

    console.log('  Audit entry written\n');
    console.log('  Done. Remove SUPERUSER_* from .env.local now — they are no longer needed.\n');
    process.exit(0);
};

run().catch((e) => {
    console.error(`\n  FAILED: ${e.code || ''} ${e.message}\n`);
    process.exit(1);
});

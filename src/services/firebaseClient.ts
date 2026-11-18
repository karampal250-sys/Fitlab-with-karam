import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  FacebookAuthProvider,
  getAdditionalUserInfo,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  deleteUser,
  type UserCredential,
} from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  getDocFromServer,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

export const db = initializeFirestore(
  app,
  {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  },
  firebaseConfig.firestoreDatabaseId
);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const facebookProvider = new FacebookAuthProvider();
facebookProvider.addScope('public_profile');
facebookProvider.addScope('email');
facebookProvider.addScope('user_birthday');

export interface SocialPrefillData {
  name?: string;
  dateOfBirth?: string;
  email?: string | null;
  provider: 'google' | 'facebook';
}

export function normalizeBirthdayToIso(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // Facebook commonly returns MM/DD/YYYY
  const mdy = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (mdy) {
    return `${mdy[3]}-${mdy[1]}-${mdy[2]}`;
  }
  return undefined;
}

export async function extractSocialProfile(result: UserCredential | null): Promise<SocialPrefillData | null> {
  if (!result || !result.user) return null;
  const info = getAdditionalUserInfo(result);
  const providerId = info?.providerId || result.providerId || result.user.providerData?.[0]?.providerId || '';
  const provider: 'google' | 'facebook' = providerId.includes('facebook') ? 'facebook' : 'google';
  const rawProfile = (info?.profile || {}) as Record<string, unknown>;

  let name =
    (typeof rawProfile.name === 'string' && rawProfile.name.trim()) ||
    result.user.displayName ||
    undefined;
  let dateOfBirth = normalizeBirthdayToIso(rawProfile.birthday);
  let email = (typeof rawProfile.email === 'string' && rawProfile.email) || result.user.email || null;

  if (provider === 'facebook' && (!dateOfBirth || !name)) {
    try {
      const cred = FacebookAuthProvider.credentialFromResult(result);
      if (cred?.accessToken) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3500);
        const resp = await fetch(
          `https://graph.facebook.com/me?fields=name,email,birthday&access_token=${encodeURIComponent(cred.accessToken)}`,
          { signal: controller.signal }
        );
        clearTimeout(timer);
        if (resp.ok) {
          const fb = (await resp.json()) as { name?: string; email?: string; birthday?: string };
          if (!name && fb.name) name = fb.name;
          if (!dateOfBirth && fb.birthday) dateOfBirth = normalizeBirthdayToIso(fb.birthday);
          if (!email && fb.email) email = fb.email;
        }
      }
    } catch {
      // Facebook Graph optional fallback — keep Firebase profile fields
    }
  }

  return { name, dateOfBirth, email, provider };
}

export const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
} as const;

export type OperationTypeValue = (typeof OperationType)[keyof typeof OperationType];

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationTypeValue;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationTypeValue,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      return false;
    }
    // Permission denied from global catch-all confirms server connectivity is online
    return true;
  }
}

export { signInWithPopup, signInWithRedirect, getRedirectResult, signOut, deleteUser };

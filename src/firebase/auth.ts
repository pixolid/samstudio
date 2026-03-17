import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  type User,
  type UserCredential,
  type NextOrObserver,
} from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from './config'

const googleProvider = new GoogleAuthProvider()

/**
 * Ensure a Firestore user document exists for the given user.
 * Called after both popup and redirect sign-in flows.
 */
async function ensureUserDoc(user: User) {
  const userDoc = await getDoc(doc(db, 'users', user.uid))
  if (!userDoc.exists()) {
    await setDoc(doc(db, 'users', user.uid), {
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      plan: 'basic',
      credits: 100,
      createdAt: new Date().toISOString(),
      source: 'sam-studio',
    })
  }
}

/**
 * Try popup first; if it fails (COOP blocks it on some browsers),
 * fall back to the redirect flow which doesn't need window.opener.
 */
export const doSignInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider)
    await ensureUserDoc(result.user)
    return result
  } catch (err: unknown) {
    const firebaseErr = err as { code?: string }

    // These error codes indicate the popup was blocked by COOP or the browser:
    //   - auth/popup-blocked       → browser blocked the popup
    //   - auth/popup-closed-by-user → COOP closed the channel before response
    //   - auth/cancelled-popup-request → duplicate request / race
    // In all these cases, fall back to the redirect flow.
    const popupFailCodes = [
      'auth/popup-blocked',
      'auth/popup-closed-by-user',
      'auth/cancelled-popup-request',
    ]

    if (popupFailCodes.includes(firebaseErr.code ?? '')) {
      // Redirect flow: page will navigate away, then come back.
      // The result is picked up by resolveRedirectSignIn() on reload.
      await signInWithRedirect(auth, googleProvider)
      return null as unknown as UserCredential // page navigates away
    }

    // Any other error (network, etc.) — rethrow so the UI can handle it
    throw err
  }
}

/**
 * Call this once on app startup to complete a redirect-based sign-in
 * that was started by doSignInWithGoogle's fallback path.
 */
export const resolveRedirectSignIn = async () => {
  try {
    const result = await getRedirectResult(auth)
    if (result?.user) {
      await ensureUserDoc(result.user)
    }
    return result
  } catch (err) {
    console.warn('[auth] redirect sign-in resolution failed', err)
    return null
  }
}

export const doSignOut = async () => {
  return signOut(auth)
}

export const onAuthStateChangedListener = (callback: NextOrObserver<User>) => {
  return onAuthStateChanged(auth, callback)
}

import {
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  type User,
  type NextOrObserver,
} from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from './config'

const googleProvider = new GoogleAuthProvider()

export const doSignInWithGoogle = async () => {
  await signInWithRedirect(auth, googleProvider)
}

/** Call once on app init to handle the redirect return and create user doc if needed */
export const handleRedirectResult = async () => {
  const result = await getRedirectResult(auth)
  if (!result) return null

  const user = result.user
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

  return result
}

export const doSignOut = async () => {
  return signOut(auth)
}

export const onAuthStateChangedListener = (callback: NextOrObserver<User>) => {
  return onAuthStateChanged(auth, callback)
}

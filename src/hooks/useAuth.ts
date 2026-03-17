import { useState, useEffect } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { auth } from '@/firebase/config'
import { resolveRedirectSignIn } from '@/firebase/auth'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Resolve any pending redirect sign-in (from COOP fallback flow)
    resolveRedirectSignIn().catch(() => {
      // Errors are already logged inside resolveRedirectSignIn
    })

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  return { user, loading }
}


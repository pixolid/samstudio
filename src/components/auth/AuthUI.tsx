import { useState } from 'react'
import { doSignInWithGoogle } from '@/firebase/auth'
import { Loader2 } from 'lucide-react'

export function AuthUI() {
  const [error, setError] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const handleGoogleSignIn = async () => {
    setError('')
    setIsProcessing(true)
    try {
      await doSignInWithGoogle()
      // If the redirect fallback was triggered, the page navigates away
      // and this code won't run. On return, useAuth picks up the session.
    } catch (err: unknown) {
      const firebaseErr = err as { code?: string; message?: string }
      console.error('[auth] sign-in error:', firebaseErr.code, firebaseErr.message)
      setError('Authentication failed. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950" />

      {/* Top-left logo */}
      <img
        src={`${import.meta.env.BASE_URL}logo_webseite_white.png`}
        alt="Pixolid"
        className="absolute top-6 left-6 w-[200px] h-[80px] object-contain z-10"
      />

      {/* Glass card */}
      <div className="relative z-10 w-full max-w-md mx-4 p-8 rounded-[2rem] bg-slate-900/80 border border-white/10 backdrop-blur-xl shadow-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <span className="text-3xl font-black tracking-tight text-white">SAM Studio</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
              Segmentation
            </span>
          </div>
          <p className="text-sm text-slate-400">
            AI-powered image segmentation in your browser
          </p>
        </div>

        <button
          onClick={handleGoogleSignIn}
          disabled={isProcessing}
          className="w-full flex items-center justify-center gap-3 bg-white text-slate-800
            px-6 py-3.5 rounded-xl font-medium text-sm
            hover:bg-slate-50 active:scale-[0.98] transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <img
              src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
              alt="Google"
              className="w-5 h-5"
            />
          )}
          {isProcessing ? 'Signing in...' : 'Continue with Google'}
        </button>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-400 text-center">{error}</p>
          </div>
        )}

        <p className="text-xs text-slate-500 text-center mt-6">
          Part of the Pixolid app suite · Shared account with SurfAIce
        </p>
      </div>
    </div>
  )
}

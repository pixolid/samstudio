/**
 *  ____    _    __  __   ____  _             _ _
 * / ___|  / \  |  \/  | / ___|| |_ _   _  __| (_) ___
 * \___ \ / _ \ | |\/| | \___ \| __| | | |/ _` | |/ _ \
 *  ___) / ___ \| |  | |  ___) | |_| |_| | (_| | | (_) |
 * |____/_/   \_\_|  |_| |____/ \__|\__,_|\__,_|_|\___/
 * ___________________________________________
 * Project: SAM Studio
 * Author: Alex Gabriel & Zvonko Vugreshek
 * Company: Pixolid UG
 * ___________________________________________
 **/
import { useState, useCallback, useRef, useEffect } from 'react'
import { ThemeProvider } from '@/components/layout/ThemeProvider'
import { AuthUI } from '@/components/auth/AuthUI'
import { Sidebar } from '@/components/layout/Sidebar'
import { Toolbar } from '@/components/layout/Toolbar'
import { SegmentationCanvas } from '@/components/canvas/SegmentationCanvas'
import { ToastContainer } from '@/components/ui/Toast'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { useSAMWorker } from '@/hooks/useSAMWorker'
import type { MaskData, SegmentationPoint } from '@/types/sam'

// ── App inner (auth-gated) ─────────────────────────────────────────────────────
function AppInner() {
  const { toasts, toast, dismiss } = useToast()
  const {
    state: modelState,
    isEncoding,
    isDecoding,
    isEmbeddingReady,
    loadModel,
    encodeImage,
    decode,
    setOnMaskResult,
    setOnStatusChange,
  } = useSAMWorker()

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageFileName, setImageFileName] = useState<string | null>(null)
  const [maskData, setMaskData] = useState<MaskData | null>(null)
  const [maskOpacity, setMaskOpacity] = useState(0.6)
  const [statusMessage, setStatusMessage] = useState('Load the model to begin')
  const [clearTrigger, setClearTrigger] = useState(0)
  const currentImageUrlRef = useRef<string | null>(null)

  // Wire up worker callbacks
  useEffect(() => {
    setOnMaskResult((mask) => setMaskData(mask))
    setOnStatusChange((msg) => setStatusMessage(msg))
  }, [setOnMaskResult, setOnStatusChange])

  const handleLoadModel = useCallback(async () => {
    loadModel()
    toast({ title: 'Loading SAM 2 model…', type: 'info' })
  }, [loadModel, toast])

  // Watch modelState for ready toast
  useEffect(() => {
    if (modelState.status === 'ready') {
      toast({ title: 'SAM 2 model loaded', type: 'success' })
    }
  }, [modelState.status, toast])

  const handleImageLoad = useCallback((url: string, fileName?: string) => {
    if (modelState.status !== 'ready') {
      toast({ title: 'Please load the model first', type: 'info' })
      return
    }
    if (currentImageUrlRef.current?.startsWith('blob:')) {
      URL.revokeObjectURL(currentImageUrlRef.current)
    }
    currentImageUrlRef.current = url
    setImageUrl(url)
    setImageFileName(fileName ?? null)
    setMaskData(null)
    setStatusMessage('Extracting image embedding…')
    encodeImage(url)
  }, [modelState.status, toast, encodeImage])

  const handleDecode = useCallback((points: SegmentationPoint[]) => {
    decode(points)
  }, [decode])

  const handleClearPoints = useCallback(() => {
    setMaskData(null)
    setClearTrigger(t => t + 1)
    setStatusMessage('Points cleared — click to add new points.')
  }, [])

  const handleResetImage = useCallback(() => {
    if (currentImageUrlRef.current?.startsWith('blob:')) {
      URL.revokeObjectURL(currentImageUrlRef.current)
    }
    currentImageUrlRef.current = null
    setImageUrl(null)
    setImageFileName(null)
    setMaskData(null)
    setStatusMessage('Load the model to begin')
  }, [])

  return (
    <div className="w-full h-full relative overflow-hidden">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onImageLoad={(url) => handleImageLoad(url)}
        hasImage={isEmbeddingReady}
        imageFileName={imageFileName}
        maskOpacity={maskOpacity}
        onMaskOpacityChange={setMaskOpacity}
        hasMask={!!maskData}
        maskData={maskData}
        imageUrl={imageUrl}
        modelState={modelState}
        onLoadModel={handleLoadModel}
      />

      <div className={`absolute inset-0 transition-all duration-300 ${sidebarOpen ? 'left-[320px]' : 'left-0'}`}>
        <SegmentationCanvas
          imageUrl={imageUrl}
          maskOpacity={maskOpacity}
          maskData={maskData}
          isModelReady={modelState.status === 'ready'}
          isEmbeddingReady={isEmbeddingReady}
          isEncoding={isEncoding}
          isDecoding={isDecoding}
          onDecode={handleDecode}
          onAllPointsCleared={() => setMaskData(null)}
          clearTrigger={clearTrigger}
        />

        <div className="absolute bottom-0 left-0 right-0 px-4 py-2 text-center pointer-events-none">
          <span className="text-xs text-slate-500 bg-slate-950/60 px-3 py-1 rounded-full backdrop-blur-sm">
            {modelState.status === 'loading'
              ? `${modelState.statusMessage} ${modelState.progress}%`
              : statusMessage}
          </span>
        </div>
      </div>

      {/* Toolbar */}
      <div className={`transition-all duration-300 ${sidebarOpen ? 'ml-[320px]' : ''}`}>
        <Toolbar
          onToggleSidebar={() => setSidebarOpen((p) => !p)}
          sidebarOpen={sidebarOpen}
          hasImage={isEmbeddingReady}
          hasMask={!!maskData}
          onClearPoints={handleClearPoints}
          onResetImage={handleResetImage}
        />
      </div>

      {/* Toasts */}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}

// ── Root (auth gate + theme) ───────────────────────────────────────────────────
export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-950">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <AuthUI />
  }

  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  )
}

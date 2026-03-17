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
import { useState, useCallback, useRef } from 'react'
import { ThemeProvider } from '@/components/layout/ThemeProvider'
import { AuthUI } from '@/components/auth/AuthUI'
import { Sidebar } from '@/components/layout/Sidebar'
import { Toolbar } from '@/components/layout/Toolbar'
import { SegmentationCanvas } from '@/components/canvas/SegmentationCanvas'
import { ToastContainer } from '@/components/ui/Toast'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { useSAMModel } from '@/hooks/useSAMModel'
import type { MaskData, RawImageData } from '@/types/sam'

// ── App inner (auth-gated) ─────────────────────────────────────────────────────
function AppInner() {
  const { toasts, toast, dismiss } = useToast()
  const { model, processor, state: modelState, loadModel } = useSAMModel()

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Image state
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageFileName, setImageFileName] = useState<string | null>(null)
  const [hasImage, setHasImage] = useState(false)

  // Mask state
  const [maskData, setMaskData] = useState<MaskData | null>(null)
  const [rawImageData, setRawImageData] = useState<RawImageData | null>(null)
  const [maskOpacity, setMaskOpacity] = useState(0.6)
  const [statusMessage, setStatusMessage] = useState('Load the model to begin')

  // Canvas reset triggers
  const [clearTrigger, setClearTrigger] = useState(0)
  const currentImageUrlRef = useRef<string | null>(null)

  // ── Model loading ─────────────────────────────────────────────────────────
  const handleLoadModel = useCallback(async () => {
    await loadModel()
    toast({ title: 'SAM 3 model loaded', type: 'success' })
  }, [loadModel, toast])

  // ── Image loading ─────────────────────────────────────────────────────────
  const handleImageLoad = useCallback((url: string, fileName?: string) => {
    if (modelState.status !== 'ready') {
      toast({ title: 'Please load the model first', type: 'info' })
      return
    }
    // Revoke previous object URL if it was one
    if (currentImageUrlRef.current?.startsWith('blob:')) {
      URL.revokeObjectURL(currentImageUrlRef.current)
    }
    currentImageUrlRef.current = url
    setImageUrl(url)
    setImageFileName(fileName ?? null)
    setHasImage(false)
    setMaskData(null)
    setRawImageData(null)
    setStatusMessage('Extracting image embedding…')
    setClearTrigger((p) => p + 1)
  }, [modelState.status, toast])

  // ── Mask generated ────────────────────────────────────────────────────────
  const handleMaskGenerated = useCallback((mask: MaskData, raw: RawImageData) => {
    setMaskData(mask)
    setRawImageData(raw)
    setHasImage(true)
  }, [])

  // ── Status from canvas ────────────────────────────────────────────────────
  const handleStatusChange = useCallback((msg: string) => {
    setStatusMessage(msg)
    if (msg.startsWith('Embedding ready')) setHasImage(true)
  }, [])

  // ── Clear points ──────────────────────────────────────────────────────────
  const handleClearPoints = useCallback(() => {
    setMaskData(null)
    // Re-set same image URL to trigger canvas reset without re-encoding
    if (imageUrl) {
      // We trigger clear via the clearTrigger mechanism in SegmentationCanvas
      setClearTrigger((p) => p + 1)
      // Signal canvas to only clear points (not re-encode) — done via null imageUrl then restore
    }
    setStatusMessage('Points cleared — click to add new points.')
  }, [imageUrl])

  // ── Reset image ────────────────────────────────────────────────────────────
  const handleResetImage = useCallback(() => {
    if (currentImageUrlRef.current?.startsWith('blob:')) {
      URL.revokeObjectURL(currentImageUrlRef.current)
    }
    currentImageUrlRef.current = null
    setImageUrl(null)
    setImageFileName(null)
    setHasImage(false)
    setMaskData(null)
    setRawImageData(null)
    setStatusMessage('Load the model to begin')
  }, [])

  return (
    <div className="w-full h-full relative overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onImageLoad={(url) => handleImageLoad(url)}
        hasImage={hasImage}
        imageFileName={imageFileName}
        maskOpacity={maskOpacity}
        onMaskOpacityChange={setMaskOpacity}
        onClearPoints={handleClearPoints}
        onResetImage={handleResetImage}
        hasMask={!!maskData}
        maskData={maskData}
        rawImageData={rawImageData}
        modelState={modelState}
        onLoadModel={handleLoadModel}
      />

      {/* Main canvas area */}
      <div
        className={`absolute inset-0 transition-all duration-300 ${
          sidebarOpen ? 'left-[320px]' : 'left-0'
        }`}
      >
        <SegmentationCanvas
          key={clearTrigger}
          model={model}
          processor={processor}
          imageUrl={imageUrl}
          maskOpacity={maskOpacity}
          onMaskGenerated={handleMaskGenerated}
          onStatusChange={handleStatusChange}
          isModelReady={modelState.status === 'ready'}
        />

        {/* Status bar */}
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

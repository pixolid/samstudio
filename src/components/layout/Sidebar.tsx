import { useRef, useState } from 'react'
import { LogOut, Upload, ExternalLink, Download, ChevronDown, Cpu } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { useAuth } from '@/hooks/useAuth'
import { doSignOut } from '@/firebase/auth'
import type { MaskData, BackendType, ModelState } from '@/types/sam'
import { downloadMask, downloadCutout } from '@/utils/download'

// ── Example images (bundled in public/samples/) ────────────────────────────────
// BASE_URL is '/SamStudio/' in production, '/' in dev — keeps paths correct on both
const BASE = import.meta.env.BASE_URL
const EXAMPLE_IMAGES = [
  { src: `${BASE}samples/truck.jpg` },
  { src: `${BASE}samples/corgi.jpg` },
  { src: `${BASE}samples/groceries.jpg` },
]

// ── Static section header with separator ──────────────────────────────────────
function SectionLabel({ title, isDark }: { title: string; isDark: boolean }) {
  return (
    <div className={`px-4 pt-4 pb-1.5 flex items-center gap-2`}>
      <span className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
        {title}
      </span>
      <div className={`flex-1 h-px ${isDark ? 'bg-white/[0.06]' : 'bg-slate-200'}`} />
    </div>
  )
}

// ── Sidebar props ──────────────────────────────────────────────────────────────
interface SidebarProps {
  open: boolean
  onClose: () => void
  onImageLoad: (url: string) => void
  hasImage: boolean
  imageFileName: string | null
  maskOpacity: number
  onMaskOpacityChange: (v: number) => void
  hasMask: boolean
  maskData: MaskData | null
  imageUrl: string | null
  modelState: ModelState
  onLoadModel: () => void
}

// ── Main Sidebar ───────────────────────────────────────────────────────────────
export function Sidebar({
  open,
  onClose,
  onImageLoad,
  hasImage,
  imageFileName,
  maskOpacity,
  onMaskOpacityChange,
  hasMask,
  maskData,
  imageUrl,
  modelState,
  onLoadModel,
}: SidebarProps) {
  const { isDark } = useTheme()
  const { user } = useAuth()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      if (typeof ev.target?.result === 'string') onImageLoad(ev.target.result)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const backendBadge = (backend: BackendType | null) => {
    if (backend === 'webgpu') return <span className="text-emerald-400 font-semibold">WebGPU ⚡</span>
    if (backend === 'wasm')   return <span className="text-yellow-400 font-semibold">WASM (CPU)</span>
    return <span className={isDark ? 'text-slate-500' : 'text-slate-400'}>—</span>
  }

  const isModelIdle    = modelState.status === 'idle'
  const isModelLoading = modelState.status === 'loading'
  const isModelReady   = modelState.status === 'ready'
  const isModelError   = modelState.status === 'error'

  return (
    <div
      className={`absolute top-0 left-0 h-full z-40 transition-transform duration-300 ease-out ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
      style={{ width: '320px' }}
    >
      <div className={`w-full h-full flex flex-col backdrop-blur-xl shadow-2xl ${isDark ? 'bg-slate-900/95' : 'bg-slate-50/95'}`}>

        {/* ── Header ── */}
        <div className={`px-4 pt-4 pb-3 border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-1.5">
              <img
                src={`${BASE}logo_webseite_white.png`}
                alt="Pixolid"
                className={`w-[200px] h-[80px] object-contain object-left ${isDark ? '' : 'invert'}`}
              />
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>SAM Studio</span>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-400 border border-violet-500/30">
                  Beta
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors text-lg leading-none mt-1
                ${isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
            >
              ×
            </button>
          </div>
        </div>

        {/* ── Scrollable content ── */}
        <div className="flex-1 overflow-y-auto">

          {/* ── MODEL ── */}
          <SectionLabel title="Model" isDark={isDark} />
          <div className="px-4 pb-4 space-y-3">
            {/* Load button */}
            {isModelIdle && (
              <button
                onClick={onLoadModel}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold
                  bg-violet-500 text-white hover:bg-violet-600 transition-all shadow-lg shadow-violet-500/20"
              >
                <Cpu className="w-4 h-4" />
                Load SAM 2.1 Model
              </button>
            )}
            {isModelLoading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {modelState.statusMessage}
                  </span>
                  <span className={`text-xs tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {modelState.progress}%
                  </span>
                </div>
                <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
                  <div
                    className="h-full bg-violet-500 transition-all duration-300"
                    style={{ width: `${modelState.progress}%` }}
                  />
                </div>
              </div>
            )}
            {isModelReady && (
              <div className={`flex items-center justify-between text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                <span className="text-emerald-400 font-medium">● Model ready</span>
                {backendBadge(modelState.backend)}
              </div>
            )}
            {isModelError && (
              <div className="space-y-2">
                <p className="text-red-400 text-xs">{modelState.error}</p>
                <button
                  onClick={onLoadModel}
                  className="w-full py-2 rounded-xl text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
                >
                  Retry Loading
                </button>
              </div>
            )}
            {/* Model info row when ready */}
            {isModelReady && (
              <div className={`text-xs ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                SAM 2.1 Tiny · vision q4 · decoder fp32
              </div>
            )}
          </div>

          {/* ── IMAGE ── */}
          <SectionLabel title="Image" isDark={isDark} />
          <div className="px-4 pb-4 space-y-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const file = e.dataTransfer.files[0]
                if (file?.type.startsWith('image/')) {
                  const reader = new FileReader()
                  reader.onload = (ev) => {
                    if (typeof ev.target?.result === 'string') onImageLoad(ev.target.result)
                  }
                  reader.readAsDataURL(file)
                }
              }}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed text-sm font-medium transition-all
                ${isDark
                  ? 'border-white/10 hover:border-violet-500/50 hover:bg-violet-500/5 text-slate-400 hover:text-violet-300'
                  : 'border-slate-300 hover:border-violet-400 hover:bg-violet-50 text-slate-500 hover:text-violet-600'
                }`}
            >
              <Upload className="w-4 h-4" />
              {hasImage ? 'Replace Image' : 'Upload Image'}
            </button>
            {imageFileName && (
              <p className={`text-xs truncate text-center ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {imageFileName}
              </p>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

            {/* Example images */}
            <p className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
              Examples
            </p>
            <div className="grid grid-cols-3 gap-2">
              {EXAMPLE_IMAGES.map((ex) => (
                <button
                  key={ex.src}
                  onClick={() => onImageLoad(ex.src)}
                  title={ex.label}
                  className={`block p-1 rounded-xl transition-all
                    ${isDark
                      ? 'bg-white/5 hover:bg-violet-500/20'
                      : 'bg-slate-100 hover:bg-violet-50'
                    }`}
                >
                  <img
                    src={ex.src}
                    alt={ex.label}
                    className="w-full aspect-square rounded-lg object-cover opacity-70 hover:opacity-100 transition-opacity"
                    loading="lazy"
                    crossOrigin="anonymous"
                  />
                </button>
              ))}
            </div>
          </div>

          {/* ── SEGMENTATION ── */}
          <SectionLabel title="Segmentation" isDark={isDark} />
          <div className="px-4 pb-4 space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Mask Opacity</span>
                <span className={`text-xs tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {maskOpacity.toFixed(2)}
                </span>
              </div>
              <input
                type="range" min={0} max={1} step={0.01}
                value={maskOpacity}
                onChange={(e) => onMaskOpacityChange(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            <div className={`text-xs space-y-1.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500 border border-white/30 shrink-0" />
                <span>Left click — include region</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500 border border-white/30 shrink-0" />
                <span>Right click — exclude region</span>
              </div>
              <p className="pt-0.5">Click a point marker to remove it.</p>
            </div>
          </div>

          {/* ── EXPORT ── */}
          <SectionLabel title="Export" isDark={isDark} />
          <div className="px-4 pb-6 space-y-2">
            <button
              onClick={() => { if (maskData) downloadMask(maskData) }}
              disabled={!hasMask}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-semibold transition-all
                disabled:opacity-40 disabled:cursor-not-allowed
                ${isDark
                  ? 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/[0.06]'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200'
                }`}
            >
              <Download className="w-3.5 h-3.5" />
              Download Mask (PNG)
            </button>
            <button
              onClick={async () => { if (maskData && imageUrl) await downloadCutout(maskData, imageUrl) }}
              disabled={!hasMask || !imageUrl}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-semibold transition-all
                disabled:opacity-40 disabled:cursor-not-allowed
                bg-violet-500 text-white hover:bg-violet-600 shadow-lg shadow-violet-500/20
                disabled:bg-violet-500/30 disabled:shadow-none`}
            >
              <Download className="w-3.5 h-3.5" />
              Download Cutout (PNG)
            </button>
          </div>

        </div>

        {/* ── User footer ── */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen((p) => !p)}
            className={`w-full flex items-center gap-2 px-4 py-3 border-t transition-colors ${
              isDark ? 'border-white/[0.06] hover:bg-white/5' : 'border-slate-200 hover:bg-slate-100/60'
            }`}
          >
            {user?.photoURL && (
              <img src={user.photoURL} alt="" className="w-6 h-6 rounded-full shrink-0" referrerPolicy="no-referrer" />
            )}
            <span className={`text-xs truncate flex-1 text-left ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              {user?.displayName || user?.email}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${userMenuOpen ? 'rotate-180' : ''} ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
          </button>

          {userMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
              <div className={`absolute bottom-full left-0 right-0 z-50 mx-2 mb-1 rounded-xl shadow-2xl overflow-hidden border
                ${isDark ? 'bg-slate-800 border-white/[0.08]' : 'bg-white border-slate-200'}`}>
                <a
                  href="https://www.pixolid.de"
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setUserMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
                    isDark ? 'text-slate-200 hover:bg-white/10' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <ExternalLink className="w-4 h-4 shrink-0" />
                  Pixolid.de
                </a>
                <div className={`h-px mx-3 ${isDark ? 'bg-white/[0.06]' : 'bg-slate-100'}`} />
                <button
                  onClick={() => { setUserMenuOpen(false); doSignOut() }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
                    isDark ? 'text-red-400 hover:bg-red-500/10' : 'text-red-500 hover:bg-red-50'
                  }`}
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  Logout
                </button>
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  )
}

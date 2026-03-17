import { useRef, useState } from 'react'
import {
  X, LogOut, Upload, ChevronDown, ChevronUp,
  ExternalLink, Download,
} from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { useAuth } from '@/hooks/useAuth'
import { doSignOut } from '@/firebase/auth'
import type { MaskData, BackendType, ModelState } from '@/types/sam'
import { downloadMask, downloadCutout } from '@/utils/download'

// ── Example images (from SAM's demo set) ──────────────────────────────────────
const EXAMPLE_IMAGES = [
  { label: '🚛 Truck',    src: 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/truck.png' },
  { label: '🐕 Corgi',   src: 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/corgi.jpg' },
  { label: '🛒 Groceries', src: 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/grocery-items.png' },
]

// ── Collapsible section ────────────────────────────────────────────────────────
function Section({
  title,
  children,
  isDark,
  defaultOpen = true,
}: {
  title: string
  children: React.ReactNode
  isDark: boolean
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className={`border-b ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
      <button
        onClick={() => setOpen((p) => !p)}
        className={`w-full flex items-center justify-between px-4 py-3 text-xs font-semibold uppercase tracking-wider transition-colors
          ${isDark ? 'text-slate-400 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700'}`}
      >
        {title}
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  )
}

// ── Sidebar props ─────────────────────────────────────────────────────────────
interface SidebarProps {
  open: boolean
  onClose: () => void
  // Image
  onImageLoad: (url: string) => void
  hasImage: boolean
  imageFileName: string | null
  // Segmentation
  maskOpacity: number
  onMaskOpacityChange: (v: number) => void
  onClearPoints: () => void
  onResetImage: () => void
  hasMask: boolean
  // Export
  maskData: MaskData | null
  imageUrl: string | null
  // Model info
  modelState: ModelState
  onLoadModel: () => void
}

// ── Main Sidebar ──────────────────────────────────────────────────────────────
export function Sidebar({
  open,
  onClose,
  onImageLoad,
  hasImage,
  imageFileName,
  maskOpacity,
  onMaskOpacityChange,
  onClearPoints,
  onResetImage,
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
      const result = ev.target?.result
      if (typeof result === 'string') onImageLoad(result)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const btnSecondary = `w-full py-2.5 rounded-xl text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed
    ${isDark ? 'bg-white/5 hover:bg-white/10 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`

  const backendBadge = (backend: BackendType | null) => {
    if (backend === 'webgpu') return <span className="text-emerald-400 font-semibold">WebGPU ⚡</span>
    if (backend === 'wasm')   return <span className="text-yellow-400 font-semibold">WASM (CPU)</span>
    return <span className="text-slate-500">—</span>
  }

  return (
    <div
      className={`absolute top-0 left-0 h-full z-40 transition-transform duration-300 ease-out ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
      style={{ width: '320px' }}
    >
      <div
        className={`w-full h-full flex flex-col backdrop-blur-xl shadow-2xl ${
          isDark ? 'bg-slate-900/95' : 'bg-slate-50/95'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between p-4 border-b ${
            isDark ? 'border-white/[0.06]' : 'border-slate-200'
          }`}
        >
          <img
            src="/logo_webseite_white.png"
            alt="Pixolid"
            className={`w-[160px] h-[60px] object-contain ${isDark ? '' : 'invert'}`}
          />
          <button
            onClick={onClose}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
              isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* App label */}
        <div className={`px-4 py-2 border-b flex items-center gap-2 ${isDark ? 'border-white/[0.06]' : 'border-slate-200'}`}>
          <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>SAM Studio</span>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-400 border border-violet-500/30">
            Beta
          </span>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Image Upload ── */}
          <Section title="Image" isDark={isDark}>
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
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </Section>

          {/* ── Example Images ── */}
          <Section title="Example Images" isDark={isDark} defaultOpen={false}>
            <div className="grid grid-cols-3 gap-2">
              {EXAMPLE_IMAGES.map((ex) => (
                <button
                  key={ex.src}
                  onClick={() => onImageLoad(ex.src)}
                  title={ex.label}
                  className={`flex flex-col items-center gap-1 p-1.5 rounded-xl text-xs font-medium transition-all
                    ${isDark
                      ? 'bg-white/5 hover:bg-violet-500/20 text-slate-400 hover:text-violet-300'
                      : 'bg-slate-100 hover:bg-violet-50 text-slate-500 hover:text-violet-600'
                    }`}
                >
                  <img
                    src={ex.src}
                    alt={ex.label}
                    className="w-full aspect-square rounded-lg object-cover opacity-70 hover:opacity-100 transition-opacity"
                    loading="lazy"
                    crossOrigin="anonymous"
                  />
                  <span>{ex.label}</span>
                </button>
              ))}
            </div>
          </Section>

          {/* ── Segmentation ── */}
          <Section title="Segmentation" isDark={isDark}>
            {/* Opacity slider */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className={`text-xs font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  Mask Opacity
                </span>
                <span className={`text-xs tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                  {maskOpacity.toFixed(2)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={maskOpacity}
                onChange={(e) => onMaskOpacityChange(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>

            {/* Click mode info */}
            <div className={`text-xs space-y-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              <p>⭐ Left click — include region</p>
              <p>❌ Right click — exclude region</p>
            </div>

            {/* Clear / Reset buttons */}
            <button
              onClick={onClearPoints}
              disabled={!hasImage}
              className={btnSecondary}
            >
              Clear Points
            </button>
            <button
              onClick={onResetImage}
              disabled={!hasImage}
              className={btnSecondary}
            >
              Reset Image
            </button>
          </Section>

          {/* ── Export ── */}
          <Section title="Export" isDark={isDark} defaultOpen={false}>
            <button
              onClick={() => { if (maskData) downloadMask(maskData) }}
              disabled={!hasMask}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium transition-all
                disabled:opacity-40 disabled:cursor-not-allowed
                ${isDark ? 'bg-white/5 hover:bg-white/10 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
            >
              <Download className="w-3.5 h-3.5" />
              Download Mask (PNG)
            </button>
            <button
              onClick={async () => { if (maskData && imageUrl) await downloadCutout(maskData, imageUrl) }}
              disabled={!hasMask || !imageUrl}
              className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium transition-all
                disabled:opacity-40 disabled:cursor-not-allowed
                ${isDark ? 'bg-white/5 hover:bg-white/10 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}
            >
              <Download className="w-3.5 h-3.5" />
              Download Cutout (PNG)
            </button>
          </Section>

          {/* ── Model Info ── */}
          <Section title="Model" isDark={isDark} defaultOpen={false}>
            <div className={`space-y-2 text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <div className="flex justify-between">
                <span>Model</span>
                <span className={isDark ? 'text-slate-300' : 'text-slate-600'}>SAM 2 Tiny (q4/q8)</span>
              </div>
              <div className="flex justify-between">
                <span>Backend</span>
                {backendBadge(modelState.backend)}
              </div>
              <div className="flex justify-between">
                <span>Status</span>
                <span className={
                  modelState.status === 'ready' ? 'text-emerald-400' :
                  modelState.status === 'error' ? 'text-red-400' :
                  modelState.status === 'loading' ? 'text-violet-400' :
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }>
                  {modelState.status === 'idle' ? 'Not loaded' :
                   modelState.status === 'loading' ? 'Loading…' :
                   modelState.status === 'ready' ? 'Ready' : 'Error'}
                </span>
              </div>
              {modelState.status === 'loading' && (
                <div>
                  <div className="flex justify-between mb-1">
                    <span>Progress</span>
                    <span>{modelState.progress}%</span>
                  </div>
                  <div className={`h-1.5 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-200'}`}>
                    <div
                      className="h-full bg-violet-500 transition-all duration-300"
                      style={{ width: `${modelState.progress}%` }}
                    />
                  </div>
                </div>
              )}
              {modelState.status === 'error' && (
                <p className="text-red-400 text-[11px]">{modelState.error}</p>
              )}
            </div>

            {modelState.status === 'idle' && (
              <button
                onClick={onLoadModel}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold
                  bg-violet-500 text-white hover:bg-violet-600 transition-all shadow-lg shadow-violet-500/20"
              >
                Load SAM 2 Model
              </button>
            )}
            {modelState.status === 'error' && (
              <button
                onClick={onLoadModel}
                className="w-full py-2 rounded-xl text-xs font-medium bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all"
              >
                Retry Loading
              </button>
            )}
          </Section>

        </div>

        {/* User footer */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen((p) => !p)}
            className={`w-full flex items-center gap-2 px-4 py-3 border-t transition-colors ${
              isDark
                ? 'border-white/[0.06] hover:bg-white/5'
                : 'border-slate-200 hover:bg-slate-100/60'
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
              <div
                className={`absolute bottom-full left-0 right-0 z-50 mx-2 mb-1 rounded-xl shadow-2xl overflow-hidden border
                  ${isDark ? 'bg-slate-800 border-white/[0.08]' : 'bg-white border-slate-200'}`}
              >
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

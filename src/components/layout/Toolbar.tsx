import { useRef, useState, useCallback } from 'react'
import { Moon, Sun, PanelLeft, Trash2, ImageOff, GripVertical } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

interface ToolbarProps {
  onToggleSidebar: () => void
  sidebarOpen: boolean
  hasImage: boolean
  hasMask: boolean
  onClearPoints: () => void
  onResetImage: () => void
}

export function Toolbar({
  onToggleSidebar,
  sidebarOpen,
  hasImage,
  hasMask,
  onClearPoints,
  onResetImage,
}: ToolbarProps) {
  const { isDark, toggleTheme } = useTheme()
  const toolbarRef = useRef<HTMLDivElement>(null)
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null)
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; posX: number; posY: number } | null>(null)

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const toolbar = toolbarRef.current
    if (!toolbar) return

    const rect = toolbar.getBoundingClientRect()
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      posX: rect.left,
      posY: rect.top,
    }

    const onMove = (me: MouseEvent) => {
      if (!dragStartRef.current) return
      const dx = me.clientX - dragStartRef.current.mouseX
      const dy = me.clientY - dragStartRef.current.mouseY
      setDragPos({
        x: dragStartRef.current.posX + dx,
        y: dragStartRef.current.posY + dy,
      })
    }

    const onUp = () => {
      dragStartRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  const toolbarStyle: React.CSSProperties = dragPos
    ? { position: 'fixed', left: dragPos.x, top: dragPos.y }
    : { position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)' }

  return (
    <div ref={toolbarRef} style={toolbarStyle} className="z-50">
      <div
        className={`flex items-center gap-2 p-2 rounded-2xl backdrop-blur-xl shadow-2xl select-none ${
          isDark ? 'bg-slate-900/95' : 'bg-slate-50/95'
        }`}
      >
        {/* Drag handle */}
        <div
          onMouseDown={handleDragStart}
          className={`h-9 px-1 flex items-center rounded-xl cursor-grab active:cursor-grabbing transition-colors ${
            isDark ? 'hover:bg-white/10 text-slate-500 hover:text-slate-400' : 'hover:bg-slate-200/60 text-slate-300 hover:text-slate-500'
          }`}
          title="Drag to move toolbar"
        >
          <GripVertical className="w-4 h-4" />
        </div>

        <div className={`w-px h-6 ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />

        <ToolbarButton
          icon={<PanelLeft className="w-5 h-5" />}
          onClick={onToggleSidebar}
          active={sidebarOpen}
          tooltip="Toggle sidebar"
          isDark={isDark}
        />

        <div className={`w-px h-6 mx-1 ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />

        <ToolbarButton
          icon={<Trash2 className="w-5 h-5" />}
          onClick={onClearPoints}
          disabled={!hasMask}
          tooltip="Clear points"
          isDark={isDark}
        />
        <ToolbarButton
          icon={<ImageOff className="w-5 h-5" />}
          onClick={onResetImage}
          disabled={!hasImage}
          tooltip="Reset image"
          isDark={isDark}
        />

        <div className={`w-px h-6 mx-1 ${isDark ? 'bg-white/10' : 'bg-slate-200'}`} />

        <ToolbarButton
          icon={isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          onClick={toggleTheme}
          tooltip={isDark ? 'Light mode' : 'Dark mode'}
          isDark={isDark}
        />
      </div>
    </div>
  )
}

function ToolbarButton({
  icon,
  onClick,
  active,
  disabled,
  tooltip,
  isDark,
}: {
  icon: React.ReactNode
  onClick: () => void
  active?: boolean
  disabled?: boolean
  tooltip: string
  isDark: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={tooltip}
      disabled={disabled}
      className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200
        hover:scale-105 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100
        ${active
          ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/25'
          : isDark
            ? 'hover:bg-white/10 text-slate-300'
            : 'hover:bg-slate-200/60 text-slate-600'
        }`}
    >
      {icon}
    </button>
  )
}

import { Moon, Sun, PanelLeft } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'

interface ToolbarProps {
  onToggleSidebar: () => void
  sidebarOpen: boolean
}

export function Toolbar({ onToggleSidebar, sidebarOpen }: ToolbarProps) {
  const { isDark, toggleTheme } = useTheme()

  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3">
      <div
        className={`flex items-center gap-2 p-2 rounded-2xl backdrop-blur-xl shadow-2xl ${
          isDark ? 'bg-slate-900/95' : 'bg-slate-50/95'
        }`}
      >
        <ToolbarButton
          icon={<PanelLeft className="w-5 h-5" />}
          onClick={onToggleSidebar}
          active={sidebarOpen}
          tooltip="Toggle sidebar"
          isDark={isDark}
        />
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
  tooltip,
  isDark,
}: {
  icon: React.ReactNode
  onClick: () => void
  active?: boolean
  tooltip: string
  isDark: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={tooltip}
      className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200
        hover:scale-105 active:scale-95
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

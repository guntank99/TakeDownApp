import {
  Activity,
  Archive,
  Briefcase,
  Clapperboard,
  ShieldAlert,
  UserCog,
  Flame,
  ClipboardList,
  FileText,
  LayoutDashboard,
  MessageSquareText,
  Microscope,
  Network,
  Radar,
  Scale,
  ScrollText,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** false = page not built yet; shown disabled ("Segera") instead of linking to a 404. */
  enabled: boolean;
  /** Only shown to administrators. */
  adminOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dasbor", href: "/dashboard", icon: LayoutDashboard, enabled: true },
  { label: "Viral Indonesia", href: "/viral", icon: Flame, enabled: true },
  { label: "Video Viral", href: "/video", icon: Clapperboard, enabled: true },
  { label: "Pemantauan", href: "/monitoring", icon: Radar, enabled: true },
  { label: "Isu", href: "/issues", icon: Activity, enabled: true },
  { label: "Postingan", href: "/posts", icon: FileText, enabled: true },
  { label: "Akun", href: "/accounts", icon: Users, enabled: true },
  { label: "Analisis", href: "/analysis", icon: Microscope, enabled: true },
  { label: "Sentimen", href: "/sentiment", icon: MessageSquareText, enabled: true },
  { label: "SNA", href: "/sna", icon: Network, enabled: true },
  { label: "Kebijakan (ToC)", href: "/toc", icon: Scale, enabled: true },
  { label: "Kasus", href: "/cases", icon: Briefcase, enabled: true },
  { label: "Bukti", href: "/evidence", icon: Archive, enabled: true },
  { label: "Take Down", href: "/takedown", icon: ShieldAlert, enabled: true },
  { label: "Laporan", href: "/reports", icon: ClipboardList, enabled: true },
  { label: "Riwayat Aktivitas", href: "/audit", icon: ScrollText, enabled: true },
  { label: "Pengguna", href: "/users", icon: UserCog, enabled: true, adminOnly: true },
  { label: "Pengaturan", href: "/settings", icon: Settings, enabled: true },
];

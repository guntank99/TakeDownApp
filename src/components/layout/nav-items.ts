import {
  Activity,
  Archive,
  Briefcase,
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
  /** false = page not built yet; shown disabled instead of linking to a 404. */
  enabled: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, enabled: true },
  { label: "Monitoring", href: "/monitoring", icon: Radar, enabled: true },
  { label: "Issues", href: "/issues", icon: Activity, enabled: true },
  { label: "Posts", href: "/posts", icon: FileText, enabled: true },
  { label: "Accounts", href: "/accounts", icon: Users, enabled: true },
  { label: "Analysis", href: "/analysis", icon: Microscope, enabled: true },
  { label: "Sentiment", href: "/sentiment", icon: MessageSquareText, enabled: true },
  { label: "SNA", href: "/sna", icon: Network, enabled: true },
  { label: "ToC", href: "/toc", icon: Scale, enabled: true },
  { label: "Cases", href: "/cases", icon: Briefcase, enabled: true },
  { label: "Evidence", href: "/evidence", icon: Archive, enabled: true },
  { label: "Reports", href: "/reports", icon: ClipboardList, enabled: true },
  { label: "Audit", href: "/audit", icon: ScrollText, enabled: true },
  { label: "Settings", href: "/settings", icon: Settings, enabled: true },
];

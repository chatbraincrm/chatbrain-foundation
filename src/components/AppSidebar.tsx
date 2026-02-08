import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { NavLink } from "@/components/NavLink";
import { useTenant } from "@/lib/tenant-context";
import { useAuth } from "@/lib/auth-context";
import { can, type Permission } from "@/lib/rbac";
import {
  LayoutDashboard, Users, Mail, FileText, Settings, Building2, LogOut,
  GitBranch, UserCircle, Briefcase, CheckSquare, Building, Tag, Inbox, Bot, MessageCircle, CreditCard,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useUnreadCounts } from "@/hooks/use-unread-counts";

const mainItems: { title: string; url: string; icon: typeof LayoutDashboard; permission: Permission | null }[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, permission: null },
  { title: "Membros", url: "/members", icon: Users, permission: 'members:read' },
  { title: "Convites", url: "/invites", icon: Mail, permission: 'invites:read' },
  { title: "Auditoria", url: "/audit", icon: FileText, permission: 'audit:read' },
  { title: "Configurações", url: "/settings", icon: Settings, permission: 'tenant:read' },
  { title: "Agente de Atendimento", url: "/settings/ai-agent", icon: Bot, permission: 'view_ai_agent' },
  { title: "WhatsApp", url: "/settings/whatsapp", icon: MessageCircle, permission: 'view_whatsapp_settings' },
  { title: "Plano e Uso", url: "/settings/billing", icon: CreditCard, permission: 'tenant:read' },
];

const crmItems: { title: string; url: string; icon: typeof LayoutDashboard; permission: Permission }[] = [
  { title: "Negócios", url: "/crm/deals", icon: Briefcase, permission: 'crm:read' },
  { title: "Leads", url: "/crm/leads", icon: UserCircle, permission: 'crm:read' },
  { title: "Empresas", url: "/crm/companies", icon: Building, permission: 'crm:read' },
  { title: "Tarefas", url: "/crm/tasks", icon: CheckSquare, permission: 'crm:read' },
  { title: "Pipelines", url: "/crm/pipelines", icon: GitBranch, permission: 'crm:read' },
  { title: "Tags", url: "/crm/tags", icon: Tag, permission: 'crm:read' },
];

const inboxItems: { title: string; url: string; icon: typeof LayoutDashboard; permission: Permission }[] = [
  { title: "Conversas", url: "/inbox", icon: Inbox, permission: 'crm:read' },
];

export function AppSidebar() {
  const { currentTenant, membership } = useTenant();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { totalUnread } = useUnreadCounts();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const visibleMain = mainItems.filter(
    item => !item.permission || can(membership?.role, item.permission)
  );

  const visibleCrm = crmItems.filter(
    item => can(membership?.role, item.permission)
  );

  const visibleInbox = inboxItems.filter(
    item => can(membership?.role, item.permission)
  );

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wider px-3 py-2">
            {currentTenant?.name || 'ChatBrain'}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleMain.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {visibleCrm.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs uppercase tracking-wider px-3 py-2">
              CRM
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleCrm.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors hover:bg-sidebar-accent"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span>{item.title}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {visibleInbox.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs uppercase tracking-wider px-3 py-2">
              Inbox
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleInbox.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors hover:bg-sidebar-accent"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className="flex-1">{item.title}</span>
                        {item.url === '/inbox' && totalUnread > 0 && (
                          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                            {totalUnread > 99 ? '99+' : totalUnread}
                          </span>
                        )}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <button
                onClick={() => navigate('/select-tenant')}
                className="flex items-center gap-3 px-3 py-2 w-full text-left rounded-md transition-colors hover:bg-sidebar-accent text-sidebar-foreground"
              >
                <Building2 className="h-4 w-4 shrink-0" />
                <span>Trocar Workspace</span>
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-3 px-3 py-2 w-full text-left rounded-md transition-colors hover:bg-sidebar-accent text-destructive"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                <span>Sair</span>
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

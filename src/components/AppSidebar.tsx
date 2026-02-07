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
import { LayoutDashboard, Users, Mail, FileText, Settings, Building2, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";

const mainItems: { title: string; url: string; icon: typeof LayoutDashboard; permission: Permission | null }[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard, permission: null },
  { title: "Membros", url: "/members", icon: Users, permission: 'members:read' },
  { title: "Convites", url: "/invites", icon: Mail, permission: 'invites:read' },
  { title: "Auditoria", url: "/audit", icon: FileText, permission: 'audit:read' },
  { title: "Configurações", url: "/settings", icon: Settings, permission: 'tenant:read' },
];

export function AppSidebar() {
  const { currentTenant, membership } = useTenant();
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const visibleItems = mainItems.filter(
    item => !item.permission || can(membership?.role, item.permission)
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
              {visibleItems.map((item) => (
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

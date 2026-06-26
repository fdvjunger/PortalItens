import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  AppBar,
  Box,
  Divider,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import InventoryIcon from '@mui/icons-material/Inventory';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import PeopleIcon from '@mui/icons-material/People';
import DescriptionIcon from '@mui/icons-material/Description';
import CategoryIcon from '@mui/icons-material/Category';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import { stepTokens } from '../theme/tokens';

const drawerWidth = 260;

const menuItems = [
  { label: 'Dashboard', path: '/dashboard', icon: <DashboardIcon /> },
  { label: 'Qualidade cadastral', path: '/qualidade-familia', icon: <FactCheckIcon /> },
  { label: 'Clientes', path: '/clientes', icon: <PeopleIcon /> },
  { label: 'Specs', path: '/specs', icon: <DescriptionIcon /> },
  { label: 'Catálogo', path: '/catalog-items', icon: <CategoryIcon /> },
  { label: 'Itens', path: '/spec-items', icon: <InventoryIcon /> },
  { label: 'Importar Excel', path: '/import-excel', icon: <UploadFileIcon /> },
];

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar sx={{ px: 2 }}>
        <Box>
          <Typography variant="subtitle2" sx={{ color: stepTokens.secondary, fontWeight: 700, letterSpacing: 1 }}>
            STEP
          </Typography>
          <Typography variant="h6" noWrap sx={{ fontWeight: 700, lineHeight: 1.1 }}>
            Spec Portal
          </Typography>
        </Box>
      </Toolbar>
      <Divider />
      <List sx={{ px: 1, py: 1 }}>
        {menuItems.map((item) => (
          <ListItemButton
            key={item.path}
            component={NavLink}
            to={item.path}
            onClick={() => setMobileOpen(false)}
            sx={{
              borderRadius: 2,
              mb: 0.5,
              '&.active': {
                background: `${stepTokens.primary}12`,
                color: stepTokens.primary,
                '& .MuiListItemIcon-root': { color: stepTokens.primary },
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
      </List>
      <Box sx={{ mt: 'auto', p: 2 }}>
        <Typography variant="caption" color="text.secondary">
          STEP Integrated Solutions
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 700 }}>
            Itens Portal
          </Typography>
          <Typography variant="body2" sx={{ ml: 2, opacity: 0.9, display: { xs: 'none', md: 'block' } }}>
            Catálogo técnico e ocorrências por spec
          </Typography>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, md: 3 },
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          mt: 8,
          backgroundColor: 'background.default',
          minHeight: '100vh',
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}

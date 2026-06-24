import { createTheme } from '@mui/material/styles';
import { stepTokens } from './tokens';

export const stepTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: stepTokens.primary,
      dark: stepTokens.primaryDark,
      light: stepTokens.primaryLight,
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: stepTokens.secondary,
      light: stepTokens.secondaryLight,
      contrastText: '#FFFFFF',
    },
    success: { main: stepTokens.success },
    warning: { main: stepTokens.warning },
    error: { main: stepTokens.error },
    background: {
      default: stepTokens.background,
      paper: stepTokens.surface,
    },
    divider: stepTokens.border,
    text: {
      primary: stepTokens.neutral900,
      secondary: stepTokens.neutral500,
    },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    h4: { fontWeight: 700, letterSpacing: '-0.02em' },
    h5: { fontWeight: 700 },
    h6: { fontWeight: 600 },
    subtitle1: { fontWeight: 500 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          border: `1px solid ${stepTokens.border}`,
          boxShadow: '0 8px 24px rgba(11, 79, 140, 0.06)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          border: `1px solid ${stepTokens.border}`,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: stepTokens.gradient,
          boxShadow: '0 4px 20px rgba(8, 58, 102, 0.25)',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: `1px solid ${stepTokens.border}`,
          backgroundColor: stepTokens.surface,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 500 },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            backgroundColor: stepTokens.neutral50,
            fontWeight: 600,
            color: stepTokens.neutral700,
          },
        },
      },
    },
  },
});

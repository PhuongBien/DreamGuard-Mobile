// ============================================================
// KBS Staff App — Theme Constants
// ============================================================
import { Ionicons } from '@expo/vector-icons';


export const Colors = {
  // Primary Palette (KBS Brand)
  primary50:  '#EAF6FC',
  primary100: '#BDE8F5',  // lightest brand
  primary200: '#86D5EE',
  primary300: '#4ABFE5',
  primary400: '#1FA8D8',
  primary500: '#4988C4',  // mid brand blue
  primary600: '#3A78B4',
  primary700: '#1C4D8D',  // deep brand blue
  primary800: '#153E75',
  primary900: '#0F2854',  // darkest brand navy

  // Neutrals
  white: '#FFFFFF',
  gray50:  '#F8FAFC',
  gray100: '#F1F5F9',
  gray200: '#E2E8F0',
  gray300: '#CBD5E1',
  gray400: '#94A3B8',
  gray500: '#64748B',
  gray600: '#475569',
  gray700: '#334155',
  gray800: '#1E293B',
  gray900: '#0F172A',

  // Semantic
  success:     '#22C55E',
  successLight:'#DCFCE7',
  warning:     '#F59E0B',
  warningLight:'#FEF3C7',
  error:       '#EF4444',
  errorLight:  '#FEE2E2',
  info:        '#4988C4',
  infoLight:   '#BDE8F5',

  // Status badge colors
  status: {
    pending:     { bg: '#FEF3C7', text: '#92400E', dot: '#F59E0B' },
    in_progress: { bg: '#BDE8F5', text: '#0F2854', dot: '#4988C4' },
    completed:   { bg: '#DCFCE7', text: '#14532D', dot: '#22C55E' },
    cancelled:   { bg: '#FEE2E2', text: '#7F1D1D', dot: '#EF4444' },
    on_hold:     { bg: '#E2E8F0', text: '#334155', dot: '#94A3B8' },
  },

  // Priority badge colors
  priority: {
    low:    { bg: '#F1F5F9', text: '#475569', dot: '#94A3B8' },
    medium: { bg: '#FEF3C7', text: '#92400E', dot: '#F59E0B' },
    high:   { bg: '#FEE2E2', text: '#7F1D1D', dot: '#EF4444' },
    urgent: { bg: '#FEE2E2', text: '#7F1D1D', dot: '#DC2626' },
  },
};

export const Typography = {
  // Font sizes
  xs:   10,
  sm:   12,
  base: 14,
  md:   16,
  lg:   18,
  xl:   20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,

  // Font weights (React Native)
  thin:       '100' as const,
  light:      '300' as const,
  regular:    '400' as const,
  medium:     '500' as const,
  semibold:   '600' as const,
  bold:       '700' as const,
  extrabold:  '800' as const,
};

export const Spacing = {
  xs:   4,
  sm:   8,
  md:   12,
  base: 16,
  lg:   20,
  xl:   24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 64,
};

export const BorderRadius = {
  sm:   6,
  base: 10,
  md:   14,
  lg:   18,
  xl:   24,
  full: 9999,
};

export const Shadow = {
  sm: {
    shadowColor: '#0F2854',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  base: {
    shadowColor: '#0F2854',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#0F2854',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 8,
  },
};

// Task type display config
export const TaskTypeConfig: Record<
  string,
  { label: string; icon: React.ComponentProps<typeof Ionicons>['name']; color: string }
> = {
  delivery:           { label: 'Delivery',        icon: 'car-outline', color: '#4988C4' },
  pickup:             { label: 'Pickup',          icon: 'cube-outline', color: '#F59E0B' },
  cleaning:           { label: 'Cleaning',     icon: 'water-outline', color: '#22C55E' },
  repair:             { label: 'Repair',         icon: 'construct-outline', color: '#EF4444' },
  trade_in:           { label: 'Trade In',       icon: 'swap-horizontal-outline', color: '#8B5CF6' },
  exchange:           { label: 'Exchange',          icon: 'refresh-outline', color: '#EC4899' },
  custom_order:       { label: 'Custom Order',        icon: 'sparkles-outline', color: '#F97316' },
  warehouse_inbound:  { label: 'Warehouse Inbound',         icon: 'download-outline', color: '#0F2854' },
  warehouse_outbound: { label: 'Warehouse Outbound',         icon: 'cloud-upload-outline', color: '#1C4D8D' }, // đổi upload-outline
  sales_consultation: { label: 'Sales Consultation',  icon: 'chatbubble-outline', color: '#4988C4' },
};

// Role display config
export const RoleConfig: Record<
  string,
  { label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }
> = {
  delivery_driver: { label: 'Delivery Driver', icon: 'car-outline' },
  cleaner:         { label: 'Cleaner',   icon: 'water-outline' },
  sales_staff:     { label: 'Sales Staff',icon: 'briefcase-outline' },
  warehouse_staff: { label: 'Warehouse Staff',       icon: 'cube-outline' },
  technician:      { label: 'Technician',       icon: 'construct-outline' },
  manager:         { label: 'Manager',             icon: 'person-outline' },
};

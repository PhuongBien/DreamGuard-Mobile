// KBS Staff App — Shared UI Components

import React, { ReactNode } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  Image,
} from "react-native";
import {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadow,
} from "../constants/theme";
import { TaskStatus, TaskPriority, TaskType } from "../types";
import { TaskTypeConfig } from "../constants/theme";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";

// KBSButton

interface KBSButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  disabled?: boolean;
  // icon?: string;
  icon?: ReactNode;
  style?: ViewStyle;
}

export function KBSButton({
  title,
  onPress,
  variant = "primary",
  size = "md",
  loading,
  disabled,
  icon,
  style,
}: KBSButtonProps) {
  const buttonStyles: ViewStyle[] = [
    styles.btn,
    styles[`btn_${variant}`],
    styles[`btn_${size}`],
  ];
  const textStyles: TextStyle[] = [
    styles.btnText,
    styles[`btnText_${variant}`],
    styles[`btnText_${size}`],
  ];

  if (disabled || loading) {
    buttonStyles.push(styles.btn_disabled);
  }

  return (
    <TouchableOpacity
      style={[...buttonStyles, style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.78}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === "primary" ? Colors.white : Colors.primary700}
        />
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {/* {icon && <Text style={{ fontSize: size === 'sm' ? 14 : 16 }}>{icon}</Text>} */}
          {icon && <View style={{ marginRight: 6 }}>{icon}</View>}
          <Text style={textStyles}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// StatusBadge

const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "Pending",
  delivering: "Delivering",
  arrived: "Arrived",
  checked_in: "Checked In",
  in_progress: "In Progress",
  checked_out: "Checked Out",
  delivered: "Delivered",
  returned: "Returned",
  completed: "Completed",
  cancelled: "Cancelled",
  on_hold: "On Hold",
};

interface StatusBadgeProps {
  status: TaskStatus;
  size?: "sm" | "base";
}

export function StatusBadge({ status, size = "base" }: StatusBadgeProps) {
  const cfg = Colors.status[status] || Colors.status.pending;
  return (
    <View
      style={[
        badgeStyles.wrap,
        {
          backgroundColor: cfg.bg,
          paddingVertical: size === "sm" ? 2 : 4,
          paddingHorizontal: size === "sm" ? 6 : 10,
        },
      ]}
    >
      <View style={[badgeStyles.dot, { backgroundColor: cfg.dot }]} />
      <Text
        style={[
          badgeStyles.text,
          { color: cfg.text, fontSize: size === "sm" ? 10 : 12 },
        ]}
      >
        {STATUS_LABELS[status]}
      </Text>
    </View>
  );
}

// PriorityBadge

// const PRIORITY_LABELS: Record<TaskPriority, string> = {
//   low:    'Thấp',
//   medium: 'Trung bình',
//   high:   'Cao',
//   urgent: 'Khẩn cấp',
// };

interface PriorityBadgeProps {
  priority: TaskPriority;
}

export function PriorityBadge({ priority }: PriorityBadgeProps) {
  const cfg = Colors.priority[priority];
  return (
    <View
      style={[badgeStyles.wrap, { paddingVertical: 2, paddingHorizontal: 8 }]}
    >
      <Text style={[badgeStyles.text, { color: cfg.text, fontSize: 11 }]}>
        {/* {priority === 'urgent' ? '🚨 ' : priority === 'high' ? '🔴 ' : ''}{PRIORITY_LABELS[priority]} */}
      </Text>
    </View>
  );
}

// TaskTypeBadge

interface TaskTypeBadgeProps {
  type: TaskType;
}

export function TaskTypeBadge({ type }: TaskTypeBadgeProps) {
  const cfg = TaskTypeConfig[type] || {
    label: type,
    icon: "cube-outline",
    color: Colors.primary500,
  };

  return (
    <View
      style={[
        badgeStyles.wrap,
        {
          backgroundColor: cfg.color + "18",
          paddingVertical: 4,
          paddingHorizontal: 10,
        },
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Ionicons name={cfg.icon as any} size={14} color={cfg.color} />
        <Text
          style={[
            badgeStyles.text,
            { color: cfg.color, fontSize: 12, fontWeight: "600" },
          ]}
        >
          {cfg.label}
        </Text>
      </View>
    </View>
  );
}

// export function TaskTypeBadge({ type }: TaskTypeBadgeProps) {
//   const cfg = TaskTypeConfig[type] || { label: type, icon: '📋', color: Colors.primary500 };
//   return (
//     <View style={[badgeStyles.wrap, { backgroundColor: cfg.color + '18', paddingVertical: 4, paddingHorizontal: 10 }]}>
//       <Text style={[badgeStyles.text, { color: cfg.color, fontSize: 12, fontWeight: '600' }]}>
//         {cfg.icon} {cfg.label}
//       </Text>
//     </View>
//   );
// }

// SectionCard

interface SectionCardProps {
  icon?: React.ReactNode;
  title?: string;
  children: React.ReactNode;
  style?: ViewStyle;
  headerRight?: React.ReactNode;
}

export function SectionCard({
  icon,
  title,
  children,
  style,
  headerRight,
}: SectionCardProps) {
  return (
    <View style={[cardStyles.card, style]}>
      {title && (
        // <View style={cardStyles.header}>
        //     {/* {icon && <View style={{ marginRight: 8 }}>{icon}</View>} */}
        //   {/* <Text style={cardStyles.title}>{title}</Text> */}
        //   {icon}
        //     <Text style={cardStyles.title}>{title}</Text>
        //   {headerRight}
        // </View>
        <View style={cardStyles.header}>
          <View style={cardStyles.headerLeft}>
            {icon}
            <Text style={cardStyles.title}>{title}</Text>
          </View>

          {headerRight && (
            <View style={cardStyles.headerRight}>{headerRight}</View>
          )}
        </View>
      )}
      {children}
    </View>
  );
}

// InfoRow

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// InfoRow
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type IconType = "ion" | "material";

interface InfoRowProps {
  iconType: IconType;
  iconName:
    | keyof typeof Ionicons.glyphMap
    | keyof typeof MaterialIcons.glyphMap;
  label: string;
  value: string | null;
  valueStyle?: TextStyle;
  iconColor?: string;
  iconSize?: number;
}

export function InfoRow({
  iconType,
  iconName,
  label,
  value,
  valueStyle,
  iconColor = Colors.gray500,
  iconSize = 18,
}: InfoRowProps) {
  const renderIcon = () => {
    if (iconType === "ion") {
      return (
        <Ionicons
          name={iconName as keyof typeof Ionicons.glyphMap}
          size={iconSize}
          color={iconColor}
        />
      );
    }

    return (
      <MaterialIcons
        name={iconName as keyof typeof MaterialIcons.glyphMap}
        size={iconSize}
        color={iconColor}
      />
    );
  };

  return (
    <View style={infoStyles.row}>
      <View style={infoStyles.icon}>{renderIcon()}</View>

      <View style={infoStyles.content}>
        <Text style={infoStyles.label}>{label}</Text>
        <Text style={[infoStyles.value, valueStyle]}>
          {value || "—"}
        </Text>
      </View>
    </View>
  );
}

// EmptyState

interface EmptyStateProps {
  // icon?: string;
  icon: ReactNode;
  title: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
}

export function EmptyState({ icon, title, subtitle, action }: EmptyStateProps) {
  return (
    <View style={emptyStyles.wrap}>
      <View style={{ marginBottom: 16 }}>{icon}</View>

      <Text style={emptyStyles.title}>{title}</Text>
      {subtitle && <Text style={emptyStyles.subtitle}>{subtitle}</Text>}

      {action && (
        <KBSButton
          title={action.label}
          onPress={action.onPress}
          variant="outline"
          style={{ marginTop: 16 }}
        />
      )}
    </View>
  );
}

// Avatar

interface AvatarProps {
  name: string;
  size?: number;
  imageUrl?: string | null;
}

export function Avatar({ name, size = 40, imageUrl }: AvatarProps) {
  const initials = name
    .split(" ")
    .slice(-2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();

  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: Colors.primary700,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          color: Colors.white,
          fontSize: size * 0.38,
          fontWeight: "700",
        }}
      >
        {initials}
      </Text>
    </View>
  );
}

// Divider

export function Divider({ style }: { style?: ViewStyle }) {
  return (
    <View style={[{ height: 1, backgroundColor: Colors.gray100 }, style]} />
  );
}

// STYLES

const styles = StyleSheet.create({
  btn: {
    borderRadius: BorderRadius.base,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  btn_primary: { backgroundColor: Colors.primary700 },
  btn_secondary: { backgroundColor: Colors.primary100 },
  btn_outline: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: Colors.primary700,
  },
  btn_ghost: { backgroundColor: "transparent" },
  btn_danger: { backgroundColor: Colors.error },
  btn_disabled: { opacity: 0.5 },
  btn_sm: { paddingVertical: 8, paddingHorizontal: 16 },
  btn_md: { paddingVertical: 12, paddingHorizontal: 20 },
  btn_lg: { paddingVertical: 16, paddingHorizontal: 24 },
  btnText: { fontWeight: "600" },
  btnText_primary: { color: Colors.white },
  btnText_secondary: { color: Colors.primary700 },
  btnText_outline: { color: Colors.primary700 },
  btnText_ghost: { color: Colors.primary700 },
  btnText_danger: { color: Colors.white },
  btnText_sm: { fontSize: Typography.sm },
  btnText_md: { fontSize: Typography.base },
  btnText_lg: { fontSize: Typography.md },
});

const badgeStyles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.full,
    gap: 5,
    alignSelf: "flex-start",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontWeight: "600",
  },
});

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.base,
    marginBottom: Spacing.base,
    ...Shadow.base,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 6,
    marginBottom: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.gray100,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },

  headerRight: {
    marginLeft: "auto",
  },
  title: {
    marginLeft: 6,
    fontSize: Typography.md,
    fontWeight: "700",
    color: Colors.primary900,
  },
});

const infoStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: Spacing.sm,
    gap: 10,
  },
  icon: {
    width: 24,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  content: { flex: 1 },
  label: {
    fontSize: Typography.xs,
    color: Colors.gray400,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  value: {
    fontSize: Typography.base,
    color: Colors.gray800,
    fontWeight: "500",
  },
});

const emptyStyles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing["2xl"],
    paddingVertical: Spacing["4xl"],
  },
  icon: { fontSize: 56, marginBottom: 16 },
  title: {
    fontSize: Typography.lg,
    fontWeight: "700",
    color: Colors.gray700,
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: Typography.base,
    color: Colors.gray400,
    textAlign: "center",
    lineHeight: 22,
  },
});

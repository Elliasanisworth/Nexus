// Shared style tokens. Plain JS objects (no Tailwind/styled-components —
// staying inside BUILD_SPEC's locked frontend stack), imported wherever a
// component needs consistent color/spacing instead of one-off inline hex codes.

export const colors = {
  bg: "#0a0c10",
  panel: "#12151b",
  panelAlt: "#171b22",
  border: "#242a35",
  text: "#e7e9ec",
  textMuted: "#8b93a3",
  accent: "#3b82f6",
  success: "#22c55e",
  warning: "#f59e0b",
  danger: "#ef4444",
  info: "#38bdf8",
};

export const statusColors = {
  active: colors.textMuted,
  pending: colors.warning,
  assigned: colors.accent,
  accepted: colors.accent,
  modified: colors.accent,
  rejected: colors.danger,
  resolved: colors.success,
  error: colors.danger,
};

export function badgeStyle(status) {
  return {
    display: "inline-block",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    padding: "3px 8px",
    borderRadius: 3,
    color: "#0a0c10",
    background: statusColors[status] || colors.textMuted,
    whiteSpace: "nowrap",
  };
}

export const panelStyle = {
  background: colors.panel,
  border: `1px solid ${colors.border}`,
  borderRadius: 6,
  padding: 16,
};

export const sectionTitleStyle = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: 1.2,
  textTransform: "uppercase",
  color: colors.textMuted,
  margin: "0 0 10px",
};

export const inputStyle = {
  background: colors.panelAlt,
  border: `1px solid ${colors.border}`,
  borderRadius: 4,
  color: colors.text,
  padding: "7px 9px",
  fontSize: 13,
  fontFamily: "inherit",
};

export const buttonStyle = {
  background: colors.panelAlt,
  border: `1px solid ${colors.border}`,
  borderRadius: 4,
  color: colors.text,
  padding: "7px 12px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

export const primaryButtonStyle = {
  ...buttonStyle,
  background: colors.accent,
  border: `1px solid ${colors.accent}`,
  color: "#04101f",
};

export const dangerButtonStyle = {
  ...buttonStyle,
  background: "transparent",
  border: `1px solid ${colors.danger}`,
  color: colors.danger,
};

export const monoStyle = {
  fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
};

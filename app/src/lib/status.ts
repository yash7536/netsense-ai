// Central mapping from domain status/severity values to the design system's
// status accents (DESIGN.md "Semantic & Status Accents"). Keeping this in one
// place is what lets every table/badge/dot agree on the same colour for the
// same meaning.

export type Tone = "critical" | "warning" | "success" | "neutral" | "info";

export const TONE_TEXT: Record<Tone, string> = {
  critical: "text-error",
  warning: "text-status-warning",
  success: "text-status-success",
  neutral: "text-outline",
  info: "text-secondary",
};

export const TONE_BG: Record<Tone, string> = {
  critical: "bg-error",
  warning: "bg-status-warning",
  success: "bg-status-success",
  neutral: "bg-outline",
  info: "bg-secondary",
};

export function severityTone(severity: "critical" | "high" | "medium" | "low"): Tone {
  switch (severity) {
    case "critical":
      return "critical";
    case "high":
      return "critical";
    case "medium":
      return "warning";
    case "low":
      return "success";
  }
}

export function predictionStatusTone(status: "active" | "investigating" | "monitored"): Tone {
  switch (status) {
    case "active":
      return "critical";
    case "investigating":
      return "neutral";
    case "monitored":
      return "success";
  }
}

export function incidentStatusTone(status: "investigating" | "mitigated" | "resolved"): Tone {
  switch (status) {
    case "investigating":
      return "info";
    case "mitigated":
      return "info";
    case "resolved":
      return "neutral";
  }
}

export function linkStatusTone(status: "healthy" | "attention"): Tone {
  return status === "healthy" ? "success" : "warning";
}

export function dutyStatusTone(status: "on-shift" | "standby" | "off-shift"): Tone {
  switch (status) {
    case "on-shift":
      return "success";
    case "standby":
      return "warning";
    case "off-shift":
      return "neutral";
  }
}

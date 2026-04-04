
import { AnalysisType } from "@/types";
import {
  Hash,
  List,
  MessageCircle,
  MessageSquare,
  Sparkles,
} from "lucide-react";

export const allowedTypes = [
  "text/plain",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/markdown",
];

export const analysisTypes: {
  value: AnalysisType;
  label: string;
  description: string;
  icon: React.ComponentType<any>;
}[] = [
  {
    value: "summary",
    label: "Resumen",
    description: "Generá un resumen completo del documento",
    icon: Sparkles,
  },
  {
    value: "qa",
    label: "Preguntas y Respuestas",
    description: "Generá preguntas y respuestas a partir del documento",
    icon: MessageCircle,
  },
  {
    value: "sentiment",
    label: "Sentimiento",
    description: "Analizá el tono y el sentimiento emocional",
    icon: MessageSquare,
  },
  {
    value: "entities",
    label: "Entidades",
    description: "Extraé nombres, lugares y organizaciones",
    icon: Hash,
  },
  {
    value: "extract",
    label: "Extracción",
    description: "Extraé información estructurada",
    icon: List,
  },
];

// Format file size
export const formatFileSize = (bytes?: number) => {
  if (!bytes) return "N/A";
  if (bytes < 1024) return bytes + " bytes";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
};
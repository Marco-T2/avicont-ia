
import { AnalysisType } from "@/types";
import {
  Brain,
  Hash,
  List,
  MessageCircle,
  MessageSquare,
  Shield,
  Sparkles,
  Upload,
  Users,
} from "lucide-react";

export const features = [
  {
    icon: Brain,
    title: "Análisis con IA",
    description: "Obtené resúmenes e insights al instante con Google Gemini AI",
  },
  {
    icon: Users,
    title: "Multi-Organización",
    description: "Organizaciones separadas con almacenamiento de documentos aislado",
  },
  {
    icon: Upload,
    title: "Carga Fácil",
    description: "Arrastrá y soltá o seleccioná archivos en múltiples formatos",
  },
  {
    icon: Shield,
    title: "Seguro",
    description: "Tus documentos están encriptados y almacenados de forma segura",
  },
];

export const steps = [
  "Registrate con una cuenta gratuita",
  "Creá una organización",
  "Subí documentos",
  "Obtené análisis de IA al instante",
];

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
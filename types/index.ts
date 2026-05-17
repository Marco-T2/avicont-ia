export interface Document {
  id: string;
  name: string;
  fileUrl?: string;
  fileSize?: number;
  fileType?: string;
  aiSummary?: string;
  scope?: "ORGANIZATION" | "ACCOUNTING" | "FARM";
  createdAt: string;
  user: {
    name?: string;
    email: string;
  };
}

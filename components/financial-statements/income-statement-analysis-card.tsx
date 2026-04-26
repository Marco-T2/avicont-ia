"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Loader2, AlertCircle, Info } from "lucide-react";

export type AnalyzeIncomeStatementResult =
  | { status: "ok"; analysis: string }
  | { status: "trivial"; code: string; reason: string }
  | { status: "error"; reason: string };

interface IncomeStatementAnalysisCardProps {
  result: AnalyzeIncomeStatementResult | null;
  loading: boolean;
}

export function IncomeStatementAnalysisCard({
  result,
  loading,
}: IncomeStatementAnalysisCardProps) {
  if (!loading && !result) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
          Análisis IA del Estado de Resultados
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="flex items-center gap-3 py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            <span>Generando análisis...</span>
          </div>
        )}

        {!loading && result?.status === "ok" && (
          <div className="text-sm leading-relaxed">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                table: ({ children }) => (
                  <div className="my-4 overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      {children}
                    </table>
                  </div>
                ),
                thead: ({ children }) => (
                  <thead className="border-b bg-muted/50">{children}</thead>
                ),
                th: ({ children }) => (
                  <th className="border-b px-3 py-2 text-left font-semibold">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="border-b px-3 py-2 align-top">{children}</td>
                ),
                h1: ({ children }) => (
                  <h2 className="mt-4 mb-2 text-base font-semibold">
                    {children}
                  </h2>
                ),
                h2: ({ children }) => (
                  <h3 className="mt-4 mb-2 text-base font-semibold">
                    {children}
                  </h3>
                ),
                h3: ({ children }) => (
                  <h4 className="mt-3 mb-1.5 text-sm font-semibold">
                    {children}
                  </h4>
                ),
                p: ({ children }) => (
                  <p className="my-2 leading-relaxed">{children}</p>
                ),
                ul: ({ children }) => (
                  <ul className="my-2 list-disc pl-5 space-y-1">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="my-2 list-decimal pl-5 space-y-1">
                    {children}
                  </ol>
                ),
                strong: ({ children }) => (
                  <strong className="font-semibold">{children}</strong>
                ),
                code: ({ children }) => (
                  <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
                    {children}
                  </code>
                ),
              }}
            >
              {result.analysis}
            </ReactMarkdown>
          </div>
        )}

        {!loading && result?.status === "trivial" && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-md border border-border bg-muted/30 p-4 text-sm"
          >
            <Info className="h-5 w-5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
            <p className="text-muted-foreground">{result.reason}</p>
          </div>
        )}

        {!loading && result?.status === "error" && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
          >
            <AlertCircle className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
            <p>{result.reason}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

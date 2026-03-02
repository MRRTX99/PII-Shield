export interface ProcessedDocument {
  originalText: string;
  maskedText: string;
  piiInstances: PIIInstance[];
  confidence: number;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  originalPdfData?: ArrayBuffer;
}

export interface PIIInstance {
  type: string;
  value: string;
  startIndex: number;
  endIndex: number;
  confidence: number;
}

export interface DocumentStats {
  totalDocuments: number;
  totalPiiFound: number;
  types: Record<string, number>;
  documentTypes: Record<string, number>;
}
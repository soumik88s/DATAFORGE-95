export type UserRole = 'ADMIN' | 'ANALYST' | 'VIEWER';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  fullName: string;
  department?: string;
  createdAt: string;
  lastLogin?: string;
  status: 'ACTIVE' | 'DISABLED';
  favoriteDatasetIds?: string[];
  dismissedDatasetIds?: string[];
  hideSampleDatasets?: boolean;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

export interface DatasetColumn {
  name: string;
  type: 'numeric' | 'string' | 'date' | 'boolean';
  missingCount: number;
  uniqueCount: number;
  sampleValues: (string | number | boolean | null)[];
}

export interface DataQualityScore {
  completeness: number; // 0-100
  validity: number; // 0-100
  consistency: number; // 0-100
  uniqueness: number; // 0-100
  missingCells: number;
  totalMissingCells?: number;
  missingCellsPct: number;
  duplicateRows: number;
  duplicateRowsPct: number;
  outlierCount: number;
  overallScore: number; // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  issues?: string[];
}

export interface DatasetMetadata {
  id: string;
  name: string;
  description: string;
  category: string;
  source: string;
  uploadedBy: string;
  ownerId: string;
  originalFileName?: string;
  fileSize?: number;
  storagePath?: string;
  createdAt?: string;
  updatedAt?: string;
  isDemo?: boolean;
  isShared?: boolean;
  uploadDate: string;
  rowCount: number;
  columnCount: number;
  fileType: string;
  processingStatus: 'READY' | 'PROCESSING' | 'ERROR';
  lastAnalyzedTimestamp?: string;
  columns: DatasetColumn[];
  duplicateCount: number;
  qualityScore?: DataQualityScore;
  isLiked?: boolean;
  likesCount?: number;
}

export type DatasetRecord = Record<string, string | number | boolean | null>;

export interface NumericStats {
  column: string;
  count: number;
  missing: number;
  mean: number;
  median: number;
  mode: number | null;
  min: number;
  max: number;
  range: number;
  stdDev: number;
  variance: number;
  q1: number;
  q3: number;
  iqr: number;
  percentile5: number;
  percentile95: number;
  skewness?: number;
}

export interface CategoricalStats {
  column: string;
  count: number;
  missing: number;
  uniqueCount: number;
  topCategories: { value: string; count: number; percentage: number }[];
}

export interface DatasetStatistics {
  numeric: Record<string, NumericStats>;
  categorical: Record<string, CategoricalStats>;
  dateColumns: string[];
  totalRows: number;
  totalColumns: number;
  missingCellsTotal: number;
  missingCellsPct: number;
}

export interface CorrelationMatrix {
  columns: string[];
  matrix: number[][]; // 2D array of Pearson coefficients
}

export interface AnomalyItem {
  rowIndex: number;
  column: string;
  value: number;
  method: 'IQR' | 'Z-SCORE';
  score: number; // e.g. z-score or distance from fence
  threshold: string;
  explanation: string;
  record: DatasetRecord;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface AnomalyAnalysis {
  iqrAnomalies: AnomalyItem[];
  zScoreAnomalies: AnomalyItem[];
  anomalies?: AnomalyItem[];
  analyzedColumns: string[];
  totalFlaggedRows: number;
  totalAnomalies?: number;
  disclaimer: string;
}

export type ChartType =
  | 'bar'
  | 'line'
  | 'area'
  | 'pie'
  | 'donut'
  | 'scatter'
  | 'histogram'
  | 'heatmap'
  | 'boxplot'
  | 'timeseries';

export interface ChartConfig {
  type: ChartType;
  title: string;
  xAxis: string;
  yAxis?: string;
  categoryAxis?: string;
  aggregation?: 'sum' | 'mean' | 'count' | 'min' | 'max';
  binCount?: number;
}

export interface SavedAnalysis {
  id: string;
  datasetId: string;
  datasetName: string;
  userId: string;
  userName: string;
  title: string;
  analysisType: string;
  selectedColumns: string[];
  filters?: Record<string, any>;
  chartType: ChartType;
  config: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface CleanResult {
  message: string;
  action: string;
  column?: string | null;
  beforeRowCount: number;
  afterRowCount: number;
  rowsAffected: number;
  columnsAffected: number;
  details: string;
  qualityScoreBefore?: DataQualityScore;
  qualityScoreAfter?: DataQualityScore;
  metadata: DatasetMetadata;
}

export interface Report {
  id: string;
  datasetId: string;
  datasetName: string;
  title: string;
  summary: string;
  keyFindings: string[];
  highlights?: string[];
  anomalies?: string[];
  recommendations?: string[];
  customNotes?: string;
  createdAt?: string;
  statsSnapshot: {
    rowCount: number;
    columnCount: number;
    keyMetrics: { label: string; value: string | number }[];
  };
  chartsIncluded: {
    type: ChartType;
    title: string;
    description: string;
  }[];
  anomalySummary: {
    totalAnomalies: number;
    topAnomalousColumns: string[];
    notes: string;
  };
  generatedBy: string;
  generatedDate: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action:
    | 'LOGIN'
    | 'LOGOUT'
    | 'LOGIN_FAILURE'
    | 'PASSWORD_RESET'
    | 'DATASET_UPLOAD'
    | 'DATASET_DELETE'
    | 'DATASET_MODIFY'
    | 'DATASET_CLEAN'
    | 'DATASET_ANALYSIS'
    | 'ANALYSIS_CREATE'
    | 'ANALYSIS_UPDATE'
    | 'ANALYSIS_DELETE'
    | 'REPORT_GENERATE'
    | 'EXPORT_PERFORMED'
    | 'USER_CHANGE'
    | 'ROLE_CHANGE'
    | 'ACCESS_DENIED';
  username: string;
  details: string;
  ipAddress?: string;
  status: 'SUCCESS' | 'FAILURE' | 'WARNING';
}

export interface SystemStats {
  totalDatasets: number;
  totalRecords: number;
  activeUsers: number;
  analysesCreated: number;
  recentDatasetName: string;
  mostUsedCategory: string;
  categoryDistribution: { category: string; count: number; records: number }[];
  storageUsedBytes: number;
  uptimeSeconds: number;
}

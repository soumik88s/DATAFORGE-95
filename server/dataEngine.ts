import {
  DatasetColumn,
  DatasetRecord,
  DatasetStatistics,
  NumericStats,
  CategoricalStats,
  CorrelationMatrix,
  AnomalyAnalysis,
  AnomalyItem,
  DataQualityScore
} from '../src/types.js';

export function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
}

export function detectColumnType(values: any[]): 'numeric' | 'string' | 'date' | 'boolean' {
  const nonNull = values.filter(v => v !== null && v !== undefined && v !== '');
  if (nonNull.length === 0) return 'string';

  let numCount = 0;
  let dateCount = 0;
  let boolCount = 0;

  for (const v of nonNull) {
    if (typeof v === 'boolean' || v === 'true' || v === 'false') {
      boolCount++;
    }
    const num = Number(v);
    if (!isNaN(num) && typeof v !== 'boolean') {
      numCount++;
    }
    if (typeof v === 'string' && v.length >= 8 && isNaN(Number(v))) {
      const parsedDate = Date.parse(v);
      if (!isNaN(parsedDate) && parsedDate > 0) {
        dateCount++;
      }
    }
  }

  const threshold = nonNull.length * 0.8;
  if (boolCount >= threshold) return 'boolean';
  if (numCount >= threshold) return 'numeric';
  if (dateCount >= threshold) return 'date';
  return 'string';
}

export function analyzeColumns(records: DatasetRecord[]): DatasetColumn[] {
  if (records.length === 0) return [];
  const columnNames = Object.keys(records[0]);

  return columnNames.map(name => {
    const values = records.map(r => r[name]);
    const type = detectColumnType(values);
    let missingCount = 0;
    const uniqueSet = new Set<string>();

    for (const v of values) {
      if (v === null || v === undefined || v === '') {
        missingCount++;
      } else {
        uniqueSet.add(String(v));
      }
    }

    const sampleValues = values.filter(v => v !== null && v !== undefined && v !== '').slice(0, 5);

    return {
      name,
      type,
      missingCount,
      uniqueCount: uniqueSet.size,
      sampleValues
    };
  });
}

export function countDuplicates(records: DatasetRecord[]): number {
  const seen = new Set<string>();
  let duplicates = 0;
  for (const r of records) {
    const key = JSON.stringify(r);
    if (seen.has(key)) {
      duplicates++;
    } else {
      seen.add(key);
    }
  }
  return duplicates;
}

export function calculateStatistics(records: DatasetRecord[], columns: DatasetColumn[]): DatasetStatistics {
  const numericStats: Record<string, NumericStats> = {};
  const categoricalStats: Record<string, CategoricalStats> = {};
  const dateColumns: string[] = [];

  let missingCellsTotal = 0;
  const totalCells = records.length * columns.length;

  for (const col of columns) {
    if (col.type === 'date') {
      dateColumns.push(col.name);
    }

    const values = records.map(r => r[col.name]);
    const missing = values.filter(v => v === null || v === undefined || v === '').length;
    missingCellsTotal += missing;

    if (col.type === 'numeric') {
      const validNumbers = values
        .filter(v => v !== null && v !== undefined && v !== '' && !isNaN(Number(v)))
        .map(v => Number(v))
        .sort((a, b) => a - b);

      if (validNumbers.length > 0) {
        const count = validNumbers.length;
        const min = validNumbers[0];
        const max = validNumbers[count - 1];
        const sum = validNumbers.reduce((acc, curr) => acc + curr, 0);
        const mean = sum / count;

        // Median
        const mid = Math.floor(count / 2);
        const median = count % 2 !== 0 ? validNumbers[mid] : (validNumbers[mid - 1] + validNumbers[mid]) / 2;

        // Mode
        const freq: Record<number, number> = {};
        let maxFreq = 0;
        let mode: number | null = null;
        for (const num of validNumbers) {
          freq[num] = (freq[num] || 0) + 1;
          if (freq[num] > maxFreq) {
            maxFreq = freq[num];
            mode = num;
          }
        }
        if (maxFreq === 1 && count > 1) mode = null; // No distinct mode

        // Variance & StdDev
        const sqDiffs = validNumbers.map(n => Math.pow(n - mean, 2));
        const variance = sqDiffs.reduce((acc, curr) => acc + curr, 0) / count;
        const stdDev = Math.sqrt(variance);

        // Quartiles & Percentiles
        const q1Index = Math.floor(count * 0.25);
        const q3Index = Math.floor(count * 0.75);
        const p5Index = Math.floor(count * 0.05);
        const p95Index = Math.floor(count * 0.95);

        const q1 = validNumbers[q1Index];
        const q3 = validNumbers[q3Index];
        const iqr = q3 - q1;
        const p5 = validNumbers[p5Index];
        const p95 = validNumbers[p95Index];

        numericStats[col.name] = {
          column: col.name,
          count,
          missing,
          mean: Number(mean.toFixed(2)),
          median: Number(median.toFixed(2)),
          mode: mode !== null ? Number(mode.toFixed(2)) : null,
          min: Number(min.toFixed(2)),
          max: Number(max.toFixed(2)),
          range: Number((max - min).toFixed(2)),
          stdDev: Number(stdDev.toFixed(2)),
          variance: Number(variance.toFixed(2)),
          q1: Number(q1.toFixed(2)),
          q3: Number(q3.toFixed(2)),
          iqr: Number(iqr.toFixed(2)),
          percentile5: Number(p5.toFixed(2)),
          percentile95: Number(p95.toFixed(2))
        };
      }
    } else {
      // Categorical / string stats
      const validStrings = values.filter(v => v !== null && v !== undefined && v !== '').map(String);
      const freq: Record<string, number> = {};
      for (const val of validStrings) {
        freq[val] = (freq[val] || 0) + 1;
      }

      const sortedCategories = Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([value, cnt]) => ({
          value,
          count: cnt,
          percentage: Number(((cnt / (validStrings.length || 1)) * 100).toFixed(1))
        }));

      categoricalStats[col.name] = {
        column: col.name,
        count: validStrings.length,
        missing,
        uniqueCount: Object.keys(freq).length,
        topCategories: sortedCategories
      };
    }
  }

  return {
    numeric: numericStats,
    categorical: categoricalStats,
    dateColumns,
    totalRows: records.length,
    totalColumns: columns.length,
    missingCellsTotal,
    missingCellsPct: totalCells > 0 ? Number(((missingCellsTotal / totalCells) * 100).toFixed(1)) : 0
  };
}

export function calculateCorrelation(records: DatasetRecord[], columns: DatasetColumn[]): CorrelationMatrix {
  const numericCols = columns.filter(c => c.type === 'numeric').map(c => c.name);
  if (numericCols.length === 0) {
    return { columns: [], matrix: [] };
  }

  const matrix: number[][] = [];

  // Extract arrays of values
  const colValues: Record<string, number[]> = {};
  for (const col of numericCols) {
    colValues[col] = records.map(r => {
      const val = Number(r[col]);
      return isNaN(val) ? 0 : val;
    });
  }

  for (let i = 0; i < numericCols.length; i++) {
    const row: number[] = [];
    const colA = numericCols[i];
    const valsA = colValues[colA];
    const meanA = valsA.reduce((s, v) => s + v, 0) / (valsA.length || 1);

    for (let j = 0; j < numericCols.length; j++) {
      if (i === j) {
        row.push(1.0);
        continue;
      }
      const colB = numericCols[j];
      const valsB = colValues[colB];
      const meanB = valsB.reduce((s, v) => s + v, 0) / (valsB.length || 1);

      let numerator = 0;
      let denomA = 0;
      let denomB = 0;

      for (let k = 0; k < valsA.length; k++) {
        const diffA = valsA[k] - meanA;
        const diffB = valsB[k] - meanB;
        numerator += diffA * diffB;
        denomA += diffA * diffA;
        denomB += diffB * diffB;
      }

      const denominator = Math.sqrt(denomA * denomB);
      const coeff = denominator === 0 ? 0 : numerator / denominator;
      row.push(Number(coeff.toFixed(3)));
    }
    matrix.push(row);
  }

  return {
    columns: numericCols,
    matrix
  };
}

export function detectAnomalies(records: DatasetRecord[], stats: DatasetStatistics): AnomalyAnalysis {
  const iqrAnomalies: AnomalyItem[] = [];
  const zScoreAnomalies: AnomalyItem[] = [];
  const flaggedRowIndices = new Set<number>();
  const analyzedColumns: string[] = [];

  for (const [colName, colStat] of Object.entries(stats.numeric)) {
    analyzedColumns.push(colName);
    const iqrLowerFence = colStat.q1 - 1.5 * colStat.iqr;
    const iqrUpperFence = colStat.q3 + 1.5 * colStat.iqr;

    records.forEach((record, index) => {
      const rawVal = record[colName];
      if (rawVal === null || rawVal === undefined || rawVal === '' || isNaN(Number(rawVal))) {
        return;
      }
      const num = Number(rawVal);

      // IQR Method
      if (num < iqrLowerFence || num > iqrUpperFence) {
        flaggedRowIndices.add(index);
        const diff = num > iqrUpperFence ? num - iqrUpperFence : iqrLowerFence - num;
        const severity: 'LOW' | 'MEDIUM' | 'HIGH' = diff > 2 * colStat.iqr ? 'HIGH' : 'MEDIUM';
        iqrAnomalies.push({
          rowIndex: index + 1,
          column: colName,
          value: num,
          method: 'IQR',
          score: Number(diff.toFixed(2)),
          severity,
          threshold: num > iqrUpperFence ? `> ${iqrUpperFence.toFixed(2)} (Q3 + 1.5*IQR)` : `< ${iqrLowerFence.toFixed(2)} (Q1 - 1.5*IQR)`,
          explanation: `Value ${num} exceeds normal IQR fence bounds [${iqrLowerFence.toFixed(1)} to ${iqrUpperFence.toFixed(1)}] by ${diff.toFixed(1)} units.`,
          record
        });
      }

      // Z-Score Method (Threshold: |Z| > 2.5)
      if (colStat.stdDev > 0) {
        const zScore = (num - colStat.mean) / colStat.stdDev;
        if (Math.abs(zScore) >= 2.5) {
          flaggedRowIndices.add(index);
          const severity: 'LOW' | 'MEDIUM' | 'HIGH' = Math.abs(zScore) >= 3.5 ? 'HIGH' : 'MEDIUM';
          zScoreAnomalies.push({
            rowIndex: index + 1,
            column: colName,
            value: num,
            method: 'Z-SCORE',
            score: Number(Math.abs(zScore).toFixed(2)),
            severity,
            threshold: '|Z| >= 2.5',
            explanation: `Value ${num} is ${Math.abs(zScore).toFixed(2)} standard deviations ${zScore > 0 ? 'above' : 'below'} column mean (${colStat.mean}).`,
            record
          });
        }
      }
    });
  }

  const allAnomalies = [...iqrAnomalies, ...zScoreAnomalies];

  return {
    iqrAnomalies: iqrAnomalies.slice(0, 100),
    zScoreAnomalies: zScoreAnomalies.slice(0, 100),
    anomalies: allAnomalies.slice(0, 100),
    analyzedColumns,
    totalFlaggedRows: flaggedRowIndices.size,
    totalAnomalies: allAnomalies.length,
    disclaimer: 'DISCLAIMER: Statistical anomalies highlight extreme variances from expected distribution patterns. They do not constitute evidence of fraud, corruption, or human error.'
  };
}

export function calculateDataQualityScore(
  records: DatasetRecord[],
  columns: DatasetColumn[]
): DataQualityScore {
  if (records.length === 0 || columns.length === 0) {
    return {
      completeness: 100,
      validity: 100,
      consistency: 100,
      uniqueness: 100,
      missingCells: 0,
      missingCellsPct: 0,
      duplicateRows: 0,
      duplicateRowsPct: 0,
      outlierCount: 0,
      overallScore: 100,
      grade: 'A'
    };
  }

  const totalCells = records.length * columns.length;
  let missingCells = 0;
  let invalidCells = 0;
  let inconsistentCells = 0;

  for (const col of columns) {
    for (const record of records) {
      const val = record[col.name];
      if (val === null || val === undefined || val === '') {
        missingCells++;
        continue;
      }

      // Check validity against inferred type
      if (col.type === 'numeric') {
        if (isNaN(Number(val))) {
          invalidCells++;
        }
      } else if (col.type === 'date') {
        const parsed = Date.parse(String(val));
        if (isNaN(parsed)) {
          invalidCells++;
        }
      } else if (col.type === 'boolean') {
        if (typeof val !== 'boolean' && val !== 'true' && val !== 'false') {
          invalidCells++;
        }
      }

      // Check consistency (e.g. untrimmed strings or malformed patterns)
      if (typeof val === 'string' && (val.trim() !== val || val.includes('\r'))) {
        inconsistentCells++;
      }
    }
  }

  const duplicates = countDuplicates(records);
  const duplicateRowsPct = records.length > 0 ? Number(((duplicates / records.length) * 100).toFixed(1)) : 0;
  const missingCellsPct = totalCells > 0 ? Number(((missingCells / totalCells) * 100).toFixed(1)) : 0;

  const completeness = Math.max(0, Math.min(100, Number(((1 - missingCells / totalCells) * 100).toFixed(1))));
  const validity = Math.max(0, Math.min(100, Number(((1 - invalidCells / totalCells) * 100).toFixed(1))));
  const consistency = Math.max(0, Math.min(100, Number(((1 - inconsistentCells / totalCells) * 100).toFixed(1))));
  const uniqueness = Math.max(0, Math.min(100, Number((100 - duplicateRowsPct).toFixed(1))));

  // Outlier detection
  let outlierCount = 0;
  const stats = calculateStatistics(records, columns);
  for (const [colName, numStat] of Object.entries(stats.numeric)) {
    const lower = numStat.q1 - 1.5 * numStat.iqr;
    const upper = numStat.q3 + 1.5 * numStat.iqr;
    for (const r of records) {
      const num = Number(r[colName]);
      if (!isNaN(num) && (num < lower || num > upper)) {
        outlierCount++;
      }
    }
  }

  const outlierPenalty = records.length > 0 ? Math.min(10, Math.floor((outlierCount / records.length) * 10)) : 0;

  // Weighted overall quality calculation:
  // Completeness: 35%, Validity: 25%, Uniqueness: 25%, Consistency: 15% - outlier penalty
  const weighted =
    completeness * 0.35 +
    validity * 0.25 +
    uniqueness * 0.25 +
    consistency * 0.15 -
    outlierPenalty;

  const overallScore = Math.max(0, Math.min(100, Math.round(weighted)));

  let grade: 'A' | 'B' | 'C' | 'D' | 'F' = 'F';
  if (overallScore >= 90) grade = 'A';
  else if (overallScore >= 80) grade = 'B';
  else if (overallScore >= 70) grade = 'C';
  else if (overallScore >= 60) grade = 'D';

  const issues: string[] = [];
  if (missingCells > 0) {
    issues.push(`${missingCells} missing cell${missingCells > 1 ? 's' : ''} (${missingCellsPct}%)`);
  }
  if (duplicates > 0) {
    issues.push(`${duplicates} duplicate row${duplicates > 1 ? 's' : ''} (${duplicateRowsPct}%)`);
  }
  if (outlierCount > 0) {
    issues.push(`${outlierCount} mathematical outlier${outlierCount > 1 ? 's' : ''} detected`);
  }
  if (invalidCells > 0) {
    issues.push(`${invalidCells} cell${invalidCells > 1 ? 's' : ''} with type mismatches`);
  }
  if (inconsistentCells > 0) {
    issues.push(`${inconsistentCells} formatting inconsistenc${inconsistentCells > 1 ? 'ies' : 'y'}`);
  }

  return {
    completeness,
    validity,
    consistency,
    uniqueness,
    missingCells,
    totalMissingCells: missingCells,
    missingCellsPct,
    duplicateRows: duplicates,
    duplicateRowsPct,
    outlierCount,
    overallScore,
    grade,
    issues
  };
}

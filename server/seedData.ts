import { DatasetMetadata, DatasetRecord } from '../src/types.js';
import { analyzeColumns, countDuplicates, calculateDataQualityScore } from './dataEngine.js';

export function getSeedDatasets(): { metadata: DatasetMetadata; records: DatasetRecord[] }[] {
  // 1. Global Renewable Energy Dataset (Explicitly requested by user prompt)
  const renewableEnergyRecords: DatasetRecord[] = [
    { date: '2024-01-15', country: 'Germany', energy_source: 'Wind', production_gwh: 1240.5, capacity_mw: 3200, investment_usd: 45000000, carbon_reduction_tons: 850000 },
    { date: '2024-01-18', country: 'Denmark', energy_source: 'Wind', production_gwh: 890.2, capacity_mw: 2100, investment_usd: 32000000, carbon_reduction_tons: 620000 },
    { date: '2024-01-22', country: 'China', energy_source: 'Solar', production_gwh: 3420.0, capacity_mw: 8500, investment_usd: 120000000, carbon_reduction_tons: 2350000 },
    { date: '2024-01-28', country: 'USA', energy_source: 'Solar', production_gwh: 2150.8, capacity_mw: 5400, investment_usd: 88000000, carbon_reduction_tons: 1480000 },
    { date: '2024-02-05', country: 'Brazil', energy_source: 'Hydro', production_gwh: 4800.0, capacity_mw: 11200, investment_usd: 150000000, carbon_reduction_tons: 3400000 },
    { date: '2024-02-12', country: 'India', energy_source: 'Solar', production_gwh: 2890.4, capacity_mw: 7100, investment_usd: 95000000, carbon_reduction_tons: 1980000 },
    { date: '2024-02-20', country: 'USA', energy_source: 'Wind', production_gwh: 3100.6, capacity_mw: 7800, investment_usd: 110000000, carbon_reduction_tons: 2150000 },
    { date: '2024-03-01', country: 'Germany', energy_source: 'Solar', production_gwh: 980.3, capacity_mw: 4200, investment_usd: 52000000, carbon_reduction_tons: 680000 },
    { date: '2024-03-15', country: 'Australia', energy_source: 'Solar', production_gwh: 1850.7, capacity_mw: 4600, investment_usd: 72000000, carbon_reduction_tons: 1290000 },
    { date: '2024-03-22', country: 'Iceland', energy_source: 'Geothermal', production_gwh: 450.0, capacity_mw: 950, investment_usd: 28000000, carbon_reduction_tons: 310000 },
    { date: '2024-04-05', country: 'China', energy_source: 'Wind', production_gwh: 5200.1, capacity_mw: 13500, investment_usd: 195000000, carbon_reduction_tons: 3600000 },
    { date: '2024-04-12', country: 'Denmark', energy_source: 'Wind', production_gwh: 920.4, capacity_mw: 2200, investment_usd: 35000000, carbon_reduction_tons: 640000 },
    { date: '2024-04-20', country: 'Norway', energy_source: 'Hydro', production_gwh: 3900.5, capacity_mw: 9200, investment_usd: 130000000, carbon_reduction_tons: 2750000 },
    { date: '2024-05-02', country: 'USA', energy_source: 'Geothermal', production_gwh: 610.2, capacity_mw: 1400, investment_usd: 41000000, carbon_reduction_tons: 425000 },
    { date: '2024-05-14', country: 'India', energy_source: 'Wind', production_gwh: 2450.0, capacity_mw: 6200, investment_usd: 84000000, carbon_reduction_tons: 1700000 },
    { date: '2024-05-25', country: 'Germany', energy_source: 'Biomass', production_gwh: 520.8, capacity_mw: 1100, investment_usd: 38000000, carbon_reduction_tons: 360000 },
    { date: '2024-06-08', country: 'China', energy_source: 'Hydro', production_gwh: 8900.0, capacity_mw: 22500, investment_usd: 320000000, carbon_reduction_tons: 6200000 }, // Intended high capacity outlier
    { date: '2024-06-15', country: 'Spain', energy_source: 'Solar', production_gwh: 1650.3, capacity_mw: 3900, investment_usd: 63000000, carbon_reduction_tons: 1150000 },
    { date: '2024-06-25', country: 'Brazil', energy_source: 'Biomass', production_gwh: 780.4, capacity_mw: 1800, investment_usd: 46000000, carbon_reduction_tons: 540000 },
    { date: '2024-07-04', country: 'USA', energy_source: 'Solar', production_gwh: 2950.0, capacity_mw: 7100, investment_usd: 115000000, carbon_reduction_tons: 2050000 },
    { date: '2024-07-15', country: 'Australia', energy_source: 'Wind', production_gwh: 1420.9, capacity_mw: 3600, investment_usd: 58000000, carbon_reduction_tons: 990000 },
    { date: '2024-07-28', country: 'Germany', energy_source: 'Wind', production_gwh: 1310.2, capacity_mw: 3400, investment_usd: 49000000, carbon_reduction_tons: 910000 },
    { date: '2024-08-10', country: 'India', energy_source: 'Solar', production_gwh: 3120.5, capacity_mw: 7800, investment_usd: 105000000, carbon_reduction_tons: 2180000 },
    { date: '2024-08-20', country: 'China', energy_source: 'Solar', production_gwh: 4850.2, capacity_mw: 12100, investment_usd: 175000000, carbon_reduction_tons: 3390000 },
    { date: '2024-09-02', country: 'Denmark', energy_source: 'Wind', production_gwh: 1040.6, capacity_mw: 2400, investment_usd: 39000000, carbon_reduction_tons: 720000 },
    { date: '2024-09-18', country: 'USA', energy_source: 'Hydro', production_gwh: 3600.0, capacity_mw: 8900, investment_usd: 125000000, carbon_reduction_tons: 2510000 },
    { date: '2024-10-05', country: 'Canada', energy_source: 'Hydro', production_gwh: 4100.8, capacity_mw: 9800, investment_usd: 140000000, carbon_reduction_tons: 2880000 },
    { date: '2024-10-20', country: 'Brazil', energy_source: 'Solar', production_gwh: 1250.4, capacity_mw: 3100, investment_usd: 48000000, carbon_reduction_tons: 870000 },
    { date: '2024-11-08', country: 'Germany', energy_source: 'Wind', production_gwh: 1750.0, capacity_mw: 4500, investment_usd: 68000000, carbon_reduction_tons: 1220000 },
    { date: '2024-11-22', country: 'China', energy_source: 'Wind', production_gwh: 6100.5, capacity_mw: 15400, investment_usd: 230000000, carbon_reduction_tons: 4250000 },
    { date: '2024-12-05', country: 'Spain', energy_source: 'Wind', production_gwh: 1890.3, capacity_mw: 4700, investment_usd: 74000000, carbon_reduction_tons: 1320000 },
    { date: '2024-12-19', country: 'India', energy_source: 'Hydro', production_gwh: 2700.1, capacity_mw: 6800, investment_usd: 98000000, carbon_reduction_tons: 1890000 },
    { date: '2025-01-10', country: 'USA', energy_source: 'Wind', production_gwh: 3450.8, capacity_mw: 8600, investment_usd: 128000000, carbon_reduction_tons: 2410000 },
    { date: '2025-01-25', country: 'Australia', energy_source: 'Solar', production_gwh: 2200.4, capacity_mw: 5500, investment_usd: 85000000, carbon_reduction_tons: 1540000 },
    { date: '2025-02-14', country: 'China', energy_source: 'Solar', production_gwh: 5800.0, capacity_mw: 14800, investment_usd: 210000000, carbon_reduction_tons: 4050000 },
    { date: '2025-03-02', country: 'Denmark', energy_source: 'Wind', production_gwh: 1180.5, capacity_mw: 2700, investment_usd: 44000000, carbon_reduction_tons: 820000 },
    { date: '2025-03-20', country: 'Germany', energy_source: 'Solar', production_gwh: 1380.2, capacity_mw: 4900, investment_usd: 62000000, carbon_reduction_tons: 960000 },
    { date: '2025-04-10', country: 'Brazil', energy_source: 'Hydro', production_gwh: 5100.0, capacity_mw: 11900, investment_usd: 162000000, carbon_reduction_tons: 3560000 },
    { date: '2025-04-28', country: 'USA', energy_source: 'Solar', production_gwh: 3350.2, capacity_mw: 8100, investment_usd: 135000000, carbon_reduction_tons: 2340000 },
    { date: '2025-05-15', country: 'India', energy_source: 'Solar', production_gwh: 3650.0, capacity_mw: 9200, investment_usd: 122000000, carbon_reduction_tons: 2550000 },
    { date: '2025-06-05', country: 'China', energy_source: 'Hydro', production_gwh: 9800.0, capacity_mw: 24800, investment_usd: 360000000, carbon_reduction_tons: 6850000 } // Statistical outlier
  ];

  // 2. Stock Market & Finance (Tech Giants & Green Energy Index)
  const stockMarketRecords: DatasetRecord[] = [
    { date: '2025-01-02', ticker: 'NVDA', open: 135.2, high: 139.8, low: 134.5, close: 138.6, volume: 48200000, daily_return_pct: 2.51 },
    { date: '2025-01-03', ticker: 'NVDA', open: 139.0, high: 142.1, low: 138.2, close: 141.4, volume: 52100000, daily_return_pct: 2.02 },
    { date: '2025-01-06', ticker: 'NVDA', open: 141.5, high: 145.0, low: 140.8, close: 144.2, volume: 58900000, daily_return_pct: 1.98 },
    { date: '2025-01-07', ticker: 'AAPL', open: 242.0, high: 244.5, low: 241.1, close: 243.8, volume: 38400000, daily_return_pct: 0.74 },
    { date: '2025-01-08', ticker: 'AAPL', open: 244.0, high: 246.2, low: 243.0, close: 245.5, volume: 41200000, daily_return_pct: 0.70 },
    { date: '2025-01-09', ticker: 'MSFT', open: 420.5, high: 426.0, low: 419.2, close: 424.8, volume: 22100000, daily_return_pct: 1.02 },
    { date: '2025-01-10', ticker: 'MSFT', open: 425.0, high: 429.5, low: 423.8, close: 428.1, volume: 24500000, daily_return_pct: 0.78 },
    { date: '2025-01-13', ticker: 'TSLA', open: 380.0, high: 410.0, low: 375.0, close: 405.2, volume: 88500000, daily_return_pct: 6.63 }, // High volatility outlier
    { date: '2025-01-14', ticker: 'TSLA', open: 408.0, high: 415.0, low: 395.0, close: 401.5, volume: 72300000, daily_return_pct: -0.91 },
    { date: '2025-01-15', ticker: 'NEE', open: 78.4, high: 79.8, low: 78.0, close: 79.2, volume: 11200000, daily_return_pct: 1.02 },
    { date: '2025-01-16', ticker: 'NEE', open: 79.5, high: 80.9, low: 79.1, close: 80.4, volume: 12400000, daily_return_pct: 1.51 },
    { date: '2025-01-17', ticker: 'NVDA', open: 144.5, high: 148.0, low: 143.2, close: 147.1, volume: 61400000, daily_return_pct: 2.01 },
    { date: '2025-01-21', ticker: 'AAPL', open: 246.0, high: 248.5, low: 245.2, close: 247.9, volume: 39100000, daily_return_pct: 0.98 },
    { date: '2025-01-22', ticker: 'MSFT', open: 428.5, high: 434.0, low: 427.0, close: 432.5, volume: 26800000, daily_return_pct: 1.03 },
    { date: '2025-01-23', ticker: 'TSLA', open: 402.0, high: 425.0, low: 398.0, close: 421.0, volume: 91400000, daily_return_pct: 4.86 }
  ];

  // 3. Healthcare & Patient Outcomes
  const healthcareRecords: DatasetRecord[] = [
    { patient_id: 'PT-1001', age: 64, department: 'Cardiology', length_of_stay: 5, treatment_cost_usd: 14200, recovery_score: 88, outcome: 'Recovered' },
    { patient_id: 'PT-1002', age: 42, department: 'Orthopedics', length_of_stay: 3, treatment_cost_usd: 8900, recovery_score: 94, outcome: 'Recovered' },
    { patient_id: 'PT-1003', age: 78, department: 'Neurology', length_of_stay: 14, treatment_cost_usd: 36500, recovery_score: 72, outcome: 'Under Observation' },
    { patient_id: 'PT-1004', age: 31, department: 'General Surgery', length_of_stay: 2, treatment_cost_usd: 5400, recovery_score: 97, outcome: 'Recovered' },
    { patient_id: 'PT-1005', age: 55, department: 'Oncology', length_of_stay: 18, treatment_cost_usd: 58000, recovery_score: 65, outcome: 'Extended Care' }, // High cost anomaly
    { patient_id: 'PT-1006', age: 29, department: 'Emergency', length_of_stay: 1, treatment_cost_usd: 2100, recovery_score: 99, outcome: 'Recovered' },
    { patient_id: 'PT-1007', age: 71, department: 'Cardiology', length_of_stay: 8, treatment_cost_usd: 22800, recovery_score: 81, outcome: 'Recovered' },
    { patient_id: 'PT-1008', age: 50, department: 'Orthopedics', length_of_stay: 4, treatment_cost_usd: 11200, recovery_score: 91, outcome: 'Recovered' },
    { patient_id: 'PT-1009', age: 83, department: 'Neurology', length_of_stay: 21, treatment_cost_usd: 49200, recovery_score: 60, outcome: 'Extended Care' },
    { patient_id: 'PT-1010', age: 38, department: 'Emergency', length_of_stay: 2, treatment_cost_usd: 3400, recovery_score: 95, outcome: 'Recovered' },
    { patient_id: 'PT-1011', age: 62, department: 'Oncology', length_of_stay: 12, treatment_cost_usd: 41000, recovery_score: 74, outcome: 'Under Observation' },
    { patient_id: 'PT-1012', age: 47, department: 'Cardiology', length_of_stay: 4, treatment_cost_usd: 12900, recovery_score: 89, outcome: 'Recovered' }
  ];

  // 4. Climate & Environment
  const climateRecords: DatasetRecord[] = [
    { timestamp: '2025-06-01', station: 'Mauna Loa Observatory', co2_ppm: 426.8, temperature_c: 12.4, humidity_pct: 45, air_quality_index: 18 },
    { timestamp: '2025-06-02', station: 'London Urban Station', co2_ppm: 442.1, temperature_c: 21.5, humidity_pct: 68, air_quality_index: 54 },
    { timestamp: '2025-06-03', station: 'Tokyo Central', co2_ppm: 448.9, temperature_c: 24.8, humidity_pct: 72, air_quality_index: 62 },
    { timestamp: '2025-06-04', station: 'Amazon Basin Field Station', co2_ppm: 412.3, temperature_c: 29.2, humidity_pct: 88, air_quality_index: 12 },
    { timestamp: '2025-06-05', station: 'Arctic Baseline Svalbard', co2_ppm: 424.2, temperature_c: 3.1, humidity_pct: 78, air_quality_index: 8 },
    { timestamp: '2025-06-06', station: 'New Delhi Ring Road', co2_ppm: 495.4, temperature_c: 38.6, humidity_pct: 42, air_quality_index: 245 }, // High pollution anomaly
    { timestamp: '2025-06-07', station: 'Berlin Mitte Station', co2_ppm: 438.0, temperature_c: 19.8, humidity_pct: 64, air_quality_index: 48 },
    { timestamp: '2025-06-08', station: 'Sydney Harbour Marine', co2_ppm: 420.5, temperature_c: 16.4, humidity_pct: 60, air_quality_index: 22 }
  ];

  // 5. E-Commerce & Retail
  const ecommerceRecords: DatasetRecord[] = [
    { order_date: '2025-03-01', region: 'North America', category: 'Electronics', revenue_usd: 12400, units_sold: 48, discount_pct: 5, customer_rating: 4.8 },
    { order_date: '2025-03-02', region: 'Europe', category: 'Home & Kitchen', revenue_usd: 8200, units_sold: 110, discount_pct: 12, customer_rating: 4.5 },
    { order_date: '2025-03-03', region: 'Asia Pacific', category: 'Electronics', revenue_usd: 18900, units_sold: 72, discount_pct: 8, customer_rating: 4.9 },
    { order_date: '2025-03-04', region: 'Latin America', category: 'Apparel', revenue_usd: 4600, units_sold: 180, discount_pct: 15, customer_rating: 4.2 },
    { order_date: '2025-03-05', region: 'North America', category: 'Books & Media', revenue_usd: 3100, units_sold: 210, discount_pct: 20, customer_rating: 4.6 },
    { order_date: '2025-03-06', region: 'Europe', category: 'Electronics', revenue_usd: 15400, units_sold: 58, discount_pct: 10, customer_rating: 4.7 },
    { order_date: '2025-03-07', region: 'Asia Pacific', category: 'Industrial Supplies', revenue_usd: 45000, units_sold: 32, discount_pct: 2, customer_rating: 4.9 } // B2B revenue anomaly
  ];

  const datasets = [
    {
      name: 'Global Renewable Energy Dataset',
      description: 'Comprehensive global energy generation, capacity, investment, and carbon reduction metrics across solar, wind, hydro, and geothermal sources.',
      category: 'Energy',
      source: 'International Renewable Energy Agency (IRENA) & Global Grid Watch',
      records: renewableEnergyRecords
    },
    {
      name: 'Tech Giants & Clean Energy Equity Index',
      description: 'Daily equity trading prices, volumes, and returns for major technological and renewable utility leaders.',
      category: 'Stock Market & Finance',
      source: 'Global Market Data Feed (Consolidated)',
      records: stockMarketRecords
    },
    {
      name: 'Hospital Network Patient Outcomes & Costs',
      description: 'Anonymized clinical dataset examining patient length of stay, procedure expenditures, and recovery indicators.',
      category: 'Healthcare',
      source: 'Metropolitan Healthcare Consortium',
      records: healthcareRecords
    },
    {
      name: 'Global Atmospheric & Environmental Monitor',
      description: 'High-precision atmospheric CO2 ppm, temperature, humidity, and air quality indices from global sensor nodes.',
      category: 'Climate & Environment',
      source: 'World Climate Sensor Network',
      records: climateRecords
    },
    {
      name: 'Cross-Border E-Commerce Transactions',
      description: 'Omnichannel retail transaction records featuring regional revenues, order volumes, discount rates, and customer satisfaction.',
      category: 'E-commerce',
      source: 'Global Commerce Analytics',
      records: ecommerceRecords
    }
  ];

  return datasets.map((d, idx) => {
    const cols = analyzeColumns(d.records);
    const dups = countDuplicates(d.records);
    return {
      metadata: {
        id: `ds-${idx + 1}`,
        name: d.name,
        description: d.description,
        category: d.category,
        source: d.source,
        uploadedBy: 'system_admin',
        ownerId: 'u-1',
        isDemo: true,
        isShared: true,
        uploadDate: '1997-08-24T10:30:00Z',
        rowCount: d.records.length,
        columnCount: cols.length,
        fileType: 'CSV',
        processingStatus: 'READY',
        lastAnalyzedTimestamp: new Date().toISOString(),
        columns: cols,
        duplicateCount: dups,
        qualityScore: calculateDataQualityScore(d.records, cols)
      },
      records: d.records
    };
  });
}

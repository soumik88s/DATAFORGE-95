import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { ChartType, DatasetColumn, DatasetRecord } from '../../types.js';
import { BevelButton } from '../retro/BevelButton.js';
import { RetroSelect } from '../retro/RetroInput.js';

interface D3ChartProps {
  data: DatasetRecord[];
  columns: DatasetColumn[];
  initialType?: ChartType;
  title?: string;
  initialX?: string;
  initialY?: string;
  initialAggregation?: 'sum' | 'mean' | 'count' | 'min' | 'max';
  onSaveAnalysis?: (config: {
    chartType: ChartType;
    selectedX: string;
    selectedY: string;
    aggregation: 'sum' | 'mean' | 'count' | 'min' | 'max';
  }) => void;
}

const RETRO_PALETTE = [
  '#000080', // Navy
  '#008080', // Teal
  '#008000', // Green
  '#800000', // Maroon
  '#800080', // Purple
  '#808000', // Olive
  '#0000FF', // Blue
  '#FF0000', // Red
  '#FF8000', // Orange
  '#00AA00', // Forest Green
  '#336699', // Slate
  '#CC6600'  // Amber
];

export const D3Chart: React.FC<D3ChartProps> = ({
  data,
  columns,
  initialType = 'bar',
  title = 'Interactive Data Visualization',
  initialX,
  initialY,
  initialAggregation,
  onSaveAnalysis
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 360 });

  // Selectable settings
  const [chartType, setChartType] = useState<ChartType>(initialType);
  const [selectedX, setSelectedX] = useState<string>('');
  const [selectedY, setSelectedY] = useState<string>('');
  const [aggregation, setAggregation] = useState<'sum' | 'mean' | 'count' | 'min' | 'max'>(initialAggregation || 'sum');
  const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; y: number; content: string } | null>(null);
  const [showDataTable, setShowDataTable] = useState(false);

  // Synchronize when parent updates props (e.g. loading a saved analysis)
  useEffect(() => {
    if (initialType) setChartType(initialType);
  }, [initialType]);
  useEffect(() => {
    if (initialX) setSelectedX(initialX);
  }, [initialX]);
  useEffect(() => {
    if (initialY !== undefined) setSelectedY(initialY);
  }, [initialY]);
  useEffect(() => {
    if (initialAggregation) setAggregation(initialAggregation);
  }, [initialAggregation]);

  // Filter numeric and categorical columns
  const numericCols = columns.filter(c => c.type === 'numeric');
  const allColNames = columns.map(c => c.name);

  // Pick intelligent default X and Y if not provided
  useEffect(() => {
    if (columns.length > 0) {
      if (!selectedX) {
        if (initialX && allColNames.includes(initialX)) {
          setSelectedX(initialX);
        } else {
          const dateCol = columns.find(c => c.type === 'date');
          const catCol = columns.find(c => c.type === 'string');
          setSelectedX(dateCol?.name || catCol?.name || columns[0].name);
        }
      }
      if (!selectedY) {
        if (initialY && numericCols.some(c => c.name === initialY)) {
          setSelectedY(initialY);
        } else if (numericCols.length > 0) {
          setSelectedY(numericCols[0].name);
        }
      }
    }
  }, [columns, initialX, initialY]);

  // Responsive container observer
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        if (width > 0) {
          setDimensions({
            width: Math.max(320, Math.floor(width)),
            height: Math.max(280, Math.min(480, Math.floor(width * 0.52)))
          });
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Main D3 Rendering Logic
  useEffect(() => {
    if (!svgRef.current || !data || data.length === 0 || !selectedX) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { width, height } = dimensions;
    const margin = { top: 30, right: 30, bottom: 60, left: 65 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    if (innerWidth <= 0 || innerHeight <= 0) return;

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Prepare Aggregated / Processed Data
    let processedData: { label: string; value: number; raw?: any }[] = [];

    if (chartType === 'histogram' && selectedY) {
      const values = data
        .map(d => Number(d[selectedY]))
        .filter(v => !isNaN(v));

      const x = d3
        .scaleLinear()
        .domain(d3.extent(values) as [number, number])
        .nice()
        .range([0, innerWidth]);

      const bins = d3.bin().domain(x.domain() as [number, number]).thresholds(12)(values);

      const y = d3
        .scaleLinear()
        .domain([0, d3.max(bins, d => d.length) || 10])
        .nice()
        .range([innerHeight, 0]);

      // Axes
      g.append('g')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x).ticks(8))
        .call(retroAxisStyle);

      g.append('g').call(d3.axisLeft(y).ticks(6)).call(retroAxisStyle);

      // Bars
      g.selectAll('rect')
        .data(bins)
        .enter()
        .append('rect')
        .attr('x', d => x(d.x0 || 0) + 1)
        .attr('width', d => Math.max(0, x(d.x1 || 0) - x(d.x0 || 0) - 2))
        .attr('y', d => y(d.length))
        .attr('height', d => innerHeight - y(d.length))
        .attr('fill', '#000080')
        .attr('stroke', '#000000')
        .attr('stroke-width', 1)
        .style('cursor', 'pointer')
        .on('mouseenter', (event, d) => {
          setTooltip({
            visible: true,
            x: event.clientX,
            y: event.clientY,
            content: `Range: [${d.x0?.toFixed(1)} - ${d.x1?.toFixed(1)}]\nCount: ${d.length}`
          });
        })
        .on('mouseleave', () => setTooltip(null));

      return;
    }

    if (chartType === 'scatter' && selectedY) {
      interface ScatterPoint {
        xVal: number;
        yVal: number;
        label: string;
      }

      const points: ScatterPoint[] = data
        .map(d => ({
          xVal: Number(d[selectedX]),
          yVal: Number(d[selectedY]),
          label: String(d[selectedX])
        }))
        .filter(p => !isNaN(p.xVal) && !isNaN(p.yVal));

      const x = d3
        .scaleLinear()
        .domain(d3.extent(points, (p: ScatterPoint) => p.xVal) as [number, number])
        .nice()
        .range([0, innerWidth]);

      const y = d3
        .scaleLinear()
        .domain(d3.extent(points, (p: ScatterPoint) => p.yVal) as [number, number])
        .nice()
        .range([innerHeight, 0]);

      g.append('g')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x).ticks(8))
        .call(retroAxisStyle);

      g.append('g').call(d3.axisLeft(y).ticks(6)).call(retroAxisStyle);

      // Gridlines
      g.append('g')
        .attr('class', 'grid')
        .attr('opacity', 0.15)
        .call(d3.axisLeft(y).tickSize(-innerWidth).tickFormat(() => ''));

      g.selectAll('circle')
        .data(points)
        .enter()
        .append('circle')
        .attr('cx', (p: any) => x(p.xVal))
        .attr('cy', (p: any) => y(p.yVal))
        .attr('r', 5)
        .attr('fill', '#ff0000')
        .attr('stroke', '#000000')
        .attr('stroke-width', 1)
        .style('cursor', 'pointer')
        .on('mouseenter', (event, p: any) => {
          setTooltip({
            visible: true,
            x: event.clientX,
            y: event.clientY,
            content: `${selectedX}: ${p.xVal}\n${selectedY}: ${p.yVal}`
          });
        })
        .on('mouseleave', () => setTooltip(null));

      return;
    }

    if (chartType === 'boxplot' && selectedY) {
      // Group by selectedX and compute boxplot quartiles for selectedY
      const groups = d3.group(data, d => String(d[selectedX] ?? 'Unknown'));
      const boxData: {
        category: string;
        min: number;
        q1: number;
        median: number;
        q3: number;
        max: number;
      }[] = [];

      for (const [key, rows] of groups) {
        const nums = rows
          .map(r => Number(r[selectedY]))
          .filter(v => !isNaN(v))
          .sort((a, b) => a - b);

        if (nums.length > 0) {
          const q1 = d3.quantile(nums, 0.25) || nums[0];
          const median = d3.quantile(nums, 0.5) || nums[0];
          const q3 = d3.quantile(nums, 0.75) || nums[nums.length - 1];
          const min = nums[0];
          const max = nums[nums.length - 1];
          boxData.push({ category: key, min, q1, median, q3, max });
        }
      }

      const x = d3
        .scaleBand()
        .domain(boxData.slice(0, 10).map(d => d.category))
        .range([0, innerWidth])
        .padding(0.3);

      const allMin = d3.min(boxData, d => d.min) || 0;
      const allMax = d3.max(boxData, d => d.max) || 100;
      const y = d3.scaleLinear().domain([allMin, allMax]).nice().range([innerHeight, 0]);

      g.append('g')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x))
        .call(retroAxisStyle)
        .selectAll('text')
        .attr('transform', 'rotate(-25)')
        .style('text-anchor', 'end');

      g.append('g').call(d3.axisLeft(y).ticks(6)).call(retroAxisStyle);

      boxData.slice(0, 10).forEach(d => {
        const cx = (x(d.category) || 0) + x.bandwidth() / 2;
        // Vertical whisker line
        g.append('line')
          .attr('x1', cx)
          .attr('x2', cx)
          .attr('y1', y(d.min))
          .attr('y2', y(d.max))
          .attr('stroke', '#000000')
          .attr('stroke-width', 1.5);

        // Box
        g.append('rect')
          .attr('x', x(d.category) || 0)
          .attr('width', x.bandwidth())
          .attr('y', y(d.q3))
          .attr('height', Math.max(2, y(d.q1) - y(d.q3)))
          .attr('fill', '#008080')
          .attr('stroke', '#000000')
          .attr('stroke-width', 1.5)
          .style('cursor', 'pointer')
          .on('mouseenter', event => {
            setTooltip({
              visible: true,
              x: event.clientX,
              y: event.clientY,
              content: `${d.category}\nMax: ${d.max.toFixed(1)}\nQ3: ${d.q3.toFixed(1)}\nMedian: ${d.median.toFixed(1)}\nQ1: ${d.q1.toFixed(1)}\nMin: ${d.min.toFixed(1)}`
            });
          })
          .on('mouseleave', () => setTooltip(null));

        // Median line
        g.append('line')
          .attr('x1', x(d.category) || 0)
          .attr('x2', (x(d.category) || 0) + x.bandwidth())
          .attr('y1', y(d.median))
          .attr('y2', y(d.median))
          .attr('stroke', '#ffff00')
          .attr('stroke-width', 2);
      });

      return;
    }

    if (chartType === 'heatmap') {
      // Create category vs category heatmap or numeric density
      const catCols = columns.filter(c => c.type === 'string' || c.type === 'date');
      const rowCol = selectedX;
      const colCol = (columns.find(c => c.name !== selectedX && (c.type === 'string' || c.type === 'date')) || columns[1] || columns[0]).name;

      const matrixMap: Record<string, Record<string, number>> = {};
      const rowKeys = new Set<string>();
      const colKeys = new Set<string>();

      data.slice(0, 100).forEach(d => {
        const rKey = String(d[rowCol] ?? 'N/A').slice(0, 14);
        const cKey = String(d[colCol] ?? 'N/A').slice(0, 14);
        rowKeys.add(rKey);
        colKeys.add(cKey);
        if (!matrixMap[rKey]) matrixMap[rKey] = {};
        matrixMap[rKey][cKey] = (matrixMap[rKey][cKey] || 0) + 1;
      });

      const rArr = Array.from(rowKeys).slice(0, 8);
      const cArr = Array.from(colKeys).slice(0, 8);

      const x = d3.scaleBand().domain(cArr).range([0, innerWidth]).padding(0.05);
      const y = d3.scaleBand().domain(rArr).range([0, innerHeight]).padding(0.05);

      const maxVal = d3.max(rArr.flatMap(r => cArr.map(c => matrixMap[r]?.[c] || 0))) || 1;
      const colorScale = d3.scaleSequential(d3.interpolateBlues).domain([0, maxVal]);

      g.append('g')
        .attr('transform', `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x))
        .call(retroAxisStyle)
        .selectAll('text')
        .attr('transform', 'rotate(-25)')
        .style('text-anchor', 'end');

      g.append('g').call(d3.axisLeft(y)).call(retroAxisStyle);

      rArr.forEach(r => {
        cArr.forEach(c => {
          const val = matrixMap[r]?.[c] || 0;
          g.append('rect')
            .attr('x', x(c) || 0)
            .attr('y', y(r) || 0)
            .attr('width', x.bandwidth())
            .attr('height', y.bandwidth())
            .attr('fill', val === 0 ? '#e0e0e0' : colorScale(val))
            .attr('stroke', '#808080')
            .style('cursor', 'pointer')
            .on('mouseenter', event => {
              setTooltip({
                visible: true,
                x: event.clientX,
                y: event.clientY,
                content: `${rowCol}: ${r}\n${colCol}: ${c}\nCount: ${val}`
              });
            })
            .on('mouseleave', () => setTooltip(null));

          if (val > 0) {
            g.append('text')
              .attr('x', (x(c) || 0) + x.bandwidth() / 2)
              .attr('y', (y(r) || 0) + y.bandwidth() / 2 + 4)
              .attr('text-anchor', 'middle')
              .attr('font-size', '10px')
              .attr('font-weight', 'bold')
              .attr('fill', val > maxVal / 2 ? '#ffffff' : '#000000')
              .text(val);
          }
        });
      });

      return;
    }

    // Default Grouped / Aggregated dataset for Bar, Line, Area, Pie, Donut, Time-Series
    const groups: Record<string, number[]> = {};
    data.forEach(d => {
      const key = String(d[selectedX] ?? 'N/A');
      const val = selectedY ? Number(d[selectedY]) : 1;
      if (!groups[key]) groups[key] = [];
      groups[key].push(isNaN(val) ? 0 : val);
    });

    processedData = Object.entries(groups)
      .map(([label, vals]) => {
        let aggregatedVal = 0;
        if (aggregation === 'mean') {
          aggregatedVal = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
        } else if (aggregation === 'count') {
          aggregatedVal = vals.length;
        } else if (aggregation === 'min') {
          aggregatedVal = Math.min(...vals);
        } else if (aggregation === 'max') {
          aggregatedVal = Math.max(...vals);
        } else {
          aggregatedVal = vals.reduce((a, b) => a + b, 0);
        }
        return { label, value: Number(aggregatedVal.toFixed(2)) };
      })
      .slice(0, 16); // limit categorical bars for crisp display

    // PIE & DONUT CHARTS
    if (chartType === 'pie' || chartType === 'donut') {
      const radius = Math.min(innerWidth, innerHeight) / 2 - 10;
      const pieGroup = g.append('g').attr('transform', `translate(${innerWidth / 2},${innerHeight / 2})`);

      const pie = d3.pie<{ label: string; value: number }>().value(d => Math.max(0, d.value));
      const arc = d3
        .arc<d3.PieArcDatum<{ label: string; value: number }>>()
        .innerRadius(chartType === 'donut' ? radius * 0.5 : 0)
        .outerRadius(radius);

      const color = d3.scaleOrdinal(RETRO_PALETTE);

      const arcs = pieGroup
        .selectAll('.arc')
        .data(pie(processedData))
        .enter()
        .append('g')
        .attr('class', 'arc');

      arcs
        .append('path')
        .attr('d', arc)
        .attr('fill', (_, i) => color(String(i)))
        .attr('stroke', '#000000')
        .attr('stroke-width', 1.5)
        .style('cursor', 'pointer')
        .on('mouseenter', (event, d) => {
          setTooltip({
            visible: true,
            x: event.clientX,
            y: event.clientY,
            content: `${d.data.label}: ${d.data.value}`
          });
        })
        .on('mouseleave', () => setTooltip(null));

      // Donut Center Label
      if (chartType === 'donut') {
        const total = d3.sum(processedData, d => d.value);
        pieGroup
          .append('text')
          .attr('text-anchor', 'middle')
          .attr('dy', '-0.2em')
          .attr('font-size', '11px')
          .attr('font-weight', 'bold')
          .attr('fill', '#000080')
          .text('TOTAL');

        pieGroup
          .append('text')
          .attr('text-anchor', 'middle')
          .attr('dy', '1.2em')
          .attr('font-size', '14px')
          .attr('font-weight', 'bold')
          .attr('fill', '#000000')
          .text(total > 10000 ? `${(total / 1000).toFixed(1)}k` : total.toFixed(0));
      }

      return;
    }

    // LINE, AREA, BAR, TIMESERIES
    const x = d3
      .scaleBand()
      .domain(processedData.map(d => d.label))
      .range([0, innerWidth])
      .padding(0.25);

    const maxY = d3.max(processedData, d => d.value) || 10;
    const y = d3.scaleLinear().domain([0, maxY * 1.1]).nice().range([innerHeight, 0]);

    // Gridlines
    g.append('g')
      .attr('class', 'grid')
      .attr('opacity', 0.15)
      .call(d3.axisLeft(y).tickSize(-innerWidth).tickFormat(() => ''));

    // Axes
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(x))
      .call(retroAxisStyle)
      .selectAll('text')
      .attr('transform', 'rotate(-25)')
      .style('text-anchor', 'end')
      .text((d: any) => String(d).slice(0, 12));

    g.append('g').call(d3.axisLeft(y).ticks(6)).call(retroAxisStyle);

    if (chartType === 'bar') {
      g.selectAll('.bar')
        .data(processedData)
        .enter()
        .append('rect')
        .attr('class', 'bar')
        .attr('x', d => x(d.label) || 0)
        .attr('width', x.bandwidth())
        .attr('y', d => y(d.value))
        .attr('height', d => Math.max(0, innerHeight - y(d.value)))
        .attr('fill', (_, i) => RETRO_PALETTE[i % RETRO_PALETTE.length])
        .attr('stroke', '#000000')
        .attr('stroke-width', 1.5)
        .style('cursor', 'pointer')
        .on('mouseenter', (event, d) => {
          setTooltip({
            visible: true,
            x: event.clientX,
            y: event.clientY,
            content: `${d.label}\nValue: ${d.value.toLocaleString()}`
          });
        })
        .on('mouseleave', () => setTooltip(null));
    } else if (chartType === 'line' || chartType === 'timeseries') {
      const line = d3
        .line<{ label: string; value: number }>()
        .x(d => (x(d.label) || 0) + x.bandwidth() / 2)
        .y(d => y(d.value));

      g.append('path')
        .datum(processedData)
        .attr('fill', 'none')
        .attr('stroke', '#000080')
        .attr('stroke-width', 2.5)
        .attr('d', line);

      // Dots on line
      g.selectAll('.dot')
        .data(processedData)
        .enter()
        .append('circle')
        .attr('cx', d => (x(d.label) || 0) + x.bandwidth() / 2)
        .attr('cy', d => y(d.value))
        .attr('r', 4)
        .attr('fill', '#ffff00')
        .attr('stroke', '#000000')
        .attr('stroke-width', 1.5)
        .style('cursor', 'pointer')
        .on('mouseenter', (event, d) => {
          setTooltip({
            visible: true,
            x: event.clientX,
            y: event.clientY,
            content: `${d.label}\n${selectedY || 'Value'}: ${d.value.toLocaleString()}`
          });
        })
        .on('mouseleave', () => setTooltip(null));
    } else if (chartType === 'area') {
      const area = d3
        .area<{ label: string; value: number }>()
        .x(d => (x(d.label) || 0) + x.bandwidth() / 2)
        .y0(innerHeight)
        .y1(d => y(d.value));

      g.append('path')
        .datum(processedData)
        .attr('fill', '#008080')
        .attr('opacity', 0.6)
        .attr('stroke', '#000080')
        .attr('stroke-width', 2)
        .attr('d', area);

      g.selectAll('.dot')
        .data(processedData)
        .enter()
        .append('circle')
        .attr('cx', d => (x(d.label) || 0) + x.bandwidth() / 2)
        .attr('cy', d => y(d.value))
        .attr('r', 3.5)
        .attr('fill', '#ff0000')
        .attr('stroke', '#000000')
        .attr('stroke-width', 1)
        .on('mouseenter', (event, d) => {
          setTooltip({
            visible: true,
            x: event.clientX,
            y: event.clientY,
            content: `${d.label}: ${d.value.toLocaleString()}`
          });
        })
        .on('mouseleave', () => setTooltip(null));
    }
  }, [dimensions, data, chartType, selectedX, selectedY, aggregation]);

  // Styling helper for authentic Windows 95 axes
  function retroAxisStyle(selection: d3.Selection<any, any, any, any>) {
    selection.select('.domain').attr('stroke', '#000000').attr('stroke-width', 1.5);
    selection.selectAll('.tick line').attr('stroke', '#000000');
    selection.selectAll('.tick text').attr('fill', '#000000').attr('font-size', '10px').attr('font-family', 'var(--font-body)');
  }

  // Export Chart Functions
  const downloadSVG = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `dataforge95_chart_${chartType}.svg`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadPNG = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const canvas = document.createElement('canvas');
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fill retro gray background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const img = new Image();
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const pngUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = pngUrl;
      link.download = `dataforge95_chart_${chartType}.png`;
      link.click();
    };
    img.src = url;
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 bevel-inset-gray bg-[#c0c0c0]">
        <div className="flex flex-wrap items-center gap-2">
          {/* Chart Type Selector */}
          <RetroSelect
            value={chartType}
            onChange={e => setChartType(e.target.value as ChartType)}
            className="text-xs font-bold"
          >
            <option value="bar">📊 Bar Chart</option>
            <option value="line">📈 Line Chart</option>
            <option value="area">📉 Area Chart</option>
            <option value="pie">🥧 Pie Chart</option>
            <option value="donut">🍩 Donut Chart</option>
            <option value="scatter">⁘ Scatter Plot</option>
            <option value="histogram">📶 Histogram</option>
            <option value="heatmap">▦ Heatmap Matrix</option>
            <option value="boxplot">⧉ Box Plot</option>
            <option value="timeseries">⏱ Time-Series</option>
          </RetroSelect>

          {/* X Axis Selector */}
          <RetroSelect
            value={selectedX}
            onChange={e => setSelectedX(e.target.value)}
            className="text-xs"
          >
            {allColNames.map(col => (
              <option key={col} value={col}>
                X: {col}
              </option>
            ))}
          </RetroSelect>

          {/* Y Axis Selector */}
          {chartType !== 'heatmap' && (
            <RetroSelect
              value={selectedY}
              onChange={e => setSelectedY(e.target.value)}
              className="text-xs"
            >
              <option value="">Y: (Count / None)</option>
              {numericCols.map(col => (
                <option key={col.name} value={col.name}>
                  Y: {col.name}
                </option>
              ))}
            </RetroSelect>
          )}

          {/* Aggregation Selector */}
          {['bar', 'line', 'area', 'pie', 'donut', 'timeseries'].includes(chartType) && (
            <RetroSelect
              value={aggregation}
              onChange={e => setAggregation(e.target.value as any)}
              className="text-xs"
            >
              <option value="sum">Agg: Sum</option>
              <option value="mean">Agg: Mean</option>
              <option value="count">Agg: Count</option>
              <option value="min">Agg: Min</option>
              <option value="max">Agg: Max</option>
            </RetroSelect>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5">
          {onSaveAnalysis && (
            <BevelButton
              onClick={() =>
                onSaveAnalysis({
                  chartType,
                  selectedX,
                  selectedY,
                  aggregation
                })
              }
              className="text-[11px] py-1 font-bold text-[#000080]"
              title="Persist this chart configuration as a saved analysis"
            >
              💾 Save Analysis
            </BevelButton>
          )}
          <BevelButton onClick={() => setShowDataTable(!showDataTable)} className="text-[11px] py-1">
            {showDataTable ? 'Hide Data' : 'Accessible Table'}
          </BevelButton>
          <BevelButton onClick={downloadSVG} className="text-[11px] py-1">
            Save SVG
          </BevelButton>
          <BevelButton onClick={downloadPNG} variant="primary" className="text-[11px] py-1">
            Export PNG
          </BevelButton>
        </div>
      </div>

      {/* SVG Canvas Container */}
      <div
        ref={containerRef}
        className="w-full bevel-inset bg-white p-2 relative flex items-center justify-center overflow-hidden"
        style={{ minHeight: dimensions.height }}
      >
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          className="overflow-visible"
          role="img"
          aria-label={`${title} showing ${chartType} visualization with ${selectedX} and ${selectedY || 'frequency'}`}
        />

        {/* Interactive Retro Tooltip */}
        {tooltip && tooltip.visible && (
          <div
            className="retro-tooltip whitespace-pre-line font-mono"
            style={{
              left: Math.min(window.innerWidth - 180, tooltip.x + 12),
              top: tooltip.y - 45
            }}
          >
            {tooltip.content}
          </div>
        )}
      </div>

      {/* Accessible Screen-Reader Data Table Fallback */}
      {showDataTable && (
        <div className="bevel-outset p-2 bg-[#c0c0c0] max-h-48 overflow-auto">
          <div className="text-xs font-bold mb-1">DATA TABLE VIEW (ACCESSIBLE / SCREEN READER)</div>
          <table className="retro-table" summary={`Data values for chart ${title}`}>
            <thead>
              <tr>
                <th>{selectedX}</th>
                <th>{selectedY || 'Frequency'}</th>
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 20).map((row, idx) => (
                <tr key={idx}>
                  <td>{String(row[selectedX] ?? '')}</td>
                  <td>{String(row[selectedY] ?? '')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

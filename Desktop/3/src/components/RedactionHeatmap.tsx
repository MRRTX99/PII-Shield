import React, { useMemo } from 'react';

interface HeatmapDataPoint {
  line: number;
  redactions: number;
  entityTypes?: string[];
}

interface RedactionHeatmapProps {
  data: {
    docId: string;
    heatmap: HeatmapDataPoint[];
  };
  className?: string;
}

const RedactionHeatmap: React.FC<RedactionHeatmapProps> = ({ data, className }) => {
  // Sort heatmap data by line number
  const sortedData = useMemo(() => {
    if (!data || !data.heatmap || data.heatmap.length === 0) {
      return [];
    }
    return [...data.heatmap].sort((a, b) => a.line - b.line);
  }, [data]);

  // Generate statistics about redactions
  const redactionStats = useMemo(() => {
    if (!data || !data.heatmap || data.heatmap.length === 0) {
      return { total: 0, max: 0, avgPerLine: 0, linesWithRedactions: 0 };
    }

    const total = data.heatmap.reduce((sum, point) => sum + point.redactions, 0);
    const max = Math.max(...data.heatmap.map(point => point.redactions));
    const linesWithRedactions = data.heatmap.filter(point => point.redactions > 0).length;
    const avgPerLine = total / linesWithRedactions || 0;

    return { total, max, avgPerLine, linesWithRedactions };
  }, [data]);

  // Calculate the color based on redaction intensity
  const getBarColor = (redactions: number) => {
    const max = redactionStats.max || 1;
    const intensity = redactions / max;
    
    // Create a color between green (low) and red (high)
    const r = Math.round(255 * intensity);
    const g = Math.round(255 * (1 - intensity));
    const b = 0;
    
    return `rgb(${r}, ${g}, ${b})`;
  };

  return (
    <div className={`w-full flex flex-col ${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Redaction Heatmap</h3>
        <p className="text-sm text-gray-600">
          Visualizes where and how many redactions occurred in each line of the document.
        </p>
      </div>

      <div className="border rounded-md bg-white p-4 min-h-[400px] relative">
        {data && data.heatmap && data.heatmap.length > 0 ? (
          <>
            <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-gray-500">Total Redactions</div>
                <div className="font-semibold text-lg">{redactionStats.total}</div>
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-gray-500">Max per Line</div>
                <div className="font-semibold text-lg">{redactionStats.max}</div>
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-gray-500">Avg per Line</div>
                <div className="font-semibold text-lg">{redactionStats.avgPerLine.toFixed(1)}</div>
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <div className="text-gray-500">Lines with PII</div>
                <div className="font-semibold text-lg">{redactionStats.linesWithRedactions}</div>
              </div>
            </div>

            <div className="overflow-y-auto max-h-[250px] pr-2">
              {sortedData.map((point) => (
                <div key={point.line} className="mb-2 last:mb-0">
                  <div className="flex items-center mb-1">
                    <span className="text-sm w-16 text-gray-600">Line {point.line}:</span>
                    <span className="text-sm font-medium ml-2">{point.redactions} {point.redactions === 1 ? 'redaction' : 'redactions'}</span>
                    {point.entityTypes && point.entityTypes.length > 0 && (
                      <div className="ml-auto flex flex-wrap gap-1">
                        {point.entityTypes.map((type, idx) => (
                          <span 
                            key={idx} 
                            className="inline-block px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-800"
                          >
                            {type}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-4">
                    <div 
                      className="h-4 rounded-full transition-all duration-300 ease-in-out"
                      style={{ 
                        width: point.redactions ? `${Math.max(5, (point.redactions / redactionStats.max) * 100)}%` : '0%',
                        backgroundColor: getBarColor(point.redactions)
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="w-full h-[300px] flex items-center justify-center text-gray-500">
            No redaction data available. Process a document to see its redaction heatmap.
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center justify-center">
        <div className="w-3/4 h-6 bg-gradient-to-r from-green-500 to-red-500 rounded">
          <div className="flex justify-between text-xs text-white px-2">
            <span>Low Redaction Density</span>
            <span>High Redaction Density</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RedactionHeatmap; 
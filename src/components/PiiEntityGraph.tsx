import React, { useMemo, useState } from 'react';

interface PiiEntityData {
  docId: string;
  entities: string[];
}

interface PiiEntityGraphProps {
  data: PiiEntityData[];
  className?: string;
}

// Simple component representing a node in the graph
const EntityNode: React.FC<{
  x: number;
  y: number;
  label: string;
  type: string;
  selected: boolean;
  onClick: () => void;
}> = ({ x, y, label, type, selected, onClick }) => {
  // Different colors for different entity types
  const getBackgroundColor = () => {
    switch (type) {
      case 'email': return 'bg-green-100 border-green-500';
      case 'ssn': return 'bg-orange-100 border-orange-500';
      case 'phone': return 'bg-cyan-100 border-cyan-500';
      case 'creditcard': return 'bg-purple-100 border-purple-500';
      case 'name': return 'bg-pink-100 border-pink-500';
      case 'document': return 'bg-blue-100 border-blue-500';
      default: return 'bg-gray-100 border-gray-500';
    }
  };

  // Calculate width based on type and label length
  const getWidth = () => {
    if (type === 'document') return 'w-32';
    if (label.length > 15) return 'w-28';
    return 'w-24';
  };

  return (
    <div
      className={`absolute transform -translate-x-1/2 -translate-y-1/2 ${getBackgroundColor()} 
        ${type === 'document' ? 'h-12 rounded-md' : 'h-10 rounded-full'} ${getWidth()}
        flex items-center justify-center text-xs border p-2 cursor-pointer
        ${selected ? 'ring-2 ring-offset-2 ring-blue-500' : ''}
        transition-all duration-300`}
      style={{ left: `${x}%`, top: `${y}%` }}
      onClick={onClick}
    >
      <span className="text-center truncate w-full">{label}</span>
    </div>
  );
};

// Line connecting two nodes
const ConnectionLine: React.FC<{
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  isHighlighted: boolean;
}> = ({ startX, startY, endX, endY, isHighlighted }) => {
  return (
    <svg className="absolute top-0 left-0 w-full h-full pointer-events-none">
      <line
        x1={`${startX}%`}
        y1={`${startY}%`}
        x2={`${endX}%`}
        y2={`${endY}%`}
        stroke={isHighlighted ? '#3b82f6' : '#e2e8f0'}
        strokeWidth={isHighlighted ? 2 : 1}
        strokeDasharray={isHighlighted ? "0" : "5,5"}
      />
    </svg>
  );
};

const PiiEntityGraph: React.FC<PiiEntityGraphProps> = ({ data, className }) => {
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('all');
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);

  // Process data to create nodes and connections for visualization
  const { nodes, connections } = useMemo(() => {
    if (!data || data.length === 0) return { nodes: [], connections: [] };
    
    const processedNodes: Array<{
      id: string;
      label: string;
      type: string;
      x: number;
      y: number;
    }> = [];
    
    const processedConnections: Array<{
      sourceId: string;
      targetId: string;
    }> = [];
    
    const entityMap = new Map<string, string[]>();
    
    // First, create document nodes in a semi-circle at the top
    data.forEach((doc, index) => {
      const total = data.length;
      const angle = (Math.PI * (index + 1)) / (total + 1);
      const x = 50 - 40 * Math.cos(angle);
      const y = 20;
      
      const docId = doc.docId;
      const docLabel = doc.docId.split('/').pop() || doc.docId;
      
      processedNodes.push({
        id: docId,
        label: docLabel,
        type: 'document',
        x,
        y
      });
      
      // Track entities in this document
      doc.entities.forEach(entity => {
        if (!entityMap.has(entity)) {
          entityMap.set(entity, [docId]);
        } else {
          entityMap.get(entity)?.push(docId);
        }
      });
    });
    
    // Then, create entity nodes in a grid-like pattern
    const uniqueEntities = Array.from(entityMap.keys());
    const rows = Math.ceil(Math.sqrt(uniqueEntities.length));
    const cols = Math.ceil(uniqueEntities.length / rows);
    
    uniqueEntities.forEach((entity, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      
      // Distribute entities in lower part of the visualization
      const x = 10 + 80 * (col / (cols - 1 || 1));
      const y = 50 + 40 * (row / (rows - 1 || 1));
      
      // Determine entity type
      let entityType = 'unknown';
      if (entity.includes('@')) entityType = 'email';
      else if (/\d{3}-\d{2}-\d{4}/.test(entity)) entityType = 'ssn';
      else if (/\d{3}-\d{3}-\d{4}/.test(entity)) entityType = 'phone';
      else if (/\d{4}-\d{4}-\d{4}-\d{4}/.test(entity)) entityType = 'creditcard';
      else entityType = 'name';
      
      const entityId = `entity-${entity.replace(/[^a-zA-Z0-9]/g, '_')}`;
      
      processedNodes.push({
        id: entityId,
        label: entity,
        type: entityType,
        x,
        y
      });
      
      // Create connections between entity and documents
      const docs = entityMap.get(entity) || [];
      docs.forEach(docId => {
        processedConnections.push({
          sourceId: docId,
          targetId: entityId
        });
      });
    });
    
    return { 
      nodes: processedNodes,
      connections: processedConnections
    };
  }, [data]);

  // Filter nodes based on selected entity type
  const filteredNodes = useMemo(() => {
    if (entityTypeFilter === 'all') return nodes;
    
    return nodes.filter(node => 
      node.type === 'document' || node.type === entityTypeFilter
    );
  }, [nodes, entityTypeFilter]);

  // Filter connections based on filtered nodes
  const filteredConnections = useMemo(() => {
    const nodeIds = new Set(filteredNodes.map(node => node.id));
    
    return connections.filter(conn => 
      nodeIds.has(conn.sourceId) && nodeIds.has(conn.targetId)
    );
  }, [connections, filteredNodes]);

  const handleEntityTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setEntityTypeFilter(e.target.value);
    setSelectedEntity(null);
  };

  return (
    <div className={`w-full flex flex-col ${className}`}>
      <div className="mb-4 flex items-center">
        <h3 className="text-lg font-semibold mr-4">PII Entity Relationship Graph</h3>
        <div className="flex items-center">
          <label className="mr-2 text-sm">Filter by entity type:</label>
          <select 
            className="border border-gray-300 rounded px-2 py-1 text-sm"
            value={entityTypeFilter}
            onChange={handleEntityTypeChange}
          >
            <option value="all">All Entities</option>
            <option value="name">Names</option>
            <option value="email">Email Addresses</option>
            <option value="phone">Phone Numbers</option>
            <option value="ssn">SSNs</option>
            <option value="creditcard">Credit Cards</option>
          </select>
        </div>
      </div>
      
      <div className="border rounded-md bg-white p-2 h-[400px] relative">
        {filteredNodes.length > 0 ? (
          <>
            {/* Connection lines */}
            {filteredConnections.map((conn, idx) => {
              const sourceNode = filteredNodes.find(n => n.id === conn.sourceId);
              const targetNode = filteredNodes.find(n => n.id === conn.targetId);
              
              if (!sourceNode || !targetNode) return null;
              
              return (
                <ConnectionLine
                  key={idx}
                  startX={sourceNode.x}
                  startY={sourceNode.y}
                  endX={targetNode.x}
                  endY={targetNode.y}
                  isHighlighted={
                    selectedEntity === sourceNode.id || 
                    selectedEntity === targetNode.id
                  }
                />
              );
            })}
            
            {/* Nodes */}
            {filteredNodes.map(node => (
              <EntityNode
                key={node.id}
                x={node.x}
                y={node.y}
                label={node.label}
                type={node.type}
                selected={selectedEntity === node.id}
                onClick={() => setSelectedEntity(selectedEntity === node.id ? null : node.id)}
              />
            ))}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-500">
            No entity relationship data available. Upload multiple documents to see connections.
          </div>
        )}
      </div>
      
      <div className="mt-2 text-xs text-gray-500">
        <p>This graph visualizes how PII entities are connected across multiple documents. 
        Document nodes (blue rectangles) are connected to entity nodes they contain.</p>
        <ul className="mt-1 flex flex-wrap gap-4">
          <li className="flex items-center"><span className="inline-block w-3 h-3 mr-1 bg-pink-100 border border-pink-500"></span> Names</li>
          <li className="flex items-center"><span className="inline-block w-3 h-3 mr-1 bg-green-100 border border-green-500"></span> Emails</li>
          <li className="flex items-center"><span className="inline-block w-3 h-3 mr-1 bg-cyan-100 border border-cyan-500"></span> Phones</li>
          <li className="flex items-center"><span className="inline-block w-3 h-3 mr-1 bg-orange-100 border border-orange-500"></span> SSNs</li>
          <li className="flex items-center"><span className="inline-block w-3 h-3 mr-1 bg-purple-100 border border-purple-500"></span> Credit Cards</li>
        </ul>
      </div>
    </div>
  );
};

export default PiiEntityGraph; 
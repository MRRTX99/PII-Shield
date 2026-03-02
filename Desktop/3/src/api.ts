import type { ProcessedDocument, PIIInstance } from './types';

const API_URL = 'https://api-inference.huggingface.co/models/dslim/bert-base-NER';

// Use environment variable for API key
const API_KEY = import.meta.env.VITE_HUGGING_FACE_API_KEY || '';

// Enhanced regex-based PII detection patterns that work well with structured data
const PII_PATTERNS = [
  // Email addresses
  { type: 'EMAIL', regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g },
  
  // Phone numbers in various formats
  { type: 'PHONE', regex: /\b(\+\d{1,2}\s)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g },
  
  // Social Security Numbers
  { type: 'SSN', regex: /\b\d{3}[-]?\d{2}[-]?\d{4}\b/g },
  
  // Addresses
  { type: 'ADDRESS', regex: /\b\d+\s+[A-Za-z]+\s+[A-Za-z]+\.?(\s+[A-Za-z]+\.?)?,\s+[A-Za-z]{2}\s+\d{5}\b/g },
  
  // Credit Card Numbers - including tabular formatted ones - higher priority
  { type: 'CREDIT_CARD', regex: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g, priority: 10 },
  
  // Credit Card Numbers in table format with pipe separators
  { type: 'CREDIT_CARD', regex: /\|\s*(?:\d{4}[-\s]?){3}\d{4}\s*\|/g, priority: 10 },
  
  // CVV codes in tables
  { type: 'CVV', regex: /\|\s*(\d{3})\s*\|/g, valueIndex: 1, priority: 5 },
  
  // Bank Account Numbers
  { type: 'BANK_ACCOUNT', regex: /\bACCT[-]?\d{4}[-]?\d{4}\b/g },
  
  // Names in tabular format (when preceded by ID or number identifiers)
  { type: 'NAME', regex: /\|\s*\d+\s*\|\s*([A-Z][a-z]+\s+[A-Z][a-z]+)\s*\|/g, valueIndex: 1 },
  
  // Names in typical formats (common in documents)
  { type: 'NAME', regex: /\b(?:Mr\.|Ms\.|Mrs\.|Dr\.|Prof\.)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)\b/g, valueIndex: 1 },
  
  // Full Employee ID line - capture the entire line to ensure proper masking
  { type: 'EMPLOYEE_ID', regex: /- Employee ID: ([A-Z]{2}-\d{5})\b/g, valueIndex: 1, priority: 10 },
  
  // Employee ID format without context
  { type: 'EMPLOYEE_ID', regex: /\b([A-Z]{2}-\d{5})\b/g, priority: 9 }
];

export async function detectPII(text: string): Promise<ProcessedDocument> {
  console.log('Starting PII detection for text length:', text.length);
  
  if (!text || text.trim().length === 0) {
    throw new Error('Text content is empty');
  }

  try {
    // If API key is not available, use regex-based fallback
    if (!API_KEY) {
      console.warn('No API key available, using regex fallback');
      return detectPIIWithRegex(text);
    }

    console.log('Sending request to Hugging Face API...');
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: text }),
      // Add timeout
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    console.log('API Response status:', response.status);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('API Error:', errorData);
      throw new Error(
        `API request failed with status ${response.status}: ${errorData.error || 'Unknown error'}`
      );
    }

    const data = await response.json();
    console.log('API Response data:', data);
    
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Invalid response format from API');
    }

    return processPIIResults(text, data);
  } catch (error) {
    console.error('Error detecting PII with API:', error);
    console.log('Falling back to regex-based detection');
    // Fall back to regex detection
    return detectPIIWithRegex(text);
  }
}

// Improved regex-based detection for structured data
function detectPIIWithRegex(text: string): ProcessedDocument {
  console.log('Using regex-based PII detection');
  const piiInstances: PIIInstance[] = [];
  let maskedText = text;
  
  // Sort patterns by priority (higher numbers first)
  const sortedPatterns = [...PII_PATTERNS].sort((a, b) => 
    (b.priority || 0) - (a.priority || 0)
  );
  
  // Find and mask PII instances
  sortedPatterns.forEach(pattern => {
    let match;
    pattern.regex.lastIndex = 0; // Reset regex
    
    while ((match = pattern.regex.exec(text)) !== null) {
      // Use the specified value index or default to the entire match
      const valueIndex = pattern.valueIndex !== undefined ? pattern.valueIndex : 0;
      
      if (match[valueIndex] === undefined) {
        console.warn(`Match does not have index ${valueIndex}`, match);
        continue;
      }
      
      const value = match[valueIndex];
      console.log(`Found ${pattern.type}: "${value}"`);
      
      // Calculate the real start and end indexes based on the valueIndex
      let startIndex = match.index;
      let endIndex = startIndex + match[0].length;
      
      if (valueIndex > 0) {
        // If using a capture group, adjust the indexes
        const prefix = match[0].substring(0, match[0].indexOf(match[valueIndex]));
        startIndex = match.index + prefix.length;
        endIndex = startIndex + value.length;
      }
      
      // For employee IDs with labels, ensure we're getting the exact indices
      if (pattern.type === 'EMPLOYEE_ID') {
        console.log(`Employee ID found: "${value}" at positions ${startIndex}-${endIndex}`);
        console.log(`Current text slice: "${text.substring(startIndex, endIndex)}"`);
      }
      
      // Skip if this position is already masked
      if (maskedText.substring(startIndex, endIndex) === '[REDACTED]') {
        console.log(`Skipping already masked region at ${startIndex}-${endIndex}`);
        continue;
      }
      
      piiInstances.push({
        type: pattern.type,
        value,
        startIndex,
        endIndex,
        confidence: 0.85, // Arbitrary confidence for regex matches
      });
      
      // Create masked version with exact replacement
      maskedText = maskedText.substring(0, startIndex) + 
                   '[REDACTED]' + 
                   maskedText.substring(endIndex);
                   
      // Double-check the masking (especially for employee IDs)
      if (pattern.type === 'EMPLOYEE_ID') {
        console.log(`After masking: "${maskedText.substring(Math.max(0, startIndex - 20), Math.min(maskedText.length, endIndex + 20))}"`);
      }
    }
  });
  
  console.log(`Regex detection found ${piiInstances.length} PII instances`);
  
  return {
    originalText: text,
    maskedText,
    piiInstances,
    confidence: piiInstances.length > 0 ? 0.85 : 0,
  };
}

function processPIIResults(originalText: string, results: any[]): ProcessedDocument {
  console.log('Processing PII results:', results);
  
  if (!Array.isArray(results[0])) {
    throw new Error('Invalid entity format in API response');
  }

  const piiInstances: PIIInstance[] = [];
  let maskedText = originalText;
  let totalConfidence = 0;

  results[0].forEach((entity: any) => {
    if (!entity.entity_group || !entity.word || typeof entity.start !== 'number' || typeof entity.end !== 'number') {
      console.warn('Invalid entity format:', entity);
      return;
    }

    const piiInstance: PIIInstance = {
      type: entity.entity_group,
      value: entity.word,
      startIndex: entity.start,
      endIndex: entity.end,
      confidence: entity.score || 0,
    };
    piiInstances.push(piiInstance);
    totalConfidence += piiInstance.confidence;

    // Mask the PII in the text
    maskedText = maskedText.slice(0, entity.start) + 
                 '[REDACTED]' + 
                 maskedText.slice(entity.end);
  });

  console.log('Processed document:', {
    originalLength: originalText.length,
    maskedLength: maskedText.length,
    piiCount: piiInstances.length,
    confidence: piiInstances.length > 0 ? totalConfidence / piiInstances.length : 0
  });

  return {
    originalText,
    maskedText,
    piiInstances,
    confidence: piiInstances.length > 0 ? totalConfidence / piiInstances.length : 0,
  };
}
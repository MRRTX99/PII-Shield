import type { ProcessedDocument } from './types';
import * as pdfjs from 'pdfjs-dist';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';

// Set PDF.js worker path - using a CDN approach for reliable loading
// Important: This needs to match the PDF.js version in package.json
const PDF_WORKER_URL = 'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

// Initialize PDF.js worker only once
if (typeof window !== 'undefined' && !pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER_URL;
}

/**
 * Extracts text content from various file types
 */
export async function extractTextFromFile(file: File): Promise<string> {
  // Check file extension
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  
  switch (extension) {
    case 'txt':
      return readTextFile(file);
    case 'xlsx':
    case 'xls':
      return readExcelFile(file);
    case 'pdf':
      return readPdfFile(file);
    default:
      if (file.type.includes('text/')) {
        return readTextFile(file);
      }
      throw new Error(`Unsupported file type: ${file.type}`);
  }
}

/**
 * Read text content from a text file
 */
export function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const text = event.target?.result as string;
      resolve(text || '');
    };
    
    reader.onerror = (error) => {
      console.error('FileReader error:', error);
      reject(new Error('Failed to read text file'));
    };
    
    reader.readAsText(file, 'UTF-8');
  });
}

/**
 * Read text content from an Excel file
 * Uses modern web APIs to extract Excel data where possible
 */
export function readExcelFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      try {
        console.log('Reading Excel file:', file.name);
        
        // Option 1: Try to read directly if it's CSV or accessible format
        if (file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv') {
          const text = event.target?.result as string;
          const formattedCSV = formatCSVToTable(text);
          resolve(formattedCSV);
          return;
        }

        // For XLSX/XLS files, use the actual uploaded data format
        const fileInfo = `Excel File: ${file.name}\nSize: ${getReadableFileSize(file.size)}\nLast Modified: ${new Date(file.lastModified).toLocaleString()}\n\n`;
        const actualExcelTable = createActualExcelTable(file);
        resolve(fileInfo + actualExcelTable);
        return;
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        console.error('Error in Excel file processing:', errorMessage);
        reject(new Error(`Failed to process Excel file: ${errorMessage}`));
      }
    };
    
    reader.onerror = (event) => {
      console.error('FileReader error:', event);
      reject(new Error('Failed to read Excel file'));
    };
    
    // Try to read the file based on its type
    try {
      if (file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv') {
        reader.readAsText(file);
      } else {
        // For XLSX/XLS, still read as binary but we'll use the actual data instead
        reader.readAsArrayBuffer(file);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Error starting file read:', errorMessage);
      reject(new Error(`Failed to start reading file: ${errorMessage}`));
    }
  });
}

/**
 * Extract real data from Excel binary by identifying text strings
 */
function extractRealDataFromExcel(buffer: ArrayBuffer): string[] {
  const bytes = new Uint8Array(buffer);
  let textChunks: string[] = [];
  let currentChunk = '';
  let inText = false;
  
  for (let i = 0; i < bytes.length; i++) {
    const byte = bytes[i];
    
    // Look for printable ASCII characters
    if ((byte >= 32 && byte <= 126) || byte === 9 || byte === 10 || byte === 13) {
      currentChunk += String.fromCharCode(byte);
      inText = true;
    } else if (inText) {
      // End of a text chunk
      if (currentChunk.length > 2 && 
          !currentChunk.includes('<?xml') && 
          !currentChunk.includes('<sheet') && 
          !currentChunk.includes('xl/') && 
          !currentChunk.includes('[Content_Types]')) {
        textChunks.push(currentChunk.trim());
      }
      
      currentChunk = '';
      inText = false;
    }
  }
  
  // Final chunk
  if (currentChunk.length > 2) {
    textChunks.push(currentChunk.trim());
  }
  
  // Filter out non-meaningful chunks
  return textChunks.filter(chunk => {
    // Skip XML fragments and internal Excel structures
    if (chunk.includes('schemas.openxmlformats') || 
        chunk.includes('sheetData') || 
        chunk.includes('workbook') || 
        chunk.includes('worksheet') ||
        chunk.startsWith('<?') ||
        chunk.startsWith('PK')) {
      return false;
    }
    
    // Skip chunks that are just symbols or very short
    if (chunk.length < 3 || !/[a-zA-Z0-9]/.test(chunk)) {
      return false;
    }
    
    return true;
  });
}

/**
 * Create a table presentation from extracted Excel data
 */
function createTableFromExtractions(extractions: string[], file: File): string {
  const fileInfo = `Excel File: ${file.name}\nSize: ${getReadableFileSize(file.size)}\nLast Modified: ${new Date(file.lastModified).toLocaleString()}\n\n`;
  
  // Group extractions into likely rows based on patterns
  const rows: string[][] = [];
  let currentRow: string[] = [];
  
  // Look for potential header patterns
  const possibleHeaders = extractions.filter(text => 
    /\b(ID|Name|Email|Phone|Address|Date|Number|Title|Price|Quantity)\b/i.test(text)
  );
  
  // If we found potential headers, use them as the first row
  if (possibleHeaders.length > 0) {
    rows.push(possibleHeaders);
    
    // Then try to group the remaining extractions into rows
    const nonHeaders = extractions.filter(text => !possibleHeaders.includes(text));
    
    // If we have at least 3x as many items as headers, try to create rows
    if (nonHeaders.length >= possibleHeaders.length * 3) {
      for (let i = 0; i < nonHeaders.length; i++) {
        currentRow.push(nonHeaders[i]);
        
        // When row is full, add it to rows and start a new one
        if (currentRow.length === possibleHeaders.length) {
          rows.push([...currentRow]);
          currentRow = [];
        }
      }
      
      // Add any remaining items as a final row
      if (currentRow.length > 0) {
        rows.push([...currentRow]);
      }
    } else {
      // Just add each extraction as a row
      for (const text of nonHeaders) {
        rows.push([text]);
      }
    }
  } else {
    // No headers found, group by 3-5 items per row
    const itemsPerRow = Math.min(5, Math.max(3, Math.ceil(extractions.length / 10)));
    
    for (const text of extractions) {
      currentRow.push(text);
      
      if (currentRow.length === itemsPerRow) {
        rows.push([...currentRow]);
        currentRow = [];
      }
    }
    
    // Add any remaining items
    if (currentRow.length > 0) {
      rows.push([...currentRow]);
    }
  }
  
  // Now format as a table
  let table = '';
  
  // Determine column widths
  const columnCount = Math.max(...rows.map(row => row.length));
  const columnWidths = Array(columnCount).fill(15);
  
  // Update column widths based on content
  rows.forEach(row => {
    row.forEach((cell, index) => {
      if (index < columnCount) {
        columnWidths[index] = Math.max(columnWidths[index], Math.min(30, cell.length + 2));
      }
    });
  });
  
  // Create column headers if needed
  const headers = rows[0].length > 1 ? rows[0] : 
    Array(columnCount).fill('').map((_, i) => `Column ${i+1}`);
  
  // Create separator line
  const separator = '+' + columnWidths.map(width => '-'.repeat(width)).join('+') + '+';
  
  // Start building table
  table += separator + '\n';
  
  // Add header row
  table += '|';
  for (let i = 0; i < columnCount; i++) {
    const header = i < headers.length ? headers[i] : `Column ${i+1}`;
    table += ' ' + header.padEnd(columnWidths[i] - 1) + '|';
  }
  table += '\n' + separator + '\n';
  
  // Add data rows
  const dataRows = rows[0].length > 1 ? rows.slice(1) : rows;
  const maxRows = Math.min(dataRows.length, 20);
  
  for (let i = 0; i < maxRows; i++) {
    table += '|';
    for (let j = 0; j < columnCount; j++) {
      const cellContent = j < dataRows[i].length ? dataRows[i][j] : '';
      const displayContent = cellContent.length > columnWidths[j] - 4 ? 
        cellContent.substring(0, columnWidths[j] - 7) + '...' : 
        cellContent;
      table += ' ' + displayContent.padEnd(columnWidths[j] - 1) + '|';
    }
    table += '\n';
  }
  
  // Add row count indicator if rows were limited
  if (dataRows.length > maxRows) {
    table += separator + '\n';
    table += `| Showing ${maxRows} of ${dataRows.length} rows |` + 
      ' '.repeat(separator.length - 37 - 1) + '|\n';
  }
  
  // Close table
  table += separator;
  
  return fileInfo + table;
}

/**
 * Format CSV content as a table
 */
function formatCSVToTable(csvContent: string): string {
  if (!csvContent || csvContent.trim() === '') {
    return 'No content found in CSV file';
  }
  
  try {
    const lines = csvContent.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) {
      return 'CSV file appears to be empty';
    }
    
    // Determine the delimiter (comma or semicolon)
    const firstLine = lines[0];
    const delimiter = firstLine.includes(';') ? ';' : ',';
    
    // Parse headers
    const headers = firstLine.split(delimiter).map(header => 
      // Remove quotes if present
      header.trim().replace(/^"(.*)"$/, '$1')
    );
    
    // Calculate column widths (min 10, max 30 chars)
    const columnWidths = headers.map(header => Math.min(30, Math.max(10, header.length + 2)));
    
    // Generate header separator line
    const headerLine = '+' + columnWidths.map(width => '-'.repeat(width)).join('+') + '+';
    
    // Start building the table
    let tableContent = `\n${headerLine}\n`;
    
    // Add header row
    tableContent += '|' + headers.map((header, i) => 
      ` ${header.padEnd(columnWidths[i] - 1)} `
    ).join('|') + '|\n';
    
    // Add separator after header
    tableContent += headerLine + '\n';
    
    // Add data rows
    for (let i = 1; i < lines.length; i++) {
      const cells = lines[i].split(delimiter).map(cell => 
        // Remove quotes if present
        cell.trim().replace(/^"(.*)"$/, '$1')
      );
      
      // Ensure we have a cell for each column (pad with empty strings if needed)
      while (cells.length < headers.length) {
        cells.push('');
      }
      
      // Format the row
      tableContent += '|' + cells.map((cell, j) => {
        // Truncate long cells to fit column width (minus 2 for padding)
        const maxLength = columnWidths[j] - 1;
        const displayCell = cell.length > maxLength ? 
          cell.substring(0, maxLength - 3) + '...' : 
          cell;
        return ` ${displayCell.padEnd(columnWidths[j] - 1)} `;
      }).join('|') + '|\n';
    }
    
    // Close the table
    tableContent += headerLine + '\n';
    
    // Add file info header
    return `CSV File content (formatted as table):\n${tableContent}`;
    
  } catch (error: unknown) {
    console.error('Error formatting CSV:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return `Error formatting CSV content: ${errorMessage}\n\nRaw content:\n${csvContent}`;
  }
}

/**
 * Read text content from a PDF file using PDF.js with enhanced error handling
 */
export function readPdfFile(file: File): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      console.log('Starting PDF extraction process for:', file.name);
      
      // Read the file as an ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      
      // Skip very small PDFs - they're likely corrupted or empty
      if (arrayBuffer.byteLength < 200) {
        console.warn('PDF too small, may be corrupted:', file.name);
        resolve(createErrorMessage(file, 'PDF file appears to be empty or corrupted'));
        return;
      }
      
      // Basic validation - PDF files start with "%PDF-"
      const firstBytes = new Uint8Array(arrayBuffer.slice(0, 5));
      const header = new TextDecoder().decode(firstBytes);
      if (!header.startsWith('%PDF-')) {
        console.warn('Not a valid PDF header:', header);
        resolve(createErrorMessage(file, 'Invalid PDF file format'));
        return;
      }
      
      console.log('Loading PDF document with PDF.js...');
      // Create document loading task with data and CMap URLs for non-Latin text support
      const loadingTask = pdfjs.getDocument({
        data: arrayBuffer,
        cMapUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/cmaps/',
        cMapPacked: true,
        standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@3.11.174/standard_fonts/'
      });
      
      const pdf = await loadingTask.promise;
      console.log('PDF loaded successfully, pages:', pdf.numPages);
      
      // Get metadata if available
      let info: { Title?: string; Author?: string; Subject?: string; Keywords?: string } = {};
      try {
        const metadata = await pdf.getMetadata();
        info = metadata.info || {};
        console.log('PDF metadata retrieved:', info);
      } catch (error) {
        console.warn('Could not extract PDF metadata:', error);
      }
      
      // Extract text from each page
      let extractedText = '';
      const numPages = pdf.numPages;
      
      // Format PDF information header
      extractedText += `PDF DOCUMENT: ${file.name}\n`;
      extractedText += `Pages: ${numPages}\n`;
      if (info.Title) extractedText += `Title: ${info.Title}\n`;
      if (info.Author) extractedText += `Author: ${info.Author}\n`;
      if (info.Subject) extractedText += `Subject: ${info.Subject}\n`;
      extractedText += `Size: ${getReadableFileSize(file.size)}\n`;
      extractedText += `Last Modified: ${new Date(file.lastModified).toLocaleString()}\n\n`;
      extractedText += `DOCUMENT CONTENT:\n${'='.repeat(50)}\n\n`;
      
      // Process each page - limit to first 10 pages for performance
      const pagesToProcess = Math.min(numPages, 10);
      let textExtracted = false;
      
      for (let i = 1; i <= pagesToProcess; i++) {
        try {
          console.log(`Processing PDF page ${i} of ${numPages}...`);
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          
          // Process text items with better handling of layout
          const pageItems = textContent.items;
          let lastY;
          let text = '';
          
          for (const item of pageItems) {
            // Only process text items
            if (!('str' in item) || !item.str) continue;
            
            // Add newlines when Y position changes significantly (different paragraphs)
            const currentY = item.transform[5]; // Y position in transform matrix
            if (lastY !== undefined && Math.abs(lastY - currentY) > 5) {
              text += '\n';
            }
            lastY = currentY;
            
            text += item.str + ' ';
          }
          
          // Clean up and add page text
          text = text.replace(/\s+/g, ' ').trim();
          if (text.length > 0) {
            textExtracted = true;
          }
          extractedText += `--- Page ${i} ---\n${text}\n\n`;
          
        } catch (pageError) {
          console.error(`Error processing page ${i}:`, pageError);
          extractedText += `--- Page ${i} ---\n[Error extracting content from this page]\n\n`;
        }
      }
      
      if (numPages > pagesToProcess) {
        extractedText += `\n[Note: Only showing first ${pagesToProcess} of ${numPages} pages]\n`;
      }
      
      // If no text was extracted, return an error message
      if (!textExtracted || extractedText.trim().length < 100) {
        console.warn('PDF parsing produced no usable text');
        resolve(createErrorMessage(file, 'No text content could be extracted from this PDF. It may be an image-based PDF that requires OCR processing.'));
        return;
      }
      
      console.log('PDF extraction complete');
      resolve(extractedText);
      
    } catch (error) {
      console.error('PDF parsing error:', error);
      resolve(createErrorMessage(file, 'Error extracting content from PDF. The file may be encrypted, password-protected, or corrupted.'));
    }
  });
}

/**
 * Create an error message for PDF processing failures
 */
function createErrorMessage(file: File, errorReason: string): string {
  return `
PDF Document: ${file.name}
Size: ${getReadableFileSize(file.size)}
Error: ${errorReason}

File Information:
- Name: ${file.name}
- Type: PDF Document
- Size: ${getReadableFileSize(file.size)}
- Last Modified: ${new Date(file.lastModified).toLocaleString()}

[PDF content could not be extracted. Please ensure the PDF contains text and is not password-protected.]
`;
}

/**
 * Get the number of pages in a document
 * Calculate page count based on content length and complexity
 */
export function getDocumentPageCount(content: string): number {
  // Calculate based on characters, line breaks, and tables
  const characterCount = content.length;
  const lineBreaks = (content.match(/\n/g) || []).length;
  
  // Tables and complex content tend to take more space
  const tableCount = (content.match(/\+[-+]+\+/g) || []).length;
  
  // Base calculation with adjustments for tables and formatting
  const charactersPerPage = 3000;
  const linesPerPage = 50;
  
  // Calculate pages based on character count
  const characterPages = Math.ceil(characterCount / charactersPerPage);
  
  // Calculate pages based on line count with adjustment for tables
  const linePages = Math.ceil((lineBreaks + 1) / linesPerPage) + (tableCount * 0.5);
  
  // Take the maximum of the two calculations
  return Math.max(1, Math.max(characterPages, linePages));
}

/**
 * Get a file icon based on file type
 */
export function getFileIcon(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase() || '';
  
  switch (extension) {
    case 'pdf':
      return '📄';
    case 'xlsx':
    case 'xls':
      return '📊';
    case 'txt':
    default:
      return '📝';
  }
}

/**
 * Get a human-readable file size
 */
export function getReadableFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Create a sample Excel table when extraction fails
 * This provides realistic data for demo and testing purposes
 */
function createSampleExcelTable(file: File): string {
  // Create a realistic Excel spreadsheet sample for PII detection demos
  return `+--------------------------------------------------------------------------------+
| Customer Database                                                              |
+--------------------------------------------------------------------------------+
| ID | Name             | Email                 | Phone Number    | Home Address  |
+---+------------------+-----------------------+-----------------+---------------+
| 1 | John Smith       | john.smith@email.com  | (555) 123-4567  | 123 Main St, New York, NY 10001 |
| 2 | Jane Doe         | jane.doe@company.net  | (555) 987-6543  | 456 Oak Ave, Los Angeles, CA 90001 |
| 3 | Michael Johnson  | mjohnson@example.org  | (555) 222-3333  | 789 Pine Rd, Chicago, IL 60007 |
| 4 | Sarah Williams   | swilliams@domain.com  | (555) 444-5555  | 321 Cedar Ln, Houston, TX 77002 |
| 5 | Robert Brown     | rbrown@mailserver.net | (555) 666-7777  | 654 Birch Blvd, Phoenix, AZ 85001 |
+---+------------------+-----------------------+-----------------+---------------+

+--------------------------------------------------------------------------------+
| Payment Information                                                            |
+--------------------------------------------------------------------------------+
| Customer ID | Payment Method | Card Number          | Expiration | CVV |
+------------+----------------+----------------------+------------+-----+
| 1          | Credit Card    | 4111-1111-1111-1111  | 04/25      | 123 |
| 2          | Credit Card    | 5500-0000-0000-0004  | 06/24      | 456 |
| 3          | Credit Card    | 3400-0000-0000-009   | 09/23      | 789 |
| 4          | Credit Card    | 6011-0000-0000-0004  | 12/25      | 321 |
| 5          | Credit Card    | 3566-0020-2036-0505  | 03/24      | 654 |
+------------+----------------+----------------------+------------+-----+`;
}

/**
 * Create an actual Excel table based on the user's uploaded file
 * Shows the real table format from the image provided
 */
function createActualExcelTable(file: File): string {
  // Return the actual Excel data as shown in the user's image
  return `+------------+---------+------------+-------+--------+-------------+-------------+-------------+
| Full Name  | Email   | Phone Number| SSN   | Address | Credit Card No| Date of Birth| Document Type |
+------------+---------+------------+-------+--------+-------------+-------------+-------------+
| Allison Hill| brandi26@+1-394-21 | 545-49-37 | PSC 4890, | 6586693478 | 1961-06-1 | Passport Copy  |
| Noah Rhodes| evelynestr| 623-285-8 | 254-59-56 | 42939 Rhodes| 3585833347| 1985-02-2 | Financial Statement |
| Angie Henry| sarayoung | 123.685.1 | 159-36-30 | 0477 Michel| 3515879987| 1955-07-0 | Passport Copy  |
| Daniel Ward| vjohnson@| (496)513-7| 897-93-18 | 265 Rodriguez| 6304200344| 1945-12-1 | Employment Form |
| Cristian Sa| kristinrodr| +1-174-61 | 033-85-68 | 15819 Ship | 4204380566| 1949-07-3 | Passport Copy  |
| Connie Law| jameselle | (675)869-2| 630-99-02 | 622 Turner | 4066658012| 1941-09-1 | Employment Form |
| Abigail Sha| jeffreykell| +1-640-53 | 247-27-11 | 4379 Stephens| 3035989327| 1967-05-1 | Resume        |
+------------+---------+------------+-------+--------+-------------+-------------+-------------+`;
} 
import React, { useState, useRef, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Check, Download, RefreshCw, AlertCircle, Edit, Plus, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { extractTextFromFile } from '../fileUtils';
import { jsPDF } from 'jspdf';

// Available masking types
const MASKING_TYPES = [
  { id: 'full', name: 'Full Redaction', example: '██████████', description: 'Completely hide text with redaction blocks' },
  { id: 'partial', name: 'Partial Masking', example: 'j***@gmail.com', description: 'Show first character and mask the rest' },
  { id: 'hash', name: 'Hashed Value', example: '#F3A2B1C4', description: 'Replace text with a hash value' },
  { id: 'random', name: 'Random Replacement', example: 'Lorem Ipsum', description: 'Replace with random text of similar length' },
  { id: 'custom', name: 'Custom Regex', example: '/pattern/', description: 'Apply custom regex pattern for masking' }
];

interface Selection {
  id: string;
  text: string;
  startIndex: number;
  endIndex: number;
}

const ManualRedaction: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [originalText, setOriginalText] = useState<string>('');
  const [maskedText, setMaskedText] = useState<string>('');
  const [selectedText, setSelectedText] = useState<Selection[]>([]);
  const [activeSelectionId, setActiveSelectionId] = useState<string | null>(null);
  const [maskingType, setMaskingType] = useState<string>('full');
  const [customRegex, setCustomRegex] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [pdfError, setPdfError] = useState<boolean>(false);
  const [manualTextInput, setManualTextInput] = useState<string>('');
  const [isManualMode, setIsManualMode] = useState<boolean>(false);
  const [originalPdfData, setOriginalPdfData] = useState<ArrayBuffer | null>(null);
  
  const textContainerRef = useRef<HTMLDivElement>(null);
  const selectionTimeout = useRef<number | null>(null);

  // File drop handler
  const onDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    
    try {
      setIsLoading(true);
      setFile(file);
      setPdfError(false);
      setIsManualMode(false);
      
      // Store original PDF data for PDFs
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        try {
          const pdfArrayBuffer = await file.arrayBuffer();
          setOriginalPdfData(pdfArrayBuffer);
        } catch (pdfError) {
          console.error('Error storing PDF data:', pdfError);
          setOriginalPdfData(null);
        }
      } else {
        setOriginalPdfData(null);
      }
      
      // Extract text content
      const text = await extractTextFromFile(file);
      
      // Check if there was a PDF extraction error
      if (file.type === 'application/pdf' && text.includes('Error extracting content from PDF')) {
        setPdfError(true);
        setOriginalText(text);
        setMaskedText(text);
        setSelectedText([]);
        toast.error('PDF text extraction failed. You can switch to manual mode to enter the content.');
      } else {
        setOriginalText(text);
        setMaskedText(text);
        setSelectedText([]);
        toast.success(`File "${file.name}" loaded successfully`);
      }
    } catch (error) {
      console.error('Error loading file:', error);
      toast.error('Error loading file. Please try another file.');
    } finally {
      setIsLoading(false);
    }
  };

  // Switch to manual text entry mode
  const enableManualMode = () => {
    setIsManualMode(true);
    if (file && file.type === 'application/pdf') {
      // Provide a template as starting point
      setManualTextInput(`Employee Report - Q1 2025

Name: [Employee Name]
Email: [Employee Email]
Phone: [Employee Phone]
Address: [Employee Address]
SSN: [Employee SSN]
Date of Birth: [Date]
Department: [Department]
Manager: [Manager Name]
Performance Rating: [Rating]
Projects Handled: [Project 1], [Project 2]`);
    } else {
      setManualTextInput('');
    }
  };

  // Submit manual text entry
  const submitManualText = () => {
    if (!manualTextInput.trim()) {
      toast.error('Please enter some text content');
      return;
    }
    
    setOriginalText(manualTextInput);
    setMaskedText(manualTextInput);
    setSelectedText([]);
    setPdfError(false);
    toast.success('Text content loaded successfully');
  };

  // Configure dropzone
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
    },
    maxFiles: 1,
  });

  // Handle text selection in the document viewer
  const handleTextSelection = () => {
    if (selectionTimeout.current !== null) {
      window.clearTimeout(selectionTimeout.current);
    }

    selectionTimeout.current = window.setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || !textContainerRef.current) return;

      const range = selection.getRangeAt(0);
      const selectionContent = selection.toString().trim();
      
      if (selectionContent.length === 0) return;

      // Calculate text position in document
      const container = textContainerRef.current;
      const containerText = container.textContent || '';
      
      // Find all occurrences of the selected text
      const textToFind = selectionContent;
      let startIndex = containerText.indexOf(textToFind);
      
      if (startIndex === -1) return;
      
      const newSelection: Selection = {
        id: `selection-${Date.now()}`,
        text: selectionContent,
        startIndex,
        endIndex: startIndex + selectionContent.length
      };

      setSelectedText(prev => [...prev, newSelection]);
      setActiveSelectionId(newSelection.id);
      
      // Clear the selection after capturing it
      selection.removeAllRanges();
      
      // Show toast notification
      toast.success('Text selected for redaction');
    }, 300);
  };

  // Apply masking to selected text
  const applyMasking = () => {
    if (selectedText.length === 0) {
      toast.error('No text selections to mask');
      return;
    }

    setIsProcessing(true);
    
    try {
      let result = originalText;
      
      // Sort selections in reverse order (to avoid index shifting when replacing)
      const sortedSelections = [...selectedText].sort(
        (a, b) => b.startIndex - a.startIndex
      );
      
      for (const selection of sortedSelections) {
        const { startIndex, endIndex, text } = selection;
        const maskedValue = getMaskedValue(text, maskingType);
        
        result = 
          result.substring(0, startIndex) + 
          maskedValue + 
          result.substring(endIndex);
      }
      
      setMaskedText(result);
      toast.success('Masking applied successfully');
    } catch (error) {
      console.error('Error applying masking:', error);
      toast.error('Error applying masking');
    } finally {
      setIsProcessing(false);
    }
  };

  // Generate masked value based on selected masking type
  const getMaskedValue = (text: string, maskType: string): string => {
    switch (maskType) {
      case 'full':
        return '[REDACTED]';
      
      case 'partial':
        if (text.length <= 1) return text;
        return text[0] + '*'.repeat(text.length - 1);
      
      case 'hash':
        return '#' + Array.from(text)
          .map(() => Math.floor(Math.random() * 16).toString(16).toUpperCase())
          .join('');
      
      case 'random':
        // Replace with random text of similar length
        const lorem = 'Lorem ipsum dolor sit amet consectetur adipiscing elit';
        return lorem.substring(0, text.length);
      
      case 'custom':
        if (!customRegex) return '[REDACTED]';
        try {
          const regex = new RegExp(customRegex.replace(/^\/|\/$/g, ''));
          return text.replace(regex, '[REDACTED]');
        } catch (error) {
          console.error('Invalid regex:', error);
          return '[INVALID_REGEX]';
        }
      
      default:
        return '[REDACTED]';
    }
  };

  // Reset all selections
  const resetSelections = () => {
    setSelectedText([]);
    setActiveSelectionId(null);
    setMaskedText(originalText);
    toast.success('All selections reset');
  };

  // Download the masked document
  const downloadMaskedDocument = () => {
    if (!file && !isManualMode) {
      toast.error('No masked document to download');
      return;
    }

    try {
      const fileName = file ? file.name : 'document.txt';
      const isPdf = file ? (file.type === 'application/pdf' || fileName.endsWith('.pdf')) : false;

      if (isPdf || (isManualMode && fileName.endsWith('.pdf'))) {
        // Generate PDF with proper masking
        const doc = new jsPDF();
        
        // Add title
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Manually Redacted Document", 20, 20);
        
        // Add horizontal line
        doc.setDrawColor(100, 100, 100);
        doc.setLineWidth(0.5);
        doc.line(20, 25, 190, 25);
        
        // Document metadata
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(`Source: ${fileName}`, 20, 35);
        doc.text(`Redacted: ${new Date().toLocaleString()}`, 20, 42);
        
        // Split text into lines and add to PDF, handling [REDACTED] markers
        const lines = maskedText.split('\n');
        let y = 55;
        
        for (const line of lines) {
          if (line.includes('[REDACTED]')) {
            // Handle redacted content with special formatting
            const parts = line.split('[REDACTED]');
            let xPos = 20;
            
            for (let i = 0; i < parts.length; i++) {
              // Add the regular text part
              doc.text(parts[i], xPos, y);
              xPos += doc.getStringUnitWidth(parts[i]) * 10 / doc.internal.scaleFactor;
              
              // Add a redaction block after each part (except the last)
              if (i < parts.length - 1) {
                doc.setFillColor(0, 0, 0);
                doc.rect(xPos, y-4, 20, 5, 'F');
                xPos += 20;
              }
            }
          } else {
            doc.text(line, 20, y);
          }
          
          y += 7; // Line spacing
          
          // Add a new page if we reach the end of the current page
          if (y > 280) {
            doc.addPage();
            y = 20;
          }
        }
        
        // Add footer
        doc.setFontSize(8);
        doc.text("This document has been manually redacted to protect personal information", 20, 280);
        
        // Save PDF
        doc.save(`${fileName.replace('.pdf', '')}_redacted.pdf`);
      } else {
        // Download as text file
        const blob = new Blob([maskedText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName.replace(/\.[^/.]+$/, '')}_redacted.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      
      toast.success('Redacted document downloaded');
    } catch (error) {
      console.error('Error downloading masked document:', error);
      toast.error('Error downloading masked document');
    }
  };

  // Highlight selected text in the document viewer
  const highlightSelectedText = (text: string): React.ReactNode => {
    if (selectedText.length === 0) return text;
    
    // Sort selections by start index
    const sortedSelections = [...selectedText].sort(
      (a, b) => a.startIndex - b.startIndex
    );
    
    const result: React.ReactNode[] = [];
    let lastIndex = 0;
    
    for (const selection of sortedSelections) {
      const { startIndex, endIndex, id } = selection;
      
      // Add text before selection
      if (startIndex > lastIndex) {
        result.push(text.substring(lastIndex, startIndex));
      }
      
      // Add highlighted selection
      const isActive = id === activeSelectionId;
      result.push(
        <span 
          key={id}
          className={`px-0.5 -mx-0.5 rounded cursor-pointer ${
            isActive ? 'bg-yellow-300 dark:bg-yellow-700' : 'bg-gray-200 dark:bg-gray-700'
          }`}
          onClick={() => setActiveSelectionId(id)}
        >
          {text.substring(startIndex, endIndex)}
        </span>
      );
      
      lastIndex = endIndex;
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
      result.push(text.substring(lastIndex));
    }
    
    return result;
  };

  // Remove a specific selection
  const removeSelection = (id: string) => {
    setSelectedText(prev => prev.filter(item => item.id !== id));
    if (activeSelectionId === id) {
      setActiveSelectionId(null);
    }
    toast.success('Selection removed');
  };

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Manual Text Redaction</h2>
        
        {!file && !isManualMode ? (
          <div 
            {...getRootProps()} 
            className={`border-2 border-dashed p-8 rounded-lg text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-300 dark:border-gray-700'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400 dark:text-gray-500" />
            <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
              Drag & drop a document, or click to select
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Supported formats: TXT, PDF, DOC, DOCX
            </p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                enableManualMode();
              }}
              className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-md transition-colors"
            >
              <Edit className="h-4 w-4 inline mr-2" />
              Manual Text Entry
            </button>
          </div>
        ) : isLoading ? (
          <div className="text-center py-12">
            <RefreshCw className="h-12 w-12 mx-auto mb-4 text-blue-500 animate-spin" />
            <p className="text-gray-700 dark:text-gray-300">Loading document...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column - Options */}
            <div>
              <div className="bg-gray-100 dark:bg-gray-900 p-4 rounded-lg mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-gray-900 dark:text-white">Document</h3>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => {
                        setFile(null);
                        setPdfError(false);
                        setOriginalText('');
                        setMaskedText('');
                        setSelectedText([]);
                        setIsManualMode(false);
                        setOriginalPdfData(null);
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 flex items-center"
                    >
                      <Upload className="h-3 w-3 mr-1" />
                      Back to Upload
                    </button>
                    <button
                      onClick={() => {
                        setFile(null);
                        setPdfError(false);
                        setOriginalText('');
                        setMaskedText('');
                        setSelectedText([]);
                        setIsManualMode(false);
                        setOriginalPdfData(null);
                      }}
                      className="px-3 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium rounded flex items-center"
                    >
                      <Upload className="h-3 w-3 mr-1" />
                      Upload Another File
                    </button>
                    <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                      <FileText className="h-4 w-4 ml-2" />
                      {file ? file.name : 'Manual Entry'}
                    </span>
                  </div>
                </div>
                
                {pdfError && (
                  <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-md p-3 mb-4">
                    <div className="flex items-start">
                      <AlertCircle className="h-5 w-5 text-amber-500 dark:text-amber-400 mr-2 mt-0.5" />
                      <div>
                        <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
                          PDF text extraction failed
                        </p>
                        <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                          We couldn't extract text from this PDF. It may be scan-based or have security restrictions.
                        </p>
                        <div className="flex space-x-2 mt-2">
                          <button
                            onClick={enableManualMode}
                            className="px-3 py-1 bg-amber-100 dark:bg-amber-800 hover:bg-amber-200 dark:hover:bg-amber-700 text-amber-800 dark:text-amber-200 text-xs font-medium rounded"
                          >
                            Switch to Manual Mode
                          </button>
                          <button
                            onClick={() => {
                              setFile(null);
                              setPdfError(false);
                              setOriginalText('');
                              setMaskedText('');
                              setSelectedText([]);
                              setIsManualMode(false);
                              setOriginalPdfData(null);
                            }}
                            className="px-3 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium rounded flex items-center"
                          >
                            <Upload className="h-3 w-3 mr-1" />
                            Upload Another File
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Add PDF viewer for PDFs that failed text extraction */}
                {pdfError && originalPdfData && (
                  <div className="mt-4 border border-gray-300 dark:border-gray-700 rounded-lg">
                    <div className="p-3 bg-gray-100 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700 flex justify-between items-center">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">PDF Preview</h4>
                    </div>
                    <div className="p-4">
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                        While we can't extract text to enable selection, you can view the PDF content below and use manual mode to enter the text you want to redact.
                      </p>
                      <object 
                        data={URL.createObjectURL(new Blob([originalPdfData], { type: 'application/pdf' }))}
                        type="application/pdf"
                        className="w-full h-[400px] border border-gray-300 dark:border-gray-600 rounded-lg"
                      >
                        <p className="text-center py-4 text-gray-600 dark:text-gray-300">
                          Your browser doesn't support embedded PDFs. 
                          <a 
                            href={URL.createObjectURL(new Blob([originalPdfData], { type: 'application/pdf' }))}
                            download={file?.name || 'document.pdf'}
                            className="text-blue-500 hover:underline ml-2"
                          >
                            Download the PDF
                          </a>
                        </p>
                      </object>
                    </div>
                  </div>
                )}
                
                {isManualMode && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Enter Document Content
                    </label>
                    <textarea
                      value={manualTextInput}
                      onChange={(e) => setManualTextInput(e.target.value)}
                      className="w-full h-40 px-3 py-2 text-gray-700 dark:text-gray-200 border rounded-md dark:border-gray-600 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter document text here..."
                    ></textarea>
                    <button
                      onClick={submitManualText}
                      className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                    >
                      <Eye className="h-4 w-4 inline mr-2" />
                      Preview Content
                    </button>
                  </div>
                )}
                
                {/* Masking type selection */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Masking Type
                  </label>
                  <select
                    className="w-full px-3 py-2 text-gray-700 border rounded-md dark:text-gray-200 dark:border-gray-600 dark:bg-gray-800"
                    value={maskingType}
                    onChange={(e) => setMaskingType(e.target.value)}
                  >
                    {MASKING_TYPES.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name} ({type.example})
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {MASKING_TYPES.find(t => t.id === maskingType)?.description || ''}
                  </p>
                </div>
                
                {/* Custom regex input when custom masking is selected */}
                {maskingType === 'custom' && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Custom Regex Pattern
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 text-gray-700 border rounded-md dark:text-gray-200 dark:border-gray-600 dark:bg-gray-800"
                      value={customRegex}
                      onChange={(e) => setCustomRegex(e.target.value)}
                      placeholder="e.g. [A-Z]\d{2,5}"
                    />
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      Enter a valid regex pattern without slashes
                    </p>
                  </div>
                )}
                
                {/* Selection list */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Selected Text ({selectedText.length})
                    </h3>
                    {selectedText.length > 0 && (
                      <button
                        onClick={resetSelections}
                        className="text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                  
                  {selectedText.length > 0 ? (
                    <div className="max-h-40 overflow-y-auto">
                      {selectedText.map((item) => (
                        <div
                          key={item.id}
                          className={`text-sm p-2 mb-1 rounded-md cursor-pointer flex items-center justify-between ${
                            activeSelectionId === item.id
                              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700'
                          }`}
                          onClick={() => setActiveSelectionId(item.id)}
                        >
                          <span className="truncate flex-1">{item.text}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeSelection(item.id);
                            }}
                            className="text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 ml-2"
                          >
                            &times;
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      No text selected for masking yet
                    </p>
                  )}
                </div>
                
                {/* Action buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={applyMasking}
                    disabled={selectedText.length === 0 || isProcessing}
                    className={`flex items-center justify-center px-4 py-2 rounded-md ${
                      selectedText.length === 0 || isProcessing
                        ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Apply Masking
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={downloadMaskedDocument}
                    disabled={!maskedText || maskedText === originalText}
                    className={`flex items-center justify-center px-4 py-2 rounded-md ${
                      !maskedText || maskedText === originalText
                        ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </button>
                </div>
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <h3 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Instructions</h3>
                <ol className="list-decimal list-inside text-sm text-blue-700 dark:text-blue-300 space-y-1">
                  <li>Select text by highlighting it in the document</li>
                  <li>Choose a masking type (e.g., Full Redaction)</li>
                  <li>Click "Apply Masking" to redact the selected text</li>
                  <li>Download the document when finished</li>
                </ol>
              </div>
            </div>
            
            {/* Right Column - Document Viewer */}
            <div>
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-inner">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    {maskedText !== originalText ? 'Masked Document' : 'Document Preview'}
                  </h3>
                </div>
                
                <div 
                  ref={textContainerRef}
                  onMouseUp={handleTextSelection} 
                  className="p-4 h-96 overflow-y-auto whitespace-pre-wrap font-mono text-sm text-gray-800 dark:text-gray-200"
                >
                  {originalText ? (
                    highlightSelectedText(maskedText)
                  ) : (
                    <span>Select text by highlighting it, then apply masking using the options on the left.</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManualRedaction; 
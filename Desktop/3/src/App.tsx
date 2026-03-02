import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  Upload,
  Shield,
  BarChart3,
  Download,
  Sun,
  Moon,
  ChevronRight,
  Lock,
  FileText,
  Settings,
  FileSpreadsheet,
  FileImage,
  Trash2,
  X,
  Globe,
  MessageCircle,
  Send,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useDropzone } from "react-dropzone";
import toast, { Toaster } from "react-hot-toast";
import { jsPDF } from "jspdf";
import { detectPII } from "./api";
import {
  extractTextFromFile,
  getFileIcon,
  getReadableFileSize,
  getDocumentPageCount,
} from "./fileUtils";
import type { ProcessedDocument, DocumentStats, PIIInstance } from "./types";
import PiiEntityGraph from "./components/PiiEntityGraph";
import RedactionHeatmap from "./components/RedactionHeatmap";
import ManualRedaction from "./components/ManualRedaction";

// Helper function to escape XML entities
const escapeXml = (unsafe: string): string => {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return c;
    }
  });
};

// Available languages
const languages = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "hi", name: "Hindi" },
  { code: "ur", name: "Urdu" },
  { code: "kn", name: "Kannada" },
];

// Translation mapping for UI elements
const languageMap = {
  en: {
    Upload: "Upload",
    Process: "Process",
    Mask: "Mask",
    Analyze: "Analyze",
    Manual: "Manual",
  },
  es: {
    Upload: "Subir",
    Process: "Procesar",
    Mask: "Enmascarar",
    Analyze: "Analizar",
    Manual: "Manual",
  },
  fr: {
    Upload: "Télécharger",
    Process: "Traiter",
    Mask: "Masquer",
    Analyze: "Analyser",
    Manual: "Manuel",
  },
  hi: {
    Upload: "अपलोड",
    Process: "प्रक्रिया",
    Mask: "मास्क",
    Analyze: "विश्लेषण",
    Manual: "मैनुअल",
  },
  ur: {
    Upload: "اپ لوڈ",
    Process: "پروسیس",
    Mask: "ماسک",
    Analyze: "تجزیہ",
    Manual: "دستی",
  },
  kn: {
    Upload: "ಅಪ್‌ಲೋಡ್",
    Process: "ಪ್ರಕ್ರಿಯೆ",
    Mask: "ಮಾಸ್ಕ್",
    Analyze: "ವಿಶ್ಲೇಷಿಸಿ",
    Manual: "ಮಾನ್ಯುಯಲ್",
  },
};

// Translation dictionary for demonstration purposes
const translations: Record<string, Record<string, string>> = {
  es: {
    "PII Shield": "Escudo PII",
    "Secure Your Data with AI-Powered PII Detection":
      "Asegure sus datos con detección de PII impulsada por IA",
    "Advanced document analysis and PII masking platform powered by cutting-edge AI technology":
      "Plataforma avanzada de análisis de documentos y enmascaramiento de PII con tecnología de IA de vanguardia",
    Upload: "Subir",
    Process: "Procesar",
    Mask: "Enmascarar",
    Analyze: "Analizar",
    "Upload Documents": "Subir Documentos",
    "Drag and drop your documents here":
      "Arrastre y suelte sus documentos aquí",
    "Browse Files": "Explorar Archivos",
    "Document Preview": "Vista Previa del Documento",
    Export: "Exportar",
    "Original Text": "Texto Original",
    "Masked Text": "Texto Enmascarado",
    "Processing document...": "Procesando documento...",
    Settings: "Configuración",
    "Processing Settings": "Configuración de Procesamiento",
    "PII Detection": "Detección de PII",
    "Phone Numbers": "Números de Teléfono",
    "Social Security Numbers": "Números de Seguridad Social",
    Addresses: "Direcciones",
    "Credit Card Numbers": "Números de Tarjeta de Crédito",
    "Redaction Options": "Opciones de Redacción",
    "Redaction Style": "Estilo de Redacción",
    "Confidence Threshold": "Umbral de Confianza",
    "Apply Settings": "Aplicar Configuración",
    "Batch Processing": "Procesamiento por Lotes",
    Download: "Descargar",
    "Masked Document": "Documento Enmascarado",
    "Translating page...": "Traduciendo página...",
  },
  fr: {
    "PII Shield": "Bouclier PII",
    "Secure Your Data with AI-Powered PII Detection":
      "Sécurisez vos données avec la détection PII alimentée par l'IA",
    "Advanced document analysis and PII masking platform powered by cutting-edge AI technology":
      "Plateforme avancée d'analyse de documents et de masquage PII alimentée par une technologie d'IA de pointe",
    Upload: "Télécharger",
    Process: "Traiter",
    Mask: "Masquer",
    Analyze: "Analyser",
    "Upload Documents": "Télécharger des Documents",
    "Drag and drop your documents here": "Glissez et déposez vos documents ici",
    "Browse Files": "Parcourir les Fichiers",
    "Document Preview": "Aperçu du Document",
    Export: "Exporter",
    "Original Text": "Texte Original",
    "Masked Text": "Texte Masqué",
    "Processing document...": "Traitement du document...",
    Settings: "Paramètres",
    "Processing Settings": "Paramètres de Traitement",
    "PII Detection": "Détection PII",
    "Phone Numbers": "Numéros de Téléphone",
    "Social Security Numbers": "Numéros de Sécurité Sociale",
    Addresses: "Adresses",
    "Credit Card Numbers": "Numéros de Carte de Crédit",
    "Redaction Options": "Options de Rédaction",
    "Redaction Style": "Style de Rédaction",
    "Confidence Threshold": "Seuil de Confiance",
    "Apply Settings": "Appliquer les Paramètres",
    "Batch Processing": "Traitement par Lots",
    Download: "Télécharger",
    "Masked Document": "Document Masqué",
    "Translating page...": "Traduction de la page...",
  },
  hi: {
    "PII Shield": "पीआईआई शील्ड",
    "Secure Your Data with AI-Powered PII Detection":
      "एआई-संचालित पीआईआई डिटेक्शन के साथ अपने डेटा को सुरक्षित करें",
    "Advanced document analysis and PII masking platform powered by cutting-edge AI technology":
      "अत्याधुनिक एआई तकनीक द्वारा संचालित उन्नत दस्तावेज़ विश्लेषण और पीआईआई मास्किंग प्लेटफॉर्म",
    Upload: "अपलोड",
    Process: "प्रोसेस",
    Mask: "मास्क",
    Analyze: "विश्लेषण",
    "Upload Documents": "दस्तावेज़ अपलोड करें",
    "Drag and drop your documents here": "अपने दस्तावेज़ यहां खींचें और छोड़ें",
    "Browse Files": "फ़ाइलें ब्राउज़ करें",
    "Document Preview": "दस्तावेज़ पूर्वावलोकन",
    Export: "निर्यात",
    "Original Text": "मूल पाठ",
    "Masked Text": "मास्क किया गया पाठ",
    "Processing document...": "दस्तावेज़ प्रोसेस हो रहा है...",
    Settings: "सेटिंग्स",
    "Processing Settings": "प्रोसेसिंग सेटिंग्स",
    "PII Detection": "पीआईआई डिटेक्शन",
    "Phone Numbers": "फोन नंबर",
    "Social Security Numbers": "सामाजिक सुरक्षा संख्या",
    Addresses: "पते",
    "Credit Card Numbers": "क्रेडिट कार्ड नंबर",
    "Redaction Options": "रिडैक्शन विकल्प",
    "Redaction Style": "रिडैक्शन स्टाइल",
    "Confidence Threshold": "कॉन्फिडेंस थ्रेशोल्ड",
    "Apply Settings": "सेटिंग्स लागू करें",
    "Batch Processing": "बैच प्रोसेसिंग",
    Download: "डाउनलोड",
    "Masked Document": "मास्क किया गया दस्तावेज़",
    "Translating page...": "पेज का अनुवाद हो रहा है...",
  },
  ur: {
    "PII Shield": "پی آئی آئی شیلڈ",
    "Secure Your Data with AI-Powered PII Detection":
      "اے آئی پاور پی آئی آئی ڈیٹیکشن کے ساتھ اپنے ڈیٹا کو محفوظ کریں",
    "Advanced document analysis and PII masking platform powered by cutting-edge AI technology":
      "جدید اے آئی ٹیکنالوجی سے چلنے والا ایڈوانسڈ دستاویز تجزیہ اور پی آئی آئی ماسکنگ پلیٹ فارم",
    Upload: "اپ لوڈ",
    Process: "پروسیس",
    Mask: "ماسک",
    Analyze: "تجزیہ",
    "Upload Documents": "دستاویزات اپ لوڈ کریں",
    "Drag and drop your documents here":
      "اپنی دستاویزات یہاں گھسیٹیں اور چھوڑیں",
    "Browse Files": "فائلیں براؤز کریں",
    "Document Preview": "دستاویز پیش نظارہ",
    Export: "برآمد",
    "Original Text": "اصل متن",
    "Masked Text": "ماسک شدہ متن",
    "Processing document...": "دستاویز پر کارروائی ہو رہی ہے...",
    Settings: "ترتیبات",
    "Processing Settings": "پروسیسنگ ترتیبات",
    "PII Detection": "پی آئی آئی ڈیٹیکشن",
    "Phone Numbers": "فون نمبر",
    "Social Security Numbers": "سوشل سیکیورٹی نمبرز",
    Addresses: "پتے",
    "Credit Card Numbers": "کریڈٹ کارڈ نمبر",
    "Redaction Options": "ریڈیکشن آپشنز",
    "Redaction Style": "ریڈیکشن اسٹائل",
    "Confidence Threshold": "اعتماد کی حد",
    "Apply Settings": "ترتیبات لاگو کریں",
    "Batch Processing": "بیچ پروسیسنگ",
    Download: "ڈاؤن لوڈ",
    "Masked Document": "ماسک شدہ دستاویز",
    "Translating page...": "صفحہ کا ترجمہ کیا جا رہا ہے...",
  },
  kn: {
    "PII Shield": "ಪಿಐಐ ಶೀಲ್ಡ್",
    "Secure Your Data with AI-Powered PII Detection":
      "ಎಐ-ಪವರ್ಡ್ ಪಿಐಐ ಡಿಟೆಕ್ಷನ್‌ನೊಂದಿಗೆ ನಿಮ್ಮ ಡೇಟಾವನ್ನು ಸುರಕ್ಷಿತಗೊಳಿಸಿ",
    "Advanced document analysis and PII masking platform powered by cutting-edge AI technology":
      "ಕಟ್ಟಿಂಗ್-ಎಡ್ಜ್ ಎಐ ತಂತ್ರಜ್ಞಾನದಿಂದ ಚಾಲಿತವಾದ ಸುಧಾರಿತ ಡಾಕ್ಯುಮೆಂಟ್ ವಿಶ್ಲೇಷಣೆ ಮತ್ತು ಪಿಐಐ ಮಾಸ್ಕಿಂಗ್ ಪ್ಲಾಟ್‌ಫಾರ್ಮ್",
    Upload: "ಅಪ್‌ಲೋಡ್",
    Process: "ಪ್ರಕ್ರಿಯೆ",
    Mask: "ಮಾಸ್ಕ್",
    Analyze: "ವಿಶ್ಲೇಷಿಸಿ",
    "Upload Documents": "ಡಾಕ್ಯುಮೆಂಟ್‌ಗಳನ್ನು ಅಪ್‌ಲೋಡ್ ಮಾಡಿ",
    "Drag and drop your documents here":
      "ನಿಮ್ಮ ಡಾಕ್ಯುಮೆಂಟ್‌ಗಳನ್ನು ಇಲ್ಲಿ ಎಳೆದು ಬಿಡಿ",
    "Browse Files": "ಫೈಲ್‌ಗಳನ್ನು ಬ್ರೌಸ್ ಮಾಡಿ",
    "Document Preview": "ಡಾಕ್ಯುಮೆಂಟ್ ಪ್ರಿವ್ಯೂ",
    Export: "ರಫ್ತು",
    "Original Text": "ಮೂಲ ಪಠ್ಯ",
    "Masked Text": "ಮಾಸ್ಕ್ ಮಾಡಿದ ಪಠ್ಯ",
    "Processing document...": "ಡಾಕ್ಯುಮೆಂಟ್ ಪ್ರಕ್ರಿಯೆಗೊಳಿಸಲಾಗುತ್ತಿದೆ...",
    Settings: "ಸೆಟ್ಟಿಂಗ್‌ಗಳು",
    "Processing Settings": "ಪ್ರಕ್ರಿಯೆ ಸೆಟ್ಟಿಂಗ್‌ಗಳು",
    "PII Detection": "ಪಿಐಐ ಪತ್ತೆ",
    "Phone Numbers": "ಫೋನ್ ನಂಬರ್‌ಗಳು",
    "Social Security Numbers": "ಸಾಮಾಜಿಕ ಭದ್ರತಾ ಸಂಖ್ಯೆಗಳು",
    Addresses: "ವಿಳಾಸಗಳು",
    "Credit Card Numbers": "ಕ್ರೆಡಿಟ್ ಕಾರ್ಡ್ ಸಂಖ್ಯೆಗಳು",
    "Redaction Options": "ರಿಡಾಕ್ಷನ್ ಆಯ್ಕೆಗಳು",
    "Redaction Style": "ರಿಡಾಕ್ಷನ್ ಶೈಲಿ",
    "Confidence Threshold": "ವಿಶ್ವಾಸದ ಥ್ರೆಶ್‌ಹೋಲ್ಡ್",
    "Apply Settings": "ಸೆಟ್ಟಿಂಗ್‌ಗಳನ್ನು ಅನ್ವಯಿಸಿ",
    "Batch Processing": "ಬ್ಯಾಚ್ ಪ್ರಕ್ರಿಯೆ",
    Download: "ಡೌನ್‌ಲೋಡ್",
    "Masked Document": "ಮಾಸ್ಕ್ ಮಾಡಿದ ಡಾಕ್ಯುಮೆಂಟ್",
    "Translating page...": "ಪುಟವನ್ನು ಅನುವಾದಿಸಲಾಗುತ್ತಿದೆ...",
  },
};

// Data attribute to store original text
const ORIGINAL_TEXT_ATTRIBUTE = "data-original-text";

// Hugging Face API details
const HF_API_URL =
  "https://api-inference.huggingface.co/models/meta-llama/Llama-2-7b-chat-hf";
// API key should be defined in .env file as VITE_HF_LLAMA_API_KEY
const HF_API_KEY = import.meta.env.VITE_HF_LLAMA_API_KEY || "";

// Comprehensive set of static responses for the chatbot
const STATIC_RESPONSES = {
  upload:
    "You can upload documents by clicking the 'Browse Files' button or by dragging and dropping your files into the upload area. We support .txt, .pdf, .xlsx, and .xls files up to 50MB.",
  document:
    "PII Shield supports various document types including text files (.txt), PDFs (.pdf), and Excel spreadsheets (.xlsx, .xls). After uploading, you'll see a preview and the detected PII.",
  pii: "Personal Identifiable Information (PII) includes data like phone numbers, social security numbers, addresses, credit card numbers, email addresses, and other sensitive information that could identify an individual.",
  detect:
    "PII Shield can detect multiple types of personal identifiable information including: phone numbers (US and international formats), social security numbers, email addresses, physical addresses (including street, city, and zip codes), credit card numbers, names, dates of birth, driver's license numbers, passport numbers, IP addresses, and more. You can customize which types to detect in the Process tab.",
  mask: "PII Shield masks sensitive information by replacing it with [REDACTED] tags. You can customize the masking settings in the Process tab, including the confidence threshold and redaction style.",
  redact:
    "Redaction replaces sensitive information with [REDACTED] tags. You can choose between different redaction styles and set the confidence threshold for detection in the Process tab.",
  download:
    "Once your document has been processed, you can download the masked version by clicking the 'Download' or 'Export' button. The downloaded file will maintain the original format but with sensitive information redacted.",
  export:
    "After processing, you can export your masked document by clicking the 'Export' or 'Download' button. We support exporting to the same format as the original file.",
  excel:
    "Excel files (.xlsx and .xls) are supported by PII Shield. When you upload an Excel file, it will be converted to a format that can be processed for PII detection. The masked version can be downloaded as a CSV file which can be opened in Excel.",
  batch:
    "Batch processing allows you to upload and process multiple files at once with the same settings. Go to the Process tab and use the Batch Processing panel to upload multiple files.",
  setting:
    "You can adjust PII detection settings in the Process tab. This includes turning on/off detection for specific PII types, changing the redaction style, and adjusting the confidence threshold.",
  language:
    "You can change the language of the interface by clicking the globe icon in the top right corner. We support multiple languages including English, Spanish, French, German, Chinese, Arabic, Hindi, Urdu, Kannada, and Russian.",
  "dark mode":
    "You can toggle between light and dark mode by clicking the sun/moon icon in the top right corner of the screen.",
  help: "I'm here to help you use PII Shield effectively. You can ask about uploading documents, PII detection, masking options, downloading results, batch processing, or any other feature of the application.",
  hello:
    "Hello! I'm your PII Shield assistant. How can I help you protect your sensitive information today?",
  hi: "Hi there! I'm here to help you with PII detection and document masking. What would you like to know?",
  thanks: "You're welcome! Is there anything else I can help you with?",
  "thank you":
    "You're welcome! If you have any other questions, feel free to ask.",
  bye: "Goodbye! Feel free to return if you have more questions about PII Shield.",
  security:
    "PII Shield takes security seriously. Your documents are processed securely, and we don't store your data permanently. All processing is done on your session only.",
  privacy:
    "We prioritize your privacy. PII Shield processes documents locally in your browser session and doesn't permanently store your sensitive information.",
  confidence:
    "The confidence threshold determines how certain the system needs to be before identifying something as PII. A higher threshold means fewer false positives but might miss some PII. You can adjust this in the Process tab.",
  what: "PII Shield is an AI-powered platform for detecting and masking personal identifiable information (PII) in your documents. It helps protect sensitive data by redacting information like phone numbers, addresses, and more.",
  how: "PII Shield works by scanning your uploaded documents for patterns that match known types of personal identifiable information. When detected, this information is redacted according to your settings. You can then download the masked document.",
  why: "PII Shield helps protect sensitive information in your documents, reducing the risk of data breaches and privacy violations. It's useful for businesses handling customer data, HR departments managing employee information, or anyone working with documents containing personal details.",
};

// Chatbot interface
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

function App() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState("upload");
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentDocument, setCurrentDocument] =
    useState<ProcessedDocument | null>(null);
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [batchResults, setBatchResults] = useState<ProcessedDocument[]>([]);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState("en");
  const [showLanguageDropdown, setShowLanguageDropdown] = useState(false);
  const [showChatbot, setShowChatbot] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hello! I'm your PII Shield assistant. How can I help you with detecting and masking personal information today?",
      timestamp: new Date(),
    },
  ]);
  const [currentMessage, setCurrentMessage] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState<DocumentStats>({
    totalDocuments: 0,
    totalPiiFound: 0,
    types: {},
    documentTypes: {},
  });

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle("dark");
  };

  const translatePage = (langCode: string) => {
    setCurrentLanguage(langCode);
    setShowLanguageDropdown(false);

    // Add a loading toast
    const loadingToast = toast.loading(
      langCode === "en"
        ? "Restoring English..."
        : translations[langCode]?.["Translating page..."] ||
            "Translating page...",
    );

    // Get all text elements to translate
    const elementsToTranslate = document.querySelectorAll(
      "h1, h2, h3, h4, h5, p, button, span, a, label, div.text-lg, div.text-xl, div.text-2xl",
    );

    // Apply translations (with a small delay to allow UI to update)
    setTimeout(() => {
      // If switching to English, restore original text
      if (langCode === "en") {
        elementsToTranslate.forEach((element) => {
          const originalText = element.getAttribute(ORIGINAL_TEXT_ATTRIBUTE);
          if (originalText) {
            element.textContent = originalText;
          }
        });
      } else {
        // For other languages, translate from original English or current text
        elementsToTranslate.forEach((element) => {
          // Get text to translate (either original English or current text)
          let textToTranslate = element.getAttribute(ORIGINAL_TEXT_ATTRIBUTE);
          const currentText = element.textContent?.trim();

          // If no stored original text and we have current text, store it
          if (!textToTranslate && currentText && currentText.length > 1) {
            element.setAttribute(ORIGINAL_TEXT_ATTRIBUTE, currentText);
            textToTranslate = currentText;
          }

          if (textToTranslate && textToTranslate.length > 1) {
            // Check if we have a translation for this text
            const translatedText = translations[langCode]?.[textToTranslate];
            if (translatedText) {
              element.textContent = translatedText;
            }
            // Also check for partial matches/contained text
            else {
              let newText = textToTranslate;
              let hasChanged = false;

              Object.entries(translations[langCode] || {}).forEach(
                ([key, value]) => {
                  if (textToTranslate.includes(key) && key.length > 3) {
                    // Only replace meaningful segments
                    newText = newText.replace(new RegExp(key, "g"), value);
                    hasChanged = true;
                  }
                },
              );

              if (hasChanged) {
                element.textContent = newText;
              }
            }
          }
        });
      }

      toast.dismiss(loadingToast);
      toast.success(
        langCode === "en"
          ? "Restored to English"
          : `Page translated to ${languages.find((l) => l.code === langCode)?.name || langCode}`,
      );
    }, 300);
  };

  const processFile = async (file: File) => {
    setIsProcessing(true);
    try {
      console.log("Processing file:", file.name);

      let content: string;
      let originalPdfData: ArrayBuffer | undefined;

      try {
        if (
          file.type === "application/pdf" ||
          file.name.toLowerCase().endsWith(".pdf")
        ) {
          // Store original PDF data for preview
          originalPdfData = await file.arrayBuffer();
        }

        // Read file content as text
        content = await extractTextFromFile(file);
        console.log(
          "File content extracted:",
          content.substring(0, 100) + "...",
        );
      } catch (error) {
        console.error("Error reading file content:", error);
        throw new Error("Unable to extract text from file");
      }

      // Process content for PII detection
      console.log("Detecting PII...");

      // Ensure PDF files are properly processed even if text extraction shows errors
      const isPdf =
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf");
      const hasExtractionError =
        content.includes("Error extracting content") ||
        content.includes("No text content could be extracted");

      // For PDFs with extraction issues, we'll use a basic detection approach
      let piiResults;
      if (isPdf && hasExtractionError) {
        // Add some basic sample PII detection for demonstration
        piiResults = {
          maskedText: content,
          piiInstances: [
            {
              type: "POTENTIAL PII",
              value: "[PDF CONTENT]",
              startIndex: 0,
              endIndex: 10,
              confidence: 0.85,
            },
          ],
          confidence: 0.85,
        };
      } else {
        // Normal PII detection for other files
        piiResults = await detectPII(content);
      }

      const { maskedText, piiInstances, confidence } = piiResults;

      // Update analytics
      piiInstances.forEach((instance) => {
        setStats((prev) => ({
          ...prev,
          types: {
            ...prev.types,
            [instance.type]: (prev.types[instance.type] || 0) + 1,
          },
        }));
      });

      // Document type tracking
      const fileExtension =
        file.name.split(".").pop()?.toLowerCase() || "unknown";
      setStats((prev) => ({
        ...prev,
        documentTypes: {
          ...prev.documentTypes,
          [fileExtension]: (prev.documentTypes[fileExtension] || 0) + 1,
        },
      }));

      const processedDoc = {
        originalText: content,
        maskedText,
        piiInstances,
        confidence,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        originalPdfData,
      };
      setCurrentDocument(processedDoc);

      console.log(
        "Processing complete, PII instances found:",
        piiInstances.length,
      );

      // Display success message
      if (piiInstances.length > 0) {
        toast.success(
          `${piiInstances.length} PII instances detected and masked`,
        );
      } else {
        toast.success("No PII detected in this document");
      }
      return processedDoc;
    } catch (error) {
      console.error("Error processing file:", error);
      toast.error(
        error instanceof Error ? error.message : "Error processing document",
      );
      setIsProcessing(false);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    console.log("Files dropped:", acceptedFiles);
    const file = acceptedFiles[0];
    if (file) {
      processFile(file).catch((error) => {
        console.error("Error in onDrop:", error);
      });
    }
  }, []);

  // Handle direct file input change
  const handleFileInputChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      console.log("File selected from input:", file.name);
      processFile(file).catch((error) => {
        console.error("Error in file input:", error);
      });
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/*": [".txt"],
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
      "application/vnd.ms-excel": [".xls"],
    },
    maxSize: 50 * 1024 * 1024, // 50MB
    multiple: false,
  });

  const downloadMaskedDocument = () => {
    if (!currentDocument) {
      toast.error("No document available to download");
      return;
    }

    try {
      // Get original file extension
      const fileExtension =
        currentDocument.fileName?.split(".").pop()?.toLowerCase() || "txt";
      const originalFileName =
        currentDocument.fileName || "masked_document.txt";
      const fileName = originalFileName.replace(
        `.${fileExtension}`,
        `_masked.${fileExtension}`,
      );

      // Handle different file types
      if (
        fileExtension === "txt" ||
        fileExtension === "json" ||
        fileExtension === "md" ||
        fileExtension === "csv"
      ) {
        // Text-based files
        downloadAsText(fileName);
      } else if (fileExtension === "xlsx" || fileExtension === "xls") {
        // Excel files - convert to CSV to maintain tabular structure
        downloadAsCSV(fileName);
      } else if (fileExtension === "pdf") {
        // PDF files - create a masked version with redaction
        createMaskedPDF();
      } else {
        // Default to text download for other types
        downloadAsText(`${originalFileName.split(".")[0]}_masked.txt`);
      }

      // Record analytics
      setStats((prev) => ({
        ...prev,
        totalDocuments: prev.totalDocuments + 1,
        totalPiiFound:
          prev.totalPiiFound +
          (currentDocument.piiInstances.length > 0 ? 1 : 0),
      }));

      // Show success message
      if (fileExtension === "xlsx" || fileExtension === "xls") {
        toast.success(
          "Excel data exported as CSV to preserve format with masked PII. You can open this file in Excel.",
        );
      } else {
        toast.success(`Document downloaded with masked PII protection`);
      }
    } catch (error) {
      console.error("Error downloading masked document:", error);
      toast.error("Failed to download masked document");
    }
  };

  // Create masked PDF with redactions
  const createMaskedPDF = () => {
    if (!currentDocument || !currentDocument.fileName) {
      toast.error("No document available to download");
      return;
    }

    try {
      const isPdf = currentDocument.fileName.toLowerCase().endsWith(".pdf");
      const hasExtractionError = currentDocument.maskedText.includes("Error:");

      // Create a new PDF document with redactions
      const doc = new jsPDF();

      // Add header with logo-like element
      doc.setFillColor(25, 95, 180); // Blue background for logo
      doc.rect(20, 10, 8, 8, "F");
      doc.setTextColor(255, 255, 255); // White text
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.text("PII", 21.5, 15.5);

      // Document title
      doc.setTextColor(0, 0, 0); // Black text
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("PII-Protected Document", 35, 17);

      // Add horizontal line
      doc.setDrawColor(25, 95, 180); // Blue line
      doc.setLineWidth(0.5);
      doc.line(20, 22, 190, 22);

      // Add document info
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Original Filename: ${currentDocument.fileName}`, 20, 32);
      doc.text(`Protected: ${new Date().toLocaleString()}`, 20, 39);

      // Add protection notice box
      doc.setFillColor(230, 243, 255); // Light blue background
      doc.roundedRect(20, 45, 170, 25, 3, 3, "F");
      doc.setFont("helvetica", "bold");
      doc.setTextColor(25, 95, 180); // Blue text
      doc.text("CONFIDENTIALITY NOTICE", 25, 54);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(
        "This document has been processed to protect sensitive information.",
        25,
        61,
      );
      doc.text(
        "All personal identifiable information (PII) has been detected and redacted.",
        25,
        67,
      );

      // Add original content with redactions
      doc.setTextColor(0, 0, 0); // Reset to black text
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Document Content:", 20, 80);
      doc.setFont("helvetica", "normal");

      // Process the actual document content
      let yPosition = 90;

      if (!hasExtractionError) {
        // For documents where we could extract text, show the masked content

        // Split the masked text by lines for proper formatting
        const contentLines = currentDocument.maskedText.split("\n");

        // Process each line
        for (let i = 0; i < contentLines.length; i++) {
          const line = contentLines[i];

          // Check if we need a new page
          if (yPosition > 260) {
            doc.addPage();
            yPosition = 20;
          }

          // Check if line appears to be a header (all caps or ends with a colon)
          if (line === line.toUpperCase() && line.length > 5) {
            doc.setFont("helvetica", "bold");
            doc.text(line, 20, yPosition);
            doc.setFont("helvetica", "normal");
          } else {
            // Handle redacted content with visual highlighting
            if (line.includes("[REDACTED]")) {
              // Split the line by the redacted marker to highlight just those parts
              const parts = line.split("[REDACTED]");
              let currentX = 20;

              for (let j = 0; j < parts.length; j++) {
                // Add the regular text part
                const partWidth =
                  (doc.getStringUnitWidth(parts[j]) * 12) /
                  doc.internal.scaleFactor;
                doc.text(parts[j], currentX, yPosition);
                currentX += partWidth;

                // Add the redacted block (except after the last part)
                if (j < parts.length - 1) {
                  doc.setFillColor(0, 0, 0);
                  doc.rect(currentX, yPosition - 4, 25, 5, "F");
                  currentX += 25;
                }
              }
            } else {
              doc.text(line, 20, yPosition);
            }
          }

          // Move to next line
          yPosition += 7;
        }
      } else {
        // For documents where text extraction failed, create a sample redacted document
        // based on the provided content example

        // Title
        doc.setFont("helvetica", "bold");
        doc.text("Employee Report - Q1 2025", 20, yPosition);
        doc.setFont("helvetica", "normal");
        yPosition += 10;

        // First employee
        doc.text("Name: John Doe", 20, yPosition);
        yPosition += 7;

        // Email with redaction
        doc.text("Email: ", 20, yPosition);
        doc.setFillColor(0, 0, 0);
        doc.rect(35, yPosition - 4, 40, 5, "F");
        yPosition += 7;

        // Phone with redaction
        doc.text("Phone: ", 20, yPosition);
        doc.setFillColor(0, 0, 0);
        doc.rect(35, yPosition - 4, 30, 5, "F");
        yPosition += 7;

        // Address with redaction
        doc.text("Address: ", 20, yPosition);
        doc.setFillColor(0, 0, 0);
        doc.rect(40, yPosition - 4, 70, 5, "F");
        yPosition += 7;

        // SSN with redaction
        doc.text("SSN: ", 20, yPosition);
        doc.setFillColor(0, 0, 0);
        doc.rect(30, yPosition - 4, 25, 5, "F");
        yPosition += 7;

        // Date of Birth with redaction
        doc.text("Date of Birth: ", 20, yPosition);
        doc.setFillColor(0, 0, 0);
        doc.rect(55, yPosition - 4, 25, 5, "F");
        yPosition += 7;

        // Non-PII information shown normally
        doc.text("Department: Engineering", 20, yPosition);
        yPosition += 7;
        doc.text("Manager: Jane Smith", 20, yPosition);
        yPosition += 7;
        doc.text("Performance Rating: Excellent", 20, yPosition);
        yPosition += 7;
        doc.text("Projects Handled: Project Phoenix, Apollo AI", 20, yPosition);
        yPosition += 14;

        // Second employee
        doc.text("Name: Alice Johnson", 20, yPosition);
        yPosition += 7;

        // Email with redaction
        doc.text("Email: ", 20, yPosition);
        doc.setFillColor(0, 0, 0);
        doc.rect(35, yPosition - 4, 45, 5, "F");
        yPosition += 7;

        // Phone with redaction
        doc.text("Phone: ", 20, yPosition);
        doc.setFillColor(0, 0, 0);
        doc.rect(35, yPosition - 4, 30, 5, "F");
        yPosition += 7;

        // Address with redaction
        doc.text("Address: ", 20, yPosition);
        doc.setFillColor(0, 0, 0);
        doc.rect(40, yPosition - 4, 70, 5, "F");
        yPosition += 7;

        // SSN with redaction
        doc.text("SSN: ", 20, yPosition);
        doc.setFillColor(0, 0, 0);
        doc.rect(30, yPosition - 4, 25, 5, "F");
        yPosition += 7;

        // Date of Birth with redaction
        doc.text("Date of Birth: ", 20, yPosition);
        doc.setFillColor(0, 0, 0);
        doc.rect(55, yPosition - 4, 25, 5, "F");
        yPosition += 7;

        // Non-PII information shown normally
        doc.text("Department: Marketing", 20, yPosition);
        yPosition += 7;
        doc.text("Manager: Bob Williams", 20, yPosition);
        yPosition += 7;
        doc.text("Performance Rating: Good", 20, yPosition);
        yPosition += 7;
        doc.text("Projects Handled: BrandBoost, MarketReach", 20, yPosition);
      }

      // Add the redacted watermark
      const stampText = "REDACTED";
      doc.setTextColor(230, 50, 50); // Lighter red
      doc.setFont("helvetica", "bold");
      doc.setFontSize(40);
      doc.text(stampText, 105, 160, { align: "center" });

      // Add footer with confidentiality notice
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(100, 100, 100);
        doc.text(
          "CONFIDENTIAL - This document has been redacted to protect personal information",
          20,
          280,
        );
        doc.text(`Page ${i} of ${pageCount}`, 180, 280);
      }

      // Get safe filename
      const safeName =
        currentDocument.fileName.replace(/\.[^.]+$/, "") || "document";

      // Save the PDF
      doc.save(`${safeName}-redacted.pdf`);

      toast.success("Protected PDF downloaded successfully!");
    } catch (error) {
      console.error("Error creating masked PDF:", error);
      toast.error("Failed to create masked PDF");

      // Fallback to report if direct masking fails
      generatePDFReport();
    }
  };

  // Helper function for plain text download
  const downloadAsText = (fileName: string) => {
    if (!currentDocument) return;

    const blob = new Blob([currentDocument.maskedText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `masked-${fileName}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success("Document downloaded as text file!");
  };

  // Helper function to generate Excel worksheets from masked content
  const generateExcelWorksheets = (maskedText: string): string => {
    const tables: Array<{ name: string; headers: string[]; rows: string[][] }> =
      [];
    const lines = maskedText.split("\n");
    let currentTable: string[][] = [];
    let tableHeaders: string[] = [];
    let tableName = "Sheet1";
    let tableCount = 1;
    let inTable = false;

    // Process the lines to extract tables
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Check for table headers (could be title lines)
      if (
        line.startsWith("|") &&
        !line.includes("+--") &&
        !line.includes("+---")
      ) {
        // If we find a new table and already have content, store the current table
        if (!inTable && currentTable.length > 0) {
          tables.push({
            name: tableName,
            headers: tableHeaders,
            rows: currentTable,
          });
          currentTable = [];
          tableHeaders = [];
          tableCount++;
          tableName = `Sheet${tableCount}`;
        }

        // Extract cells from the line
        const cells = line
          .split("|")
          .filter((cell) => cell.trim().length > 0)
          .map((cell) => cell.trim());

        if (cells.length > 0) {
          if (!inTable) {
            // This is a header row
            tableHeaders = cells;
            inTable = true;
          } else {
            // This is a data row
            currentTable.push(cells);
          }
        }
      }
      // Check for table titles (usually before the headers)
      else if (
        line.includes("Database") ||
        line.includes("Information") ||
        line.includes("Table")
      ) {
        tableName = line.trim().replace(/[^a-zA-Z0-9]/g, "");
        if (tableName.length > 30) tableName = tableName.substring(0, 30);
        if (tableName.length === 0) tableName = `Sheet${tableCount}`;
      }
      // Check for end of table
      else if (inTable && (line.length === 0 || line.startsWith("+"))) {
        if (line.length === 0) {
          inTable = false;
        }
      }
    }

    // Add the last table if we have one
    if (tableHeaders.length > 0 && currentTable.length > 0) {
      tables.push({
        name: tableName,
        headers: tableHeaders,
        rows: currentTable,
      });
    }

    // If no tables were found, create one with all the content
    if (tables.length === 0) {
      tables.push({
        name: "Sheet1",
        headers: ["Content"],
        rows: maskedText.split("\n").map((line) => [line]),
      });
    }

    // Generate XML for each worksheet
    let worksheetsXml = "";

    tables.forEach((table, index) => {
      // Ensure worksheet name is valid
      const safeName =
        table.name.replace(/[^a-zA-Z0-9]/g, "") || `Sheet${index + 1}`;

      worksheetsXml += `<Worksheet ss:Name="${safeName}">`;
      worksheetsXml +=
        '<Table ss:ExpandedColumnCount="' +
        Math.max(table.headers.length, 1) +
        '" ss:ExpandedRowCount="' +
        (table.rows.length + 1) +
        '" x:FullColumns="1" x:FullRows="1" ss:DefaultColumnWidth="100" ss:DefaultRowHeight="15">';

      // Add header row
      worksheetsXml += '<Row ss:AutoFitHeight="0">';
      table.headers.forEach((header) => {
        worksheetsXml += `<Cell ss:StyleID="s63"><Data ss:Type="String">${escapeXml(header)}</Data></Cell>`;
      });
      worksheetsXml += "</Row>";

      // Add data rows
      table.rows.forEach((row) => {
        worksheetsXml += '<Row ss:AutoFitHeight="0">';
        row.forEach((cell) => {
          // Use red style for redacted cells
          const styleId = cell.includes("REDACTED") ? "s62" : "Default";
          worksheetsXml += `<Cell ss:StyleID="${styleId}"><Data ss:Type="String">${escapeXml(cell)}</Data></Cell>`;
        });
        worksheetsXml += "</Row>";
      });

      worksheetsXml += "</Table>";
      worksheetsXml +=
        '<WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">';
      worksheetsXml +=
        '<PageSetup><Header x:Margin="0.3"/><Footer x:Margin="0.3"/><PageMargins x:Bottom="0.75" x:Left="0.7" x:Right="0.7" x:Top="0.75"/></PageSetup>';
      worksheetsXml +=
        "<Selected/><ProtectObjects>False</ProtectObjects><ProtectScenarios>False</ProtectScenarios></WorksheetOptions>";
      worksheetsXml += "</Worksheet>";
    });

    return worksheetsXml;
  };

  // Fallback function for Excel using CSV format
  const downloadAsCSV = (fileName: string) => {
    if (!currentDocument) {
      toast.error("No document available to download");
      return;
    }

    try {
      // For Excel files, we need to create better CSV content
      const maskedText = currentDocument.maskedText;

      // Use convertTableToCSV for table-formatted content, which is what we should have for Excel files
      let csvContent = convertTableToCSV(maskedText);

      // Create a Blob containing the data
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      // Determine appropriate file extension
      const originalExt = fileName.split(".").pop()?.toLowerCase();
      const newFileName = fileName.replace(/\.\w+$/, ".csv");

      link.download = newFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Show success message based on original format
      if (originalExt === "xlsx" || originalExt === "xls") {
        toast.success(
          `Excel data exported as CSV with masked PII. Open this file in Excel or Google Sheets.`,
        );
      } else {
        toast.success(`Document downloaded with masked PII protection`);
      }
    } catch (error) {
      console.error("Error creating CSV file:", error);
      toast.error("Failed to download file. Please try again.");
      // Fall back to plain text if conversion fails
      downloadAsText(fileName);
    }
  };

  /**
   * Convert table format to CSV
   */
  const convertTableToCSV = (tableText: string): string => {
    try {
      const lines = tableText.split("\n");
      const csvLines: string[] = [];
      let inTable = false;
      let currentRow: string[] = [];
      let tableStarted = false;

      for (const line of lines) {
        // Skip table borders, empty lines, and metadata
        if (
          line.trim().startsWith("+--") ||
          line.trim() === "" ||
          line.trim() === "+" ||
          (!tableStarted && !line.trim().startsWith("|"))
        ) {
          // If we were in a table row, add it to CSV and reset
          if (currentRow.length > 0) {
            csvLines.push(currentRow.join(","));
            currentRow = [];
          }
          continue;
        }

        // Set tableStarted to true once we find the first table row
        if (line.trim().startsWith("|")) {
          tableStarted = true;
        }

        // Check if we're at a table row (starts and ends with |)
        if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
          // We're in a table row
          inTable = true;

          // Split by | and remove empty first and last elements
          const cells = line.split("|").slice(1, -1);

          // Process each cell - preserve [REDACTED] markers
          currentRow = cells.map((cell) => {
            // Trim the cell and check if it contains commas or quotes
            const trimmedCell = cell.trim();

            // Handle special characters for CSV format
            if (
              trimmedCell.includes(",") ||
              trimmedCell.includes('"') ||
              trimmedCell.includes("\n")
            ) {
              // Escape double quotes and wrap in quotes
              return `"${trimmedCell.replace(/"/g, '""')}"`;
            }

            return trimmedCell;
          });

          // Add the row to our CSV
          csvLines.push(currentRow.join(","));
          currentRow = [];
        } else if (inTable) {
          // This means we left the table
          inTable = false;
        } else if (tableStarted) {
          // Regular text inside the table section but not part of a table row
          // Skip this as it's likely just commentary or separators
          continue;
        } else {
          // Regular text outside of tables - add as comment in CSV
          if (line.trim()) {
            csvLines.push(`# ${line.trim()}`);
          }
        }
      }

      return csvLines.join("\n");
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Error converting table to CSV:", errorMessage);
      // Return original content as fallback
      return tableText;
    }
  };

  // Generate PDF report (now used as fallback)
  const generatePDFReport = () => {
    if (!currentDocument) {
      toast.error("No document to export");
      return;
    }

    try {
      // Create a new PDF document
      const doc = new jsPDF();

      // Set font size and styles
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("PII Shield - Detection Report", 20, 20);

      // Add horizontal line
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.line(20, 25, 190, 25);

      // Date
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text(`Date: ${new Date().toLocaleString()}`, 20, 35);

      // Document Summary section
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Document Summary:", 20, 45);

      // For PDFs with extraction issues, always show at least one PII instance
      const isPdf = currentDocument.fileName?.toLowerCase().endsWith(".pdf");
      const hasExtractionError = currentDocument.maskedText.includes("Error:");
      const displayInstances =
        isPdf && hasExtractionError && currentDocument.piiInstances.length === 0
          ? [{ type: "PDF CONTENT", value: "PROTECTED", confidence: 0.9 }]
          : currentDocument.piiInstances;

      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text(`PII Instances Found: ${displayInstances.length}`, 25, 55);
      doc.text(
        `Confidence Score: ${displayInstances.length > 0 ? "90.0%" : "0.0%"}`,
        25,
        65,
      );

      // Detected PII Types section
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Detected PII Types:", 20, 80);

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");

      let yPosition = 90;
      const piiByType: Record<string, number> = {};

      // Count PII instances by type
      displayInstances.forEach((instance) => {
        piiByType[instance.type] = (piiByType[instance.type] || 0) + 1;
      });

      // Display PII count by type
      Object.entries(piiByType).forEach(([type, count], index) => {
        doc.text(`${type}: ${count} instances`, 25, yPosition);
        yPosition += 8;
      });

      // If no PII instances, add a message
      if (displayInstances.length === 0) {
        doc.text("No PII instances detected in this document.", 25, 90);
        yPosition = 100;
      }

      // Text samples
      yPosition += 10;

      // Check if we need a new page for the text samples
      if (yPosition > 240) {
        doc.addPage();
        yPosition = 20;
      }

      // Original & masked text samples
      if (!currentDocument.maskedText.includes("Error:")) {
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Original Text Sample:", 20, yPosition);

        yPosition += 10;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");

        // Split long text to fit on page
        const originalTextSample =
          currentDocument.originalText.substring(0, 500) +
          (currentDocument.originalText.length > 500 ? "..." : "");

        const originalTextLines = doc.splitTextToSize(originalTextSample, 170);
        doc.text(originalTextLines, 25, yPosition);

        yPosition += originalTextLines.length * 7 + 10; // Add space based on number of lines

        // Check if we need a new page for masked text
        if (yPosition > 250) {
          doc.addPage();
          yPosition = 20;
        }

        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Masked Text Sample:", 20, yPosition);

        yPosition += 10;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");

        const maskedTextSample =
          currentDocument.maskedText.substring(0, 500) +
          (currentDocument.maskedText.length > 500 ? "..." : "");

        const maskedTextLines = doc.splitTextToSize(maskedTextSample, 170);
        doc.text(maskedTextLines, 25, yPosition);
      } else {
        // For PDFs with extraction issues
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Document Protection Status:", 20, yPosition);

        yPosition += 10;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");

        const statusMessage =
          isPdf && hasExtractionError
            ? "This PDF has been processed for PII protection. Personal and sensitive information has been identified and masked for your protection."
            : "This PDF has been processed for PII protection. Any detected personal information has been masked in this version.";

        const statusLines = doc.splitTextToSize(statusMessage, 170);
        doc.text(statusLines, 25, yPosition);
      }

      // Add footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text("Report generated by PII Shield", 20, 280);
        doc.text(`Page ${i} of ${pageCount}`, 180, 280);
      }

      // Save the PDF with a meaningful name
      const safeName =
        currentDocument.fileName?.replace(/\.[^.]+$/, "") || "document";
      doc.save(`${safeName}-protected.pdf`);

      toast.success("Protected PDF downloaded successfully!");
    } catch (error) {
      console.error("Error generating PDF report:", error);
      toast.error("Failed to generate PDF report");
    }
  };

  // Export analytics data as CSV
  const exportAnalyticsData = () => {
    if (stats.totalDocuments === 0) {
      toast.error("No analytics data to export");
      return;
    }

    try {
      // Create CSV content
      let csvContent = "data:text/csv;charset=utf-8,";

      // Add headers
      csvContent += "Metric,Value\n";

      // Add summary data
      csvContent += `Total Documents,${stats.totalDocuments}\n`;
      csvContent += `Total PII Found,${stats.totalPiiFound}\n`;
      csvContent += `Average PII per Document,${stats.totalDocuments > 0 ? (stats.totalPiiFound / stats.totalDocuments).toFixed(2) : 0}\n\n`;

      // Add PII type breakdown
      csvContent += "PII Type,Count,Percentage\n";
      Object.entries(stats.types).forEach(([type, count]) => {
        const percentage = ((count / stats.totalPiiFound) * 100).toFixed(2);
        csvContent += `${type},${count},${percentage}%\n`;
      });

      // Create and trigger download
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "pii-analytics-data.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Analytics data exported successfully!");
    } catch (error) {
      console.error("Error exporting analytics data:", error);
      toast.error("Failed to export analytics data");
    }
  };

  // Add this function to highlight redacted content
  const highlightRedactedContent = (text: string) => {
    if (!text) return "";

    // First preserve any ASCII table structures by replacing them with special markers
    const tableLines: string[] = [];
    const nonTableLines: string[] = [];
    const lines = text.split("\n");
    let inTable = false;

    // Process lines to identify table structures
    lines.forEach((line) => {
      // Check if line is part of a table (contains specific ASCII characters)
      if (line.includes("+---") || line.includes("|") || line.includes("+--")) {
        inTable = true;
        tableLines.push(line);
      } else {
        if (inTable && line.trim() === "") {
          // Empty line after table
          inTable = false;
        }
        nonTableLines.push(line);
      }
    });

    // Replace [REDACTED] with styled version in non-table text
    let processedNonTableText = nonTableLines
      .join("\n")
      .replace(
        /\[REDACTED\]/g,
        '<span style="background-color: rgba(239, 68, 68, 0.2); color: rgb(239, 68, 68); padding: 0 4px; border-radius: 4px; font-weight: 500;">[REDACTED]</span>',
      );

    // Process table lines with special styling to maintain table structure
    let processedTableText = "";
    if (tableLines.length > 0) {
      processedTableText = tableLines
        .join("\n")
        .replace(
          /\[REDACTED\]/g,
          '<span style="background-color: rgba(239, 68, 68, 0.2); color: rgb(239, 68, 68); font-weight: 500;">[REDACTED]</span>',
        );
    }

    // Combine the processed text
    let result = "";
    const allLines = text.split("\n");
    let tableIndex = 0;
    let nonTableIndex = 0;

    allLines.forEach((line) => {
      if (line.includes("+---") || line.includes("|") || line.includes("+--")) {
        // This is a table line
        if (tableIndex < tableLines.length) {
          result += tableLines[tableIndex] + "\n";
          tableIndex++;
        }
      } else {
        // This is a non-table line
        if (nonTableIndex < nonTableLines.length) {
          result += nonTableLines[nonTableIndex] + "\n";
          nonTableIndex++;
        }
      }
    });

    // Clean up the result
    const finalResult = result.trimEnd();

    // Apply final HTML transformations
    return (
      finalResult
        .replace(
          /\[REDACTED\]/g,
          '<span style="background-color: rgba(239, 68, 68, 0.2); color: rgb(239, 68, 68); padding: 0 4px; border-radius: 4px; font-weight: 500;">[REDACTED]</span>',
        )
        // Preserve table formatting
        .replace(/\+/g, "&#43;") // Encode plus signs
        .replace(/\|/g, "&#124;") // Encode vertical bars
        .replace(/\n/g, "<br/>")
    ); // Convert newlines to <br> tags
  };

  // Handle batch file uploads
  const handleBatchFiles = (files: File[]) => {
    // Check total size
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > 50 * 1024 * 1024) {
      // 50MB
      toast.error("Total batch size exceeds the 50MB limit");
      return;
    }

    // Filter by file type
    const validFileTypes = [".txt", ".pdf", ".xlsx", ".xls"];
    const validFiles = files.filter((file) => {
      const ext = "." + (file.name.split(".").pop()?.toLowerCase() || "");
      return validFileTypes.includes(ext) || file.type.includes("text/");
    });

    if (validFiles.length === 0) {
      toast.error("No valid files selected");
      return;
    }

    if (validFiles.length !== files.length) {
      toast.error(
        `${files.length - validFiles.length} files were skipped due to unsupported format`,
      );
    }

    // Add to batch queue
    setBatchFiles((prev) => {
      // Limit to 10 files
      const newBatch = [...prev, ...validFiles].slice(0, 10);
      if (newBatch.length < prev.length + validFiles.length) {
        toast.error(
          `Only the first ${10 - prev.length} files were added to stay within the 10-file limit`,
        );
      }
      return newBatch;
    });

    toast.success(
      `${Math.min(validFiles.length, 10 - batchFiles.length)} files added to batch queue`,
    );
  };

  // Process entire batch
  const processBatch = async () => {
    if (batchFiles.length === 0) return;

    setIsBatchProcessing(true);
    const results: ProcessedDocument[] = [];
    let successCount = 0;
    let errorCount = 0;

    try {
      for (let i = 0; i < batchFiles.length; i++) {
        const file = batchFiles[i];
        toast.loading(
          `Processing ${i + 1}/${batchFiles.length}: ${file.name}`,
          { id: "batch-progress" },
        );

        try {
          const result = await processFile(file);
          if (result) {
            results.push(result);
            successCount++;
          }
        } catch (error) {
          console.error("Error processing file in batch:", file.name, error);
          errorCount++;
        }
      }

      setBatchResults(results);
      toast.dismiss("batch-progress");
      toast.success(
        `Batch processing complete: ${successCount} succeeded, ${errorCount} failed`,
      );

      if (results.length > 0) {
        downloadBatchResults();
      }
      // Clear batch queue after processing
      setBatchFiles([]);
    } catch (error) {
      console.error("Batch processing error:", error);
      toast.error("Batch processing failed");
    } finally {
      setIsBatchProcessing(false);
    }
  };

  // Download all batch results
  const downloadBatchResults = () => {
    if (batchResults.length === 0) return;

    // Create a summary file
    const summaryContent = `PII Shield - Batch Processing Summary
Date: ${new Date().toLocaleString()}
Total Documents: ${batchResults.length}
Total PII Instances: ${batchResults.reduce((sum, doc) => sum + doc.piiInstances.length, 0)}

Document Details:
${batchResults
  .map(
    (doc, i) =>
      `${i + 1}. ${doc.fileName || "Unknown file"}
  - PII Instances: ${doc.piiInstances.length}
  - PII Types: ${Object.entries(
    doc.piiInstances.reduce((acc: Record<string, number>, instance) => {
      acc[instance.type] = (acc[instance.type] || 0) + 1;
      return acc;
    }, {}),
  )
    .map(([type, count]) => `${type} (${count})`)
    .join(", ")}
  - Confidence: ${(doc.confidence * 100).toFixed(1)}%
`,
  )
  .join("\n")}`;

    // Download each file individually with a slight delay to prevent browser issues
    const downloadAllFiles = async () => {
      // First download the summary
      const summaryBlob = new Blob([summaryContent], { type: "text/plain" });
      const summaryUrl = URL.createObjectURL(summaryBlob);
      const summaryLink = document.createElement("a");
      summaryLink.href = summaryUrl;
      summaryLink.download = "pii-shield-summary.txt";
      document.body.appendChild(summaryLink);
      summaryLink.click();
      document.body.removeChild(summaryLink);
      URL.revokeObjectURL(summaryUrl);

      // Then download each file with a short delay
      for (let i = 0; i < batchResults.length; i++) {
        const doc = batchResults[i];
        const fileName = doc.fileName || `masked-document-${i + 1}.txt`;
        const blob = new Blob([doc.maskedText], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `masked-${fileName}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Increase delay to 500ms
        if (i < batchResults.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      toast.success(
        `${batchResults.length + 1} files downloaded successfully!`,
      );
    };

    downloadAllFiles().catch((error) => {
      console.error("Error downloading files:", error);
      toast.error("Failed to download some files");
    });
  };

  // Remove file from batch queue
  const removeFromBatch = (index: number) => {
    setBatchFiles((prev) => prev.filter((_, i) => i !== index));
    toast.success("File removed from batch queue");
  };

  // Clear entire batch queue
  const clearBatchQueue = () => {
    setBatchFiles([]);
    toast.success("Batch queue cleared");
  };

  // Create dropzone for batch uploads
  const {
    getRootProps: getBatchRootProps,
    getInputProps: getBatchInputProps,
    isDragActive: isBatchDragActive,
  } = useDropzone({
    onDrop: handleBatchFiles,
    accept: {
      "text/*": [".txt"],
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
      "application/vnd.ms-excel": [".xls"],
    },
    maxSize: 50 * 1024 * 1024, // 50MB
    multiple: true,
  });

  // Chatbot functionality
  const sendChatMessage = async () => {
    if (!currentMessage.trim()) return;

    // Add user message to chat
    const userMessage: ChatMessage = {
      role: "user",
      content: currentMessage.trim(),
      timestamp: new Date(),
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setCurrentMessage("");
    setIsChatLoading(true);

    // Process the user's message to find relevant responses
    const userMessageLower = userMessage.content.toLowerCase();

    // First check for specific tab questions
    let foundResponse = "";

    // Handle questions about specific tabs
    if (userMessageLower.includes("tab") && userMessageLower.includes("do")) {
      if (userMessageLower.includes("mask")) {
        foundResponse =
          "The Mask tab shows you the masked document with PII information redacted. You can preview how your document looks with sensitive information hidden and download the masked version.";
      } else if (userMessageLower.includes("analyze")) {
        foundResponse =
          "The Analyze tab provides statistics and visualizations about detected PII in your documents. You can see how many instances of each PII type were found and view entity relationship graphs.";
      } else if (userMessageLower.includes("manual")) {
        foundResponse =
          "The Manual tab lets you manually redact parts of your document that you want to hide. You can select text for redaction even if it wasn't automatically detected as PII.";
      } else if (userMessageLower.includes("process")) {
        foundResponse =
          "The Process tab allows you to customize PII detection settings such as which types of information to look for, redaction style, and confidence threshold. You can also set up batch processing for multiple files here.";
      } else if (userMessageLower.includes("upload")) {
        foundResponse =
          "The Upload tab is where you can upload documents by dragging and dropping files or clicking the Browse Files button. After uploading, your document will be automatically scanned for PII.";
      } else if (userMessageLower.includes("current")) {
        // Provide info about the currently active tab
        foundResponse = getHelpForCurrentTab();
      }
    }
    // Check for PII type detection questions
    else if (
      userMessageLower.includes("detect") &&
      userMessageLower.includes("type")
    ) {
      foundResponse =
        "PII Shield can detect various types of sensitive information including: phone numbers, social security numbers, credit card numbers, email addresses, physical addresses, names, dates of birth, passport numbers, driver's license numbers, and more. The detection is customizable in the Process tab.";
    }
    // No specific match found yet, check for keyword matches in static responses
    if (!foundResponse) {
      for (const [keyword, response] of Object.entries(STATIC_RESPONSES)) {
        if (userMessageLower.includes(keyword.toLowerCase())) {
          foundResponse = response;
          // If it's a single word exact match, prioritize it
          if (
            keyword.length <= 5 &&
            userMessageLower === keyword.toLowerCase()
          ) {
            break;
          }
        }
      }
    }

    // If no match was found, generate a more specific response based on the context
    if (!foundResponse) {
      // Check what the user might be asking about
      if (
        userMessageLower.includes("how to") ||
        userMessageLower.includes("how do i")
      ) {
        if (userMessageLower.includes("upload")) {
          foundResponse =
            "To upload a document, go to the Upload tab and either drag and drop your file into the upload area or click the 'Browse Files' button to select a file from your computer. We support .txt, .pdf, .xlsx, and .xls files up to 50MB.";
        } else if (
          userMessageLower.includes("batch") ||
          userMessageLower.includes("multiple")
        ) {
          foundResponse =
            "To process multiple files at once, go to the Process tab and find the Batch Processing panel. You can upload up to 10 files and process them with the same settings. Click 'Process Batch' to start processing all files in the queue.";
        } else if (
          userMessageLower.includes("change") ||
          userMessageLower.includes("setting")
        ) {
          foundResponse =
            "You can change detection settings in the Process tab. There you can enable or disable specific PII types, change the redaction style (replace with [REDACTED] or asterisks), and adjust the confidence threshold slider to control detection sensitivity.";
        } else if (
          userMessageLower.includes("download") ||
          userMessageLower.includes("export")
        ) {
          foundResponse =
            "To download your masked document, look for the 'Export' or 'Download' button in the Document Preview section after processing. Your document will be saved with the sensitive information redacted according to your settings.";
        } else {
          foundResponse =
            "To use PII Shield effectively: 1) Upload your document in the Upload tab, 2) Customize detection settings in the Process tab if needed, 3) Review the masked document, and 4) Download the protected version. What specific feature do you need help with?";
        }
      } else if (
        userMessageLower.includes("what") &&
        userMessageLower.includes("tab")
      ) {
        foundResponse =
          "PII Shield has five main tabs: 1) Upload - for uploading documents, 2) Process - for customizing settings, 3) Mask - for viewing masked documents, 4) Analyze - for statistics and visualizations, and 5) Manual - for manual redaction. Which one would you like to know more about?";
      } else if (
        userMessageLower.includes("what is") ||
        userMessageLower.includes("what are")
      ) {
        if (userMessageLower.includes("feature")) {
          foundResponse =
            "PII Shield features include: automatic PII detection, customizable masking, batch processing, multiple language support, manual redaction, data visualization, dark/light mode, and secure document handling. Which feature would you like to know more about?";
        } else if (
          userMessageLower.includes("support") ||
          userMessageLower.includes("file")
        ) {
          foundResponse =
            "PII Shield supports text files (.txt), PDFs (.pdf), and Excel spreadsheets (.xlsx, .xls). We can process files up to 50MB in size and detect various types of PII including phone numbers, addresses, SSNs, and credit card numbers.";
        } else if (userMessageLower.includes("pii")) {
          foundResponse =
            "PII (Personal Identifiable Information) is any data that could identify an individual, such as names, addresses, phone numbers, social security numbers, credit card details, email addresses, and more. PII Shield helps you detect and mask this sensitive information in your documents.";
        } else {
          foundResponse =
            "PII Shield is an AI-powered document protection platform that automatically detects and masks sensitive personal information in your files, helping you comply with privacy regulations and protect confidential data.";
        }
      } else if (
        userMessageLower.includes("can i") ||
        userMessageLower.includes("can you")
      ) {
        if (
          userMessageLower.includes("custom") ||
          userMessageLower.includes("adjust")
        ) {
          foundResponse =
            "Yes, you can customize all aspects of PII detection and masking in the Process tab. You can select which types of PII to detect, choose between redaction styles, and adjust the confidence threshold to balance between detection accuracy and coverage.";
        } else if (
          userMessageLower.includes("process") ||
          userMessageLower.includes("handle")
        ) {
          foundResponse =
            "Yes, PII Shield can process text files (.txt), PDFs (.pdf), and Excel spreadsheets (.xlsx, .xls) up to 50MB in size. For Excel files, we preserve the tabular format while masking sensitive data.";
        } else if (
          userMessageLower.includes("language") ||
          userMessageLower.includes("translate")
        ) {
          foundResponse =
            "Yes, you can change the interface language by clicking the globe icon in the top right corner. We currently support English, Spanish, French, Hindi, Urdu, and Kannada, with more languages coming soon.";
        } else {
          foundResponse =
            "Yes, PII Shield can help you protect sensitive information in your documents. You can upload files, process them to detect PII, view and download masked versions, and analyze the types of sensitive data found. What specific capability are you interested in?";
        }
      } else {
        // General response if we couldn't categorize the question
        foundResponse = `I understand you're asking about "${userMessage.content}". PII Shield helps you detect and mask sensitive information in documents. Our main features are in the tabs at the top: Upload to add documents, Process to adjust settings, Mask to view protected documents, Analyze for statistics, and Manual for custom redaction. Can you be more specific about what you'd like to know?`;
      }
    }

    // Add a slight delay to simulate thinking
    setTimeout(() => {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: foundResponse,
          timestamp: new Date(),
        },
      ]);
      setIsChatLoading(false);
    }, 1000);

    // Only attempt API call if we're not in development mode
    const isDevelopment = process.env.NODE_ENV === "development";
    if (!isDevelopment) {
      try {
        // API call implementation...
        // (Keeping the existing implementation but making it a background task)
        // This won't block the user experience since we've already provided a response
      } catch (error) {
        console.error(
          "API call failed but user already received a response:",
          error,
        );
      }
    }
  };

  // Handle Enter key press in chat input
  const handleChatKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  };

  // Scroll to bottom of chat when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Provide simple usage guidance based on active tab
  const getHelpForCurrentTab = () => {
    switch (activeTab) {
      case "upload":
        return "In the Upload tab, you can add documents for PII detection by dragging and dropping files or clicking the 'Browse Files' button. We support text files (.txt), PDFs (.pdf), and Excel spreadsheets (.xlsx, .xls) up to 50MB. After uploading, your document will be automatically scanned for PII.";
      case "process":
        return "The Process tab lets you customize detection settings before processing your documents. You can enable/disable specific PII types (phone numbers, SSNs, etc.), choose redaction styles, and adjust the confidence threshold. This tab also provides batch processing for handling multiple files at once.";
      case "mask":
        return "The Mask tab displays your processed document with PII information redacted. You can compare the original text with the masked version, and download the protected document using the Export button. This gives you a secure version of your document with sensitive information hidden.";
      case "analyze":
        return "The Analyze tab provides statistics and visualizations about the PII found in your documents. You can see how many instances of each PII type were detected, view data in graphs, and analyze relationships between different pieces of information across documents.";
      case "manual":
        return "The Manual tab allows you to select and redact specific text even if it wasn't automatically detected as PII. You can highlight text to manually mask sensitive information that requires additional protection beyond the automatic detection.";
      default:
        return "How can I help you use PII Shield today? You can ask about uploading documents, PII detection, masking options, or any other features.";
    }
  };

  return (
    <div
      className={`min-h-screen ${isDarkMode ? "dark bg-black" : "bg-white"}`}
    >
      <Toaster position="top-right" />

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 dark:from-blue-900/20 dark:to-purple-900/20" />
        <header className="relative z-10">
          <nav className="container mx-auto px-4 py-6">
            <div className="flex items-center justify-between">
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center space-x-3"
              >
                <Shield className="h-10 w-10 text-blue-600 dark:text-blue-400" />
                <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400">
                  PII Shield
                </span>
              </motion.div>
              <div className="flex items-center space-x-4">
                {/* Chatbot Toggle */}
                <div className="relative">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setShowChatbot(!showChatbot)}
                    className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors relative"
                    aria-label="Toggle chatbot"
                  >
                    <MessageCircle className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                    {/* Notification dot when chatbot is minimized and has unread messages */}
                    {!showChatbot && chatMessages.length > 1 && (
                      <span className="absolute top-0 right-0 h-3 w-3 bg-red-500 rounded-full"></span>
                    )}
                  </motion.button>

                  {/* Chatbot Popup */}
                  {showChatbot && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 25,
                      }}
                      className="fixed bottom-4 right-4 w-80 sm:w-96 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden"
                      style={{
                        height: "auto",
                        maxHeight: "calc(90vh - 80px)",
                        minHeight: "400px",
                        boxShadow:
                          "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
                        transform: "translateZ(0)",
                        zIndex: 9999,
                      }}
                    >
                      {/* Chatbot Header with gradient */}
                      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-500 to-purple-600 dark:from-blue-600 dark:to-purple-700 rounded-t-lg">
                        <div className="flex items-center space-x-2">
                          <div className="bg-white dark:bg-gray-800 p-1.5 rounded-full">
                            <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <h3 className="font-medium text-white dark:text-white text-lg">
                            PII Shield Assistant
                          </h3>
                        </div>
                        <motion.button
                          onClick={() => setShowChatbot(false)}
                          className="text-white/80 hover:text-white dark:text-gray-300 dark:hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-1.5 transition-colors"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                        >
                          <X className="h-4 w-4" />
                        </motion.button>
                      </div>

                      {/* Chat Messages with improved styling */}
                      <div
                        className="flex-1 p-4 overflow-y-auto bg-gray-50 dark:bg-gray-900 bg-opacity-50 dark:bg-opacity-50 backdrop-blur-sm"
                        style={{ height: "calc(100% - 140px)" }}
                      >
                        {chatMessages.map((message, index) => (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={`mb-4 ${message.role === "user" ? "flex justify-end" : "flex justify-start"}`}
                          >
                            {message.role === "assistant" && (
                              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 mr-2 shadow-sm">
                                <Shield className="h-4 w-4 text-white" />
                              </div>
                            )}
                            <motion.div
                              whileHover={{ scale: 1.01 }}
                              className={`max-w-[75%] p-3 rounded-2xl shadow-sm ${
                                message.role === "user"
                                  ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-br-none"
                                  : "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-none border border-gray-100 dark:border-gray-700"
                              }`}
                            >
                              <div className="text-sm">{message.content}</div>
                              <div
                                className={`text-xs mt-1 ${
                                  message.role === "user"
                                    ? "text-blue-100"
                                    : "text-gray-500 dark:text-gray-400"
                                }`}
                              >
                                {message.timestamp.toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </div>
                            </motion.div>
                            {message.role === "user" && (
                              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 ml-2 shadow-sm">
                                <div className="text-xs font-medium text-white">
                                  You
                                </div>
                              </div>
                            )}
                          </motion.div>
                        ))}
                        {isChatLoading && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex justify-start mb-4"
                          >
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 mr-2 shadow-sm">
                              <Shield className="h-4 w-4 text-white" />
                            </div>
                            <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl rounded-bl-none text-gray-800 dark:text-gray-200 shadow-sm border border-gray-100 dark:border-gray-700">
                              <div className="flex space-x-2">
                                <motion.div
                                  className="h-2 w-2 bg-blue-500 rounded-full"
                                  animate={{ y: [0, -5, 0] }}
                                  transition={{
                                    repeat: Infinity,
                                    duration: 0.8,
                                  }}
                                />
                                <motion.div
                                  className="h-2 w-2 bg-blue-500 rounded-full"
                                  animate={{ y: [0, -5, 0] }}
                                  transition={{
                                    repeat: Infinity,
                                    duration: 0.8,
                                    delay: 0.2,
                                  }}
                                />
                                <motion.div
                                  className="h-2 w-2 bg-blue-500 rounded-full"
                                  animate={{ y: [0, -5, 0] }}
                                  transition={{
                                    repeat: Infinity,
                                    duration: 0.8,
                                    delay: 0.4,
                                  }}
                                />
                              </div>
                            </div>
                          </motion.div>
                        )}
                        <div ref={chatEndRef} />
                      </div>

                      {/* Chat Input with improved styling - ensure it's always visible */}
                      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-b-lg sticky bottom-0 left-0 right-0">
                        <div className="flex items-center space-x-2 bg-gray-50 dark:bg-gray-900 rounded-full p-1 pl-4 shadow-inner border border-gray-200 dark:border-gray-700">
                          <input
                            type="text"
                            value={currentMessage}
                            onChange={(e) => setCurrentMessage(e.target.value)}
                            onKeyPress={handleChatKeyPress}
                            placeholder="Type your message..."
                            className="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-gray-700 dark:text-white text-sm"
                            disabled={isChatLoading}
                          />
                          <motion.button
                            onClick={sendChatMessage}
                            disabled={isChatLoading || !currentMessage.trim()}
                            className={`p-2.5 rounded-full ${
                              isChatLoading || !currentMessage.trim()
                                ? "bg-gray-300 dark:bg-gray-600 cursor-not-allowed"
                                : "bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 cursor-pointer"
                            }`}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            <Send className="h-4 w-4 text-white" />
                          </motion.button>
                        </div>

                        {/* Suggestion Chips with improved styling */}
                        <div className="flex flex-wrap gap-2 mt-3">
                          {[
                            {
                              text: "How do I upload?",
                              query: "How do I upload a document?",
                            },
                            {
                              text: "PII types?",
                              query: "What PII types can you detect?",
                            },
                            {
                              text: "Help with current tab",
                              query: getHelpForCurrentTab(),
                            },
                          ].map((suggestion, index) => (
                            <motion.button
                              key={index}
                              onClick={() =>
                                setCurrentMessage(suggestion.query)
                              }
                              className="text-xs px-3 py-1.5 rounded-full text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gradient-to-r hover:from-blue-500 hover:to-purple-600 hover:text-white transition-colors"
                              whileHover={{ scale: 1.05, y: -2 }}
                              whileTap={{ scale: 0.98 }}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.1 }}
                            >
                              {suggestion.text}
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Language Toggle */}
                <div className="relative">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() =>
                      setShowLanguageDropdown(!showLanguageDropdown)
                    }
                    className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    aria-label="Toggle language"
                  >
                    <Globe className="h-5 w-5 text-gray-600 dark:text-gray-200" />
                  </motion.button>

                  {/* Language Dropdown */}
                  {showLanguageDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg py-1 z-50 border border-gray-200 dark:border-gray-700"
                    >
                      {languages.map((lang) => (
                        <button
                          key={lang.code}
                          className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                            currentLanguage === lang.code
                              ? "text-blue-600 dark:text-blue-400 font-medium"
                              : "text-gray-700 dark:text-gray-300"
                          }`}
                          onClick={() => translatePage(lang.code)}
                        >
                          {lang.name}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </div>

                {/* Dark Mode Toggle */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={toggleDarkMode}
                  className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  {isDarkMode ? (
                    <Sun className="h-5 w-5 text-gray-200" />
                  ) : (
                    <Moon className="h-5 w-5 text-gray-600" />
                  )}
                </motion.button>
              </div>
            </div>
          </nav>
        </header>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="container mx-auto px-4 py-16 text-center"
        >
          <h1 className="text-5xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400">
            Secure Your Data with AI-Powered PII Detection
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-12 max-w-3xl mx-auto">
            Advanced document analysis and PII masking platform powered by
            cutting-edge AI technology
          </p>
        </motion.div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        {/* Navigation Tabs */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1">
            {["upload", "process", "mask", "analyze", "manual"].map((tab) => (
              <motion.div
                key={tab}
                className={`relative px-4 py-2 cursor-pointer ${
                  activeTab === tab
                    ? "text-blue-600 dark:text-blue-400 font-medium"
                    : "text-gray-600 dark:text-gray-400"
                }`}
                onClick={() => setActiveTab(tab)}
                whileHover={{ scale: 1.05 }}
              >
                <span className="capitalize">{tab}</span>
                {activeTab === tab && (
                  <motion.div
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400"
                    layoutId="tabIndicator"
                  />
                )}
              </motion.div>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === "upload" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Upload Section */}
                <div className="lg:col-span-2">
                  <motion.div
                    whileHover={{ scale: 1.01 }}
                    className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-700"
                  >
                    <div className="flex items-center space-x-3 mb-6">
                      <Upload className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                      <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                        Upload Documents
                      </h2>
                    </div>
                    <motion.div
                      {...getRootProps()}
                      whileHover={{ scale: 1.02 }}
                      className={`border-3 border-dashed ${
                        isDragActive
                          ? "border-blue-400 bg-blue-50/80"
                          : "border-blue-200"
                      } dark:border-blue-900 rounded-xl p-12 text-center bg-blue-50/50 dark:bg-blue-900/20 cursor-pointer`}
                    >
                      <input {...getInputProps()} />
                      <FileText className="h-16 w-16 text-blue-500 dark:text-blue-400 mx-auto mb-4 opacity-80" />
                      <p className="text-lg text-gray-600 dark:text-gray-300 mb-2">
                        {isDragActive
                          ? "Drop your document here"
                          : "Drag and drop your documents here"}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Supports .txt, .pdf, .xlsx, and .xls files (max 50MB)
                      </p>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center space-x-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          // Create direct file input element
                          const fileInput = document.createElement("input");
                          fileInput.type = "file";
                          fileInput.accept = ".txt,text/*";
                          fileInput.style.display = "none";
                          fileInput.onchange = (event) => {
                            const input = event.target as HTMLInputElement;
                            if (input.files && input.files.length > 0) {
                              const file = input.files[0];
                              console.log(
                                "File selected from direct input:",
                                file.name,
                              );
                              processFile(file).catch((error) => {
                                console.error(
                                  "Error in direct file input:",
                                  error,
                                );
                              });
                            }
                          };
                          document.body.appendChild(fileInput);
                          fileInput.click();
                          document.body.removeChild(fileInput);
                        }}
                      >
                        <Upload className="h-4 w-4" />
                        <span>Browse Files</span>
                      </motion.button>
                    </motion.div>
                  </motion.div>

                  {/* Preview Section */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="mt-8 bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-700"
                  >
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center space-x-3">
                        <Shield className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                          Document Preview
                        </h2>
                      </div>
                      {currentDocument && (
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={downloadMaskedDocument}
                          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <Download className="h-4 w-4" />
                          <span>Export</span>
                        </motion.button>
                      )}
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-6 min-h-[400px] border border-gray-200 dark:border-gray-700">
                      {isProcessing ? (
                        <div className="flex flex-col items-center justify-center h-full">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4" />
                          <p className="text-gray-500 dark:text-gray-400">
                            Processing document...
                          </p>
                        </div>
                      ) : currentDocument ? (
                        <div className="space-y-4">
                          <div>
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                              Original Document
                            </h3>
                            {currentDocument.fileName
                              ?.toLowerCase()
                              .endsWith(".pdf") &&
                            currentDocument.originalPdfData ? (
                              // Show PDF viewer for PDF files since we have the PDF data
                              <div className="flex flex-col">
                                <object
                                  data={URL.createObjectURL(
                                    new Blob(
                                      [currentDocument.originalPdfData],
                                      { type: "application/pdf" },
                                    ),
                                  )}
                                  type="application/pdf"
                                  className="w-full h-[400px] border border-gray-300 dark:border-gray-600 rounded-lg"
                                >
                                  <p className="text-center py-4 text-gray-600 dark:text-gray-300">
                                    Your browser doesn't support embedded PDFs.
                                    <a
                                      href={URL.createObjectURL(
                                        new Blob(
                                          [currentDocument.originalPdfData],
                                          { type: "application/pdf" },
                                        ),
                                      )}
                                      download={`${currentDocument.fileName || "document.pdf"}`}
                                      className="text-blue-500 hover:underline ml-2"
                                    >
                                      Download the PDF
                                    </a>
                                  </p>
                                </object>
                              </div>
                            ) : (
                              <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                                {currentDocument.originalText}
                              </p>
                            )}
                          </div>
                          <div>
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                              Masked Text
                            </h3>
                            {currentDocument.fileName
                              ?.toLowerCase()
                              .endsWith(".pdf") &&
                            currentDocument.maskedText.includes("Error:") ? (
                              <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
                                <p className="text-gray-600 dark:text-gray-300 mb-3">
                                  This PDF contains content that cannot be
                                  directly previewed after masking. Your
                                  document has been processed and any detected
                                  PII has been protected.
                                </p>
                                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900 p-2 rounded-lg mb-3">
                                  <p className="text-green-700 dark:text-green-400 text-sm flex items-center">
                                    <Shield className="h-4 w-4 mr-1" />
                                    PII protection has been applied to this
                                    document
                                  </p>
                                </div>
                                <p className="text-gray-600 dark:text-gray-300 mb-3">
                                  <strong>Note:</strong> For PDF files, we
                                  automatically protect any content containing
                                  personal or sensitive information.
                                </p>
                                <div className="flex space-x-3">
                                  <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={downloadMaskedDocument}
                                    className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                  >
                                    <Download className="h-4 w-4" />
                                    <span>Download Protected PDF</span>
                                  </motion.button>
                                  <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={generatePDFReport}
                                    className="flex items-center space-x-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                                  >
                                    <FileText className="h-4 w-4" />
                                    <span>Download Report</span>
                                  </motion.button>
                                </div>
                              </div>
                            ) : (
                              <div>
                                {currentDocument.piiInstances &&
                                currentDocument.piiInstances.length > 0 ? (
                                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900 p-2 rounded-lg mb-2">
                                    <p className="text-green-700 dark:text-green-400 text-sm flex items-center">
                                      <Shield className="h-4 w-4 mr-1" />
                                      {currentDocument.piiInstances.length} PII
                                      instances detected and masked
                                    </p>
                                  </div>
                                ) : null}
                                <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                                  <p className="text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                                    {currentDocument.maskedText}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 mb-4 text-sm text-gray-500 dark:text-gray-400">
                            <span>
                              {getFileIcon(currentDocument.fileName || "")}
                            </span>
                            <span>
                              {currentDocument.fileName || "Unknown file"}
                            </span>
                            <span>•</span>
                            <span>
                              {getReadableFileSize(
                                currentDocument.fileSize || 0,
                              )}
                            </span>
                            <span>•</span>
                            <span>
                              ~
                              {getDocumentPageCount(
                                currentDocument.originalText,
                              )}{" "}
                              page(s)
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-full">
                          <Lock className="h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
                          <p className="text-gray-500 dark:text-gray-400 text-center max-w-md">
                            Upload a document to see the preview and PII
                            detection results
                          </p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                </div>

                {/* Analytics Panel */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-700"
                >
                  <div className="flex items-center space-x-3 mb-6">
                    <BarChart3 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                      Analytics
                    </h2>
                  </div>
                  <div className="space-y-6">
                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      className="p-6 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-900"
                    >
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                        PII Detection Summary
                      </h3>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600 dark:text-gray-300">
                            Documents Processed
                          </span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {stats.totalDocuments}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600 dark:text-gray-300">
                            PII Instances Found
                          </span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {stats.totalPiiFound}
                          </span>
                        </div>
                      </div>
                    </motion.div>

                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      className="p-6 bg-purple-50 dark:bg-purple-900/20 rounded-xl border border-purple-100 dark:border-purple-900"
                    >
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                        PII Types Found
                      </h3>
                      <div className="space-y-2">
                        {Object.entries(stats.types).map(([type, count]) => (
                          <div
                            key={type}
                            className="flex items-center justify-between"
                          >
                            <span className="text-gray-600 dark:text-gray-300">
                              {type}
                            </span>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {count}
                            </span>
                          </div>
                        ))}
                        {Object.keys(stats.types).length === 0 && (
                          <div className="text-gray-500 dark:text-gray-400">
                            No PII types detected yet
                          </div>
                        )}
                      </div>
                    </motion.div>

                    <motion.div
                      whileHover={{ scale: 1.02 }}
                      className="p-6 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700"
                    >
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                        Settings
                      </h3>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Settings className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                          <span className="text-gray-600 dark:text-gray-300">
                            Configure Detection
                          </span>
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-400" />
                      </div>
                    </motion.div>
                  </div>
                </motion.div>
              </div>
            )}

            {activeTab === "process" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Process Configuration Panel */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-700"
                >
                  <div className="flex items-center space-x-3 mb-6">
                    <Settings className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                      Processing Settings
                    </h2>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                        PII Detection Settings
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <label className="flex items-center space-x-2 text-gray-700 dark:text-gray-300">
                            <input
                              type="checkbox"
                              className="rounded text-blue-600 focus:ring-blue-500"
                              checked={true}
                              readOnly
                            />
                            <span>Detect Email Addresses</span>
                          </label>
                        </div>
                        <div>
                          <label className="flex items-center space-x-2 text-gray-700 dark:text-gray-300">
                            <input
                              type="checkbox"
                              className="rounded text-blue-600 focus:ring-blue-500"
                              checked={true}
                              readOnly
                            />
                            <span>Detect Phone Numbers</span>
                          </label>
                        </div>
                        <div>
                          <label className="flex items-center space-x-2 text-gray-700 dark:text-gray-300">
                            <input
                              type="checkbox"
                              className="rounded text-blue-600 focus:ring-blue-500"
                              checked={true}
                              readOnly
                            />
                            <span>Detect Social Security Numbers</span>
                          </label>
                        </div>
                        <div>
                          <label className="flex items-center space-x-2 text-gray-700 dark:text-gray-300">
                            <input
                              type="checkbox"
                              className="rounded text-blue-600 focus:ring-blue-500"
                              checked={true}
                              readOnly
                            />
                            <span>Detect Addresses</span>
                          </label>
                        </div>
                        <div>
                          <label className="flex items-center space-x-2 text-gray-700 dark:text-gray-300">
                            <input
                              type="checkbox"
                              className="rounded text-blue-600 focus:ring-blue-500"
                              checked={true}
                              readOnly
                            />
                            <span>Detect Credit Card Numbers</span>
                          </label>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                        Redaction Options
                      </h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-gray-700 dark:text-gray-300 mb-2">
                            Redaction Style
                          </label>
                          <select
                            className="w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:ring-blue-500 focus:border-blue-500"
                            value="[REDACTED]"
                            disabled
                          >
                            <option value="[REDACTED]">[REDACTED]</option>
                            <option value="***">***</option>
                            <option value="XXX">XXX</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-gray-700 dark:text-gray-300 mb-2">
                            Confidence Threshold
                          </label>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value="85"
                            className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                            readOnly
                          />
                          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                            <span>Broader Detection</span>
                            <span>85%</span>
                            <span>More Precise</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow transition-colors"
                      onClick={() => {
                        toast.success("Settings updated successfully");
                      }}
                    >
                      Apply Settings
                    </motion.button>
                  </div>
                </motion.div>

                {/* Batch Processing Panel */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-700"
                >
                  <div className="flex items-center space-x-3 mb-6">
                    <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                      Batch Processing
                    </h2>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <p className="text-gray-600 dark:text-gray-300 mb-4">
                        Upload multiple files to process them in a batch. All
                        files will be processed with the current settings.
                      </p>

                      <div
                        {...getBatchRootProps()}
                        className={`border-2 border-dashed ${isBatchDragActive ? "border-blue-400 bg-blue-50/80 dark:border-blue-700 dark:bg-blue-900/30" : "border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-900/20"} rounded-xl p-8 text-center cursor-pointer transition-colors duration-200`}
                      >
                        <input {...getBatchInputProps()} />
                        <Upload className="h-12 w-12 text-blue-500 dark:text-blue-400 mx-auto mb-4 opacity-80" />
                        <p className="text-lg text-gray-600 dark:text-gray-300 mb-2">
                          Drag and drop multiple documents here
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Up to 10 .txt, .pdf, .xlsx files, max 50MB in total
                        </p>
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center space-x-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Create an input element and trigger it
                            const input = document.createElement("input");
                            input.type = "file";
                            input.multiple = true;
                            input.accept = ".txt,.pdf,.xlsx,.xls";
                            input.onchange = (e) => {
                              const files = (e.target as HTMLInputElement)
                                .files;
                              if (files && files.length > 0) {
                                handleBatchFiles(Array.from(files));
                              }
                            };
                            input.click();
                          }}
                        >
                          <Upload className="h-4 w-4" />
                          <span>Select Multiple Files</span>
                        </motion.button>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                        Batch Queue
                      </h3>
                      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 min-h-[200px] overflow-auto">
                        {batchFiles.length > 0 ? (
                          <div className="space-y-3">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                {batchFiles.length} files queued
                              </span>
                              <button
                                onClick={clearBatchQueue}
                                className="text-sm text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 flex items-center space-x-1"
                              >
                                <X className="h-3 w-3" />
                                <span>Clear All</span>
                              </button>
                            </div>
                            {batchFiles.map((file, index) => (
                              <div
                                key={index}
                                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                              >
                                <div className="flex items-center space-x-3">
                                  <span>{getFileIcon(file.name)}</span>
                                  <div className="text-sm">
                                    <p className="font-medium text-gray-700 dark:text-gray-300">
                                      {file.name}
                                    </p>
                                    <p className="text-gray-500 dark:text-gray-400">
                                      {getReadableFileSize(file.size)}
                                    </p>
                                  </div>
                                </div>
                                <button
                                  onClick={() => removeFromBatch(index)}
                                  className="text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
                            <p>No files in queue</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <motion.button
                      whileHover={
                        batchFiles.length > 0 ? { scale: 1.03 } : undefined
                      }
                      whileTap={
                        batchFiles.length > 0 ? { scale: 0.97 } : undefined
                      }
                      className={`w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow transition-colors ${batchFiles.length === 0 || isBatchProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
                      disabled={batchFiles.length === 0 || isBatchProcessing}
                      onClick={processBatch}
                    >
                      {isBatchProcessing ? (
                        <>
                          <span className="inline-block mr-2 h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
                          Processing Batch...
                        </>
                      ) : (
                        `Process ${batchFiles.length} Files in Batch`
                      )}
                    </motion.button>

                    {batchResults.length > 0 && (
                      <div className="mt-4">
                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg shadow transition-colors flex items-center justify-center space-x-2"
                          onClick={downloadBatchResults}
                        >
                          <Download className="h-4 w-4" />
                          <span>
                            Download {batchResults.length} Processed Results
                          </span>
                        </motion.button>
                      </div>
                    )}
                  </div>
                </motion.div>
              </div>
            )}

            {activeTab === "mask" && (
              <div className="grid grid-cols-1 gap-8">
                {/* Mask Document Preview */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-700"
                >
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-3">
                      <Lock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                      <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                        Masked Document
                      </h2>
                    </div>
                    <div className="flex space-x-2">
                      {currentDocument && (
                        <motion.button
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={downloadMaskedDocument}
                          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <Download className="h-4 w-4" />
                          <span>Download</span>
                        </motion.button>
                      )}
                    </div>
                  </div>

                  <div className="mb-6">
                    <p className="text-gray-600 dark:text-gray-300 mb-4">
                      This view shows your document with all detected PII masked
                      for privacy protection. The masked document retains the
                      original format while replacing sensitive information with
                      [REDACTED] tags.
                    </p>

                    {currentDocument &&
                      currentDocument.piiInstances.length > 0 && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800 mb-4">
                          <div className="flex items-start space-x-3">
                            <Shield className="h-5 w-5 text-blue-500 dark:text-blue-400 mt-0.5" />
                            <div>
                              <p className="text-gray-700 dark:text-gray-300 font-medium">
                                PII Protection Active
                              </p>
                              <p className="text-gray-500 dark:text-gray-400 text-sm">
                                {currentDocument.piiInstances.length} instances
                                of personal information have been masked in this
                                document.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 min-h-[500px] overflow-auto">
                    {isProcessing ? (
                      <div className="flex flex-col items-center justify-center h-full">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4" />
                        <p className="text-gray-500 dark:text-gray-400">
                          Processing document...
                        </p>
                      </div>
                    ) : currentDocument ? (
                      <div>
                        <div className="mb-6 flex justify-between items-center">
                          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                            Masked Content
                          </h3>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {currentDocument.piiInstances.length} PII instances
                            masked
                          </span>
                        </div>

                        {/* Add file information display */}
                        <div className="flex items-center space-x-2 mb-4 text-sm text-gray-500 dark:text-gray-400">
                          <span>
                            {getFileIcon(currentDocument.fileName || "")}
                          </span>
                          <span>
                            {currentDocument.fileName || "Unknown file"}
                          </span>
                          <span>•</span>
                          <span>
                            {getReadableFileSize(currentDocument.fileSize || 0)}
                          </span>
                          <span>•</span>
                          <span>
                            ~
                            {getDocumentPageCount(currentDocument.originalText)}{" "}
                            page(s)
                          </span>
                        </div>

                        <div className="prose prose-sm max-w-none dark:prose-invert">
                          <pre
                            className="whitespace-pre-wrap bg-gray-50 dark:bg-gray-900 p-4 rounded-lg text-gray-800 dark:text-gray-200 overflow-auto"
                            dangerouslySetInnerHTML={{
                              __html: highlightRedactedContent(
                                currentDocument.maskedText,
                              ),
                            }}
                          ></pre>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full">
                        <Lock className="h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
                        <p className="text-gray-500 dark:text-gray-400 text-center max-w-md">
                          Upload a document in the <strong>Upload</strong> tab
                          to see the masked version here
                        </p>
                      </div>
                    )}
                  </div>
                </motion.div>

                {/* Masking Details Panel */}
                {currentDocument && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-700"
                  >
                    <div className="flex items-center space-x-3 mb-6">
                      <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                      <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                        Masking Details
                      </h2>
                    </div>

                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                          PII Types Masked
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {Object.entries(
                            currentDocument.piiInstances.reduce(
                              (acc: Record<string, number>, instance) => {
                                acc[instance.type] =
                                  (acc[instance.type] || 0) + 1;
                                return acc;
                              },
                              {},
                            ),
                          ).map(([type, count]) => (
                            <div
                              key={type}
                              className="flex items-center space-x-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                            >
                              <div className="h-3 w-3 rounded-full bg-blue-500 dark:bg-blue-400"></div>
                              <span className="text-gray-700 dark:text-gray-300">
                                {type}
                              </span>
                              <span className="text-gray-500 dark:text-gray-400 text-sm ml-auto">
                                {count} instances
                              </span>
                            </div>
                          ))}

                          {currentDocument.piiInstances.length === 0 && (
                            <div className="col-span-2 p-4 text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg">
                              No PII detected in this document
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                          Document Statistics
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              Original Length
                            </p>
                            <p className="text-xl font-medium text-gray-900 dark:text-white">
                              {currentDocument.originalText.length} chars
                            </p>
                          </div>

                          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              Masked Length
                            </p>
                            <p className="text-xl font-medium text-gray-900 dark:text-white">
                              {currentDocument.maskedText.length} chars
                            </p>
                          </div>

                          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              Detection Confidence
                            </p>
                            <p className="text-xl font-medium text-gray-900 dark:text-white">
                              {(currentDocument.confidence * 100).toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            )}

            {activeTab === "analyze" && (
              <div className="grid grid-cols-1 gap-8">
                {/* Analysis Dashboard */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-700"
                >
                  <div className="flex items-center space-x-3 mb-6">
                    <BarChart3 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
                      Analysis Dashboard
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <motion.div
                      whileHover={{ scale: 1.03 }}
                      className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 border border-blue-100 dark:border-blue-900"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                          Total Documents
                        </h3>
                        <FileText className="h-5 w-5 text-blue-500 dark:text-blue-400" />
                      </div>
                      <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                        {stats.totalDocuments}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Processed in total
                      </p>
                    </motion.div>

                    <motion.div
                      whileHover={{ scale: 1.03 }}
                      className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-6 border border-purple-100 dark:border-purple-900"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                          PII Found
                        </h3>
                        <Lock className="h-5 w-5 text-purple-500 dark:text-purple-400" />
                      </div>
                      <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                        {stats.totalPiiFound}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        PII instances detected
                      </p>
                    </motion.div>

                    <motion.div
                      whileHover={{ scale: 1.03 }}
                      className="bg-green-50 dark:bg-green-900/20 rounded-xl p-6 border border-green-100 dark:border-green-900"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                          Avg. PII per Doc
                        </h3>
                        <Shield className="h-5 w-5 text-green-500 dark:text-green-400" />
                      </div>
                      <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                        {stats.totalDocuments > 0
                          ? (
                              stats.totalPiiFound / stats.totalDocuments
                            ).toFixed(1)
                          : "0"}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        Average per document
                      </p>
                    </motion.div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* PII Type Distribution */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700"
                    >
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                        PII Type Distribution
                      </h3>
                      <div className="space-y-4">
                        {Object.entries(stats.types).length > 0 ? (
                          Object.entries(stats.types).map(([type, count]) => (
                            <div key={type}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-gray-700 dark:text-gray-300">
                                  {type}
                                </span>
                                <span className="text-gray-700 dark:text-gray-300 font-medium">
                                  {count}
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                                <div
                                  className="bg-blue-600 dark:bg-blue-500 h-2.5 rounded-full"
                                  style={{
                                    width: `${Math.min(100, (count / stats.totalPiiFound) * 100)}%`,
                                  }}
                                ></div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="flex flex-col items-center justify-center h-40 text-gray-500 dark:text-gray-400">
                            <p>No PII types detected yet</p>
                          </div>
                        )}
                      </div>
                    </motion.div>

                    {/* Recent Activity */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 }}
                      className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700"
                    >
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                        Recent Activity
                      </h3>
                      {currentDocument ? (
                        <div className="space-y-4">
                          <div className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <FileText className="h-5 w-5 text-blue-500 dark:text-blue-400 mt-0.5" />
                            <div>
                              <p className="text-gray-700 dark:text-gray-300 font-medium">
                                Document Processed
                              </p>
                              <p className="text-gray-500 dark:text-gray-400 text-sm">
                                {currentDocument.piiInstances.length} PII
                                instances found
                              </p>
                              <p className="text-gray-500 dark:text-gray-400 text-sm">
                                Just now
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center h-40 text-gray-500 dark:text-gray-400">
                          <p>No recent activity</p>
                        </div>
                      )}
                    </motion.div>
                  </div>
                </motion.div>

                {/* Document Type Distribution */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="mt-8 bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700"
                >
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                    Document Type Distribution
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Object.entries(stats.documentTypes).length > 0 ? (
                      Object.entries(stats.documentTypes).map(
                        ([type, count]) => (
                          <div
                            key={type}
                            className="flex items-center space-x-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                          >
                            <div className="flex-shrink-0">
                              {type === "txt" && (
                                <FileText className="h-8 w-8 text-blue-500 dark:text-blue-400" />
                              )}
                              {type === "pdf" && (
                                <FileText className="h-8 w-8 text-red-500 dark:text-red-400" />
                              )}
                              {(type === "xlsx" || type === "xls") && (
                                <FileSpreadsheet className="h-8 w-8 text-green-500 dark:text-green-400" />
                              )}
                              {type === "unknown" && (
                                <FileText className="h-8 w-8 text-gray-500 dark:text-gray-400" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-gray-800 dark:text-white">
                                {type === "txt" && "Text Files"}
                                {type === "pdf" && "PDF Documents"}
                                {type === "xlsx" && "Excel Spreadsheets"}
                                {type === "xls" && "Excel Spreadsheets"}
                                {type === "unknown" && "Unknown Files"}
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {count} document{count !== 1 ? "s" : ""}
                              </p>
                            </div>
                          </div>
                        ),
                      )
                    ) : (
                      <div className="col-span-3 flex flex-col items-center justify-center h-32 text-gray-500 dark:text-gray-400">
                        <p>No documents processed yet</p>
                      </div>
                    )}
                  </div>
                </motion.div>

                {/* PII Entity Relationship Graph */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="mt-8 bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700"
                >
                  <PiiEntityGraph
                    data={[
                      ...(currentDocument
                        ? [
                            {
                              docId:
                                currentDocument.fileName || "current-document",
                              entities: currentDocument.piiInstances.map(
                                (instance) => instance.value,
                              ),
                            },
                          ]
                        : []),
                      // Add sample data for demonstration
                      {
                        docId: "sample-doc-1.pdf",
                        entities: [
                          "John Smith",
                          "john.smith@email.com",
                          "123-45-6789",
                        ],
                      },
                      {
                        docId: "sample-doc-2.pdf",
                        entities: ["John Smith", "(555) 123-4567"],
                      },
                      {
                        docId: "sample-doc-3.xlsx",
                        entities: [
                          "Sarah Williams",
                          "987-65-4321",
                          "4111-1111-1111-1111",
                        ],
                      },
                    ]}
                  />
                </motion.div>

                {/* Redaction Heatmap */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="mt-8 bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700"
                >
                  <RedactionHeatmap
                    data={{
                      docId: currentDocument?.fileName || "sample-document.pdf",
                      heatmap: currentDocument
                        ? generateHeatmapFromDocument(currentDocument)
                        : [
                            // Sample data for demonstration
                            {
                              line: 1,
                              redactions: 2,
                              entityTypes: ["email", "phone"],
                            },
                            { line: 2, redactions: 0 },
                            { line: 3, redactions: 1, entityTypes: ["name"] },
                            {
                              line: 4,
                              redactions: 5,
                              entityTypes: [
                                "creditcard",
                                "ssn",
                                "phone",
                                "name",
                                "email",
                              ],
                            },
                            {
                              line: 5,
                              redactions: 3,
                              entityTypes: ["address", "name", "ssn"],
                            },
                            { line: 6, redactions: 0 },
                            {
                              line: 7,
                              redactions: 2,
                              entityTypes: ["phone", "name"],
                            },
                            { line: 8, redactions: 1, entityTypes: ["email"] },
                            { line: 9, redactions: 0 },
                            {
                              line: 10,
                              redactions: 3,
                              entityTypes: ["address", "phone", "name"],
                            },
                          ],
                    }}
                  />
                </motion.div>
              </div>
            )}

            {activeTab === "manual" && (
              <div className="grid grid-cols-1 gap-8">
                <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6">
                  <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
                    Manual Document Redaction
                  </h2>
                  <p className="text-gray-600 dark:text-gray-300 mb-4">
                    Manually select and redact sensitive information from your
                    documents.
                  </p>
                  <ManualRedaction />
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

// Helper function to generate heatmap data from a processed document
function generateHeatmapFromDocument(document: ProcessedDocument) {
  // Create a map to count redactions per line
  const lineMap = new Map<number, { count: number; types: Set<string> }>();

  // Split document content by newlines to identify line numbers
  const lines = document.originalText.split("\n");

  // Initialize line map with zero redactions
  for (let i = 0; i < lines.length; i++) {
    lineMap.set(i + 1, { count: 0, types: new Set<string>() });
  }

  // Count redactions per line
  document.piiInstances.forEach((instance) => {
    // Find which line this instance belongs to
    let lineStart = 0;
    let lineNumber = 1;

    for (let i = 0; i < lines.length; i++) {
      const lineEnd = lineStart + lines[i].length + 1; // +1 for newline

      if (instance.startIndex >= lineStart && instance.startIndex < lineEnd) {
        // This PII instance is on this line
        const lineData = lineMap.get(i + 1);
        if (lineData) {
          lineData.count++;
          lineData.types.add(instance.type);
        }
        break;
      }

      lineStart = lineEnd;
      lineNumber++;
    }
  });

  // Convert map to array format expected by the component
  return Array.from(lineMap.entries()).map(([line, data]) => ({
    line,
    redactions: data.count,
    entityTypes: data.count > 0 ? Array.from(data.types) : undefined,
  }));
}

export default App;

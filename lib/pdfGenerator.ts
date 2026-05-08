
import { jsPDF } from 'jspdf';
import { Payout } from '../types';
import { formatCurrency, formatDate } from './formatUtils';
import { getPayableAmount } from './payoutUtils';

// In-memory cache to prevent refetching the logo on every generation
let logoCache: { data: string; ratio: number } | null = null;

const PX_TO_MM = 0.264583; // Conversion factor for 96 DPI

const getLogoData = async (): Promise<{ data: string; ratio: number }> => {
  if (logoCache) return logoCache;

  // Fetch from public folder as a blob to ensure we have the data
  const response = await fetch('/tourflow-logo.png');
  if (!response.ok) throw new Error(`Logo fetch failed: ${response.statusText}`);
  
  const blob = await response.blob();
  
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const data = reader.result as string;
      
      // Load into an image object solely to determine aspect ratio
      const img = new Image();
      img.onload = () => {
        const ratio = img.height / img.width;
        logoCache = { data, ratio };
        resolve(logoCache);
      };
      img.onerror = reject;
      img.src = data;
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const generatePayoutStatement = async (payout: Payout) => {
  const doc = new jsPDF();
  
  // Layout Constants
  // User Requested: 40px left margin (~10.6mm)
  const marginLeft = 40 * PX_TO_MM; 
  const pageWidth = doc.internal.pageSize.getWidth(); // A4 width is 210mm
  const marginRight = pageWidth - marginLeft; // Symmetrical right margin
  
  let y = 20; // Default starting Y
  const lineHeight = 8;

  // --- Header Logo ---
  try {
    const { data, ratio } = await getLogoData();
    
    // User Requested: Target height 48px
    const imgHeight = 48 * PX_TO_MM; // ~12.7mm
    const imgWidth = imgHeight / ratio; // Calculate width to preserve aspect ratio
    
    const logoTopMargin = 10;
    
    // Add image left aligned
    doc.addImage(data, 'PNG', marginLeft, logoTopMargin, imgWidth, imgHeight);
    
    // User Requested: 18px spacing between logo and title
    // logoTopMargin + imgHeight is the bottom Y of the logo
    // We add 18px spacing
    // Note: doc.text y-coordinate is the baseline. We add approx 5mm for the font height of the next line.
    y = logoTopMargin + imgHeight + (18 * PX_TO_MM) + 5; 

  } catch (err) {
    console.warn("PDF Logo generation failed, skipping logo:", err);
    y = 35; // Fallback spacing
  }

  // --- Title ---
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('TourFlow Earnings Statement', marginLeft, y);
  
  // User Requested: Start Payout Reference line at least 16px below title
  // Add line height clearance + 16px spacing
  y += (16 * PX_TO_MM) + 4; 

  // --- Header Metadata ---
  doc.setFontSize(10);
  
  const providerName =
    (payout as any).provider_display_name ||
    (payout as any).provider_name ||
    'Provider';

  const operatorName =
    (payout as any).operator_display_name ||
    (payout as any).operator_name ||
    'Tour Operator';

  const addMetadataRow = (label: string, value: string) => {
    doc.setFont('helvetica', 'bold');
    doc.text(label, marginLeft, y);
    doc.setFont('helvetica', 'normal');
    doc.text(value, marginLeft + 45, y);
    y += lineHeight;
  };

  addMetadataRow('Payout Reference:', payout.payout_reference);
  addMetadataRow('Status:', payout.status.toUpperCase());
  addMetadataRow('Date Created:', formatDate(payout.created_at));
  y += lineHeight / 2; // Extra spacing

  addMetadataRow('Provider:', providerName);
  addMetadataRow('Operator:', operatorName);
  
  const bookingRef = (payout as any).bookings?.booking_reference || payout.booking_id;
  addMetadataRow('Booking Ref:', bookingRef);

  if ((payout as any).tour_title) {
    addMetadataRow('Tour Name:', (payout as any).tour_title);
  }
  if ((payout as any).service_date) {
    addMetadataRow('Service Date:', formatDate((payout as any).service_date));
  }
  
  y += lineHeight;

  // --- Divider ---
  doc.setLineWidth(0.5);
  doc.setDrawColor(200, 200, 200);
  doc.line(marginLeft, y, marginRight, y);
  y += lineHeight * 1.5;

  // --- Financial Details Header ---
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Financial Details', marginLeft, y);
  y += lineHeight * 1.5;

  // --- Financial Rows ---
  doc.setFontSize(11);
  const currency = payout.currency || 'ZAR';
  
  // Calculate value column X position (aligned towards right margin)
  const valueColumnX = marginRight - 30; 

  const addFinanceRow = (label: string, value: number, isDeduction = false, isTotal = false) => {
    if (isTotal) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      y += 2; // Extra spacing before total
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
    }

    doc.text(label, marginLeft, y);
    
    // Format value
    const formattedValue = formatCurrency(Math.abs(value), currency);
    const displayValue = isDeduction ? `-${formattedValue}` : formattedValue;
    
    // Right align value
    doc.text(displayValue, valueColumnX, y, { align: 'right' });
    
    y += lineHeight;
  };

  addFinanceRow('Gross Amount', payout.amount_gross || 0);
  addFinanceRow('Platform Fee', payout.platform_fee || 0, true);
  
  // Total Line
  y += 2;
  doc.setLineWidth(0.2);
  doc.line(marginLeft, y, marginRight, y);
  y += lineHeight;

  addFinanceRow('Net Payout Amount', getPayableAmount(payout) || 0, false, true);

  // VAT Row with rate (Informational)
  y += lineHeight / 2;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`VAT (Included): ${formatCurrency(payout.vat_amount || 0, currency)} @ ${payout.vat_rate || 0}%`, marginLeft, y);
  y += lineHeight;

  // --- Footer ---
  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(150, 150, 150);
  doc.text('TourFlow B2B Platform - System Generated Document', marginLeft, pageHeight - 15);

  // Save File
  doc.save(`TourFlow_Earnings_Statement_${payout.payout_reference}.pdf`);
};

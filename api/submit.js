import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function fmtHours(h) {
  if (h < 0.2) return 'Rest';
  const totalMins = Math.round(Math.round(h * 60 / 15) * 15);
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

// Wrap text to fit within maxWidth using pdf-lib font
function wrapText(text, font, fontSize, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(test, fontSize) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

async function generateStudyPlanPDF({ firstName, lastName, className, currentGrade, goalGrade, priority, hours, examDate, schedule, strategies }) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const { width, height } = page.getSize();

  const font     = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Colors
  const indigo     = rgb(0.427, 0.357, 0.969);
  const indigoDark = rgb(0.298, 0.231, 0.710);
  const indigoLight= rgb(0.937, 0.933, 0.996);
  const ink        = rgb(0.169, 0.169, 0.239);
  const gray       = rgb(0.420, 0.420, 0.500);
  const white      = rgb(1, 1, 1);

  // ── Header bar ──────────────────────────────────────────────────────
  const headerH = 80;
  page.drawRectangle({ x: 0, y: height - headerH, width, height: headerH, color: indigo });

  // Logo
  try {
    const logoPath = path.join(__dirname, '..', 'public', 'logo.png');
    const logoBytes = fs.readFileSync(logoPath);
    const logoImg = await pdfDoc.embedPng(logoBytes);
    const targetH = 38;
    const scale   = targetH / logoImg.height;
    page.drawImage(logoImg, {
      x: 32,
      y: height - headerH + (headerH - targetH) / 2,
      width:  logoImg.width * scale,
      height: targetH,
    });
  } catch {
    page.drawText('Dash Academy', { x: 32, y: height - 48, size: 18, font: fontBold, color: white });
  }

  // URL top-right
  const urlStr = 'studyplan.mydashacademy.com';
  page.drawText(urlStr, {
    x: width - 32 - font.widthOfTextAtSize(urlStr, 8),
    y: height - 48,
    size: 8, font, color: rgb(0.8, 0.76, 1),
  });

  // ── Plan title ──────────────────────────────────────────────────────
  const fullName  = [firstName, lastName].filter(Boolean).join(' ');
  const planTitle = className ? `${fullName}'s Plan — ${className}` : `${fullName}'s Study Plan`;
  let y = height - headerH - 28;

  page.drawText(planTitle, { x: 32, y, size: 15, font: fontBold, color: ink });
  y -= 16;
  page.drawText('Your personalized study plan from Dash Academy', { x: 32, y, size: 9, font, color: gray });
  y -= 14;

  // Divider
  page.drawLine({ start: { x: 32, y }, end: { x: width - 32, y }, thickness: 0.75, color: rgb(0.88, 0.86, 0.97) });
  y -= 20;

  // ── Info grid ───────────────────────────────────────────────────────
  const gradeLabel = { A: 'A (90–100%)', B: 'B (80–89%)', C: 'C (70–79%)', D: 'D (60–69%)', F: 'F / Unsure', pass: 'Just Pass' };
  const focusLabel = { grade: 'Hit a target grade', gpa: 'Protect my GPA', exam: 'Pass the next exam', habits: 'Build better habits' };

  const infoRows = [
    ['Class', className || '—'],
    ['Current Grade', gradeLabel[currentGrade] || currentGrade || '—'],
    ['Goal Grade',    gradeLabel[goalGrade]    || goalGrade    || '—'],
    ['Weekly Hours',  `${hours} hrs/week`],
    ['Focus',         focusLabel[priority] || priority || '—'],
    ...(examDate ? [['Exam / Deadline', examDate]] : []),
  ];

  const col1 = 32, col2 = 160;
  for (const [label, value] of infoRows) {
    page.drawText(label.toUpperCase(), { x: col1, y, size: 7, font: fontBold, color: gray });
    page.drawText(value,               { x: col2, y, size: 9, font: fontBold, color: ink  });
    y -= 17;
  }
  y -= 8;

  // ── Weekly Schedule ─────────────────────────────────────────────────
  page.drawRectangle({ x: 32, y: y - 2, width: width - 64, height: 18, color: indigoLight });
  page.drawText('WEEKLY STUDY SCHEDULE', { x: 38, y: y + 3, size: 7.5, font: fontBold, color: indigo });
  y -= 20;

  const barArea  = 200;
  const maxH     = Math.max(...(schedule || []).map(s => s.hours ?? 0), 1);

  for (const s of (schedule || [])) {
    const hrs    = s.hours ?? 0;
    const isRest = hrs < 0.2;
    const barW   = isRest ? 0 : Math.max(6, Math.round((hrs / maxH) * barArea));

    page.drawText(s.day, { x: 32, y, size: 9, font: fontBold, color: isRest ? gray : ink });

    if (!isRest) {
      page.drawRectangle({ x: 68, y: y - 1, width: barW, height: 10, color: rgb(0.86, 0.82, 0.99) });
    }

    const label = isRest ? 'Rest' : fmtHours(hrs);
    page.drawText(label, {
      x: 68 + barArea + 8, y,
      size: 9, font: isRest ? font : fontBold,
      color: isRest ? gray : indigo,
    });
    y -= 16;
  }
  y -= 8;

  // ── Strategy ────────────────────────────────────────────────────────
  page.drawRectangle({ x: 32, y: y - 2, width: width - 64, height: 18, color: indigoLight });
  page.drawText('YOUR STRATEGY — 4 TACTICS TO MOVE THE NEEDLE', { x: 38, y: y + 3, size: 7.5, font: fontBold, color: indigo });
  y -= 24;

  const tipMaxW = width - 64 - 22;
  for (let i = 0; i < Math.min(4, (strategies || []).length); i++) {
    const tip = strategies[i];
    // Number badge
    page.drawCircle({ x: 42, y: y + 4, size: 8, color: indigo });
    page.drawText(String(i + 1), {
      x: 42 - font.widthOfTextAtSize(String(i + 1), 7) / 2,
      y: y + 1,
      size: 7, font: fontBold, color: white,
    });

    const lines = wrapText(tip, font, 8, tipMaxW);
    for (let li = 0; li < lines.length; li++) {
      page.drawText(lines[li], { x: 56, y: y - li * 12, size: 8, font, color: ink });
    }
    y -= lines.length * 12 + 14;
  }

  // ── Footer CTA ──────────────────────────────────────────────────────
  const footerH = 52;
  page.drawRectangle({ x: 0, y: 0, width, height: footerH, color: indigoDark });

  page.drawText('Ready to make sure this actually works? Book your free strategy call:', {
    x: 32, y: 33, size: 8, font, color: rgb(0.87, 0.82, 1),
  });
  page.drawText('hi.mydashacademy.com/widget/bookings/strategy-session-dashacademy', {
    x: 32, y: 17, size: 8.5, font: fontBold, color: white,
  });

  return await pdfDoc.save();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    email, phone, examDate,
    firstName, lastName,
    className, currentGrade, goalGrade, priority, hours,
    schedule, strategies,
  } = req.body;

  // ── Save to Supabase ────────────────────────────────────────────────
  try {
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/study_plan_submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey':        process.env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        'Prefer':        'return=minimal',
      },
      body: JSON.stringify({
        email,
        phone:          phone    || null,
        exam_date:      examDate || null,
        first_name:     firstName,
        last_name:      lastName || null,
        class_name:     className,
        current_grade:  currentGrade,
        goal_grade:     goalGrade,
        priority,
        hours_per_week: hours,
      }),
    });
  } catch (err) {
    console.error('Supabase error:', err);
  }

  // ── Generate PDF ────────────────────────────────────────────────────
  let pdfBytes;
  try {
    pdfBytes = await generateStudyPlanPDF({
      firstName, lastName, className,
      currentGrade, goalGrade, priority, hours, examDate,
      schedule, strategies,
    });
  } catch (err) {
    console.error('PDF generation error:', err);
  }

  // ── Send via Mailgun ────────────────────────────────────────────────
  try {
    const focusLabels = {
      grade:  'Hit a target grade',
      gpa:    'Protect my GPA',
      exam:   'Pass the next exam',
      habits: 'Build better study habits',
    };
    const examLine  = examDate ? `\nExam/deadline: ${examDate}` : '';
    const phoneLine = phone    ? `\nPhone: ${phone}` : '';

    const emailText = `
Hi ${firstName},

Your free study plan from Dash Academy is ready — and it's attached to this email as a PDF you can save, print, or share.

────────────────────
Class: ${className || 'Your class'}
Current Grade: ${currentGrade} → Goal: ${goalGrade}
Weekly Study Hours: ${hours} hrs/week
Focus: ${focusLabels[priority] || priority}${examLine}${phoneLine}
────────────────────

Your full weekly schedule and personalized strategy tips are inside the attached PDF.

Ready to take it further? A Dash Academy coach can run this plan with you week by week — keeping you on track, adjusting when life gets in the way, and making sure exam day isn't a surprise.

Book your free strategy call here:
https://hi.mydashacademy.com/widget/bookings/strategy-session-dashacademy

— The Dash Academy Team
    `.trim();

    const formData = new FormData();
    formData.append('from',    `Dash Academy <noreply@${process.env.MAILGUN_DOMAIN}>`);
    formData.append('to',      email);
    formData.append('subject', `${firstName}, your free study plan is ready 📚`);
    formData.append('text',    emailText);

    if (pdfBytes) {
      formData.append(
        'attachment',
        new Blob([pdfBytes], { type: 'application/pdf' }),
        'dash-academy-study-plan.pdf',
      );
    }

    await fetch(`https://api.mailgun.net/v3/${process.env.MAILGUN_DOMAIN}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString('base64')}`,
      },
      body: formData,
    });
  } catch (err) {
    console.error('Mailgun error:', err);
  }

  return res.status(200).json({ success: true });
}

import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Plan logic (mirrors client-side) ────────────────────────────────────────

const gradeRank = { A: 4, B: 3, C: 2, D: 1, F: 0, pass: 1 };
const gradeLabel = {
  A: 'A (90–100%)', B: 'B (80–89%)', C: 'C (70–79%)',
  D: 'D (60–69%)', F: 'F / Unsure', pass: 'Just Pass',
};
const focusLabel = {
  grade: 'Hit a target grade', gpa: 'Protect my GPA',
  exam: 'Pass the next exam', habits: 'Build better habits',
};

function buildWeekDistribution(hours, priority) {
  let weights;
  if (priority === 'exam')        weights = [1.4, 1.4, 1.6, 1.6, 1.0, 0.6, 0.4];
  else if (priority === 'habits') weights = [1.2, 1.2, 1.2, 1.2, 1.2, 0.5, 0.5];
  else if (priority === 'gpa')    weights = [1.3, 1.3, 1.4, 1.4, 0.8, 0.5, 0.3];
  else                            weights = [1.2, 1.1, 1.3, 1.3, 0.9, 0.6, 0.6];
  const total = weights.reduce((a, b) => a + b, 0);
  return weights.map(w => Math.round((w / total) * hours * 10) / 10);
}

function getStrategy(currentGrade, goalGrade, priority, hours, className) {
  const gap = Math.max(0, (gradeRank[goalGrade] ?? 3) - (gradeRank[currentGrade] ?? 2));
  const cls = className || 'your class';
  const tips = [];

  if (gap >= 1.5) {
    tips.push(`Rework every problem you've gotten wrong so far in ${cls} from scratch, without looking at the solution first — this is called "error logging," and it closes the exact gaps costing you points.`);
    tips.push(`Use active recall instead of re-reading: close your notes and write out everything you remember about a topic in ${cls} before checking. Research on the testing effect shows this builds stronger, longer-lasting retention.`);
  } else if (gap > 0) {
    tips.push(`Spend your first two sessions each week on retrieval practice for the 2–3 topics in ${cls} where you've lost the most points — quizzing yourself from memory rather than rereading notes.`);
  } else {
    tips.push(`You're maintaining your grade, so use spaced repetition: revisit material on a schedule (1 day, 3 days, 1 week later) instead of cramming before deadlines. Spacing out review is one of the most well-supported findings in learning research.`);
  }

  if (priority === 'exam') {
    tips.push(`Interleave your practice: mix problem types from different topics in ${cls} within the same session rather than drilling one topic at a time. Studies show interleaving improves your ability to identify problem types on exam day.`);
    tips.push('In your final 3 days before the exam, do timed practice under realistic conditions — no notes, a clock running — so the format itself is not a surprise.');
  } else if (priority === 'gpa') {
    tips.push('List every assignment and exam with its point weight so you can see which grades move your GPA the most, then allocate study time proportionally rather than evenly.');
    tips.push('Knock out smaller assignments early in the week in short focused sessions, so they don\'t eat into the longer blocks you need for exam prep.');
  } else if (priority === 'habits') {
    tips.push('Study at the same time and place each day this week. Habit research shows consistent cues — time and location — build the habit faster than session length does.');
    tips.push('Keep a short daily log of what you studied and for how long. Seeing the streak in writing makes it far easier to notice when momentum is slipping.');
  } else {
    tips.push('Break sessions into focused 25–40 minute blocks with short breaks between them. Sustained, undivided attention produces better retention than longer unbroken sessions.');
  }

  if (hours <= 3) {
    tips.push('With limited hours, spend nearly all of it on active practice — problems, self-quizzing — rather than rereading. Passive review is the lowest-return use of a small time budget.');
  } else if (hours >= 14) {
    tips.push('With this much time, add a dedicated weekly session that only reviews your error log from past assignments and quizzes. Revisiting mistakes has a stronger effect on retention than an equal amount of time on new material.');
  }

  return tips.slice(0, 4);
}

function fmtHours(h) {
  if (h < 0.2) return 'Rest';
  const totalMins = Math.round(Math.round(h * 60 / 15) * 15);
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
}

// Word-wrap helper
function wrapText(text, font, size, maxW) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// ── PDF builder ──────────────────────────────────────────────────────────────

async function generateStudyPlanPDF({ firstName, lastName, className, currentGrade, goalGrade, priority, hours, examDate }) {
  const n = Number(hours);
  const distribution = buildWeekDistribution(n, priority);
  const strategies   = getStrategy(currentGrade, goalGrade, priority, n, className);
  const days         = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const pdfDoc   = await PDFDocument.create();
  const page     = pdfDoc.addPage([612, 864]); // slightly taller for content
  const { width, height } = page.getSize();

  const font     = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Palette
  const indigo      = rgb(0.427, 0.357, 0.969);
  const indigoDark  = rgb(0.298, 0.231, 0.710);
  const indigoMid   = rgb(0.482, 0.361, 0.941);
  const indigoLight = rgb(0.937, 0.933, 0.996);
  const ink         = rgb(0.169, 0.169, 0.239);
  const grayText    = rgb(0.420, 0.420, 0.500);
  const white       = rgb(1, 1, 1);
  const border      = rgb(0.906, 0.898, 0.953);
  const green       = rgb(0.180, 0.745, 0.494);

  const PAD = 32;

  // ── Gradient-style header card ───────────────────────────────────────
  const hdrH = 110;
  // Dark base
  page.drawRectangle({ x: 0, y: height - hdrH, width, height: hdrH, color: indigoDark });
  // Lighter overlay strip (simulates gradient)
  page.drawRectangle({ x: 0, y: height - hdrH, width: width * 0.6, height: hdrH, color: rgb(0.341, 0.267, 0.769) });

  // Logo
  let logoDrawn = false;
  try {
    const logoBytes = fs.readFileSync(path.join(__dirname, '..', 'public', 'logo.png'));
    const logoImg   = await pdfDoc.embedPng(logoBytes);
    const targetH   = 36;
    const logoW     = logoImg.width * (targetH / logoImg.height);
    page.drawImage(logoImg, {
      x: PAD, y: height - hdrH + (hdrH - targetH) / 2,
      width: logoW, height: targetH,
    });
    logoDrawn = true;
  } catch { /* fallback below */ }

  if (!logoDrawn) {
    page.drawText('DASH ACADEMY', { x: PAD, y: height - 56, size: 14, font: fontBold, color: white });
  }

  // URL top-right
  const urlStr = 'studyplan.mydashacademy.com';
  page.drawText(urlStr, {
    x: width - PAD - font.widthOfTextAtSize(urlStr, 8),
    y: height - 44, size: 8, font, color: rgb(0.75, 0.70, 0.97),
  });

  // ── Plan header card (purple rounded card look) ──────────────────────
  const cardTop = height - hdrH - 12;
  const cardH   = 78;
  page.drawRectangle({ x: PAD, y: cardTop - cardH, width: width - PAD * 2, height: cardH, color: indigo, borderRadius: 10 });

  // "YOUR PERSONALIZED PLAN" label
  page.drawText('YOUR PERSONALIZED PLAN', {
    x: PAD + 14, y: cardTop - 20,
    size: 7.5, font: fontBold, color: rgb(0.82, 0.78, 1),
  });

  // Student + class title
  const fullName  = [firstName, lastName].filter(Boolean).join(' ');
  const planTitle = className ? `${fullName}'s plan for ${className}` : `${fullName}'s study plan`;
  page.drawText(planTitle, {
    x: PAD + 14, y: cardTop - 36,
    size: 13, font: fontBold, color: white,
  });

  // Subtitle line
  const focusSub = focusLabel[priority] || priority;
  let subParts = [`${n} hrs/week`, focusSub];
  if (examDate) {
    const d = new Date(examDate + 'T00:00:00');
    const daysLeft = Math.ceil((d - new Date()) / 86400000);
    if (daysLeft > 0) subParts.push(`${daysLeft} days to your exam`);
  }
  page.drawText(subParts.join(' · '), {
    x: PAD + 14, y: cardTop - 52,
    size: 8.5, font, color: rgb(0.87, 0.84, 1),
  });

  // ── Stat cards row ───────────────────────────────────────────────────
  let y = cardTop - cardH - 16;
  const statW = (width - PAD * 2 - 16) / 3;

  const curL  = (currentGrade || '').toUpperCase();
  const goalL = gradeLabel[goalGrade]?.split(' ')[0] || (goalGrade || '').toUpperCase();
  const stats = [
    { top: `${curL} → ${goalL}`, bot: 'Grade goal' },
    { top: `${n} hrs`,           bot: 'hrs/week'   },
    { top: focusSub.split(' ').slice(0, 2).join(' '), bot: 'Focus mode' },
  ];

  stats.forEach((s, i) => {
    const sx = PAD + i * (statW + 8);
    page.drawRectangle({ x: sx, y: y - 52, width: statW, height: 52, color: white, borderRadius: 8 });
    page.drawRectangle({ x: sx, y: y - 52, width: statW, height: 52, borderColor: border, borderWidth: 1, borderRadius: 8 });

    const tw = fontBold.widthOfTextAtSize(s.top, 11);
    page.drawText(s.top, { x: sx + (statW - tw) / 2, y: y - 26, size: 11, font: fontBold, color: ink });
    const bw = font.widthOfTextAtSize(s.bot, 8);
    page.drawText(s.bot, { x: sx + (statW - bw) / 2, y: y - 40, size: 8,  font, color: grayText });
  });
  y -= 66;

  // ── Effort bar card ──────────────────────────────────────────────────
  const gap = Math.max(0, (gradeRank[goalGrade] ?? 3) - (gradeRank[currentGrade] ?? 2));
  let fillPct, effortLabel, effortNote;
  if (gap === 0)      { fillPct = 30; effortLabel = 'Low';       effortNote = 'You\'re maintaining — consistency is your main lever here.'; }
  else if (gap <= 1)  { fillPct = 55; effortLabel = 'Moderate';  effortNote = 'A focused, achievable jump with consistent weekly effort.'; }
  else if (gap <= 2)  { fillPct = 75; effortLabel = 'High';      effortNote = 'A real stretch goal — doable, but it\'ll take disciplined weekly work.'; }
  else                { fillPct = 92; effortLabel = 'Intensive'; effortNote = 'An ambitious goal. Pairing this plan with coaching is the fastest path.'; }

  page.drawRectangle({ x: PAD, y: y - 60, width: width - PAD * 2, height: 60, color: white, borderRadius: 8 });
  page.drawRectangle({ x: PAD, y: y - 60, width: width - PAD * 2, height: 60, borderColor: border, borderWidth: 1, borderRadius: 8 });

  page.drawText('Effort required to close the gap', { x: PAD + 14, y: y - 18, size: 8.5, font, color: grayText });
  page.drawText(effortLabel, { x: width - PAD - 14 - fontBold.widthOfTextAtSize(effortLabel, 8.5), y: y - 18, size: 8.5, font: fontBold, color: ink });

  // Bar track
  const barTrackW = width - PAD * 2 - 28;
  page.drawRectangle({ x: PAD + 14, y: y - 34, width: barTrackW, height: 8, color: rgb(0.9, 0.89, 0.97), borderRadius: 4 });
  // Bar fill (gradient-ish: green → indigo)
  const fillW = Math.round(barTrackW * fillPct / 100);
  page.drawRectangle({ x: PAD + 14, y: y - 34, width: fillW, height: 8, color: gap <= 1 ? green : indigo, borderRadius: 4 });

  page.drawText(effortNote, { x: PAD + 14, y: y - 50, size: 7.5, font, color: grayText });
  y -= 74;

  // ── Weekly Schedule section ──────────────────────────────────────────
  page.drawText('YOUR WEEKLY STUDY SCHEDULE', { x: PAD, y, size: 8, font: fontBold, color: ink });
  y -= 12;

  const rowH   = 30;
  const barMax = width - PAD * 2 - 60 - 50; // space for label left + time right
  const maxH   = Math.max(...distribution, 1);

  days.forEach((day, i) => {
    const hrs    = distribution[i];
    const isRest = hrs < 0.2;
    const barW   = isRest ? 0 : Math.max(8, Math.round((hrs / maxH) * barMax));

    // Row bg
    page.drawRectangle({ x: PAD, y: y - rowH + 4, width: width - PAD * 2, height: rowH, color: white, borderRadius: 8 });
    page.drawRectangle({ x: PAD, y: y - rowH + 4, width: width - PAD * 2, height: rowH, borderColor: border, borderWidth: 0.75, borderRadius: 8 });

    // Day label
    page.drawText(day, { x: PAD + 12, y: y - 10, size: 9, font: fontBold, color: isRest ? grayText : ink });

    // Bar
    if (!isRest) {
      page.drawRectangle({ x: PAD + 52, y: y - rowH + 11, width: barW, height: 12, color: indigoLight, borderRadius: 3 });
      page.drawRectangle({ x: PAD + 52, y: y - rowH + 11, width: Math.min(barW, 24), height: 12, color: rgb(0.73, 0.67, 0.99), borderRadius: 3 });
    }

    // Time label
    const timeStr = isRest ? 'Rest' : fmtHours(hrs);
    page.drawText(timeStr, {
      x: width - PAD - 12 - fontBold.widthOfTextAtSize(timeStr, 9.5),
      y: y - 10, size: 9.5, font: fontBold, color: isRest ? grayText : indigo,
    });

    y -= rowH + 4;
  });
  y -= 10;

  // ── Strategy section ─────────────────────────────────────────────────
  page.drawText('YOUR STRATEGY — 4 TACTICS TO MOVE THE NEEDLE', { x: PAD, y, size: 8, font: fontBold, color: ink });
  y -= 12;

  const tipMaxW = width - PAD * 2 - 32;

  strategies.forEach((tip, i) => {
    const lines    = wrapText(tip, font, 8.5, tipMaxW);
    const cardHeight = lines.length * 12 + 24;

    // Card bg
    page.drawRectangle({ x: PAD, y: y - cardHeight + 4, width: width - PAD * 2, height: cardHeight, color: white, borderRadius: 8 });
    page.drawRectangle({ x: PAD, y: y - cardHeight + 4, width: width - PAD * 2, height: cardHeight, borderColor: border, borderWidth: 0.75, borderRadius: 8 });

    // Number badge
    page.drawCircle({ x: PAD + 20, y: y - 10, size: 10, color: indigo });
    const numStr = String(i + 1);
    page.drawText(numStr, {
      x: PAD + 20 - fontBold.widthOfTextAtSize(numStr, 7.5) / 2,
      y: y - 13.5,
      size: 7.5, font: fontBold, color: white,
    });

    // Tip text
    lines.forEach((line, li) => {
      page.drawText(line, { x: PAD + 36, y: y - 9 - li * 12, size: 8.5, font, color: ink });
    });

    y -= cardHeight + 6;
  });

  y -= 6;

  // ── CTA footer card ──────────────────────────────────────────────────
  const ctaH = 68;
  page.drawRectangle({ x: PAD, y: y - ctaH, width: width - PAD * 2, height: ctaH, color: indigo, borderRadius: 10 });

  page.drawText('Want to make sure this actually works?', {
    x: PAD + 14, y: y - 22, size: 10, font: fontBold, color: white,
  });
  page.drawText('A Dash coach will run this plan with you week by week — keeping you on track', {
    x: PAD + 14, y: y - 36, size: 7.5, font, color: rgb(0.87, 0.84, 1),
  });
  page.drawText('and making sure exam day isn\'t a surprise.', {
    x: PAD + 14, y: y - 47, size: 7.5, font, color: rgb(0.87, 0.84, 1),
  });

  // Book button look
  const btnW = 200, btnH = 24;
  page.drawRectangle({ x: PAD + 14, y: y - ctaH + 8, width: btnW, height: btnH, color: white, borderRadius: 6 });
  const btnText = 'Book a Free Strategy Call';
  page.drawText(btnText, {
    x: PAD + 14 + (btnW - fontBold.widthOfTextAtSize(btnText, 8)) / 2,
    y: y - ctaH + 17,
    size: 8, font: fontBold, color: indigo,
  });

  return await pdfDoc.save();
}

// ── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    email, phone, examDate,
    firstName, lastName,
    className, currentGrade, goalGrade, priority, hours,
  } = req.body;

  // ── Save to Supabase ─────────────────────────────────────────────────
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

  // ── Generate PDF ─────────────────────────────────────────────────────
  let pdfBytes;
  try {
    pdfBytes = await generateStudyPlanPDF({
      firstName, lastName, className,
      currentGrade, goalGrade, priority,
      hours, examDate,
    });
  } catch (err) {
    console.error('PDF generation error:', err);
  }

  // ── Send via Mailgun ─────────────────────────────────────────────────
  try {
    const focusLabels = {
      grade: 'Hit a target grade', gpa: 'Protect my GPA',
      exam:  'Pass the next exam', habits: 'Build better study habits',
    };
    const examLine  = examDate ? `\nExam/deadline: ${examDate}` : '';
    const phoneLine = phone    ? `\nPhone: ${phone}` : '';

    const emailText = `
Hi ${firstName},

Your free study plan from Dash Academy is attached as a PDF — save it, print it, or pull it up on your phone.

────────────────────
Class: ${className || 'Your class'}
Current Grade: ${currentGrade} → Goal: ${goalGrade}
Weekly Study Hours: ${hours} hrs/week
Focus: ${focusLabels[priority] || priority}${examLine}${phoneLine}
────────────────────

Ready to make sure this actually works? A Dash Academy coach can run this plan with you week by week — keeping you on track, adjusting when life gets in the way, and making sure exam day isn't a surprise.

Book your free strategy call:
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

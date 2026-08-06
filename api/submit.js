export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    email, phone, examDate,
    firstName, lastName,
    className, currentGrade, goalGrade, priority, hours,
    pdfBase64,
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

    const auth   = `Basic ${Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString('base64')}`;
    const mgUrl  = `https://api.mailgun.net/v3/${process.env.MAILGUN_DOMAIN}/messages`;

    if (pdfBase64) {
      // Send with PDF attachment via multipart
      const pdfBuffer = Buffer.from(pdfBase64, 'base64');
      const formData  = new FormData();
      formData.append('from',    `Dash Academy <noreply@${process.env.MAILGUN_DOMAIN}>`);
      formData.append('to',      email);
      formData.append('subject', `${firstName}, your free study plan is ready 📚`);
      formData.append('text',    emailText);
      formData.append('attachment', new Blob([pdfBuffer], { type: 'application/pdf' }), 'dash-academy-study-plan.pdf');
      await fetch(mgUrl, { method: 'POST', headers: { 'Authorization': auth }, body: formData });
    } else {
      // No PDF — send plain email
      const body = new URLSearchParams();
      body.append('from',    `Dash Academy <noreply@${process.env.MAILGUN_DOMAIN}>`);
      body.append('to',      email);
      body.append('subject', `${firstName}, your free study plan is ready 📚`);
      body.append('text',    emailText);
      await fetch(mgUrl, { method: 'POST', headers: { 'Authorization': auth, 'Content-Type': 'application/x-www-form-urlencoded' }, body });
    }
  } catch (err) {
    console.error('Mailgun error:', err);
  }

  return res.status(200).json({ success: true });
}

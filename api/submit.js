export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, firstName, className, currentGrade, goalGrade, priority, hours } = req.body;

  // --- Save to Supabase ---
  try {
    await fetch(`${process.env.SUPABASE_URL}/rest/v1/study_plan_submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        email,
        first_name: firstName,
        class_name: className,
        current_grade: currentGrade,
        goal_grade: goalGrade,
        priority,
        hours_per_week: hours
      })
    });
  } catch (err) {
    console.error('Supabase error:', err);
  }

  // --- Send email via Mailgun ---
  try {
    const emailText = `
Hi ${firstName},

Your free study plan from Dash Academy is ready!

Class: ${className || 'Your class'}
Current Grade: ${currentGrade} → Goal: ${goalGrade}
Weekly Hours: ${hours} hrs/week
Focus: ${priority}

Head back to your study plan page to view your full breakdown and weekly schedule.

Want real results? Book a free strategy call with a Dash Academy coach:
https://hi.mydashacademy.com/widget/bookings/strategy-session-dashacademy

— The Dash Academy Team
    `.trim();

    const formData = new URLSearchParams();
    formData.append('from', `Dash Academy <noreply@${process.env.MAILGUN_DOMAIN}>`);
    formData.append('to', email);
    formData.append('subject', `${firstName}, your free study plan is ready`);
    formData.append('text', emailText);

    await fetch(`https://api.mailgun.net/v3/${process.env.MAILGUN_DOMAIN}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${process.env.MAILGUN_API_KEY}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData
    });
  } catch (err) {
    console.error('Mailgun error:', err);
  }

  return res.status(200).json({ success: true });
}

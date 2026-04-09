"""
StriveX Automated Email Sequences
Behavioral email triggers based on user actions and patterns
"""
from datetime import datetime, timedelta
from models import db, User, Goal, Task
from intelligence import gemini
import os
from loguru import logger

# Email provider (use SendGrid in production)
try:
    from sendgrid import SendGridAPIClient
    SENDGRID_API_KEY = os.environ.get('SENDGRID_API_KEY')
    sg = SendGridAPIClient(SENDGRID_API_KEY) if SENDGRID_API_KEY else None
except ImportError:
    sg = None


def send_email(to_email, subject, html_content, text_content=""):
    """
    Send email via SendGrid (or log if not configured).
    In development, just logs the email instead of sending.
    """
    if not sg or not SENDGRID_API_KEY:
        logger.info(f"📧 EMAIL (dev mode - not sent):")
        logger.info(f"   To: {to_email}")
        logger.info(f"   Subject: {subject}")
        logger.info(f"   HTML: {html_content[:200]}...")
        return True
    
    try:
        message = {
            'personalizations': [{'to': [{'email': to_email}]}],
            'from': {'email': 'noreply@strivex.app', 'name': 'StriveX'},
            'subject': subject,
            'content': [
                {'type': 'text/plain', 'value': text_content},
                {'type': 'text/html', 'value': html_content}
            ]
        }
        
        response = sg.client.mail.send.post(request_body=message)
        logger.info(f"✅ Email sent to {to_email}: {subject}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        return False


# ════════════════════════════════════════════════════════════
# EMAIL SEQUENCE TEMPLATES
# ════════════════════════════════════════════════════════════

TEMPLATES = {
    'welcome': {
        'subject': "Welcome to StriveX! Let's crush your first goal 🚀",
        'html': lambda name: f"""
        <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #5e6ad2;">Welcome to StriveX, {name}! 🎉</h1>
            
            <p>You've just joined thousands of high-performers who use StriveX to:</p>
            <ul>
                <li>✅ Eliminate decision fatigue</li>
                <li>✅ Build unbreakable habits</li>
                <li>✅ Achieve goals 3x faster</li>
            </ul>
            
            <h2 style="margin-top: 32px;">Your First Steps:</h2>
            <ol>
                <li><strong>Add your first goal</strong> — What's the ONE thing you want to achieve this month?</li>
                <li><strong>Let AI break it down</strong> — We'll create a step-by-step plan</li>
                <li><strong>Trust the schedule</strong> — We'll find your peak performance windows</li>
            </ol>
            
            <a href="https://strivex.app/dashboard?view=goals" 
               style="display: inline-block; background: linear-gradient(135deg, #5e6ad2, #764ba2); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 20px;">
                Add Your First Goal →
            </a>
            
            <p style="margin-top: 32px; color: #666;">
                Need help? Reply to this email — we read every message.<br>
                <strong>— The StriveX Team</strong>
            </p>
        </div>
        """
    },
    
    'first_goal_created': {
        'subject': "Goal added! Here's what happens next 🎯",
        'html': lambda name, goal_title: f"""
        <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Awesome goal, {name}! 🎯</h2>
            
            <p><strong>"{goal_title}"</strong> is now being tracked.</p>
            
            <h3 style="margin-top: 32px;">What Happens Next:</h3>
            <div style="background: #f5f7ff; padding: 20px; border-radius: 8px; margin: 16px 0;">
                <p><strong>1️⃣ AI Analysis</strong><br>
                We're analyzing your goal complexity and estimated effort.</p>
                
                <p><strong>2️⃣ Smart Breakdown</strong><br>
                We'll suggest 5-7 actionable subtasks (you can edit these).</p>
                
                <p><strong>3️⃣ Optimal Scheduling</strong><br>
                Tasks will be scheduled around your existing commitments.</p>
                
                <p><strong>4️⃣ Real-Time Adaptation</strong><br>
                Life happens! We'll automatically reschedule if you fall behind.</p>
            </div>
            
            <p style="color: #666; font-size: 14px;">
                💡 <strong>Pro tip:</strong> Goals with deadlines are 76% more likely to be achieved. 
                Make sure you've set a realistic deadline!
            </p>
        </div>
        """
    },
    
    'first_week_milestone': {
        'subject': "You're on fire! Week 1 recap 🔥",
        'html': lambda name, stats: f"""
        <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #5e6ad2;">Week 1 Complete! 🔥</h2>
            
            <p>Amazing start, {name}! Here's what you accomplished:</p>
            
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 24px 0;">
                <div style="text-align: center; padding: 16px; background: #f0f4ff; border-radius: 8px;">
                    <div style="font-size: 32px; font-weight: bold; color: #5e6ad2;">{stats['tasks_completed']}</div>
                    <div style="font-size: 12px; color: #666;">Tasks Done</div>
                </div>
                <div style="text-align: center; padding: 16px; background: #fff4f0; border-radius: 8px;">
                    <div style="font-size: 32px; font-weight: bold; color: #f97316;">{stats['focus_minutes']}</div>
                    <div style="font-size: 12px; color: #666;">Focus Minutes</div>
                </div>
                <div style="text-align: center; padding: 16px; background: #f0fff4; border-radius: 8px;">
                    <div style="font-size: 32px; font-weight: bold; color: #22c55e;">{stats['streak_days']}</div>
                    <div style="font-size: 12px; color: #666;">Day Streak</div>
                </div>
            </div>
            
            <p><strong>What's working:</strong></p>
            <ul>
                <li>✅ You're building momentum</li>
                <li>✅ Morning productivity is up 40%</li>
                <li>✅ Consistency score: {stats['consistency_score']}%</li>
            </ul>
            
            <p style="background: #fef3c7; padding: 16px; border-radius: 8px; border-left: 4px solid #f59e0b;">
                <strong>💡 Insight:</strong> Users who maintain a 7-day streak are 3x more likely to achieve their monthly goals. 
                You're at {stats['streak_days']} days — keep going!
            </p>
            
            <a href="https://strivex.app/dashboard" 
               style="display: inline-block; background: linear-gradient(135deg, #5e6ad2, #764ba2); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 20px;">
                Keep the Streak Going →
            </a>
        </div>
        """
    },
    
    'streak_saved': {
        'subject': "Nice save! Your streak is safe 🎉",
        'html': lambda name, streak: f"""
        <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #22c55e;">Streak Saved! 🎉</h2>
            
            <p>Great job, {name}! You completed a task just in time.</p>
            
            <div style="text-align: center; padding: 32px; background: linear-gradient(135deg, #f0fff4, #dcfce7); border-radius: 12px; margin: 24px 0;">
                <div style="font-size: 64px;">🔥</div>
                <div style="font-size: 48px; font-weight: bold; color: #22c55e;">{streak} Days</div>
                <div style="color: #666; margin-top: 8px;">Current Streak</div>
            </div>
            
            <p><strong>Why this matters:</strong></p>
            <ul>
                <li>Research shows it takes 66 days to form a habit</li>
                <li>You're {streak} days in ({round(streak/66*100)}% there!)</li>
                <li>Every day you maintain this, the neural pathway gets stronger</li>
            </ul>
            
            <p style="font-style: italic; color: #666; border-left: 4px solid #5e6ad2; padding-left: 16px;">
                "We are what we repeatedly do. Excellence, then, is not an act, but a habit." 
                <br>— Aristotle
            </p>
        </div>
        """
    },
    
    'at_risk_churn': {
        'subject': "Everything okay? We miss you 👋",
        'html': lambda name, days_inactive: f"""
        <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Hey {name}, just checking in 👋</h2>
            
            <p>We noticed you haven't logged in for <strong>{days_inactive} days</strong>.</p>
            
            <p style="color: #666;">Life gets busy, we get it. But here's what we've observed:</p>
            
            <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <strong>📊 Data Point:</strong> Users who take a 3+ day break are 67% less likely to achieve their monthly goals.
            </div>
            
            <p><strong>Here's how to jump back in (takes 2 minutes):</strong></p>
            <ol>
                <li>Open StriveX → See today's auto-generated schedule</li>
                <li>Complete ONE small task (even 5-minute ones count!)</li>
                <li>We'll handle the rest — momentum will rebuild naturally</li>
            </ol>
            
            <a href="https://strivex.app/dashboard" 
               style="display: inline-block; background: linear-gradient(135deg, #5e6ad2, #764ba2); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: bold; margin-top: 20px;">
                Get Back on Track →
            </a>
            
            <p style="margin-top: 32px; color: #666; font-size: 14px;">
                P.S. If you're struggling with something, reply to this email. 
                We're here to help, not sell you more stuff.
            </p>
        </div>
        """
    },
    
    'subscription_welcome': {
        'subject': "Welcome to StriveX Premium! Here's what's unlocked 🚀",
        'html': lambda name, tier: f"""
        <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #5e6ad2;">You're Now {tier.title()}! 🎉</h1>
            
            <p>Welcome to the inner circle, {name}!</p>
            
            <div style="background: linear-gradient(135deg, #f5f7ff, #eef2ff); padding: 24px; border-radius: 12px; margin: 24px 0;">
                <h3 style="margin-top: 0;">Your {tier.title()} Perks:</h3>
                <ul style="line-height: 2;">
                    {'✅ <strong>Unlimited AI breakdowns</strong> — No more 5/month limit' if tier == 'premium' else ''}
                    {'✅ <strong>Team collaboration</strong> — Invite accountability partners' if tier == 'pro' else ''}
                    ✅ <strong>Advanced analytics</strong> — Deep insights into your patterns
                    ✅ <strong>Priority support</strong> — We respond within 2 hours
                    ✅ <strong>Early access</strong> — New features before anyone else
                </ul>
            </div>
            
            <p><strong>Recommended next steps:</strong></p>
            <ol>
                <li>Explore the new analytics dashboard</li>
                <li>Break down that big goal you've been thinking about</li>
                <li>Reply to this email with any questions</li>
            </ol>
            
            <p style="color: #666; font-size: 14px; margin-top: 32px;">
                Thank you for supporting StriveX! Your subscription directly funds 
                continuous improvement and new features.
            </p>
        </div>
        """
    }
}


# ════════════════════════════════════════════════════════════
# TRIGGER FUNCTIONS
# ════════════════════════════════════════════════════════════

def trigger_welcome_email(user):
    """Send welcome email when user signs up"""
    template = TEMPLATES['welcome']
    name = user.name or user.email.split('@')[0]
    
    return send_email(
        to_email=user.email,
        subject=template['subject'],
        html_content=template['html'](name),
        text_content=f"Welcome to StriveX, {name}!"
    )


def trigger_first_goal_email(user, goal_title):
    """Send email when user creates first goal"""
    template = TEMPLATES['first_goal_created']
    name = user.name or user.email.split('@')[0]
    
    return send_email(
        to_email=user.email,
        subject=template['subject'],
        html_content=template['html'](name, goal_title),
        text_content=f"Goal added: {goal_title}"
    )


def trigger_weekly_milestone_email(user, stats):
    """Send weekly progress recap"""
    template = TEMPLATES['first_week_milestone']
    name = user.name or user.email.split('@')[0]
    
    return send_email(
        to_email=user.email,
        subject=template['subject'],
        html_content=template['html'](name, stats),
        text_content=f"Week 1 complete! Tasks: {stats['tasks_completed']}, Focus: {stats['focus_minutes']}min, Streak: {stats['streak_days']} days"
    )


def trigger_streak_saved_email(user, streak_count):
    """Send email when user saves a long streak (7+ days)"""
    template = TEMPLATES['streak_saved']
    name = user.name or user.email.split('@')[0]
    
    return send_email(
        to_email=user.email,
        subject=template['subject'],
        html_content=template['html'](name, streak_count),
        text_content=f"Streak saved! {streak_count} days"
    )


def trigger_churn_risk_email(user, days_inactive):
    """Send re-engagement email after 3+ days of inactivity"""
    template = TEMPLATES['at_risk_churn']
    name = user.name or user.email.split('@')[0]
    
    return send_email(
        to_email=user.email,
        subject=template['subject'],
        html_content=template['html'](name, days_inactive),
        text_content=f"Checking in after {days_inactive} days"
    )


def trigger_subscription_welcome(user, tier):
    """Send welcome email after subscription upgrade"""
    template = TEMPLATES['subscription_welcome']
    name = user.name or user.email.split('@')[0]
    
    return send_email(
        to_email=user.email,
        subject=template['subject'],
        html_content=template['html'](name, tier),
        text_content=f"Welcome to {tier}!"
    )


# ════════════════════════════════════════════════════════════
# SCHEDULED EMAIL JOBS
# ════════════════════════════════════════════════════════════

def check_and_send_scheduled_emails():
    """
    Run this daily via cron/scheduler.
    Checks all users and sends appropriate automated emails.
    """
    logger.info("Running daily email sequence checks...")
    
    users = User.query.all()
    today = datetime.utcnow().date()
    
    for user in users:
        try:
            # Weekly milestone (send on day 7, 14, 21, 30)
            if user.created_at.date() <= today - timedelta(days=7):
                days_since_signup = (today - user.created_at.date()).days
                week_number = days_since_signup // 7
                
                if days_since_signup % 7 == 0 and week_number <= 4:  # Only first 4 weeks
                    stats = calculate_user_stats(user)
                    trigger_weekly_milestone_email(user, stats)
            
            # Streak celebration (7, 14, 30 days)
            if user.streak_count in [7, 14, 30]:
                # Check if already emailed for this streak
                last_streak_email = user.last_activity_date  # Could add separate field
                if last_streak_email and (today - last_streak_email).days < 7:
                    pass  # Already emailed recently
                else:
                    trigger_streak_saved_email(user, user.streak_count)
            
            # Churn risk (3, 7, 14 days inactive)
            if user.last_activity_date:
                days_inactive = (today - user.last_activity_date).days
                if days_inactive in [3, 7, 14]:
                    trigger_churn_risk_email(user, days_inactive)
        
        except Exception as e:
            logger.error(f"Email sequence failed for user {user.id}: {e}")
            continue
    
    logger.info("Daily email sequence complete.")


def calculate_user_stats(user):
    """Calculate user statistics for email templates"""
    from sqlalchemy import func
    
    # Get tasks completed in last 7 days
    week_ago = datetime.utcnow() - timedelta(days=7)
    tasks_completed = Task.query.join(Task.goal).filter(
        Task.goal.has(user_id=user.id),
        Task.completed_at >= week_ago,
        Task.status == 'completed'
    ).count()
    
    # Estimate focus minutes (from Pomodoro sessions)
    # Since this is the backend, we can't access localStorage.
    # We will estimate focus minutes based on completed task estimated hours.
    focus_minutes = db.session.query(func.sum(Task.estimated_hours)).join(Task.goal).filter(
        Task.goal.has(user_id=user.id),
        Task.completed_at >= week_ago,
        Task.status == 'completed'
    ).scalar()
    focus_minutes = int((focus_minutes or 0) * 60)
    
    return {
        'tasks_completed': tasks_completed,
        'focus_minutes': focus_minutes,
        'streak_days': user.streak_count or 0,
        'consistency_score': min(100, (tasks_completed / 10) * 100)  # Simplified
    }


logger.info("✅ Email sequence service initialized")

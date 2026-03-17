"""
StriveX Premium Features & Usage Tracking System
Tracks API usage, enforces limits, and manages subscription tiers
"""
from datetime import datetime, timedelta
from functools import wraps
from flask import request, jsonify
import json
from models import db  # Import db from models
from loguru import logger  # Add logger

# Import token_required decorator (will be passed during initialization)
token_required = None

# Subscription tiers
TIERS = {
    'free': {
        'name': 'Free',
        'price': 0,
        'ai_breakdowns_per_month': 5,
        'advanced_analytics': False,
        'custom_badges': False,
        'priority_support': False,
        'early_access': False,
        'team_collaboration': False,
        'api_access': False,
        'custom_integrations': False,
        'dedicated_support': False
    },
    'premium': {
        'name': 'Premium',
        'price': 4.99,
        'ai_breakdowns_per_month': -1,  # unlimited
        'advanced_analytics': True,
        'custom_badges': True,
        'priority_support': True,
        'early_access': True,
        'team_collaboration': False,
        'api_access': False,
        'custom_integrations': False,
        'dedicated_support': False
    },
    'pro': {
        'name': 'Pro',
        'price': 9.99,
        'ai_breakdowns_per_month': -1,  # unlimited
        'advanced_analytics': True,
        'custom_badges': True,
        'priority_support': True,
        'early_access': True,
        'team_collaboration': True,
        'api_access': True,
        'custom_integrations': True,
        'dedicated_support': True
    }
}


def check_usage_limit(user, feature):
    """
    Check if user has exceeded their usage limit for a feature.
    Returns (allowed, remaining, reset_date)
    """
    tier_name = getattr(user, 'subscription_tier', 'free') or 'free'
    tier = TIERS.get(tier_name, TIERS['free'])
    
    if feature == 'ai_breakdown':
        limit = tier['ai_breakdowns_per_month']
        
        # Unlimited
        if limit == -1:
            return True, -1, None
        
        # Count usage this month
        month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        usage_count = AIBreakdownUsage.query.filter(
            AIBreakdownUsage.user_id == user.id,
            AIBreakdownUsage.created_at >= month_start
        ).count()
        
        remaining = max(0, limit - usage_count)
        allowed = remaining > 0
        
        # Calculate reset date (first day of next month)
        if month_start.month == 12:
            reset_date = month_start.replace(year=month_start.year + 1, month=1)
        else:
            reset_date = month_start.replace(month=month_start.month + 1)
        
        return allowed, remaining, reset_date
    
    # Add more features here as needed
    return True, -1, None


def record_usage(user, feature):
    """Record usage of a limited feature"""
    if feature == 'ai_breakdown':
        usage = AIBreakdownUsage(user_id=user.id)
        db.session.add(usage)
        db.session.commit()


def require_feature(feature_name):
    """
    Decorator to check if user has access to a premium feature.
    Usage: @require_feature('advanced_analytics')
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            from app import get_current_user  # Import here to avoid circular imports
            
            current_user = get_current_user()
            if not current_user:
                return jsonify({'error': 'Authentication required'}), 401
            
            tier_name = getattr(current_user, 'subscription_tier', 'free') or 'free'
            tier = TIERS.get(tier_name, TIERS['free'])
            
            # Check if feature is available in tier
            if not tier.get(feature_name, False):
                return jsonify({
                    'error': f'{feature_name} requires Premium or Pro subscription',
                    'upgrade_required': True,
                    'current_tier': tier_name,
                    'required_tiers': [t for t, v in TIERS.items() if v.get(feature_name, False)]
                }), 403
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator


def require_subscription(minimum_tier='premium'):
    """
    Decorator to require minimum subscription tier.
    Usage: @require_subscription('premium')
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            from app import get_current_user
            
            current_user = get_current_user()
            if not current_user:
                return jsonify({'error': 'Authentication required'}), 401
            
            tier_order = {'free': 0, 'premium': 1, 'pro': 2}
            user_tier = getattr(current_user, 'subscription_tier', 'free') or 'free'
            
            if tier_order.get(user_tier, 0) < tier_order.get(minimum_tier, 0):
                return jsonify({
                    'error': f'This feature requires {minimum_tier.capitalize()} subscription',
                    'upgrade_required': True,
                    'current_tier': user_tier,
                    'upgrade_url': '/billing/upgrade'
                }), 403
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator


# SQLAlchemy model for tracking AI breakdown usage
class AIBreakdownUsage(db.Model):
    __tablename__ = 'ai_breakdown_usage'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('User', backref=db.backref('ai_usages', lazy=True))


def init_premium_features(app, token_decorator=None):
    """Initialize premium feature endpoints"""
    global token_required
    if token_decorator:
        token_required = token_decorator
    
    @app.route('/api/billing/tiers', methods=['GET'])
    def get_subscription_tiers():
        """Get all subscription tiers with features"""
        return jsonify({
            'tiers': [
                {
                    'id': tier_id,
                    'name': info['name'],
                    'price': info['price'],
                    'features': {k: v for k, v in info.items() if k != 'name' and k != 'price'}
                }
                for tier_id, info in TIERS.items()
            ],
            'currency': 'USD',
            'billing_period': 'monthly'
        })
    
    @app.route('/api/billing/usage', methods=['GET'])
    @token_required
    def get_usage_stats(current_user):
        """Get current usage statistics"""
        tier_name = getattr(current_user, 'subscription_tier', 'free') or 'free'
        tier = TIERS.get(tier_name, TIERS['free'])
        
        # AI Breakdown usage
        month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        ai_usage = AIBreakdownUsage.query.filter(
            AIBreakdownUsage.user_id == current_user.id,
            AIBreakdownUsage.created_at >= month_start
        ).count()
        
        ai_limit = tier['ai_breakdowns_per_month']
        
        stats = {
            'tier': tier_name,
            'tier_name': tier['name'],
            'ai_breakdown': {
                'used': ai_usage,
                'limit': ai_limit if ai_limit != -1 else 'unlimited',
                'remaining': (ai_limit - ai_usage) if ai_limit != -1 else -1,
                'reset_date': (month_start + timedelta(days=32)).replace(day=1).isoformat()
            }
        }
        
        return jsonify(stats)
    
    @app.route('/api/billing/upgrade', methods=['POST'])
    @token_required
    def upgrade_subscription(current_user):
        """
        Upgrade subscription tier.
        Body: { tier: 'premium' | 'pro' }
        In production, integrate with Stripe/Paddle/LemonSqueezy
        """
        data = request.json or {}
        new_tier = data.get('tier', 'premium')
        
        if new_tier not in ['premium', 'pro']:
            return jsonify({'error': 'Invalid tier'}), 400
        
        # === PRODUCTION: Integrate with Stripe ===
        # Example flow:
        # 1. Create Stripe Checkout Session
        # 2. Return checkout URL
        # 3. Handle webhook to update subscription
        
        # For now, simulate immediate upgrade (you'd use webhooks)
        old_tier = getattr(current_user, 'subscription_tier', 'free') or 'free'
        current_user.subscription_tier = new_tier
        current_user.subscription_updated_at = datetime.utcnow()
        
        db.session.commit()
        
        logger.info(f"User {current_user.id} upgraded from {old_tier} to {new_tier}")
        
        return jsonify({
            'success': True,
            'old_tier': old_tier,
            'new_tier': new_tier,
            'message': f'Upgraded to {TIERS[new_tier]["name"]} (${TIERS[new_tier]["price"]}/month)'
        })
    
    @app.route('/api/billing/cancel', methods=['POST'])
    @token_required
    def cancel_subscription(current_user):
        """Cancel subscription and downgrade to free"""
        old_tier = getattr(current_user, 'subscription_tier', 'free') or 'free'
        
        # === PRODUCTION: Cancel via Stripe ===
        
        current_user.subscription_tier = 'free'
        current_user.subscription_cancelled_at = datetime.utcnow()
        
        db.session.commit()
        
        logger.info(f"User {current_user.id} cancelled subscription (was {old_tier})")
        
        return jsonify({
            'success': True,
            'message': 'Subscription cancelled. Downgraded to Free tier.'
        })
    
    logger.info("✅ Premium features initialized")

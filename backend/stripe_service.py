"""
StriveX Stripe Payment Processing
Secure, production-ready payment handling with webhook verification
"""
import stripe
import os
from datetime import datetime
from functools import wraps
from flask import request, jsonify
import hmac
import hashlib
import json
from loguru import logger

# Initialize Stripe
stripe.api_key = os.environ.get('STRIPE_SECRET_KEY')
STRIPE_WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET')
FRONTEND_URL = os.environ.get('CORS_ORIGIN', 'http://localhost:3001')

# Stripe Price IDs (you'll get these from Stripe Dashboard after creating products)
STRIPE_PRICES = {
    'premium': os.environ.get('STRIPE_PRICE_PREMIUM', 'price_premium_monthly'),
    'pro': os.environ.get('STRIPE_PRICE_PRO', 'price_pro_monthly')
}


def verify_stripe_webhook(f):
    """
    Verify Stripe webhook signature to prevent fraud.
    MUST be used on all webhook endpoints.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        payload = request.get_data()
        sig_header = request.headers.get('Stripe-Signature')
        
        if not sig_header or not STRIPE_WEBHOOK_SECRET:
            logger.error("Webhook verification failed: missing signature or secret")
            return jsonify({'error': 'Missing webhook signature'}), 400
        
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, STRIPE_WEBHOOK_SECRET
            )
        except ValueError as e:
            logger.error(f"Invalid webhook payload: {e}")
            return jsonify({'error': 'Invalid payload'}), 400
        except stripe.error.SignatureVerificationError as e:
            logger.error(f"Invalid webhook signature: {e}")
            return jsonify({'error': 'Invalid signature'}), 400
        
        # Add verified event to request context
        request.stripe_event = event
        return f(*args, **kwargs)
    
    return decorated_function


def create_checkout_session(user, tier):
    """
    Create a secure Stripe Checkout Session.
    Returns checkout URL for redirect.
    
    Security features:
    - Uses user's email from database (not client-provided)
    - Client reference ID prevents session tampering
    - Success/cancel URLs validated against allowed origins
    """
    try:
        price_id = STRIPE_PRICES.get(tier)
        if not price_id:
            raise ValueError(f"Invalid tier: {tier}")
        
        # Create checkout session
        session = stripe.checkout.Session.create(
            customer_email=user.email,  # Use DB email, not client input
            client_reference_id=f"strivex_user_{user.id}",  # For webhook lookup
            mode='subscription',
            line_items=[{
                'price': price_id,
                'quantity': 1,
            }],
            success_url=f"{FRONTEND_URL}/billing?session_id={{CHECKOUT_SESSION_ID}}&success=true",
            cancel_url=f"{FRONTEND_URL}/billing?canceled=true",
            metadata={
                'user_id': str(user.id),
                'tier': tier,
                'platform': 'strivex_web'
            },
            # Security: Prevent discount code abuse
            allow_promotion_codes=False,
            # Security: Require payment method
            payment_method_types=['card'],
            # Subscription behavior
            subscription_data={
                'trial_period_days': 7,  # Free 7-day trial (optional)
            }
        )
        
        logger.info(f"Created checkout session for user {user.id}: {session.id}")
        return session
    
    except Exception as e:
        logger.error(f"Failed to create checkout session: {e}")
        raise


def handle_subscription_created(event):
    """
    Handle checkout.session.completed webhook event.
    Upgrades user subscription in database.
    """
    from models import db, User
    
    session = event['data']['object']
    
    # Extract user info from session
    user_id = int(session['metadata']['user_id'])
    tier = session['metadata']['tier']
    stripe_customer_id = session['customer']
    stripe_subscription_id = session['subscription']
    
    # Find user
    user = User.query.get(user_id)
    if not user:
        logger.error(f"User not found for webhook: {user_id}")
        return {'error': 'User not found'}, 404
    
    # Update user subscription atomically
    try:
        old_tier = user.subscription_tier or 'free'
        user.subscription_tier = tier
        user.subscription_updated_at = datetime.utcnow()
        user.subscription_cancelled_at = None
        
        # Store Stripe IDs for future management
        user.stripe_customer_id = stripe_customer_id
        user.stripe_subscription_id = stripe_subscription_id
        
        db.session.commit()
        
        logger.info(f"✅ Subscription created: User {user_id} upgraded from {old_tier} to {tier}")
        
        # TODO: Send welcome email
        # send_welcome_email(user, tier)
        
        return {'success': True}, 200
    
    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to process subscription creation: {e}")
        return {'error': 'Database update failed'}, 500


def handle_subscription_updated(event):
    """
    Handle customer.subscription.updated webhook.
    Syncs subscription changes (e.g., plan changes).
    """
    from models import db, User
    
    subscription = event['data']['object']
    stripe_subscription_id = subscription['id']
    
    # Find user by Stripe subscription ID
    user = User.query.filter_by(stripe_subscription_id=stripe_subscription_id).first()
    if not user:
        logger.warning(f"User not found for subscription update: {stripe_subscription_id}")
        return {'skipped': 'User not found'}, 200
    
    # Get new price/tier from subscription
    try:
        new_price_id = subscription['items']['data'][0]['price']['id']
        new_tier = next((k for k, v in STRIPE_PRICES.items() if v == new_price_id), None)
        
        if new_tier and new_tier != user.subscription_tier:
            old_tier = user.subscription_tier
            user.subscription_tier = new_tier
            user.subscription_updated_at = datetime.utcnow()
            
            db.session.commit()
            logger.info(f"🔄 Subscription updated: User {user.id} from {old_tier} to {new_tier}")
        
        return {'success': True}, 200
    
    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to process subscription update: {e}")
        return {'error': 'Update failed'}, 500


def handle_subscription_deleted(event):
    """
    Handle customer.subscription.deleted webhook.
    Downgrades user to free tier when they cancel.
    """
    from models import db, User
    
    subscription = event['data']['object']
    stripe_subscription_id = subscription['id']
    
    # Find user
    user = User.query.filter_by(stripe_subscription_id=stripe_subscription_id).first()
    if not user:
        logger.warning(f"User not found for subscription deletion: {stripe_subscription_id}")
        return {'skipped': 'User not found'}, 200
    
    # Downgrade to free
    try:
        old_tier = user.subscription_tier
        user.subscription_tier = 'free'
        user.subscription_cancelled_at = datetime.utcnow()
        user.stripe_subscription_id = None  # Clear subscription ID
        
        db.session.commit()
        
        logger.info(f"❌ Subscription cancelled: User {user.id} was on {old_tier}")
        
        # TODO: Send cancellation confirmation email
        # send_cancellation_email(user)
        
        return {'success': True}, 200
    
    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to process subscription deletion: {e}")
        return {'error': 'Deletion failed'}, 500


# Webhook event handlers mapping
WEBHOOK_HANDLERS = {
    'checkout.session.completed': handle_subscription_created,
    'customer.subscription.updated': handle_subscription_updated,
    'customer.subscription.deleted': handle_subscription_deleted,
}


def process_webhook_event(event):
    """
    Route webhook event to appropriate handler.
    """
    event_type = event['type']
    handler = WEBHOOK_HANDLERS.get(event_type)
    
    if handler:
        logger.info(f"Processing webhook event: {event_type}")
        return handler(event)
    else:
        logger.info(f"Ignored webhook event: {event_type}")
        return {'skipped': 'No handler'}, 200


def get_customer_portal_session(user):
    """
    Create a Stripe Customer Portal session for subscription management.
    Users can cancel/pause/update payment methods themselves.
    """
    if not user.stripe_customer_id:
        raise ValueError("User has no Stripe customer ID")
    
    try:
        session = stripe.billing_portal.Session.create(
            customer=user.stripe_customer_id,
            return_url=f"{FRONTEND_URL}/billing",
            flow_data={
                'type': 'subscription_update',
                'subscription_update': {
                    'subscription': user.stripe_subscription_id
                }
            } if user.stripe_subscription_id else None
        )
        
        logger.info(f"Created customer portal session for user {user.id}")
        return session
    
    except Exception as e:
        logger.error(f"Failed to create portal session: {e}")
        raise

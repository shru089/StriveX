import { useState, useEffect } from 'react'
import api from '../api'
import { showToast } from '../components/Toast'
import './BillingPage.css'

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    period: 'forever',
    description: 'Perfect for getting started',
    features: [
      '5 AI breakdowns/month',
      'Basic analytics',
      'Standard badges',
      'Email support',
      'Core features'
    ],
    cta: 'Current Plan',
    disabled: true,
    highlight: false
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 4.99,
    period: 'month',
    description: 'For serious productivity enthusiasts',
    features: [
      '✓ Unlimited AI breakdowns',
      '✓ Advanced analytics dashboard',
      '✓ Custom achievement badges',
      '✓ Priority email support',
      '✓ Early access to new features',
      '✓ All free features'
    ],
    cta: 'Upgrade to Premium',
    popular: true,
    highlight: true
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 9.99,
    period: 'month',
    description: 'Maximum power for professionals',
    features: [
      '✓ Everything in Premium',
      '✓ Team collaboration features',
      '✓ API access',
      '✓ Custom integrations',
      '✓ Dedicated support',
      '✓ Unlimited everything'
    ],
    cta: 'Upgrade to Pro',
    highlight: false
  }
]

export default function BillingPage() {
  const [currentTier, setCurrentTier] = useState('free')
  const [usage, setUsage] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchUsage()
  }, [])

  async function fetchUsage() {
    try {
      const response = await api.get('/billing/usage')
      const data = response.data
      
      setCurrentTier(data.tier || 'free')
      setUsage(data.ai_breakdown)
    } catch (error) {
      console.error('Failed to fetch usage:', error)
    }
  }

  async function handleUpgrade(tierId) {
    if (tierId === currentTier) return
    
    setLoading(true)
    try {
      // Create Stripe Checkout Session
      const response = await api.post('/billing/create-checkout', { tier: tierId })
      
      // Redirect to Stripe Checkout (secure payment on Stripe's domain)
      window.location.href = response.data.checkout_url
      
      showToast('Redirecting to secure checkout...', 'info')
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to create checkout session. Please try again.'
      showToast(message, 'error')
      setLoading(false)
    }
  }

  async function handleManageSubscription() {
    setLoading(true)
    try {
      const response = await api.post('/billing/customer-portal')
      
      // Redirect to Stripe Customer Portal
      window.location.href = response.data.portal_url
      
      showToast('Opening subscription management...', 'info')
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to open portal'
      showToast(message, 'error')
      setLoading(false)
    }
  }

  async function handleCancel() {
    if (!window.confirm('Are you sure you want to cancel your subscription? You\'ll lose access to premium features at the end of your billing period.')) {
      return
    }
    
    try {
      const response = await api.post('/billing/cancel')
      showToast(response.data.message, 'info')
      setCurrentTier('free')
      fetchUsage()
    } catch (error) {
      showToast('Failed to cancel subscription', 'error')
    }
  }

  return (
    <div className="billing-page">
      <div className="billing-header">
        <h1>🚀 Upgrade Your Productivity</h1>
        <p>Choose the plan that works best for you</p>
      </div>

      {/* Current Usage */}
      {usage && currentTier === 'free' && (
        <div className="usage-card">
          <h3>📊 Current Month Usage</h3>
          <div className="usage-stats">
            <div className="usage-stat">
              <div className="usage-value">{usage.used}/{usage.limit === 'unlimited' ? '∞' : usage.limit}</div>
              <div className="usage-label">AI Breakdowns Used</div>
            </div>
            <div className="usage-bar-container">
              <div 
                className="usage-bar" 
                style={{ width: `${Math.min(100, (usage.used / (usage.limit || 1)) * 100)}%` }}
              />
            </div>
            <div className="usage-reset">
              Resets on {new Date(usage.reset_date).toLocaleDateString()}
            </div>
          </div>
        </div>
      )}

      {/* Pricing Plans */}
      <div className="pricing-grid">
        {PLANS.map(plan => (
          <div 
            key={plan.id} 
            className={`pricing-card${plan.highlight ? ' highlight' : ''}${plan.popular ? ' popular' : ''}`}
          >
            {plan.popular && <div className="popular-badge">Most Popular</div>}
            
            <div className="pricing-header">
              <h2>{plan.name}</h2>
              <div className="pricing-price">
                {plan.price === 0 ? (
                  <span className="price-free">Free</span>
                ) : (
                  <>
                    <span className="price-currency">$</span>
                    <span className="price-amount">{plan.price}</span>
                    <span className="price-period">/{plan.period}</span>
                  </>
                )}
              </div>
              <p className="pricing-description">{plan.description}</p>
            </div>

            <ul className="pricing-features">
              {plan.features.map((feature, i) => (
                <li key={i} className={feature.startsWith('✓') ? 'included' : ''}>
                  {feature}
                </li>
              ))}
            </ul>

            <button 
              className={`pricing-cta${plan.disabled ? ' disabled' : ''}`}
              onClick={() => handleUpgrade(plan.id)}
              disabled={plan.disabled || loading}
            >
              {loading && currentTier !== plan.id ? 'Processing...' : plan.cta}
            </button>
          </div>
        ))}
      </div>

      {/* Current Subscription Management */}
      {currentTier !== 'free' && (
        <div className="subscription-management">
          <h3>📋 Current Subscription</h3>
          <p>You're currently on the <strong>{PLANS.find(p => p.id === currentTier)?.name}</strong> plan.</p>
          <div className="subscription-actions">
            <button className="manage-btn" onClick={handleManageSubscription}>
              🔧 Manage Subscription
            </button>
            <button className="cancel-btn" onClick={handleCancel}>
              Cancel Subscription
            </button>
          </div>
        </div>
      )}

      {/* FAQ Section */}
      <div className="billing-faq">
        <h2>Frequently Asked Questions</h2>
        
        <div className="faq-item">
          <h4>💳 How does billing work?</h4>
          <p>Plans are billed monthly. You can cancel anytime and keep access until the end of your billing period.</p>
        </div>

        <div className="faq-item">
          <h4>🔄 Can I upgrade or downgrade later?</h4>
          <p>Yes! You can upgrade or downgrade at any time. Changes take effect immediately.</p>
        </div>

        <div className="faq-item">
          <h4>🎓 Do you offer student discounts?</h4>
          <p>Yes! Contact us at support@strivex.app with your student email for a 50% discount.</p>
        </div>

        <div className="faq-item">
          <h4>💰 What payment methods do you accept?</h4>
          <p>We accept all major credit cards (Visa, MasterCard, Amex) and PayPal.</p>
        </div>
      </div>
    </div>
  )
}

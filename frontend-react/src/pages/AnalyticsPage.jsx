import { useState, useEffect } from 'react'
import api from '../api'
import { showToast } from '../components/Toast'
import './AnalyticsPage.css'

export default function AnalyticsPage() {
  const [funnel, setFunnel] = useState(null)
  const [behavior, setBehavior] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    fetchAnalytics()
  }, [])

  async function fetchAnalytics() {
    try {
      setLoading(true)
      const [funnelRes, behaviorRes] = await Promise.all([
        api.get('/analytics/funnel'),
        api.get('/analytics/user-behavior')
      ])
      
      setFunnel(funnelRes.data)
      setBehavior(behaviorRes.data)
      showToast('Analytics loaded', 'success')
    } catch (error) {
      showToast('Failed to load analytics', 'error')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="analytics-page">
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading analytics...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="analytics-page">
      <div className="analytics-header">
        <h1>📊 Analytics Dashboard</h1>
        <p>Data-driven insights to optimize your productivity</p>
      </div>

      <div className="analytics-tabs">
        <button 
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button 
          className={`tab ${activeTab === 'funnel' ? 'active' : ''}`}
          onClick={() => setActiveTab('funnel')}
        >
          Conversion Funnel
        </button>
        <button 
          className={`tab ${activeTab === 'behavior' ? 'active' : ''}`}
          onClick={() => setActiveTab('behavior')}
        >
          Behavior Patterns
        </button>
      </div>

      {activeTab === 'overview' && (
        <OverviewDashboard funnel={funnel} behavior={behavior} />
      )}
      
      {activeTab === 'funnel' && <ConversionFunnel funnel={funnel} />}
      {activeTab === 'behavior' && <BehaviorPatterns behavior={behavior} />}
    </div>
  )
}

function OverviewDashboard({ funnel, behavior }) {
  return (
    <div className="overview-dashboard">
      {/* Key Metrics */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-icon">🎯</div>
          <div className="metric-value">
            {funnel?.stages[2]?.percentage || 0}%
          </div>
          <div className="metric-label">Goal Creation Rate</div>
          <div className="metric-trend positive">+12% from last week</div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">⚡</div>
          <div className="metric-value">
            {funnel?.stages[1]?.percentage || 0}%
          </div>
          <div className="metric-label">Activation Rate</div>
          <div className="metric-trend positive">+5% from last week</div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">💎</div>
          <div className="metric-value">
            {funnel?.stages[3]?.percentage || 0}%
          </div>
          <div className="metric-label">Premium Conversion</div>
          <div className="metric-trend neutral">Stable</div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">🔥</div>
          <div className="metric-value">
            {funnel?.stages[4]?.percentage || 0}%
          </div>
          <div className="metric-label">7-Day Retention</div>
          <div className="metric-trend negative">-3% from last week</div>
        </div>
      </div>

      {/* Insights */}
      {funnel?.insights && funnel.insights.length > 0 && (
        <div className="insights-section">
          <h2>🧠 AI-Powered Insights</h2>
          <div className="insights-list">
            {funnel.insights.map((insight, i) => (
              <div key={i} className={`insight-card ${insight.type}`}>
                <div className="insight-icon">
                  {insight.type === 'warning' ? '⚠️' : '💡'}
                </div>
                <div className="insight-content">
                  <strong>{insight.message}</strong>
                  <p>{insight.recommendation}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="quick-stats">
        <h3>Performance Highlights</h3>
        <div className="stats-list">
          {behavior?.hourly_productivity && (
            <div className="stat-item">
              <span className="stat-label">Peak Hour:</span>
              <span className="stat-value">
                {(() => {
                  const peak = behavior.hourly_productivity.reduce((max, h) => 
                    h.success_rate > max.success_rate ? h : max, 
                    behavior.hourly_productivity[0]
                  )
                  return `${peak?.hour}:00 (${peak?.success_rate}% success rate)`
                })()}
              </span>
            </div>
          )}
          
          {behavior?.daily_productivity && (
            <div className="stat-item">
              <span className="stat-label">Best Day:</span>
              <span className="stat-value">
                {(() => {
                  const best = behavior.daily_productivity.reduce((max, d) => 
                    d.success_rate > max.success_rate ? d : max, 
                    behavior.daily_productivity[0]
                  )
                  return `${best?.day} (${best?.success_rate}% success rate)`
                })()}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ConversionFunnel({ funnel }) {
  if (!funnel) return null

  return (
    <div className="conversion-funnel">
      <h2>Conversion Funnel Analysis</h2>
      <p className="section-description">
        Track user progression from signup to retained premium subscriber
      </p>

      <div className="funnel-viz">
        {funnel.stages.map((stage, i) => (
          <div key={i} className="funnel-stage">
            <div className="funnel-bar-container">
              <div 
                className="funnel-bar"
                style={{ width: `${stage.percentage}%` }}
              />
            </div>
            <div className="funnel-info">
              <span className="funnel-name">{stage.name}</span>
              <span className="funnel-count">{stage.count} users</span>
              <span className="funnel-percentage">{stage.percentage}%</span>
            </div>
          </div>
        ))}
      </div>

      {/* Drop-off Analysis */}
      <div className="dropoff-analysis">
        <h3>Critical Drop-off Points</h3>
        {funnel.stages.slice(0, -1).map((stage, i) => {
          const nextStage = funnel.stages[i + 1]
          const dropoff = stage.percentage - nextStage.percentage
          if (dropoff > 20) {
            return (
              <div key={i} className="dropoff-item critical">
                <span className="dropoff-stage">
                  {stage.name} → {nextStage.name}
                </span>
                <span className="dropoff-rate">{dropoff.toFixed(1)}% drop-off</span>
              </div>
            )
          }
          return null
        })}
      </div>

      {/* Recommendations */}
      {funnel.insights && funnel.insights.length > 0 && (
        <div className="funnel-recommendations">
          <h3>Optimization Recommendations</h3>
          <ul>
            {funnel.insights.map((insight, i) => (
              <li key={i} className={`recommendation ${insight.type}`}>
                <strong>{insight.message}</strong>
                <p>{insight.recommendation}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function BehaviorPatterns({ behavior }) {
  if (!behavior) return null

  return (
    <div className="behavior-patterns">
      <h2>Behavioral Pattern Analysis</h2>
      <p className="section-description">
        Understand your productivity rhythms and optimize accordingly
      </p>

      {/* Hourly Productivity */}
      <div className="pattern-section">
        <h3>⏰ Hourly Productivity</h3>
        <div className="hourly-chart">
          {behavior.hourly_productivity.map(hour => (
            <div key={hour.hour} className="hour-bar">
              <div className="hour-label">{hour.hour}:00</div>
              <div 
                className="hour-success-bar"
                style={{ height: `${Math.min(100, hour.success_rate)}%` }}
              />
              <div className="hour-rate">{hour.success_rate}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* Daily Productivity */}
      <div className="pattern-section">
        <h3>📅 Daily Productivity</h3>
        <div className="daily-chart">
          {behavior.daily_productivity.map(day => (
            <div key={day.day} className={`day-bar ${day.success_rate < 50 ? 'low' : ''}`}>
              <div className="day-name">{day.day}</div>
              <div 
                className="day-success-bar"
                style={{ height: `${Math.min(100, day.success_rate)}%` }}
              />
              <div className="day-rate">{day.success_rate}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* Category Performance */}
      <div className="pattern-section">
        <h3>🎯 Category Performance</h3>
        <div className="category-list">
          {behavior.category_performance.map(cat => (
            <div key={cat.category} className="category-item">
              <div className="category-info">
                <span className="category-name">{cat.category}</span>
                <span className="category-stats">
                  {cat.completed}/{cat.total} tasks · {cat.avg_hours}h avg
                </span>
              </div>
              <div className="category-bar-container">
                <div 
                  className="category-bar"
                  style={{ width: `${cat.success_rate}%` }}
                />
              </div>
              <span className="category-rate">{cat.success_rate}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* AI Insights */}
      {behavior.insights && behavior.insights.length > 0 && (
        <div className="ai-insights-box">
          <h3>🤖 AI-Powered Recommendations</h3>
          {behavior.insights.map((insight, i) => (
            <div key={i} className={`insight-bubble ${insight.type}`}>
              <strong>{insight.title}</strong>
              <p>{insight.description}</p>
              <div className="insight-action">
                💡 <strong>Action:</strong> {insight.action}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

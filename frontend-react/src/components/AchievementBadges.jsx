import { useState, useEffect } from 'react'
import db from '../db'
import './AchievementBadges.css'

const BADGES = {
  // Task achievements
  first_task: {
    id: 'first_task',
    icon: '🎯',
    title: 'First Step',
    desc: 'Complete your first task',
    condition: (stats) => stats.tasksCompleted >= 1
  },
  task_master_10: {
    id: 'task_master_10',
    icon: '⭐',
    title: 'Task Master',
    desc: 'Complete 10 tasks',
    condition: (stats) => stats.tasksCompleted >= 10
  },
  task_master_50: {
    id: 'task_master_50',
    icon: '🌟',
    title: 'Task Legend',
    desc: 'Complete 50 tasks',
    condition: (stats) => stats.tasksCompleted >= 50
  },
  task_master_100: {
    id: 'task_master_100',
    icon: '👑',
    title: 'Task God',
    desc: 'Complete 100 tasks',
    condition: (stats) => stats.tasksCompleted >= 100
  },
  
  // Streak achievements
  streak_3: {
    id: 'streak_3',
    icon: '🔥',
    title: 'On Fire',
    desc: 'Maintain a 3-day streak',
    condition: (stats) => stats.streak >= 3
  },
  streak_7: {
    id: 'streak_7',
    icon: '⚡',
    title: 'Week Warrior',
    desc: 'Maintain a 7-day streak',
    condition: (stats) => stats.streak >= 7
  },
  streak_30: {
    id: 'streak_30',
    icon: '💎',
    title: 'Monthly Master',
    desc: 'Maintain a 30-day streak',
    condition: (stats) => stats.streak >= 30
  },
  
  // Goal achievements
  goal_crusher: {
    id: 'goal_crusher',
    icon: '🎪',
    title: 'Goal Crusher',
    desc: 'Complete 5 goals',
    condition: (stats) => stats.goalsCompleted >= 5
  },
  goal_legend: {
    id: 'goal_legend',
    icon: '🏆',
    title: 'Goal Legend',
    desc: 'Complete 20 goals',
    condition: (stats) => stats.goalsCompleted >= 20
  },
  
  // Focus Zone achievements
  pomodoro_novice: {
    id: 'pomodoro_novice',
    icon: '🍅',
    title: 'Pomodoro Novice',
    desc: 'Complete 10 Pomodoro sessions',
    condition: (stats) => stats.pomodoroSessions >= 10
  },
  pomodoro_master: {
    id: 'pomodoro_master',
    icon: '🍕',
    title: 'Pomodoro Master',
    desc: 'Complete 50 Pomodoro sessions',
    condition: (stats) => stats.pomodoroSessions >= 50
  },
  
  // Early bird / Night owl
  early_bird: {
    id: 'early_bird',
    icon: '🌅',
    title: 'Early Bird',
    desc: 'Complete a task before 7 AM',
    condition: (stats) => stats.earlyTasks >= 1
  },
  night_owl: {
    id: 'night_owl',
    icon: '🦉',
    title: 'Night Owl',
    desc: 'Complete a task after 10 PM',
    condition: (stats) => stats.lateTasks >= 1
  },
  
  // Special achievements
  perfection_day: {
    id: 'perfection_day',
    icon: '✨',
    title: 'Perfect Day',
    desc: 'Complete all tasks in a day (min 5)',
    condition: (stats) => stats.perfectDays >= 1
  },
  comeback_kid: {
    id: 'comeback_kid',
    icon: '💪',
    title: 'Comeback Kid',
    desc: 'Return after a 7+ day break',
    condition: (stats) => stats.returnedAfterBreak
  },
  
  // AI usage
  ai_pioneer: {
    id: 'ai_pioneer',
    icon: '🤖',
    title: 'AI Pioneer',
    desc: 'Use AI Work Coach 5 times',
    condition: (stats) => stats.aiUsage >= 5
  }
}

export default function AchievementBadges() {
  const [badges, setBadges] = useState([])
  const [newBadges, setNewBadges] = useState([])
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    checkAchievements()
  }, [])

  function checkAchievements() {
    // Calculate user stats
    const todos = db.getTodos()
    const tasksCompleted = todos.filter(t => t.completed).length
    
    // Get streak from localStorage (you'd track this in real app)
    const streak = parseInt(localStorage.getItem('sx_streak') || '0')
    
    // Get completed goals
    const goals = db.getGoals()
    const goalsCompleted = goals.filter(g => g.progress >= 100).length
    
    // Get Pomodoro sessions
    const pomodoroData = JSON.parse(localStorage.getItem('sx_pomodoro') || '{}')
    const pomodoroSessions = pomodoroData.sessions || 0
    
    // Analyze task completion times
    const earlyTasks = todos.filter(t => {
      if (!t.completed_at) return false
      const hour = new Date(t.completed_at).getHours()
      return hour < 7
    }).length
    
    const lateTasks = todos.filter(t => {
      if (!t.completed_at) return false
      const hour = new Date(t.completed_at).getHours()
      return hour >= 22
    }).length
    
    // Check for perfect days (simplified)
    const perfectDays = 0 // You'd track this properly
    
    // Check AI usage
    const aiUsage = parseInt(localStorage.getItem('sx_ai_usage') || '0')
    
    const stats = {
      tasksCompleted,
      streak,
      goalsCompleted,
      pomodoroSessions,
      earlyTasks,
      lateTasks,
      perfectDays,
      returnedAfterBreak: false, // Track this separately
      aiUsage
    }
    
    // Get earned badges
    const earnedBadges = Object.values(BADGES).filter(badge => 
      badge.condition(stats)
    )
    
    // Check for new badges
    const previousBadges = JSON.parse(localStorage.getItem('sx_badges') || '[]')
    const newlyEarned = earnedBadges.filter(
      b => !previousBadges.find(pb => pb.id === b.id)
    )
    
    if (newlyEarned.length > 0) {
      setNewBadges(newlyEarned)
      setTimeout(() => setNewBadges([]), 5000)
    }
    
    setBadges(earnedBadges)
    localStorage.setItem('sx_badges', JSON.stringify(earnedBadges))
  }

  return (
    <>
      {/* New badge notification */}
      {newBadges.map(badge => (
        <div key={badge.id} className="badge-notification">
          <div className="badge-icon-large">{badge.icon}</div>
          <div className="badge-content">
            <strong>🏅 Achievement Unlocked!</strong>
            <p>{badge.title}</p>
          </div>
        </div>
      ))}
      
      {/* Badges panel */}
      <div className="achievement-panel">
        <div className="panel-header">
          <h3>🏆 Achievements</h3>
          <button onClick={() => setShowAll(!showAll)}>
            {showAll ? 'Show Less' : `View All (${badges.length}/${Object.keys(BADGES).length})`}
          </button>
        </div>
        
        {!showAll ? (
          <div className="recent-badges">
            {badges.slice(-6).map(badge => (
              <div key={badge.id} className="badge" title={badge.desc}>
                <div className="badge-icon">{badge.icon}</div>
                <div className="badge-info">
                  <div className="badge-title">{badge.title}</div>
                </div>
              </div>
            ))}
            {badges.length === 0 && (
              <div className="no-badges">
                <p>No achievements yet. Keep going! 💪</p>
              </div>
            )}
          </div>
        ) : (
          <div className="all-badges">
            {Object.values(BADGES).map(badge => {
              const earned = badges.find(b => b.id === badge.id)
              return (
                <div key={badge.id} className={`badge ${earned ? 'earned' : 'locked'}`} title={badge.desc}>
                  <div className="badge-icon">{earned ? badge.icon : '🔒'}</div>
                  <div className="badge-info">
                    <div className="badge-title">{badge.title}</div>
                    <div className="badge-desc">{badge.desc}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}

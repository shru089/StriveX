import React from 'react'
import { useNavigate } from 'react-router-dom'
import StriveXLogo from '../components/StriveXLogo'
import './PrivacyPolicyPage.css'

export default function PrivacyPolicyPage() {
  const navigate = useNavigate()

  return (
    <div className="privacy-page">
      {/* Background */}
      <div className="bg-galaxy" />
      <div className="bg-galaxy-2" />
      <div className="bg-nebula bg-nebula-1" />
      <div className="bg-nebula bg-nebula-2" />
      <div className="bg-nebula bg-nebula-3" />
      <div className="bg-grid" />

      <div className="privacy-container">
        {/* Navigation */}
        <nav className="privacy-nav">
          <div className="nav-brand" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            <StriveXLogo size={24} />
            <span>StriveX</span>
          </div>
          <button className="btn-secondary" onClick={() => navigate(-1)}>Go Back</button>
        </nav>

        {/* Content */}
        <div className="privacy-content glass-card">
          <h1>Privacy Policy</h1>
          <p className="last-updated">Last Updated: {new Date().toLocaleDateString()}</p>

          <section className="privacy-section">
            <h2>1. Introduction</h2>
            <p>
              Welcome to StriveX. Your privacy is critically important to us. This Privacy Policy explains how we collect, use, and protect your personal information when you use our productivity dashboard, AI Work Coach, and related services.
            </p>
          </section>

          <section className="privacy-section">
            <h2>2. Information We Collect</h2>
            <p>We only collect the information absolutely necessary to provide you with the best productivity experience:</p>
            <ul>
              <li><strong>Account Information:</strong> When you sign up, we collect your email address and basic profile information (such as your name).</li>
              <li><strong>Productivity Data:</strong> We store your tasks, goals, habits, and schedules to provide our core services.</li>
              <li><strong>Behavioral Telemetry:</strong> We securely analyze metadata about your work patterns (e.g., peak focus times, completion rates) to improve AI scheduling. This data is strictly tied to your account and never shared.</li>
            </ul>
          </section>

          <section className="privacy-section">
            <h2>3. How We Use Your Information</h2>
            <p>Your data is used to make StriveX work for you:</p>
            <ul>
              <li>To provide, maintain, and improve the application.</li>
              <li>To power the AI Work Coach and generate personalized schedules.</li>
              <li>To communicate with you regarding your account, updates, and customer support.</li>
              <li>To process secure payments through Stripe (we do not store your credit card information).</li>
            </ul>
          </section>

          <section className="privacy-section">
            <h2>4. Security & Data Protection</h2>
            <p>
              We implement industry-standard security measures including data encryption in transit and at rest, secure password hashing, and rate-limiting to protect against brute-force attacks. However, no internet transmission is 100% secure. You are responsible for keeping your login credentials confidential.
            </p>
          </section>

          <section className="privacy-section">
            <h2>5. AI & Third-Party Services</h2>
            <p>
              To provide advanced coaching, we utilize large language models (like Google Gemini). When you interact with the AI Coach, your inputs (role, current work, blockers) are sent securely to these services solely for generating your action plan. They do not use your personal data to train their public models. 
            </p>
            <p>
              We also use Stripe for billing and secure payment processing. 
            </p>
          </section>

          <section className="privacy-section">
            <h2>6. Your Rights</h2>
            <p>
              You have the right to access, update, or delete your personal data. You can manage your information directly from your StriveX dashboard or by contacting our support team to request full data deletion.
            </p>
          </section>

          <section className="privacy-section">
            <h2>7. Contact Us</h2>
            <p>
              If you have any questions or concerns about this Privacy Policy, please contact us at <strong>privacy@strivex.com</strong>.
            </p>
          </section>
        </div>
        
        {/* Footer */}
        <footer className="privacy-footer">
          <p>© {new Date().getFullYear()} StriveX. All rights reserved.</p>
        </footer>
      </div>
    </div>
  )
}

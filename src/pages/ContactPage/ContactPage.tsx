import React from 'react'
import { useLanguage } from '../../context'
import { Layout } from '../../layouts'
import './ContactPage.css'

export const ContactPage: React.FC = () => {
  const { t } = useLanguage()
  const content = t.pages.contact

  return (
    <Layout>
      <div className="contact-page">
        <div className="contact-hero">
          <h1>{content.title}</h1>
        </div>

        <div className="contact-content">
          <p className="contact-intro">{content.intro}</p>

          <div className="contact-info">
            <div className="contact-item">
              <h3 className="contact-label">{content.phone}</h3>
              <a href={`tel:${content.phoneNumber.replace(/\s/g, '')}`} className="contact-link">
                {content.phoneNumber}
              </a>
            </div>

            <div className="contact-item">
              <h3 className="contact-label">{content.email}</h3>
              <a href={`mailto:${content.emailAddress}`} className="contact-link">
                {content.emailAddress}
              </a>
            </div>

            <div className="contact-item">
              <h3 className="contact-label">{content.address}</h3>
              <p className="contact-value">{content.addressValue}</p>
            </div>
          </div>

          <div className="contact-section">
            <h2>{content.workingHours}</h2>
            <div className="working-hours">
              <p>{content.mondayFriday}</p>
              <p>{content.weekendClosed}</p>
            </div>
          </div>

          <div className="contact-section">
            <h2>{content.socialNetworks}</h2>
            <div className="social-links">
              <a href="https://facebook.com/birklikaz" target="_blank" rel="noopener noreferrer" className="social-item">
                Facebook: {content.facebook}
              </a>
              <a href="https://instagram.com/birklikaz" target="_blank" rel="noopener noreferrer" className="social-item">
                Instagram: {content.instagram}
              </a>
            </div>
          </div>

          <p className="contact-closing">{content.closing}</p>
        </div>
      </div>
    </Layout>
  )
}

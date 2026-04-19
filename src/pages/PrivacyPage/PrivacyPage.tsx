import React from 'react'
import { useLanguage } from '../../context'
import { Layout } from '../../layouts'
import './PrivacyPage.css'

export const PrivacyPage: React.FC = () => {
  const { t } = useLanguage()
  const content = t.pages.privacy

  return (
    <Layout>
      <div className="privacy-page">
        <div className="privacy-hero">
          <h1>{content.title}</h1>
        </div>

        <div className="privacy-content">
        {content.sections.map((section, index) => (
          <section key={index} className="privacy-section">
            {section.title && <h2>{section.title}</h2>}
            {section.isList ? (
              <ul className="privacy-list">
                {section.content.split(',').map((item, i) => (
                  <li key={i}>{item.trim()}</li>
                ))}
              </ul>
            ) : (
              <p>{section.content}</p>
            )}
          </section>
        ))}
        </div>
      </div>
    </Layout>
  )
}

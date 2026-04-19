import React from 'react'
import { useLanguage } from '../../context'
import { Layout } from '../../layouts'
import './AboutPage.css'

export const AboutPage: React.FC = () => {
  const { t } = useLanguage()
  const content = t.pages.about

  return (
    <Layout>
      <div className="about-page">
        <div className="about-hero">
          <h1>{content.title}</h1>
        </div>

        <div className="about-content">
        {content.sections.map((section, index) => (
          <section key={index} className="about-section">
            {section.title && <h2>{section.title}</h2>}
            {section.isList ? (
              <ul className="about-list">
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

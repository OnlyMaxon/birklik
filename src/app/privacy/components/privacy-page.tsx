import React from 'react'
import { getAppTranslations } from '@/lib/i18n/get-app-translations'

function renderContent(content: string) {
  const lines = content.split('\n').map((l) => l.trim()).filter(Boolean)

  const result: React.ReactNode[] = []
  let bullets: string[] = []

  const flushBullets = () => {
    if (bullets.length > 0) {
      result.push(
        <ul key={`ul-${result.length}`} className="privacy-list">
          {bullets.map((b, i) => <li key={i}>{b}</li>)}
        </ul>
      )
      bullets = []
    }
  }

  lines.forEach((line, i) => {
    if (line.startsWith('•')) {
      bullets.push(line.replace(/^•\s*/, ''))
    } else {
      flushBullets()
      result.push(<p key={i} className="privacy-clause">{line}</p>)
    }
  })

  flushBullets()
  return result
}

export async function PrivacyPage() {
  const { t } = await getAppTranslations()
  const content = t.pages.privacy

  return (
    <>
      <div className="privacy-page">
        <div className="privacy-hero">
          <h1>{content.title}</h1>
        </div>

        <div className="privacy-content">
          {content.sections.map((section, index) => (
            <section key={index} className="privacy-section">
              {section.title && (
                <h2>
                  {section.number && <span className="privacy-section-num">{section.number}.</span>}
                  {section.title}
                </h2>
              )}
              <div className="privacy-body">
                {renderContent(section.content)}
              </div>
            </section>
          ))}
        </div>
      </div>
    </>
  )
}

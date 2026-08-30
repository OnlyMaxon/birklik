import type {Metadata} from 'next'
import type {ReactNode} from 'react'
import {getAppTranslations} from '@/lib/i18n/get-app-translations'
import {localeAlternates, type LocaleCode} from '@/lib/locale-routes'

type PageProps = {params: Promise<{locale: string}>}

export async function generateMetadata({params}: PageProps): Promise<Metadata> {
  const {locale} = await params
  const {t} = await getAppTranslations(locale)
  return {
    title: t.pages.privacy.title,
    // Описание на языке страницы. Без него сюда подставлялось
    // азербайджанское из корневого layout — на всех трёх языках.
    description: t.site.description,
    alternates: localeAlternates('/privacy', locale as LocaleCode)
  }
}

function renderContent(content: string) {
  const lines = content.split('\n').map((l) => l.trim()).filter(Boolean)

  const result: ReactNode[] = []
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

export default async function Page({params}: PageProps) {
  const {locale} = await params
  const {t} = await getAppTranslations(locale)
  const content = t.pages.privacy

  return (
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
  )
}

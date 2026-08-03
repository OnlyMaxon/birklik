import type {Metadata} from 'next'
import {getAppTranslations} from '@/lib/i18n/get-app-translations'

export async function generateMetadata(): Promise<Metadata> {
  const {t} = await getAppTranslations()
  return {title: t.pages.about.title}
}
export default async function Page() {
  const { t } = await getAppTranslations()
  const content = t.pages.about

  return (
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
  )
}

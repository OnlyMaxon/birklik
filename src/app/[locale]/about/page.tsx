import type {Metadata} from 'next'
import {getAppTranslations} from '@/lib/i18n/get-app-translations'
import {localeAlternates, type LocaleCode} from '@/lib/locale-routes'

type PageProps = {params: Promise<{locale: string}>}

export async function generateMetadata({params}: PageProps): Promise<Metadata> {
  const {locale} = await params
  const {t} = await getAppTranslations(locale)
  return {
    title: t.pages.about.title,
    // Описание на языке страницы. Без него сюда подставлялось
    // азербайджанское из корневого layout — на всех трёх языках.
    description: t.site.description,
    alternates: localeAlternates('/about', locale as LocaleCode)
  }
}
export default async function Page({params}: PageProps) {
  const {locale} = await params
  const {t} = await getAppTranslations(locale)
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

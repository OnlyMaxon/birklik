import { Layout } from '@/components/app-layout'
import { getAppTranslations } from '@/lib/i18n/get-app-translations'

function renderContent(text: string) {
  // Split by ** to find bold sections
  const parts = text.split('**')
  return parts.map((part, index) => {
    // Odd indices are bold
    if (index % 2 === 1) {
      return <strong key={index}>{part}</strong>
    }
    return <span key={index}>{part}</span>
  })
}

export async function TermsPage() {
  const { t } = await getAppTranslations()
  const currentTerms = t.pages.terms

  return (
    <Layout>
      <div className="terms-page">
        <div className="terms-hero">
          <h1 className="terms-title">{currentTerms.title}</h1>
          <p className="terms-last-updated">{currentTerms.lastUpdated}</p>
        </div>

        <div className="terms-body">
          {currentTerms.sections.map((section, i) => (
            <section key={i} className="terms-section">
              <h2 className="terms-section-title">
                {section.number}. {section.title}
              </h2>
              <div className="terms-section-content">
                {section.content.split('\n').map((line, j) => (
                  <p key={j}>
                    {renderContent(line)}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </Layout>
  )
}

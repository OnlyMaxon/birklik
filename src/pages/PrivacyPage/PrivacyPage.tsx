import React from 'react'
import { useLanguage } from '../../context'
import { Layout } from '../../layouts'
import './PrivacyPage.css'

export const PrivacyPage: React.FC = () => {
  const { t } = useLanguage()
  const content = t.pages.privacy

  const parseContent = (text: string) => {
    const paragraphs = text.split('\n').filter((p: string) => p.trim());
    const result = [];
    let currentList: string[] = [];

    paragraphs.forEach((para: string) => {
      if (para.trim().startsWith('•')) {
        currentList.push(para.replace('•', '').trim());
      } else {
        if (currentList.length > 0) {
          result.push({ type: 'list', items: currentList });
          currentList = [];
        }
        result.push({ type: 'paragraph', content: para });
      }
    });

    if (currentList.length > 0) {
      result.push({ type: 'list', items: currentList });
    }

    return result;
  };

  return (
    <Layout>
      <div className="privacy-page">
        <div className="privacy-hero">
          <h1>{content.title}</h1>
        </div>

        <div className="privacy-content">
          {content.sections.map((section, index) => (
            <section key={index} className="privacy-section">
              <div className="section-header">
                {section.number && <span className="section-number">{section.number}</span>}
                {section.title && <h2>{section.title}</h2>}
              </div>

              <div className="section-content">
                {parseContent(section.content).map((item, i) => {
                  if (item.type === 'list') {
                    return (
                      <ul key={i} className="privacy-list">
                        {item.items.map((listItem: string, j: number) => (
                          <li key={j}>{listItem}</li>
                        ))}
                      </ul>
                    );
                  }
                  return (
                    <p key={i} className="privacy-paragraph">
                      {item.content}
                    </p>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </Layout>
  )
}

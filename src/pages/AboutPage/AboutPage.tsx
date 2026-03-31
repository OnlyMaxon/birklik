import React from 'react'
import { useLanguage } from '../../context'
import { Layout } from '../../layouts'
import './AboutPage.css'

const aboutContent = {
  az: {
    title: 'Haqqımızda',
    sections: [
      {
        title: 'Birklik.az Nədir?',
        content: 'Birklik.az – ölkə daxilində günlük və qısamüddətli kirayə bazarını daha əlçatan, təhlükəsiz və rahat etmək məqsədilə yaradılmış rəqəmsal platformadır. Layihəmizin əsas məqsədi şəhər və rayonlarda yerləşən evləri, villaları, istirahət mərkəzlərini və digər məkanları bir məkanda toplayaraq istifadəçilərə sürətli və etibarlı bron imkanı təqdim etməkdir.'
      },
      {
        title: 'Missiyamız',
        content: 'Biz inanırıq ki, kirayə prosesi sadə, şəffaf və güvənli olmalıdır. Bu səbəbdən Birklik.az platformasında yerləşdirilən elanların düzgünlüyünə və aktuallığına xüsusi diqqət yetirilir. İstifadəçilər istədikləri məkanı rahatlıqla axtara, müqayisə edə və vaxt itirmədən bron edə bilərlər.'
      },
      {
        title: 'Platformamız',
        content: 'Platformamız həm kirayə götürənlər, həm də əmlak sahibləri üçün faydalı bir mühit yaradır. Əmlak sahibləri öz məkanlarını daha geniş auditoriyaya təqdim edərək gəlir əldə edə, istifadəçilər isə ehtiyaclarına uyğun ən uyğun variantı rahatlıqla tapa bilirlər.'
      },
      {
        title: 'Gələcəkdə',
        content: 'Gələcək planlarımız arasında xidmət sahəmizi genişləndirərək və digər istirahət xidmətlərini də platformaya inteqrasiya etmək yer alır. Məqsədimiz istifadəçilərə bir platforma üzərindən bütün istirahət və planlaşdırma ehtiyaclarını qarşılamaq imkanı yaratmaqdır.'
      },
      {
        title: 'Əsas Dəyərlərimiz',
        content: 'Etibarlılıq və şəffaflıq, İstifadəçi məmnuniyyəti, Rahat və sürətli xidmət, Davamlı inkişaf və yenilik',
        isList: true
      },
      {
        title: '',
        content: 'Biz sizin rahatlığınız və güvəniniz üçün çalışırıq.'
      }
    ]
  },
  ru: {
    title: 'О нас',
    sections: [
      {
        title: 'Что такое Birklik.az?',
        content: 'Birklik.az — это цифровая платформа, созданная с целью сделать рынок краткосрочной аренды в стране более доступным, удобным и безопасным. Наш проект объединяет дома, виллы, зоны отдыха и другие объекты в городах и регионах, предоставляя пользователям возможность быстрого и надежного бронирования.'
      },
      {
        title: 'Наша миссия',
        content: 'Мы считаем, что процесс аренды должен быть простым, прозрачным и безопасным. Поэтому мы уделяем особое внимание актуальности и достоверности размещаемых объявлений. Пользователи могут легко находить подходящие варианты, сравнивать их и бронировать без лишних затрат времени.'
      },
      {
        title: 'Наша платформа',
        content: 'Платформа Birklik.az создает удобную среду как для арендаторов, так и для владельцев недвижимости. Владельцы получают возможность представить свои объекты широкой аудитории и увеличить доход, а пользователи — быстро находить подходящее жилье для отдыха.'
      },
      {
        title: 'В будущем',
        content: 'В будущем мы планируем расширить наши услуги, добавив и других сервисов для отдыха. Наша цель — создать единую платформу для планирования отдыха и досуга.'
      },
      {
        title: 'Наши основные ценности',
        content: 'Надежность и прозрачность, Удовлетворенность пользователей, Удобство и скорость сервиса, Постоянное развитие и инновации',
        isList: true
      },
      {
        title: '',
        content: 'Мы работаем для вашего комфорта и доверия.'
      }
    ]
  },
  en: {
    title: 'About Us',
    sections: [
      {
        title: 'What is Birklik.az?',
        content: 'Birklik.az is a digital platform created to make the short-term rental market more accessible, convenient, and secure. Our mission is to bring together houses, villas, holiday homes, and other properties across cities and regions, allowing users to easily find and book the perfect place.'
      },
      {
        title: 'Our Mission',
        content: 'We believe that the rental process should be simple, transparent, and trustworthy. That is why we focus on ensuring that all listings on our platform are accurate and up to date. Users can search, compare, and book properties quickly and efficiently.'
      },
      {
        title: 'Our Platform',
        content: 'Birklik.az provides value for both guests and property owners. Owners can showcase their properties to a wider audience and generate income, while users can easily find the best options that suit their needs.'
      },
      {
        title: 'In the Future',
        content: 'In the future, we plan to expand our services by adding other leisure-related offerings. Our goal is to become an all-in-one platform for travel, leisure, and lifestyle planning.'
      },
      {
        title: 'Our Core Values',
        content: 'Trust and transparency, Customer satisfaction, Fast and user-friendly service, Continuous innovation and growth',
        isList: true
      },
      {
        title: '',
        content: 'We are committed to providing a reliable and comfortable experience for our users.'
      }
    ]
  }
}

export const AboutPage: React.FC = () => {
  const { language } = useLanguage()
  const content = aboutContent[language as keyof typeof aboutContent] || aboutContent.en

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

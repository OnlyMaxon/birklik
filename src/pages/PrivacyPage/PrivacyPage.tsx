import React from 'react'
import { useLanguage } from '../../context'
import { Layout } from '../../layouts'
import './PrivacyPage.css'

const privacyContent = {
  az: {
    title: 'Məxfilik Siyasəti',
    sections: [
      {
        title: 'Giriş',
        content: 'Birklik.az istifadəçilərinin şəxsi məlumatlarının qorunmasına böyük önəm verir. Bu məxfilik siyasəti platformamızdan istifadə zamanı toplanan məlumatların necə istifadə olunduğunu və qorunduğunu izah edir.'
      },
      {
        title: 'Toplanan məlumatlar',
        content: 'Ad və soyad, Əlaqə məlumatları (telefon nömrəsi, e-poçt ünvanı), Rezervasiya və sifariş məlumatları, Saytdan istifadə zamanı texniki məlumatlar (IP ünvanı, brauzer məlumatları və s.)',
        isList: true
      },
      {
        title: 'Məlumatların istifadə məqsədi',
        content: 'Rezervasiyaların həyata keçirilməsi, İstifadəçi ilə əlaqə saxlanılması, Xidmət keyfiyyətinin yaxşılaşdırılması, Təhlükəsizliyin təmin edilməsi',
        isList: true
      },
      {
        title: 'Məlumatların qorunması',
        content: 'Biz istifadəçi məlumatlarının təhlükəsizliyini təmin etmək üçün müasir texniki və təşkilati tədbirlər görürük. Məlumatlar üçüncü şəxslərlə yalnız qanunvericiliyin tələb etdiyi hallarda və ya xidmətin göstərilməsi üçün zəruri olduqda paylaşılır.'
      },
      {
        title: 'Cookie-lər və texnologiyalar',
        content: 'Saytımız istifadəçi təcrübəsini yaxşılaşdırmaq üçün cookie-lərdən istifadə edə bilər. İstifadəçilər brauzer ayarlarından cookie istifadəsini məhdudlaşdıra bilərlər.'
      },
      {
        title: 'Üçüncü tərəf xidmətləri',
        content: 'Bəzi hallarda ödəniş sistemləri və digər xidmətlər üçün üçüncü tərəf platformalardan istifadə edilə bilər. Bu xidmətlərin öz məxfilik siyasətləri mövcuddur.'
      },
      {
        title: 'İstifadəçi hüquqları',
        content: 'İstifadəçilər öz şəxsi məlumatlarına baxmaq, onları yeniləmək və ya silinməsini tələb etmək hüququna malikdirlər.'
      },
      {
        title: 'Dəyişikliklər',
        content: 'Birklik.az bu məxfilik siyasətini istənilən vaxt yeniləmək hüququnu özündə saxlayır. Dəyişikliklər saytda dərc edildiyi andan qüvvəyə minir.'
      },
      {
        title: 'Əlaqə',
        content: 'Məxfilik siyasəti ilə bağlı suallarınız yaranarsa, bizimlə sayt üzərindən əlaqə saxlaya bilərsiniz.'
      }
    ]
  },
  ru: {
    title: 'Политика конфиденциальности',
    sections: [
      {
        title: 'Введение',
        content: 'Birklik.az придает большое значение защите персональных данных своих пользователей. Настоящая политика конфиденциальности объясняет, как собираются, используются и защищаются данные при использовании нашей платформы.'
      },
      {
        title: 'Собираемые данные',
        content: 'Имя и фамилия, Контактная информация (номер телефона, адрес электронной почты), Информация о бронированиях и заказах, Техническая информация при использовании сайта (IP-адрес, данные браузера и др.)',
        isList: true
      },
      {
        title: 'Цели использования данных',
        content: 'Осуществления бронирований, Связи с пользователями, Улучшения качества обслуживания, Обеспечения безопасности',
        isList: true
      },
      {
        title: 'Защита данных',
        content: 'Мы применяем современные технические и организационные меры для защиты данных пользователей. Данные могут передаваться третьим лицам только при соблюдении законодательства или для предоставления услуг.'
      },
      {
        title: 'Файлы cookie и технологии',
        content: 'Сайт использует cookie для улучшения пользовательского опыта. Пользователи могут ограничить использование cookie через настройки браузера.'
      },
      {
        title: 'Сервисы третьих сторон',
        content: 'В некоторых случаях для оплаты и других услуг могут использоваться сторонние платформы с собственными политиками конфиденциальности.'
      },
      {
        title: 'Права пользователей',
        content: 'Пользователи имеют право просматривать, обновлять или требовать удаление своих персональных данных.'
      },
      {
        title: 'Изменения',
        content: 'Birklik.az оставляет за собой право вносить изменения в политику конфиденциальности. Изменения вступают в силу с момента публикации на сайте.'
      },
      {
        title: 'Контакты',
        content: 'Если у вас возникнут вопросы по политике конфиденциальности, свяжитесь с нами через форму обратной связи на сайте.'
      }
    ]
  },
  en: {
    title: 'Privacy Policy',
    sections: [
      {
        title: 'Introduction',
        content: 'Birklik.az values the privacy and protection of its users\' personal data. This Privacy Policy explains how information is collected, used, and safeguarded when using our platform.'
      },
      {
        title: 'Information We Collect',
        content: 'Name and surname, Contact information (phone number, email address), Booking and order details, Technical information from site usage (IP address, browser data, etc.)',
        isList: true
      },
      {
        title: 'How We Use Your Information',
        content: 'Processing bookings, Communicating with users, Improving service quality, Ensuring security',
        isList: true
      },
      {
        title: 'Data Protection',
        content: 'We implement modern technical and organizational measures to protect users\' data. Information may only be shared with third parties when required by law or necessary to provide services.'
      },
      {
        title: 'Cookies and Technologies',
        content: 'The website may use cookies to enhance user experience. Users can limit cookies via browser settings.'
      },
      {
        title: 'Third-Party Services',
        content: 'Payment systems and other services may use third-party platforms that have their own privacy policies.'
      },
      {
        title: 'User Rights',
        content: 'Users have the right to access, update, or request the deletion of their personal data.'
      },
      {
        title: 'Changes',
        content: 'Birklik.az reserves the right to update this Privacy Policy at any time. Changes take effect once posted on the website.'
      },
      {
        title: 'Contact',
        content: 'For questions regarding this Privacy Policy, users can contact us via the website\'s contact form.'
      }
    ]
  }
}

export const PrivacyPage: React.FC = () => {
  const { language } = useLanguage()
  const content = privacyContent[language as keyof typeof privacyContent] || privacyContent.en

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

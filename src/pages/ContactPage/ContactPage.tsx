import React from 'react'
import { useLanguage } from '../../context'
import './ContactPage.css'

const contactContent = {
  az: {
    title: 'Əlaqə',
    intro: 'Sizə xidmət göstərməkdən məmnunuq! Hər hansı sual, təklif və ya dəstək üçün bizimlə əlaqə saxlaya bilərsiniz:',
    phone: 'Telefon',
    email: 'E-poçt',
    address: 'Ünvan',
    phoneNumber: '+994 55 660 00 86',
    emailAddress: 'info@birklik.az',
    addressValue: 'Bakı şəhəri, Azərbaycan',
    workingHours: 'İş saatları',
    mondayFriday: 'Bazar ertəsi – Cümə: 09:00 – 18:00',
    weekendClosed: 'Şənbə – Bazar: bağlıdır',
    socialNetworks: 'Sosial şəbəkələr',
    facebook: 'facebook.com/birklikaz',
    instagram: 'instagram.com/birklikaz',
    closing: 'Biz sizin suallarınıza tez bir zamanda cavab verməyə çalışırıq və hər zaman xidmətinizdəyik.'
  },
  ru: {
    title: 'Контакты',
    intro: 'Мы рады помочь вам! Для вопросов, предложений или поддержки свяжитесь с нами:',
    phone: 'Телефон',
    email: 'Электронная почта',
    address: 'Адрес',
    phoneNumber: '+994 55 660 00 86',
    emailAddress: 'info@birklik.az',
    addressValue: 'город Баку, Азербайджан',
    workingHours: 'Часы работы',
    mondayFriday: 'Понедельник – Пятница: 09:00 – 18:00',
    weekendClosed: 'Суббота – Воскресенье: выходной',
    socialNetworks: 'Социальные сети',
    facebook: 'facebook.com/birklikaz',
    instagram: 'instagram.com/birklikaz',
    closing: 'Мы стараемся отвечать на ваши вопросы как можно быстрее и всегда готовы помочь.'
  },
  en: {
    title: 'Contact',
    intro: 'We are happy to assist you! For any questions, suggestions, or support, please contact us:',
    phone: 'Phone',
    email: 'Email',
    address: 'Address',
    phoneNumber: '+994 55 660 00 86',
    emailAddress: 'info@birklik.az',
    addressValue: 'Baku, Azerbaijan',
    workingHours: 'Working Hours',
    mondayFriday: 'Monday – Friday: 09:00 – 18:00',
    weekendClosed: 'Saturday – Sunday: Closed',
    socialNetworks: 'Social Media',
    facebook: 'facebook.com/birklikaz',
    instagram: 'instagram.com/birklikaz',
    closing: 'We aim to respond to your inquiries promptly and are always here to assist you.'
  }
}

export const ContactPage: React.FC = () => {
  const { language } = useLanguage()
  const content = contactContent[language as keyof typeof contactContent] || contactContent.en

  return (
    <div className="contact-page">
      <div className="contact-hero">
        <h1>{content.title}</h1>
      </div>

      <div className="contact-content">
        <p className="contact-intro">{content.intro}</p>

        <div className="contact-info">
          <div className="contact-item">
            <h3 className="contact-label">{content.phone}</h3>
            <a href={`tel:${content.phoneNumber.replace(/\s/g, '')}`} className="contact-link">
              {content.phoneNumber}
            </a>
          </div>

          <div className="contact-item">
            <h3 className="contact-label">{content.email}</h3>
            <a href={`mailto:${content.emailAddress}`} className="contact-link">
              {content.emailAddress}
            </a>
          </div>

          <div className="contact-item">
            <h3 className="contact-label">{content.address}</h3>
            <p className="contact-value">{content.addressValue}</p>
          </div>
        </div>

        <div className="contact-section">
          <h2>{content.workingHours}</h2>
          <div className="working-hours">
            <p>{content.mondayFriday}</p>
            <p>{content.weekendClosed}</p>
          </div>
        </div>

        <div className="contact-section">
          <h2>{content.socialNetworks}</h2>
          <div className="social-links">
            <a href="https://facebook.com/birklikaz" target="_blank" rel="noopener noreferrer" className="social-item">
              Facebook: {content.facebook}
            </a>
            <a href="https://instagram.com/birklikaz" target="_blank" rel="noopener noreferrer" className="social-item">
              Instagram: {content.instagram}
            </a>
          </div>
        </div>

        <p className="contact-closing">{content.closing}</p>
      </div>
    </div>
  )
}

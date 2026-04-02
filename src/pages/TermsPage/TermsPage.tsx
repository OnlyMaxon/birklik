import React from 'react'
import { useLanguage } from '../../context'
import { Layout } from '../../layouts'
import './TermsPage.css'

export const TermsPage: React.FC = () => {
  const { language } = useLanguage()

  const terms = {
    en: {
      title: 'Terms and Conditions',
      lastUpdated: 'Last Updated: 30.03.2026',
      sections: [
        {
          number: '1',
          title: 'General Provisions',
          content: `1.1. These Terms and Conditions are binding for all users of the "birklik.az" platform.
1.2. By registering on or using the website, you agree to these Terms and Conditions.
1.3. If you do not agree, you must refrain from using the platform.`
        },
        {
          number: '2',
          title: 'Description of Services',
          content: `2.1. birklik.az provides users with the ability to list and search for properties for daily and short-term rentals, including houses, villas, cottages, and recreational properties.
2.2. The platform acts solely as an intermediary and is not a party to any rental agreement.`
        },
        {
          number: '3',
          title: 'Registration and Account',
          content: `3.1. Users must provide accurate and up-to-date information.
3.2. Users are responsible for maintaining the confidentiality and security of their accounts.
3.3. Accounts containing false or misleading information may be suspended or terminated.`
        },
        {
          number: '4',
          title: 'Listing Policy',
          content: `4.1. The person posting a listing ("Host") must:
• Provide accurate and complete information about the property
• Upload real and truthful images
• Clearly state pricing and conditions

4.2. It is prohibited to:
• Post false or misleading listings
• Publish properties without authorization
• Use properties for illegal activities

4.3. Reservation Accuracy and Obligations
• If the Host accepts reservations through other platforms or private channels, they must promptly update and mark those dates as unavailable on birklik.az.
• If the Host fails to do so and the property remains available on the platform, and another user makes a reservation for those same dates, the Host is obligated to honor that booking and provide the property, bearing full responsibility.
• Failure to comply with this rule may result in the suspension or blocking of the Host's account.

4.4. The platform reserves the right to remove or edit any listing at its discretion.`
        },
        {
          number: '5',
          title: 'Payments and Listing Types',
          content: `5.1. Both free and paid listings are available on the platform.
5.2. Fees for paid services (e.g., premium listings) may be non-refundable, except in specific cases.`
        },
        {
          number: '6',
          title: 'Rental Relationships',
          content: `6.1. Any rental agreement is concluded directly between the Host and the Guest.
6.2. birklik.az is not responsible for disputes between users.
6.3. Users are encouraged to enter into a written or electronic agreement.`
        },
        {
          number: '7',
          title: 'Rights and Obligations of Hosts',
          content: `Hosts must:
• Provide the property as described in the listing
• Accept guests at the agreed time
• Not change the price without valid reason

Hosts have the right to:
• Refuse guests who violate rules
• Request compensation for damages`
        },
        {
          number: '8',
          title: 'Rights and Obligations of Guests',
          content: `8.1. Guests must:
• Use the property responsibly
• Follow all applicable rules
• Avoid causing damage

8.2. Guests have the right to:
• Receive services as described
• Submit complaints in case of misrepresentation

8.3. Reservation Changes and Cancellation Policy
• Up to 96 hours before check-in: The Renter may modify or cancel the reservation without any penalty.
• Within 72 hours before check-in: If the reservation is modified or canceled, a penalty equal to one night's stay will be charged.
• Within 48 hours before check-in: The reservation can only be canceled and cannot be modified. In this case, the full amount will be charged as a penalty and is non-refundable.`
        },
        {
          number: '9',
          title: 'Limitation of Liability',
          content: `9.1. birklik.az does not guarantee the accuracy of listings.
9.2. The platform is not liable for:
• Financial losses
• Property damage
• Disputes between users`
        },
        {
          number: '10',
          title: 'Complaints and Disputes',
          content: `10.1. Users may submit complaints through the platform.
10.2. Disputes shall be governed by the laws of the Republic of Azerbaijan.`
        },
        {
          number: '11',
          title: 'Account Suspension',
          content: `The platform may suspend or terminate accounts in cases of:
• Violation of these Terms
• Fraudulent activity
• Harm caused to other users`
        },
        {
          number: '12',
          title: 'Privacy',
          content: `User data is protected in accordance with the Privacy Policy.`
        },
        {
          number: '13',
          title: 'Changes',
          content: `The platform reserves the right to modify these Terms at any time. Updated versions become effective upon publication.`
        },
        {
          number: '14',
          title: 'Contact and Payment Responsibility',
          content: `**14. Contact and Payment Responsibility**
**For inquiries:**
**Email: info@birklik.az**

**14.1. birklik.az acts solely as an intermediary platform that enables communication between users (Host and Guest) and does not participate in any payment processes.**

**14.2. All payments related to listings are made directly between the Host and the Guest.**

**14.3. birklik.az shall not be held liable for:**
**• the execution or failure of any payments**
**• delays or refunds of payments**
**• fraud, misrepresentation, or any financial disputes**

**14.4. Users acknowledge and accept that they bear all risks associated with making payments.**

**14.5. birklik.az does not receive, hold, or transfer funds and does not act as a financial intermediary between users.**`
        }
      ]
    },
    az: {
      title: 'Şərtlər və Qaydalar',
      lastUpdated: 'Son yenilənmə tarixi: 30.03.2026',
      sections: [
        {
          number: '1',
          title: 'Ümumi müddəalar',
          content: `1.1. Bu Şərtlər və Qaydalar "birklik.az" platformasının bütün istifadəçiləri üçün məcburidir.
1.2. Saytda qeydiyyatdan keçməklə və ya ondan istifadə etməklə siz bu Şərtlər və Qaydalarla razılaşmış sayılırsınız.
1.3. Əgər bu şərtlərlə razı deyilsinizsə, platformadan istifadə etməməlisiniz.`
        },
        {
          number: '2',
          title: 'Xidmətlərin təsviri',
          content: `2.1. birklik.az istifadəçilərə günlük və qısa müddətli kirayə üçün ev, villa, kottec və istirahət obyektlərini yerləşdirmək və axtarmaq imkanı yaradır.
2.2. Platforma yalnız vasitəçi rolunu oynayır və heç bir kirayə müqaviləsinin birbaşa tərəfi deyil.`
        },
        {
          number: '3',
          title: 'Qeydiyyat və hesab',
          content: `3.1. İstifadəçilər düzgün və aktual məlumat təqdim etməlidir.
3.2. İstifadəçilər öz hesablarının təhlükəsizliyinə və məxfiliyinə görə məsuliyyət daşıyırlar.
3.3. Saxta və ya yanıltıcı məlumat təqdim edən hesablar bloklana və ya ləğv edilə bilər.`
        },
        {
          number: '4',
          title: 'Elan siyasəti',
          content: `4.1. Elan yerləşdirən şəxs ("Ev Sahibi") aşağıdakıları təmin etməlidir:
• Əmlak haqqında doğru və tam məlumat vermək
• Real və həqiqi şəkillər yerləşdirmək
• Qiymət və şərtləri açıq şəkildə göstərmək

4.2. Aşağıdakılar qadağandır:
• Saxta və ya yanıltıcı elan yerləşdirmək
• İcazəsiz əmlak paylaşmaq
• Əmlakı qanunsuz fəaliyyətlər üçün istifadə etmək

4.3. Rezervasiya uyğunluğu və öhdəliklər
• Əgər Ev Sahibi digər platformalar və ya şəxsi kanallar vasitəsilə rezervasiya qəbul edirsə, həmin tarixləri dərhal birklik.az platformasında qeydə almalı və əlçatmaz kimi qeyd etməlidir.
• Əgər Ev Sahibi bunu etməzsə və həmin tarixlər platformada açıq qalarsa və başqa bir istifadəçi həmin tarixlər üçün rezervasiya edərsə, Ev Sahibi həmin bronu qəbul edib əmlakı təqdim etməyə borcludur və tam məsuliyyət daşıyır.
• Bu qaydanın pozulması Ev Sahibinin hesabının bloklanması ilə nəticələnə bilər.

4.4. Platforma istənilən elanı silmək və ya redaktə etmək hüququnu özündə saxlayır.`
        },
        {
          number: '5',
          title: 'Ödənişlər və elan növləri',
          content: `5.1. Platformada ödənişli və ödənişsiz elan yerləşdirmək mümkündür.
5.2. Ödənişli xidmətlər (məsələn, premium elanlar) üçün edilən ödənişlər xüsusi hallar istisna olmaqla geri qaytarılmaya bilər.`
        },
        {
          number: '6',
          title: 'Kirayə münasibətləri',
          content: `6.1. Kirayə müqaviləsi birbaşa Ev Sahibi və Kirayəçi arasında bağlanır.
6.2. birklik.az istifadəçilər arasında yaranan mübahisələrə görə məsuliyyət daşımır.
6.3. İstifadəçilərə yazılı və ya elektron müqavilə bağlamaq tövsiyə olunur.`
        },
        {
          number: '7',
          title: 'Ev Sahiblərinin hüquq və vəzifələri',
          content: `Ev Sahibi aşağıdakıları təmin etməlidir:
• Əmlakı elanda göstərildiyi kimi təqdim etmək
• Razılaşdırılmış vaxtda kirayəçini qəbul etmək
• Qiyməti əsassız şəkildə dəyişməmək

Ev Sahibi hüquqludur:
• Qaydaları pozan kirayəçini qəbul etməməyə
• Əmlaka zərər vurulduqda kompensasiya tələb etməyə`
        },
        {
          number: '8',
          title: 'Kirayəçilərin hüquq və vəzifələri',
          content: `8.1. Kirayəçilər aşağıdakıları etməlidir:
• Əmlakdan düzgün istifadə etmək
• Qaydalara riayət etmək
• Əmlaka zərər vurmamak

8.2. Kirayəçilərin hüquqları:
• Elan edilən şərtlərə uyğun xidmət almak
• Aldadılma halında şikayət etmək

8.3. Rezervasiyanın dəyişdirilməsi və ləğvi siyasəti
• Giriş tarixindən 96 saat əvvələdək: Rezervasiya dəyişdirilə və ya ləğv edilə bilər. Bu halda heç bir cərimə tətbiq olunmur.
• Girişə 72 saat qaldıqda: Rezervasiya dəyişdirildikdə və ya ləğv edildikdə 1 gecəlik ödəniş məbləği cərimə kimi tutulur.
• Girişə 48 saat qaldıqda: Rezervasiya yalnız ləğv edilə bilər, dəyişiklik mümkün deyil. Bu halda tam məbləğ cərimə kimi saxlanılır və geri qaytarılmır.`
        },
        {
          number: '9',
          title: 'Məsuliyyətin məhdudlaşdırılması',
          content: `9.1. birklik.az elanların doğruluğuna tam zəmanət vermir.
9.2. Platforma aşağıdakılara görə məsuliyyət daşımır:
• Maliyyə itkiləri
• Əmlak zərərləri
• İstifadəçilər arasında yaranan mübahisələr`
        },
        {
          number: '10',
          title: 'Şikayətlər və mübahisələr',
          content: `10.1. İstifadəçilər şikayətlərini platforma vasitəsilə təqdim edə bilərlər.
10.2. Mübahisələr Azərbaycan Respublikasının qanunvericiliyinə uyğun həll olunur.`
        },
        {
          number: '11',
          title: 'Hesabın bloklanması',
          content: `Platforma aşağıdakı hallarda hesabı bloklaya və ya ləğv edə bilər:
• Bu Şərtlərin pozulması
• Saxta fəaliyyət
• Digər istifadəçilərə zərər vurulması`
        },
        {
          number: '12',
          title: 'Məxfilik',
          content: `İstifadəçi məlumatları Məxfilik Siyasətinə uyğun olaraq qorunur.`
        },
        {
          number: '13',
          title: 'Dəyişikliklər',
          content: `Platforma bu Şərtləri istənilən vaxt dəyişdirmək hüququna malikdir. Yenilənmiş versiya dərc edildiyi andan qüvvəyə minir.`
        },
        {
          number: '14',
          title: 'Əlaqə və ödənişlər üzrə məsuliyyət',
          content: `**14. Əlaqə və ödənişlər üzrə məsuliyyət**
**Suallar üçün:**
**Email: info@birklik.az**

**14.1. birklik.az platforması istifadəçilər (Ev Sahibi və Kirayəçi) arasında yalnız əlaqə yaradılmasını təmin edən vasitəçi platformadır və heç bir ödəniş prosesində iştirak etmir.**

**14.2. Platformada yerləşdirilən elanlar üzrə bütün ödənişlər birbaşa olaraq Ev Sahibi və Kirayəçi arasında həyata keçirilir.**

**14.3. birklik.az heç bir halda aşağıdakılara görə məsuliyyət daşımır:**
**• Ödənişlərin həyata keçirilməsi və ya keçirilməməsi**
**• Ödənişlərin gecikməsi və ya qaytarılması**
**• Aldadılma, dələduzluq və ya digər maliyyə mübahisələri**

**14.4. İstifadəçilər ödəniş əməliyyatlarını həyata keçirərkən bütün riskləri öz üzərlərinə götürdüklərini qəbul edirlər.**

**14.5. birklik.az heç bir ödənişi qəbul etmir, saxlamır və ya ötürmür və tərəflər arasında maliyyə vasitəçisi kimi çıxış etmir.**`
        }
      ]
    },
    ru: {
      title: 'Условия и положения',
      lastUpdated: 'Дата последнего обновления: 30.03.2026',
      sections: [
        {
          number: '1',
          title: 'Общие положения',
          content: `1.1. Настоящие Условия и положения являются обязательными для всех пользователей платформы «birklik.az».
1.2. Регистрируясь на сайте или используя его, вы соглашаетесь с данными Условиями.
1.3. Если вы не согласны с этими условиями, вы должны воздержаться от использования платформы.`
        },
        {
          number: '2',
          title: 'Описание услуг',
          content: `2.1. Платформа birklik.az предоставляет пользователям возможность размещать и искать объявления о краткосрочной и посуточной аренде недвижимости, включая дома, виллы, коттеджи и объекты отдыха.
2.2. Платформа выступает исключительно в роли посредника и не является стороной договора аренды.`
        },
        {
          number: '3',
          title: 'Регистрация и аккаунт',
          content: `3.1. Пользователи обязаны предоставлять точную и актуальную информацию.
3.2. Пользователи несут ответственность за безопасность и конфиденциальность своих аккаунтов.
3.3. Аккаунты с ложной или вводящей в заблуждение информацией могут быть заблокированы или удалены.`
        },
        {
          number: '4',
          title: 'Политика размещения объявлений',
          content: `4.1. Лицо, размещающее объявление («Хозяин»), обязано:
• Предоставлять точную и полную информацию о недвижимости
• Загружать реальные и достоверные фотографии
• Четко указывать цену и условия

4.2. Запрещается:
• Размещать ложные или вводящие в заблуждение объявления
• Публиковать объекты без разрешения
• Использовать объекты для незаконной деятельности

4.3. Точность бронирования и обязательства
• Если Хозяин принимает бронирования через другие платформы или частные каналы, он обязан незамедлительно обновить информацию и отметить соответствующие даты как недоступные на birklik.az.
• Если Хозяин этого не делает, и объект остается доступным на платформе, а другой пользователь осуществляет бронирование на те же даты, Хозяин обязан подтвердить данное бронирование, предоставить объект и несет полную ответственность.
• Нарушение данного правила может привести к блокировке аккаунта Хозяина.

4.4. Платформа оставляет за собой право удалять или редактировать любые объявления по своему усмотрению.`
        },
        {
          number: '5',
          title: 'Платежи и типы объявлений',
          content: `5.1. На платформе доступны как бесплатные, так и платные объявления.
5.2. Оплата за платные услуги (например, премиум-размещение), как правило, не подлежит возврату, за исключением отдельных случаев.`
        },
        {
          number: '6',
          title: 'Арендные отношения',
          content: `6.1. Договор аренды заключается непосредственно между Хозяином и Арендатором.
6.2. birklik.az не несет ответственности за споры между пользователями.
6.3. Пользователям рекомендуется заключать письменные или электронные договоры.`
        },
        {
          number: '7',
          title: 'Права и обязанности Хозяев',
          content: `Хозяин обязан:
• Предоставить объект в соответствии с описанием
• Принять арендатора в согласованное время
• Не изменять цену без обоснованной причины

Хозяин имеет право:
• Отказать в заселении арендаторам, нарушающим правила
• Требовать компенсацию за причиненный ущерб`
        },
        {
          number: '8',
          title: 'Права и обязанности Арендаторов',
          content: `8.1. Арендаторы обязаны:
• Использовать объект надлежащим образом
• Соблюдать установленные правила
• Не причинять ущерб имуществу

8.2. Арендаторы имеют право:
• Получать услуги в соответствии с описанием
• Подавать жалобы в случае введения в заблуждение

8.3. Политика изменения и отмены бронирования
• За 96 часов до заезда: Бронирование может быть изменено или отменено без штрафа.
• За 72 часа до заезда: При изменении или отмене взимается штраф в размере стоимости одной ночи проживания.
• За 48 часов до заезда: Бронирование может быть только отменено, изменение невозможно. В этом случае вся сумма удерживается в качестве штрафа и не возвращается.`
        },
        {
          number: '9',
          title: 'Ограничение ответственности',
          content: `9.1. birklik.az не гарантирует точность размещенных объявлений.
9.2. Платформа не несет ответственность за:
• Финансовые потери
• Ущерб имуществу
• Споры между пользователями`
        },
        {
          number: '10',
          title: 'Жалобы и споры',
          content: `10.1. Пользователи могут направлять жалобы через платформу.
10.2. Споры регулируются законодательством Азербайджанской Республики.`
        },
        {
          number: '11',
          title: 'Блокировка аккаунта',
          content: `Платформа может заблокировать или удалить аккаунт в следующих случаях:
• Нарушение настоящих Условий
• Мошенническая деятельность
• Причинение вреда другим пользователям`
        },
        {
          number: '12',
          title: 'Конфиденциальность',
          content: `Данные пользователей защищаются в соответствии с Политикой конфиденциальности.`
        },
        {
          number: '13',
          title: 'Изменения',
          content: `Платформа оставляет за собой право изменять данные Условия в любое время. Обновленная версия вступает в силу с момента публикации.`
        },
        {
          number: '14',
          title: 'Контакты и ответственность за платежи',
          content: `**14. Связь и ответственность за платежи**
**По всем вопросам:**
**Email: info@birklik.az**

**14.1. Платформа birklik.az выступает исключительно как посредник для установления связи между пользователями (Арендодателем и Арендатором) и не участвует в процессе оплаты.**

**14.2. Все платежи по размещённым объявлениям осуществляются напрямую между Арендодателем и Арендатором.**

**14.3. birklik.az не несёт ответственности за:**
**• осуществление или неосуществление платежей**
**• задержки или возвраты платежей**
**• мошенничество, обман или иные финансовые споры**

**14.4. Пользователи принимают на себя все риски, связанные с осуществлением платежей.**

**14.5. birklik.az не принимает, не хранит и не переводит денежные средства и не выступает в качестве платёжного посредника между сторонами.**`
        }
      ]
    }
  }

  const currentTerms = terms[language as keyof typeof terms] || terms.en

  const renderContent = (text: string) => {
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

  return (
    <Layout>
      <section className="terms-hero">
        <div className="container">
          <h1 className="terms-title">{currentTerms.title}</h1>
          <p className="terms-last-updated">{currentTerms.lastUpdated}</p>
        </div>
      </section>

      <section className="terms-content">
        <div className="container">
          <div className="terms-body">
            {currentTerms.sections.map((section) => (
              <div key={section.number} className="terms-section">
                <h2 className="terms-section-title">
                  <span className="section-number">{section.number}.</span>
                  {section.title}
                </h2>
                <div className="terms-section-content">
                  {section.content.split('\n').map((line, index) => (
                    <p key={index} className={line.startsWith('•') ? 'bullet-point' : ''}>
                      {renderContent(line)}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  )
}

import {Layout} from '@/components/app-layout'
import {Link} from '@/lib/navigation'
import '../payment.css'

type CallbackPageProps = {
  searchParams: Promise<{payment?: string | string[]}>
}

const RESULT_CONTENT = {
  success: {
    icon: '✓',
    title: 'Ödəniş uğurludur',
    body: 'Paket elanınıza tətbiq edildi.',
    tone: 'success',
  },
  reversed: {
    icon: '↩',
    title: 'Ödəniş geri qaytarıldı',
    body: 'Əməliyyat ləğv edildi və geri qaytarılma qeydə alındı.',
    tone: 'neutral',
  },
  reversal_failed: {
    icon: '!',
    title: 'Geri qaytarma tamamlanmadı',
    body: 'Dəstək xidməti ilə əlaqə saxlayın.',
    tone: 'error',
  },
  failed: {
    icon: '×',
    title: 'Ödəniş tamamlanmadı',
    body: 'Kartdan vəsait tutulmayıb. Yenidən cəhd edə bilərsiniz.',
    tone: 'error',
  },
  error: {
    icon: '!',
    title: 'Ödənişi təsdiqləmək mümkün olmadı',
    body: 'Əməliyyatın vəziyyətini dəqiqləşdirmək üçün dəstək xidməti ilə əlaqə saxlayın.',
    tone: 'error',
  },
} as const

export default async function PaymentCallbackPage({searchParams}: CallbackPageProps) {
  const params = await searchParams
  const key = typeof params.payment === 'string' && params.payment in RESULT_CONTENT
    ? params.payment as keyof typeof RESULT_CONTENT
    : 'error'
  const result = RESULT_CONTENT[key]

  return (
    <Layout>
      <main className="payment-page">
        <div className="container payment-status card">
          <div className={`payment-status__mark payment-status__mark--${result.tone}`}>{result.icon}</div>
          <h1>{result.title}</h1>
          <p>{result.body}</p>
          <div className="payment-status__actions">
            <Link className="btn btn-primary" to="/dashboard">Kabinetə qayıt</Link>
            {key !== 'success' && <Link className="btn btn-outline" to="/dashboard/payment">Yenidən cəhd et</Link>}
          </div>
        </div>
      </main>
    </Layout>
  )
}
